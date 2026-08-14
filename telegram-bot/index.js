import { bot } from './bot.js';
import { startNotificationWorker } from './notifications.js';

async function main() {

  console.log(
    '🤖 Starting FinOK Telegram Bot...'
  );

  await bot.launch();

  console.log(
    '✅ Telegram bot started'
  );

  await startNotificationWorker();

  console.log(
    '📨 Notification worker started'
  );
}

main().catch((error) => {

  console.error(
    '❌ Telegram bot startup error:',
    error
  );

  process.exit(1);
});

process.once(
  'SIGINT',
  () => bot.stop('SIGINT')
);

process.once(
  'SIGTERM',
  () => bot.stop('SIGTERM')
);