import { bot, shutdownBotResources } from './bot.js';
import { startNotificationWorker, stopNotificationWorker } from './notifications.js';

async function shutdown(signal) {
  try {
    await stopNotificationWorker();
    bot.stop(signal);
    await shutdownBotResources();
    console.log(`🛑 Telegram bot stopped by ${signal}`);
  } catch (error) {
    console.error('❌ Telegram bot shutdown error:', error);
  }
}

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
  () => {
    shutdown('SIGINT').finally(() => process.exit(0));
  }
);

process.once(
  'SIGTERM',
  () => {
    shutdown('SIGTERM').finally(() => process.exit(0));
  }
);