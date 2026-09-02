import { Telegraf, Markup } from 'telegraf';
import { createRequire } from 'module';
import { config } from './config.js';

export const bot = new Telegraf(config.botToken);

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const nodemailer = require('../backend/node_modules/nodemailer');
const prisma = new PrismaClient();

// ======================================================
// HELPERS
// ======================================================

function isAdmin(userId) {
  return config.adminIds.includes(String(userId));
}

function getUserName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Клієнт';
}

function escapeTelegram(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseJsonSafely(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '';
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_ENABLED = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);

let smtpTransporter = null;

function getSmtpTransporter() {
  if (!SMTP_ENABLED) return null;
  if (smtpTransporter) return smtpTransporter;
  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return smtpTransporter;
}

const userStates = new Map();

// Навігаційний футер
const navFooter = (backCallback = 'menu') => [
  [
    Markup.button.callback('⬅️ Назад', backCallback),
    Markup.button.callback('🏠 Головне меню', 'menu'),
  ],
];

// Головне меню у 2 колонки
const getMainMenu = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('🧮 Калькулятор', 'calc_menu'),
      Markup.button.callback('📅 Календар', 'tax_calendar'),
    ],
    [
      Markup.button.callback('💬 Підтримка', 'support'),
      Markup.button.callback('❓ Часті питання', 'faq'),
    ],
    [Markup.button.url('🌐 Офіційний сайт FinOK', config.siteUrl)],
  ]);

// ======================================================
// START & MAIN MENU
// ======================================================

bot.start(async (ctx) => {
  userStates.delete(ctx.from.id);

  const welcomeText =
`🏛 <b>FinOK | Фінансовий та юридичний консалтинг</b>
───────────────────────────────
Вітаємо, <b>${escapeTelegram(getUserName(ctx.from))}</b>!

Я ваш персональний цифровий помічник. Допоможу розрахувати податки, нагадаю про дедлайни або з'єднаю з профільним фахівцем.

Оберіть потрібний розділ нижче:`;

  await ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    ...getMainMenu(),
  });
});

bot.action('menu', async (ctx) => {
  userStates.delete(ctx.from.id);
  await ctx.answerCbQuery();

  const menuText =
`🏛 <b>FinOK | Головне меню</b>
───────────────────────────────
Оберіть потрібний розділ або дію:`;

  await ctx.reply(menuText, {
    parse_mode: 'HTML',
    ...getMainMenu(),
  });
});

// ======================================================
// ПОДАТКОВИЙ КАЛЬКУЛЯТОР
// ======================================================

bot.action('calc_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const text =
`🧮 <b>Податковий калькулятор</b>
───────────────────────────────
Оберіть категорію розрахунку:`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('👤 ФОП 3 група (5%)', 'calc_fop3'),
        Markup.button.callback('💼 Зарплатні податки', 'calc_salary'),
      ],
      ...navFooter('menu'),
    ]),
  });
});

bot.action('calc_fop3', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.set(ctx.from.id, { step: 'CALC_FOP3_INPUT' });

  const text =
`📊 <b>Розрахунок для ФОП 3 групи (5%)</b>
───────────────────────────────
Введіть суму планового доходу в гривнях.

<i>Приклад: <code>50000</code> або <code>120 000</code></i>`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('❌ Скасувати', 'calc_menu')]]),
  });
});

bot.action('calc_salary', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.set(ctx.from.id, { step: 'CALC_SALARY_INPUT' });

  const text =
`💼 <b>Калькулятор витрат на працівника</b>
───────────────────────────────
Введіть бажану суму виплати <b>«на руки» (Net)</b>.

<i>Приклад: <code>25000</code></i>`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('❌ Скасувати', 'calc_menu')]]),
  });
});

// ======================================================
// ПОДАТКОВИЙ КАЛЕНДАР
// ======================================================

bot.action('tax_calendar', async (ctx) => {
  await ctx.answerCbQuery();
  const text =
`📅 <b>Податковий календар та дедлайни</b>
───────────────────────────────
Оберіть категорію вашого бізнесу:`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('📌 ФОП 1-2 група', 'tax_fop12'),
        Markup.button.callback('📌 ФОП 3 група', 'tax_fop3'),
      ],
      [Markup.button.callback('🏢 Юридичні особи (ТОВ)', 'tax_tov')],
      ...navFooter('menu'),
    ]),
  });
});

