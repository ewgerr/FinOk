import { bot } from './bot.js';
import { config } from './config.js';
import { Markup } from 'telegraf';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
let workerIntervalId = null;
let lastReminderSweepAt = 0;
const REMINDER_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const deadlineCategoryLabel = {
  fop12: 'ФОП 1-2 група',
  fop3: 'ФОП 3 група',
  tov: 'ТОВ / НПО',
};

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  try { return JSON.parse(payload); } catch { return {}; }
}

function formatDate(date) {
  if (!date) return 'Не вказано';
  return new Date(date).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
}

function escape(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getPayloadMeta(payload) {
  return {
    ...(payload?.__meta && typeof payload.__meta === 'object' ? payload.__meta : {}),
  };
}

function withPayloadMeta(payload, meta) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  return {
    ...safePayload,
    __meta: {
      ...getPayloadMeta(safePayload),
      ...meta,
    },
  };
}

function getRetryDelayMs(attempt) {
  const base = config.notificationWorker.retryBaseMs;
  const max = config.notificationWorker.retryMaxMs;
  const computed = base * 2 ** Math.max(0, attempt - 1);
  return Math.min(computed, max);
}

function canRetryNow(payload, now = Date.now()) {
  const meta = getPayloadMeta(payload);
  const nextRetryAt = meta.nextRetryAt ? Number(new Date(meta.nextRetryAt)) : null;
  if (!nextRetryAt || Number.isNaN(nextRetryAt)) return true;
  return now >= nextRetryAt;
}

function getDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.reminders.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function getTimezoneHourMinute(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.reminders.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);

  return { hour, minute };
}

function isReminderTimeWindow(date = new Date()) {
  const { hour, minute } = getTimezoneHourMinute(date);
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = config.reminders.hour * 60 + config.reminders.minute;
  const diff = Math.abs(currentMinutes - targetMinutes);
  return diff <= config.reminders.windowMinutes;
}

