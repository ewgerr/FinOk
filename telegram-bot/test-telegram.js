import { bot } from './bot.js';
import { config } from './config.js';

console.log('=================================');
console.log('Telegram test');
console.log('=================================');

console.log(
  'BOT TOKEN:',
  config.botToken ? 'OK' : 'MISSING'
);

console.log(
  'TEAM CHAT ID:',
  config.teamChatId
);

console.log(
  'SITE URL:',
  config.siteUrl
);

try {
  const me = await bot.telegram.getMe();

  console.log(
    'BOT:',
    me.username
  );

  await bot.telegram.sendMessage(
    config.teamChatId,
    '✅ Тестове повідомлення FinOK. Telegram працює!'
  );

  console.log(
    '✅ TEST MESSAGE SENT'
  );

} catch (error) {

  console.error(
    '❌ TELEGRAM TEST FAILED'
  );

  console.error(
    error
  );
}