bot.action('tax_fop12', async (ctx) => {
  await ctx.answerCbQuery();
  const text =
`📌 <b>Дедлайни для ФОП 1 та 2 груп</b>
───────────────────────────────
┌ <b>Єдиний податок:</b>
└ Щомісяця <b>до 20 числа</b> поточного місяця.

┌ <b>ЄСВ (22% від мін. ЗП):</b>
└ Щокварталу <b>до 19 числа</b> (квітень, липень, жовтень, січень).

┌ <b>Річна декларація:</b>
└ Протягом <b>60 днів</b> після закінчення звітного року.`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('💬 Консультація бухгалтера', 'support')],
      ...navFooter('tax_calendar'),
    ]),
  });
});

bot.action('tax_fop3', async (ctx) => {
  await ctx.answerCbQuery();
  const text =
`📌 <b>Дедлайни для ФОП 3 групи (5%)</b>
───────────────────────────────
┌ <b>Подання декларації:</b>
└ Щокварталу протягом <b>40 днів</b> після кварталу.

┌ <b>Сплата Єдиного податку:</b>
└ Протягом <b>10 днів</b> після подання декларації.

┌ <b>Сплата ЄСВ:</b>
└ Щокварталу <b>до 19 числа</b> після кварталу.`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('💬 Замовити супровід ФОП', 'support')],
      ...navFooter('tax_calendar'),
    ]),
  });
});

bot.action('tax_tov', async (ctx) => {
  await ctx.answerCbQuery();
  const text =
`📌 <b>Дедлайни для ТОВ та НПО</b>
───────────────────────────────
┌ <b>Зарплатні податки (ПДФО, ВЗ, ЄСВ):</b>
└ У день виплати зарплати або <b>до 30 числа</b> місяця.

┌ <b>Зарплатний звіт (Єдиний):</b>
└ Щомісяця <b>до 20 числа</b>.

┌ <b>Декларація з прибутку:</b>
└ Щокварталу (40 днів) або щорічно (60 днів).`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('💬 Обслуговування ТОВ', 'support')],
      ...navFooter('tax_calendar'),
    ]),
  });
});

// ======================================================
// FAQ
// ======================================================

bot.action('faq', async (ctx) => {
  await ctx.answerCbQuery();
  const text =
`❓ <b>Часті питання (FAQ)</b>
───────────────────────────────
<b>Скільки коштує перша консультація?</b>
▫️ Вступна первинна консультація є повністю безкоштовною.

<b>Які послуги ви надаєте?</b>
▫️ Комплексний бухгалтерський облік, оптимізація податків, юридичний супровід ТОВ/ФОП, допомога з грантами.

<b>Як швидко відповідає менеджер?</b>
▫️ У робочий час (09:00 - 18:00) відповідь надходить протягом 15 хвилин.`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('💬 Написати менеджеру', 'support')],
      ...navFooter('menu'),
    ]),
  });
});

// ======================================================
// SUPPORT
// ======================================================

bot.action('support', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.set(ctx.from.id, { step: 'SUPPORT' });

  const text =
`💬 <b>Прямий зв'язок з експертом FinOK</b>
───────────────────────────────
Напишіть ваше питання або опишіть ситуацію наступним повідомленням. Менеджер отримає запит та відповість вам у цей чат.`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('❌ Скасувати', 'menu')]]),
  });
});

// ======================================================
// АДМІНІСТРУВАННЯ ТА КНОПКИ ДЛЯ КОМАНДИ
// ======================================================

const adminSessions = new Map();

bot.action(/^admin_take:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Немає доступу');
  await ctx.answerCbQuery('✅ Взято в обробку');

  const actionId = ctx.match[1];
  const adminName = getUserName(ctx.from);

  await ctx.editMessageReplyMarkup({
    inline_keyboard: [
      [Markup.button.callback(`👤 Взяв(ла): ${adminName}`, 'noop')],
      [
        Markup.button.callback('💬 Відповісти', `reply:${actionId}`),
        Markup.button.callback('✅ Закрити заявку', `admin_done:${actionId}`),
      ],
    ],
  });
});

bot.action(/^admin_done:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Немає доступу');
  await ctx.answerCbQuery('✅ Заявку закрито');

  await ctx.editMessageReplyMarkup({
    inline_keyboard: [[Markup.button.callback('✅ Опрацьовано та закрито', 'noop')]],
  });
});

bot.action(/^reply:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Немає доступу');
  await ctx.answerCbQuery();

  const userId = Number(ctx.match[1]);
  adminSessions.set(ctx.from.id, { type: 'telegram-chat', userId });

  await ctx.reply(`✍️ Введіть текст відповіді для клієнта (ID: <code>${userId}</code>):`, {
    parse_mode: 'HTML',
  });
});

