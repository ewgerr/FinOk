import { createRequire } from 'module';
import { bot } from './bot.js';
import { config } from './config.js';
import { Markup } from 'telegraf';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const prisma = new PrismaClient();

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
  try {
    if (notification.type === 'consultation.created.team') {
      await sendConsultationNotification(notification);
    } else if (notification.type === 'question.created.team') {
      await sendWebsiteQuestionNotification(notification);
    }
    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: { status: 'sent', sentAt: new Date() },
    });
  } catch (error) {
    console.error(`❌ Notification error for ${notification.id}:`, error);
    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: { status: 'failed' },
    });
  }
}

export async function startNotificationWorker() {
  console.log('📨 Telegram notification worker started');
  setInterval(async () => {
    try {
      const notifications = await prisma.notificationLog.findMany({
        where: { channel: 'telegram', status: 'queued' },
        take: 20,
      });
      for (const n of notifications) await processNotification(n);
    } catch (e) {
      console.error('Worker error:', e);
    }
  }, config.pollInterval);
}