async function getActiveDeadlineSubscriptions() {
  const records = await prisma.notificationLog.findMany({
    where: {
      channel: 'telegram',
      type: { in: ['deadline.subscription', 'deadline.unsubscription'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const latestByPair = new Map();

  for (const record of records) {
    const payload = parsePayload(record.payload);
    const category = payload?.category;
    const recipient = record.recipient;
    if (!recipient || !category) continue;

    const key = `${recipient}:${category}`;
    if (latestByPair.has(key)) continue;
    latestByPair.set(key, {
      recipient,
      category,
      enabled: Boolean(payload.enabled),
    });
  }

  return Array.from(latestByPair.values()).filter((item) => item.enabled);
}

async function alreadyRemindedToday(recipient, category, dayKey) {
  const reminders = await prisma.notificationLog.findMany({
    where: {
      channel: 'telegram',
      type: 'deadline.reminder.daily',
      recipient,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return reminders.some((item) => {
    const payload = parsePayload(item.payload);
    return payload?.category === category && payload?.dayKey === dayKey;
  });
}

function buildDailyReminderText(category) {
  const categoryName = deadlineCategoryLabel[category] || category;
  return [
    '🔔 <b>Нагадування FinOK</b>',
    '───────────────────────────────',
    `Категорія: <b>${escape(categoryName)}</b>`,
    'Перевірте найближчі податкові дедлайни у розділі «Календар».',
    '',
    'Щоб вимкнути нагадування — відкрийте календар і натисніть «Вимкнути нагадування».',
  ].join('\n');
}

async function processDeadlineReminders() {
  const now = Date.now();
  if (now - lastReminderSweepAt < REMINDER_SWEEP_INTERVAL_MS) {
    return;
  }

  if (!isReminderTimeWindow(new Date())) {
    return;
  }

  lastReminderSweepAt = now;

  const subscriptions = await getActiveDeadlineSubscriptions();
  const dayKey = getDayKey(new Date());

  for (const sub of subscriptions) {
    const reminded = await alreadyRemindedToday(sub.recipient, sub.category, dayKey);
    if (reminded) {
      continue;
    }

    try {
      await bot.telegram.sendMessage(
        Number(sub.recipient),
        buildDailyReminderText(sub.category),
        { parse_mode: 'HTML' }
      );

      await prisma.notificationLog.create({
        data: {
          channel: 'telegram',
          type: 'deadline.reminder.daily',
          recipient: sub.recipient,
          status: 'sent',
          sentAt: new Date(),
          payload: JSON.stringify({
            category: sub.category,
            dayKey,
          }),
        },
      });
    } catch (error) {
      console.error(`❌ Deadline reminder failed for ${sub.recipient}/${sub.category}:`, error);
    }
  }
}

async function sendConsultationNotification(notification) {
  const payload = parsePayload(notification.payload);
  const consultId = payload.consultationId || notification.consultationId || 'unknown';

  const message =
`🔔 <b>НОВА ЗАЯВКА З САЙТУ</b>
───────────────────────────────
┌ 👤 <b>Клієнт:</b> ${escape(payload.firstName || 'Не вказано')}
├ 📞 <b>Телефон:</b> <code>${escape(payload.phone || 'Не вказано')}</code>
├ 💼 <b>Послуга:</b> ${escape(payload.serviceName || 'Консультація')}
├ 📂 <b>Категорія:</b> ${escape(payload.serviceCategory || 'Загальна')}
├ 💰 <b>Тип:</b> ${escape(payload.consultationType || 'FREE')}
├ 📅 <b>Бажаний час:</b> ${formatDate(payload.preferredDateTime)}
└ 🆔 <b>ID заявки:</b> <code>${escape(consultId)}</code>`;

  const keyboard = [
    [Markup.button.callback('🙋‍♂️ Взяти в роботу', `admin_take:${consultId}`)],
    [
      Markup.button.callback('✅ Опрацьовано', `admin_done:${consultId}`),
      Markup.button.url('🌐 Відкрити сайт', config.siteUrl),
    ],
  ];

  await bot.telegram.sendMessage(config.teamChatId, message, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(keyboard),
  });
}

async function sendWebsiteQuestionNotification(notification) {
  const payload = parsePayload(notification.payload);
  const questionId = notification.id;

  const message =
`💬 <b>НОВЕ ПИТАННЯ З САЙТУ</b>
───────────────────────────────
┌ 👤 <b>Клієнт:</b> ${escape(payload.firstName || 'Не вказано')}
├ 📧 <b>Email:</b> <code>${escape(payload.email || 'Не вказано')}</code>
├ 📞 <b>Телефон:</b> <code>${escape(payload.phone || 'Не вказано')}</code>
├ 💬 <b>Telegram:</b> ${escape(payload.telegram || 'Не вказано')}
├ 📂 <b>Категорія:</b> ${escape(payload.category || 'Загальне питання')}
├ 🌐 <b>Сторінка:</b> ${escape(payload.sourcePage || 'Не вказано')}
└ 🆔 <b>ID запиту:</b> <code>${escape(questionId)}</code>

<b>Питання клієнта:</b>
${escape(payload.message || '')}`;

  const keyboard = [
    [Markup.button.callback('🙋‍♂️ Взяти в роботу', `siteq_take:${questionId}`)],
    [
      Markup.button.callback('💬 Відповісти', `siteq_reply:${questionId}`),
      Markup.button.callback('✅ Закрити', `siteq_done:${questionId}`),
    ],
  ];

  await bot.telegram.sendMessage(config.teamChatId, message, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(keyboard),
  });
}

async function processNotification(notification) {
  if (notification.channel !== 'telegram') return;

  const payload = parsePayload(notification.payload);
  const meta = getPayloadMeta(payload);
  const attempts = Number(meta.attempts || 0);

  try {
    if (notification.type === 'consultation.created.team') {
      await sendConsultationNotification(notification);
    } else if (notification.type === 'question.created.team') {
      await sendWebsiteQuestionNotification(notification);
    }

    const cleanedPayload = withPayloadMeta(payload, {
      attempts,
      lastError: null,
      nextRetryAt: null,
      processedAt: new Date().toISOString(),
    });

    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        payload: JSON.stringify(cleanedPayload),
      },
    });
  } catch (error) {
    const nextAttempts = attempts + 1;
    const isRetryExhausted = nextAttempts >= config.notificationWorker.maxRetryAttempts;
    const retryDelayMs = getRetryDelayMs(nextAttempts);
    const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();

    const failedPayload = withPayloadMeta(payload, {
      attempts: nextAttempts,
      lastError: error?.message || 'Unknown error',
      nextRetryAt,
      failedAt: new Date().toISOString(),
    });

    console.error(`❌ Notification error for ${notification.id} (attempt ${nextAttempts}):`, error);

    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: {
        status: 'failed',
        payload: JSON.stringify(failedPayload),
      },
    });

    if (isRetryExhausted) {
      console.error(`⛔ Notification ${notification.id} reached max retries (${config.notificationWorker.maxRetryAttempts}).`);
    }
  }
}

async function claimNotification(notificationId) {
  const { count } = await prisma.notificationLog.updateMany({
    where: {
      id: notificationId,
      status: {
        in: ['queued', 'failed'],
      },
    },
    data: {
      status: 'processing',
    },
  });

  return count === 1;
}

async function markClaimedProcessing(notification) {
  const payload = parsePayload(notification.payload);
  const claimedPayload = withPayloadMeta(payload, {
    processingStartedAt: new Date().toISOString(),
  });

  await prisma.notificationLog.update({
    where: { id: notification.id },
    data: {
      payload: JSON.stringify(claimedPayload),
    },
  });
}

async function recoverStaleProcessingNotifications() {
  const now = Date.now();
  const processing = await prisma.notificationLog.findMany({
    where: {
      channel: 'telegram',
      status: 'processing',
    },
    orderBy: { createdAt: 'asc' },
    take: config.notificationWorker.batchSize,
  });

  for (const item of processing) {
    const payload = parsePayload(item.payload);
    const meta = getPayloadMeta(payload);
    const startedAtTs = meta.processingStartedAt ? Number(new Date(meta.processingStartedAt)) : Number(new Date(item.createdAt));

    if (Number.isNaN(startedAtTs)) {
      continue;
    }

    if (now - startedAtTs < config.notificationWorker.processingTimeoutMs) {
      continue;
    }

    const recoveredPayload = withPayloadMeta(payload, {
      processingStartedAt: null,
      nextRetryAt: new Date().toISOString(),
      recoveredAt: new Date().toISOString(),
    });

    await prisma.notificationLog.update({
      where: { id: item.id },
      data: {
        status: 'failed',
        payload: JSON.stringify(recoveredPayload),
      },
    });

    console.warn(`♻️ Recovered stale processing notification: ${item.id}`);
  }
}

let isTickRunning = false;

export async function startNotificationWorker() {
  console.log('📨 Telegram notification worker started');

  if (workerIntervalId) {
    return;
  }

  workerIntervalId = setInterval(async () => {
    if (isTickRunning) {
      return;
    }

    isTickRunning = true;

    try {
      await processDeadlineReminders();
      await recoverStaleProcessingNotifications();

      const notifications = await prisma.notificationLog.findMany({
        where: {
          channel: 'telegram',
          status: {
            in: ['queued', 'failed'],
          },
        },
        orderBy: { createdAt: 'asc' },
        take: config.notificationWorker.batchSize,
      });

      for (const notification of notifications) {
        const parsedPayload = parsePayload(notification.payload);
        const attempts = Number(getPayloadMeta(parsedPayload).attempts || 0);

        if (attempts >= config.notificationWorker.maxRetryAttempts) {
          continue;
        }

        if (!canRetryNow(parsedPayload)) {
          continue;
        }

        const claimed = await claimNotification(notification.id);
        if (!claimed) {
          continue;
        }

        await markClaimedProcessing(notification);

        await processNotification(notification);
      }
    } catch (e) {
      console.error('Worker error:', e);
    } finally {
      isTickRunning = false;
    }
  }, config.pollInterval);
}

export async function stopNotificationWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
  }

  await prisma.$disconnect();
}