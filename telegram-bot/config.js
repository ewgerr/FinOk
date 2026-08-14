import dotenv from 'dotenv';

dotenv.config();

const required = [
  'BOT_TOKEN',
  'TELEGRAM_TEAM_CHAT_ID',
  'DATABASE_URL',
];

for (const variable of required) {
  if (!process.env[variable]) {
    throw new Error(
      `❌ Missing required environment variable: ${variable}`
    );
  }
}

export const config = {
  botToken: process.env.BOT_TOKEN,

  teamChatId: process.env.TELEGRAM_TEAM_CHAT_ID,

  databaseUrl: process.env.DATABASE_URL,

  siteUrl:
    process.env.PUBLIC_API_URL ||
    process.env.SITE_URL ||
    'http://localhost:4000',

  adminIds: String(process.env.TELEGRAM_ADMIN_IDS || '8751041240')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),

  pollInterval: Number(
    process.env.TELEGRAM_POLL_INTERVAL || 3000
  ),
};