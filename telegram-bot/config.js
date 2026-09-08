import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../backend/.env'), override: false });

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

  adminIds: String(process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),

  pollInterval: Number(
    process.env.TELEGRAM_POLL_INTERVAL || 3000
  ),

  supportCooldownMs: toNumber(process.env.TELEGRAM_SUPPORT_COOLDOWN_MS, 30_000),

  notificationWorker: {
    batchSize: toNumber(process.env.TELEGRAM_NOTIF_BATCH_SIZE, 20),
    maxRetryAttempts: toNumber(process.env.TELEGRAM_NOTIF_MAX_RETRIES, 5),
    retryBaseMs: toNumber(process.env.TELEGRAM_NOTIF_RETRY_BASE_MS, 10_000),
    retryMaxMs: toNumber(process.env.TELEGRAM_NOTIF_RETRY_MAX_MS, 15 * 60 * 1000),
    processingTimeoutMs: toNumber(process.env.TELEGRAM_NOTIF_PROCESSING_TIMEOUT_MS, 120_000),
  },

  reminders: {
    timezone: process.env.TELEGRAM_REMINDER_TIMEZONE || 'Europe/Kyiv',
    hour: toNumber(process.env.TELEGRAM_REMINDER_HOUR, 9),
    minute: toNumber(process.env.TELEGRAM_REMINDER_MINUTE, 0),
    windowMinutes: toNumber(process.env.TELEGRAM_REMINDER_WINDOW_MINUTES, 20),
  },

  taxRules: {
    fop3SingleTaxRate: toNumber(process.env.TAX_FOP3_SINGLE_TAX_RATE, 0.05),
    fop3EsvMonthlyUah: toNumber(process.env.TAX_FOP3_ESV_MONTHLY_UAH, 1760),
    salaryPdfoRate: toNumber(process.env.TAX_SALARY_PDFO_RATE, 0.18),
    salaryVzRate: toNumber(process.env.TAX_SALARY_VZ_RATE, 0.05),
    salaryEsvRate: toNumber(process.env.TAX_SALARY_ESV_RATE, 0.22),
  },
};