bot.action(/^siteq_take:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Немає доступу');
  await ctx.answerCbQuery('✅ Взято в обробку');

  const actionId = ctx.match[1];
  const adminName = getUserName(ctx.from);

  await ctx.editMessageReplyMarkup({
    inline_keyboard: [
      [Markup.button.callback(`👤 Взяв(ла): ${adminName}`, 'noop')],
      [
        Markup.button.callback('💬 Відповісти', `siteq_reply:${actionId}`),
        Markup.button.callback('✅ Закрити запит', `siteq_done:${actionId}`),
      ],
    ],
  });
});

bot.action(/^siteq_done:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Немає доступу');
  await ctx.answerCbQuery('✅ Запит закрито');

  await ctx.editMessageReplyMarkup({
    inline_keyboard: [[Markup.button.callback('✅ Питання опрацьовано', 'noop')]],
  });
});

bot.action(/^siteq_reply:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔ Немає доступу');
  await ctx.answerCbQuery();

  const notificationId = ctx.match[1];
  const notification = await prisma.notificationLog.findUnique({
    where: { id: notificationId },
  });
  const payload = parseJsonSafely(notification?.payload) || {};

  adminSessions.set(ctx.from.id, {
    type: 'website-question',
    notificationId,
    email: payload.email || null,
    firstName: payload.firstName || 'клієнт',
  });

  await ctx.reply(
    `✍️ Введіть текст відповіді для клієнта <b>${escapeTelegram(payload.firstName || 'клієнт')}</b> (${escapeTelegram(payload.email || 'email не вказано')}):`,
    {
      parse_mode: 'HTML',
    }
  );
});

bot.action('noop', async (ctx) => ctx.answerCbQuery());

// ======================================================
// ОБРОБКА ТЕКСТОВИХ ВВЕДЕНЬ
// ======================================================

bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;

  // Адмінська відповідь
  if (isAdmin(userId) && adminSessions.has(userId)) {
    const session = adminSessions.get(userId);
    try {
      if (session.type === 'website-question') {
        if (!session.email) {
          await ctx.reply('❌ Для цього запиту не вказано email. Зв’яжіться з клієнтом вручну.');
          adminSessions.delete(userId);
          return;
        }

        if (!SMTP_ENABLED) {
          await ctx.reply(`❌ SMTP не налаштовано. Відповідь не відправлена. Email клієнта: ${session.email}`);
          adminSessions.delete(userId);
          return;
        }

        const transporter = getSmtpTransporter();
        await transporter.sendMail({
          from: SMTP_FROM,
          to: session.email,
          subject: 'Відповідь менеджера FinOK на ваше запитання',
          text:
`Вітаємо, ${session.firstName}!

Надсилаємо відповідь менеджера FinOK на ваше запитання:

${ctx.message.text}

Якщо потрібні уточнення, просто дайте відповідь на цей лист або залиште нове звернення на сайті.

З повагою,
команда FinOK`,
        });

        await prisma.notificationLog.create({
          data: {
            channel: 'email',
            type: 'question.reply.client',
            recipient: session.email,
            status: 'sent',
            sentAt: new Date(),
            payload: JSON.stringify({
              notificationId: session.notificationId,
              firstName: session.firstName,
              email: session.email,
              message: ctx.message.text,
              source: 'telegram-admin-reply',
            }),
          },
        });

        await ctx.reply(`✅ Відповідь надіслана на email ${session.email}.`);
        adminSessions.delete(userId);
        return;
      }

      await bot.telegram.sendMessage(
        session.userId,
        `👨‍💼 <b>Відповідь менеджера FinOK:</b>\n───────────────────────────────\n${escapeTelegram(ctx.message.text)}`,
        { parse_mode: 'HTML' }
      );
      await ctx.reply('✅ Відповідь надіслана клієнту.');
      adminSessions.delete(userId);
    } catch {
      await ctx.reply('❌ Не вдалося відправити повідомлення.');
      adminSessions.delete(userId);
    }
    return;
  }

  const userState = userStates.get(userId);
  if (!userState) return next();

  // Калькулятор ФОП 3
  if (userState.step === 'CALC_FOP3_INPUT') {
    const income = parseFloat(ctx.message.text.replace(/\s+/g, '').replace(',', '.'));
    if (isNaN(income) || income <= 0) {
      return ctx.reply('⚠️ Введіть коректну додатну суму (число):');
    }

    const singleTax = income * 0.05;
    const esvMonth = 1760;
    const totalTax = singleTax + esvMonth;
    const netIncome = income - totalTax;

    userStates.delete(userId);
    return ctx.reply(
`📊 <b>Розрахунок: ФОП 3 група (5%)</b>
───────────────────────────────
┌ <b>Плановий дохід:</b> <code>${income.toLocaleString('uk-UA')} ₴</code>
├ <b>Єдиний податок (5%):</b> <code>${singleTax.toLocaleString('uk-UA')} ₴</code>
└ <b>ЄСВ (1 місяць):</b> <code>${esvMonth.toLocaleString('uk-UA')} ₴</code>
───────────────────────────────
💳 <b>Разом податків:</b> <code>~${totalTax.toLocaleString('uk-UA')} ₴</code>
💵 <b>Чистий залишок:</b> <code>${netIncome.toLocaleString('uk-UA')} ₴</code>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🧮 Порахувати іншу суму', 'calc_fop3')],
          [Markup.button.callback('💬 Консультація бухгалтера', 'support')],
          ...navFooter('calc_menu'),
        ]),
      }
    );
  }

  // Калькулятор Зарплати
  if (userState.step === 'CALC_SALARY_INPUT') {
    const netSalary = parseFloat(ctx.message.text.replace(/\s+/g, '').replace(',', '.'));
    if (isNaN(netSalary) || netSalary <= 0) {
      return ctx.reply('⚠️ Введіть коректну суму (число):');
    }

    const grossSalary = netSalary / 0.77;
    const pdfo = grossSalary * 0.18;
    const vz = grossSalary * 0.05;
    const esv = grossSalary * 0.22;
    const totalCost = grossSalary + esv;

    userStates.delete(userId);
    return ctx.reply(
`💼 <b>Розрахунок витрат на виплату ЗП</b>
───────────────────────────────
┌ <b>Виплата «на руки» (Net):</b> <code>${netSalary.toLocaleString('uk-UA')} ₴</code>
└ <b>Оклад у договорі (Gross):</b> <code>${Math.round(grossSalary).toLocaleString('uk-UA')} ₴</code>

<b>Утримання із зарплати:</b>
• ПДФО (18%): <code>${Math.round(pdfo).toLocaleString('uk-UA')} ₴</code>
• Військовий збір (5%): <code>${Math.round(vz).toLocaleString('uk-UA')} ₴</code>

<b>Нарахування компанії:</b>
• ЄСВ (22%): <code>${Math.round(esv).toLocaleString('uk-UA')} ₴</code>
───────────────────────────────
💰 <b>Повні витрати компанії:</b> <code>${Math.round(totalCost).toLocaleString('uk-UA')} ₴</code>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🧮 Порахувати іншу суму', 'calc_salary')],
          [Markup.button.callback('💬 Кадровий аудит', 'support')],
          ...navFooter('calc_menu'),
        ]),
      }
    );
  }

  // Звернення в підтримку
  if (userState.step === 'SUPPORT') {
    const username = ctx.from.username ? `@${ctx.from.username}` : 'не вказано';
    const fullName = getUserName(ctx.from);

    const message =
`🚨 <b>НОВЕ ЗВЕРНЕННЯ В ПІДТРИМКУ</b>
───────────────────────────────
┌ 👤 <b>Клієнт:</b> ${escapeTelegram(fullName)}
├ 🔗 <b>Username:</b> ${escapeTelegram(username)}
└ 🆔 <b>Telegram ID:</b> <code>${userId}</code>

💬 <b>Питання клієнта:</b>
${escapeTelegram(ctx.message.text)}`;

    try {
      await bot.telegram.sendMessage(config.teamChatId, message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🙋‍♂️ Взяти в роботу', `admin_take:${userId}`)],
          [
            Markup.button.callback('💬 Відповісти', `reply:${userId}`),
            Markup.button.callback('✅ Закрити', `admin_done:${userId}`),
          ],
        ]),
      });

      userStates.delete(userId);
      await ctx.reply(
        `✅ <b>Ваше звернення успішно передано команді FinOK.</b>\nМенеджер зв'яжеться з вами найближчим часом.`,
        {
          parse_mode: 'HTML',
          ...getMainMenu(),
        }
      );
    } catch {
      await ctx.reply('❌ Помилка надсилання. Спробуйте пізніше.');
    }
  }
});

bot.catch((err) => console.error('Telegram bot error:', err));