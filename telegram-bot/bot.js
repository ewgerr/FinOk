import { Telegraf, Markup } from 'telegraf';
import { config } from './config.js';

export const bot = new Telegraf(config.botToken);

// ======================================================
// HELPERS
// ======================================================

function isAdmin(userId) {
  return config.adminIds.includes(String(userId));
}

function getUserName(user) {
  return [
    user?.first_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(' ') || 'Клієнт';
}

function escapeTelegram(text) {
  if (!text) return '';

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(date) {
  if (!date) return 'Не вказано';

  return new Date(date).toLocaleString(
    'uk-UA',
    {
      timeZone: 'Europe/Kyiv',
    }
  );
}

// ======================================================
// START
// ======================================================

bot.start(async (ctx) => {
  await ctx.reply(
    `👋 <b>Вітаємо у FinOK!</b>

Я допоможу вам зв'язатися з нашою командою.

Оберіть потрібну дію:`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '💬 Написати менеджеру',
            'support'
          ),
        ],
        [
          Markup.button.callback(
            '📅 Записатися на консультацію',
            'consultation'
          ),
        ],
        [
          Markup.button.callback(
            '❓ Часті питання',
            'faq'
          ),
        ],
      ]),
    }
  );
});

// ======================================================
// MENU
// ======================================================

bot.action('menu', async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    `👋 <b>Меню FinOK</b>`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '💬 Написати менеджеру',
            'support'
          ),
        ],
        [
          Markup.button.callback(
            '📅 Записатися',
            'consultation'
          ),
        ],
        [
          Markup.button.callback(
            '❓ FAQ',
            'faq'
          ),
        ],
      ]),
    }
  );
});

// ======================================================
// FAQ
// ======================================================

bot.action('faq', async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    `❓ <b>Часті питання</b>

<b>Як записатися на консультацію?</b>
Перейдіть на сайт FinOK та створіть заявку.

<b>Скільки коштує перша консультація?</b>
Перша консультація є безкоштовною.

<b>Як зв'язатися з менеджером?</b>
Натисніть кнопку «Написати менеджеру».

Якщо ви не знайшли відповідь — напишіть нам.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '💬 Написати менеджеру',
            'support'
          ),
        ],
        [
          Markup.button.callback(
            '⬅️ Меню',
            'menu'
          ),
        ],
      ]),
    }
  );
});

// ======================================================
// CONSULTATION
// ======================================================

bot.action('consultation', async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    `📅 <b>Запис на консультацію</b>

Для запису перейдіть на сайт FinOK:

${config.siteUrl}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            '🌐 Відкрити FinOK',
            config.siteUrl
          ),
        ],
        [
          Markup.button.callback(
            '⬅️ Меню',
            'menu'
          ),
        ],
      ]),
    }
  );
});

// ======================================================
// SUPPORT
// ======================================================

const supportSessions = new Map();

bot.action('support', async (ctx) => {
  await ctx.answerCbQuery();

  supportSessions.set(ctx.from.id, { active: true });

  await ctx.reply(
    `💬 <b>Звернення до підтримки</b>

Напишіть ваше питання одним або кількома повідомленнями.

Ваше повідомлення буде передано менеджеру.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '❌ Скасувати',
            'cancel_support'
          ),
        ],
      ]),
    }
  );
});

// ======================================================
// CANCEL SUPPORT
// ======================================================

bot.action('cancel_support', async (ctx) => {
  await ctx.answerCbQuery();

  supportSessions.delete(ctx.from.id);

  await ctx.reply(
    '❌ Звернення скасовано.',
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '⬅️ Меню',
          'menu'
        ),
      ],
    ])
  );
});

// ======================================================
// USER MESSAGE
// ======================================================

bot.on('message', async (ctx, next) => {
  const userId = ctx.from.id;
  const session = supportSessions.get(userId);

  if (!session?.active) {
    return next();
  }

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    '[Клієнт надіслав файл або медіа]';

  const username = ctx.from.username
    ? `@${ctx.from.username}`
    : 'немає';

  const fullName = getUserName(ctx.from);

  const message =
`🚨 <b>НОВЕ ЗВЕРНЕННЯ</b>

👤 <b>Клієнт:</b> ${escapeTelegram(fullName)}
🔗 <b>Username:</b> ${escapeTelegram(username)}
🆔 <b>Telegram ID:</b> <code>${userId}</code>

💬 <b>Повідомлення:</b>
${escapeTelegram(text)}`;

  try {
    await bot.telegram.sendMessage(
      config.teamChatId,
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '💬 Відповісти',
              `reply:${userId}`
            ),
          ],
          [
            Markup.button.callback(
              '✅ Закрити',
              `close:${userId}`
            ),
          ],
        ]),
      }
    );

    await ctx.reply(
      `✅ <b>Повідомлення передано менеджеру.</b>

Очікуйте відповідь.`,
      {
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('Telegram support error:', error);

    await ctx.reply(
      '❌ Не вдалося передати повідомлення. Спробуйте ще раз.'
    );
  }
});

// ======================================================
// ADMIN REPLY
// ======================================================

const adminSessions = new Map();

bot.action(/^reply:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery('⛔ У вас немає доступу');
    return;
  }

  await ctx.answerCbQuery();
  const userId = Number(ctx.match[1]);

  adminSessions.set(ctx.from.id, { userId });

  await ctx.reply(
    `💬 Напишіть відповідь клієнту.

🆔 Telegram ID: ${userId}

Наступне повідомлення буде відправлено клієнту.`
  );
});

// ======================================================
// ADMIN MESSAGE
// ======================================================

bot.on('message', async (ctx, next) => {
  if (!isAdmin(ctx.from.id)) {
    return next();
  }

  const session = adminSessions.get(ctx.from.id);

  if (!session) {
    return next();
  }

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    '[Медіа]';

  try {
    await bot.telegram.sendMessage(
      session.userId,
      `👨‍💼 <b>Повідомлення від менеджера FinOK</b>

${escapeTelegram(text)}`,
      {
        parse_mode: 'HTML',
      }
    );

    await ctx.reply('✅ Відповідь відправлено клієнту.');
    adminSessions.delete(ctx.from.id);
  } catch (error) {
    console.error('Admin reply error:', error);
    await ctx.reply('❌ Не вдалося відправити повідомлення.');
  }
});

// ======================================================
// CLOSE SUPPORT
// ======================================================

bot.action(/^close:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCbQuery('⛔ У вас немає доступу');
    return;
  }

  await ctx.answerCbQuery();
  const userId = Number(ctx.match[1]);

  supportSessions.delete(userId);

  try {
    await bot.telegram.sendMessage(
      userId,
      `✅ <b>Ваше звернення закрито.</b>

Якщо у вас виникнуть нові питання — звертайтеся до нас знову.`,
      {
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('Close support error:', error);
  }

  await ctx.reply('✅ Звернення закрито.');
});

// ======================================================
// UNKNOWN COMMAND
// ======================================================

bot.on('text', async (ctx, next) => {
  if (ctx.message.text?.startsWith('/')) {
    return next();
  }

  if (supportSessions.has(ctx.from.id)) {
    return;
  }

  await ctx.reply(
    'Оберіть потрібну дію:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '💬 Підтримка',
          'support'
        ),
      ],
      [
        Markup.button.callback(
          '❓ FAQ',
          'faq'
        ),
      ],
      [
        Markup.button.callback(
          '📅 Записатися',
          'consultation'
        ),
      ],
    ])
  );
});

// ======================================================
// ERRORS
// ======================================================

bot.catch((error, ctx) => {
  console.error('Telegram bot error:', error, 'Update:', ctx?.update);
});