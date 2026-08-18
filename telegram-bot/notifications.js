import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';
import { bot } from './bot.js';
import { config } from './config.js';
import { Markup } from 'telegraf';

const prisma = new PrismaClient();

// ======================================================
// HELPERS
// ======================================================

function parsePayload(payload) {
  if (!payload) {
    return {};
  }

  if (typeof payload === 'object') {
    return payload;
  }

  try {
    return JSON.parse(payload);
  } catch {
    console.error('❌ Failed to parse notification payload:', payload);
    return {};
  }
}

function formatDate(date) {
  if (!date) {
    return 'Не вказано';
  }

  return new Date(date).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
  });
}

function escape(text) {
  if (text === null || text === undefined) {
    return '';
  }

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ======================================================
// NEW CONSULTATION
// ======================================================

async function sendConsultationNotification(notification) {
  const payload = parsePayload(notification.payload);

  const message =
`🔔 <b>НОВА КОНСУЛЬТАЦІЯ</b>

👤 <b>Клієнт:</b>
${escape(payload.firstName || 'Не вказано')}

📞 <b>Телефон:</b>
${escape(payload.phone || 'Не вказано')}

💼 <b>Послуга:</b>
${escape(payload.serviceName || 'Консультація')}

📂 <b>Категорія:</b>
${escape(payload.serviceCategory || 'Не вказано')}

💰 <b>Тип:</b>
${escape(payload.consultationType || 'FREE')}

📅 <b>Дата:</b>
${formatDate(payload.preferredDateTime)}

📞 <b>Контакт:</b>
${escape(payload.preferredContactMethod || 'Не вказано')}

🆔 <b>ID:</b>
<code>${escape(
  payload.consultationId ||
  notification.consultationId ||
  'Не вказано'
)}</code>`;

  const keyboard = [
    [
      Markup.button.url(
        '🌐 Відкрити сайт',
        config.siteUrl
      ),
    ],
  ];

  await bot.telegram.sendMessage(
    config.teamChatId,
    message,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard),
    }
  );
}

// ======================================================
// CONSULTATION CONFIRMED
// ======================================================

async function sendConsultationConfirmedNotification(notification) {
  const payload = parsePayload(notification.payload);

  const scheduledAt =
    payload.scheduledAt ||
    payload.preferredDateTime;

  const message =
`✅ <b>КОНСУЛЬТАЦІЮ ПІДТВЕРДЖЕНО</b>

👤 <b>Менеджер:</b>
${escape(payload.manager || 'Менеджер')}

📅 <b>Дата:</b>
${formatDate(scheduledAt)}

💻 <b>Google Meet:</b>
${escape(
  payload.googleMeetLink ||
  'Посилання не вказано'
)}

🆔 <b>ID консультації:</b>
<code>${escape(
  payload.consultationId ||
  notification.consultationId ||
  'Не вказано'
)}</code>`;

  const keyboard = [];

  if (payload.googleMeetLink) {
    keyboard.push([
      Markup.button.url(
        '🎥 Приєднатися до Google Meet',
        payload.googleMeetLink
      ),
    ]);
  }

  keyboard.push([
    Markup.button.url(
      '🌐 Відкрити FinOK',
      config.siteUrl
    ),
  ]);

  await bot.telegram.sendMessage(
    config.teamChatId,
    message,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard),
    }
  );
}

// ======================================================
// PROCESS NOTIFICATION
// ======================================================

async function processNotification(notification) {
  if (notification.channel !== 'telegram') {
    return;
  }

  const payload = parsePayload(notification.payload);

  console.log(
    `📨 Processing Telegram notification: ${notification.id}`
  );

  console.log(
    `   Type: ${notification.type}`
  );

  console.log(
    `   Chat ID: ${config.teamChatId}`
  );

  try {
    switch (notification.type) {

      case 'consultation.created.team':
        await sendConsultationNotification(notification);
        break;

      case 'consultation.confirmed.client':
        await sendConsultationConfirmedNotification(notification);
        break;

      default:
        await bot.telegram.sendMessage(
          config.teamChatId,

          `🔔 <b>FinOK notification</b>

Тип:
<code>${escape(notification.type)}</code>

${escape(
  JSON.stringify(payload, null, 2)
)}`,

          {
            parse_mode: 'HTML',
          }
        );
    }

    await prisma.notificationLog.update({
      where: {
        id: notification.id,
      },

      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });

    console.log(
      `✅ Telegram notification sent: ${notification.id}`
    );

  } catch (error) {

    console.error(
      `❌ Telegram notification failed: ${notification.id}`,
      error
    );

    try {
      await prisma.notificationLog.update({
        where: {
          id: notification.id,
        },

        data: {
          status: 'failed',
        },
      });
    } catch (dbError) {
      console.error(
        '❌ Failed to update notification status:',
        dbError
      );
    }
  }
}

// ======================================================
// WORKER
// ======================================================

export async function startNotificationWorker() {

  console.log(
    '📨 Telegram notification worker started'
  );

  // Обробити одразу при запуску
  await processQueuedNotifications();

  setInterval(
    async () => {
      await processQueuedNotifications();
    },
    config.pollInterval
  );
}

// ======================================================
// QUEUED NOTIFICATIONS
// ======================================================

async function processQueuedNotifications() {

  try {

    const notifications =
      await prisma.notificationLog.findMany({

        where: {
          channel: 'telegram',
          status: 'queued',
        },

        orderBy: {
          createdAt: 'asc',
        },

        take: 20,
      });

    if (notifications.length > 0) {

      console.log(
        `📨 Found ${notifications.length} queued Telegram notification(s)`
      );

    }

    for (const notification of notifications) {

      await processNotification(
        notification
      );

    }

  } catch (error) {

    console.error(
      '❌ Notification worker error:',
      error
    );

  }
}