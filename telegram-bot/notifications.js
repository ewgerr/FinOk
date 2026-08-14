import { PrismaClient } from '@prisma/client';
import { bot } from './bot.js';
import { config } from './config.js';

const prisma = new PrismaClient();

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
    return {};
  }
}

function formatDate(date) {

  if (!date) {
    return 'Не вказано';
  }

  return new Date(date).toLocaleString(
    'uk-UA',
    {
      timeZone: 'Europe/Kyiv',
    }
  );
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

async function sendConsultationNotification(notification) {

  const payload = parsePayload(
    notification.payload
  );

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
${escape(payload.preferredContactMethod || '')}

🆔 <b>ID:</b>
<code>${escape(payload.consultationId || notification.consultationId)}</code>`;

  await bot.telegram.sendMessage(
    config.teamChatId,
    message,
    {
      parse_mode: 'HTML',

      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            '🌐 Відкрити сайт',
            config.siteUrl
          ),
        ],
      ]),
    }
  );
}

async function processNotification(notification) {

  if (
    notification.channel !== 'telegram'
  ) {
    return;
  }

  const payload =
    parsePayload(notification.payload);

  try {

    switch (notification.type) {

      case 'consultation.created.team':

        await sendConsultationNotification(
          notification
        );

        break;

      default:

        await bot.telegram.sendMessage(
          config.teamChatId,

          `🔔 <b>FinOK notification</b>

Тип:
<code>${escape(notification.type)}</code>

${escape(JSON.stringify(payload, null, 2))}`,

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

    await prisma.notificationLog.update({
      where: {
        id: notification.id,
      },

      data: {
        status: 'failed',
      },
    });
  }
}

export async function startNotificationWorker() {

  console.log(
    '📨 Telegram notification worker started'
  );

  setInterval(
    async () => {

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

        for (
          const notification of notifications
        ) {

          await processNotification(
            notification
          );
        }

      } catch (error) {

        console.error(
          'Notification worker error:',
          error
        );
      }

    },

    config.pollInterval
  );
}