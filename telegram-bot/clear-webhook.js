import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN not set in .env');
  process.exit(1);
}

async function main() {
  try {
    console.log('Calling getWebhookInfo...');
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { method: 'GET' });
    const info = await infoRes.json();
    console.log('getWebhookInfo result:', JSON.stringify(info, null, 2));

    const url = info?.result?.url;
    if (url) {
      console.log('Webhook is set to:', url);
      console.log('Calling deleteWebhook...');
      const delRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: 'POST' });
      const del = await delRes.json();
      console.log('deleteWebhook result:', JSON.stringify(del, null, 2));
      if (del.ok) process.exit(0);
      process.exitCode = 1;
    } else {
      console.log('No webhook configured (getWebhookInfo reports empty url).');
    }
  } catch (err) {
    console.error('Error calling Telegram API:', err?.message || err);
    process.exit(1);
  }
}

main();
