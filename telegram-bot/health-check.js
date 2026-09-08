import { createRequire } from 'module';
import { bot } from './bot.js';
import { config } from './config.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const prisma = new PrismaClient();

function maskConnectionString(value) {
  if (!value) return 'missing';
  try {
    const url = new URL(value);
    const user = url.username ? `${url.username.slice(0, 2)}***` : '***';
    const host = url.hostname || 'unknown-host';
    const db = url.pathname?.replace('/', '') || 'unknown-db';
    return `${url.protocol}//${user}@${host}/${db}`;
  } catch {
    return 'set (non-url format)';
  }
}

async function checkDatabase() {
  const checks = {
    canConnect: false,
    groupedStatuses: [],
    latest: [],
  };

  await prisma.$queryRaw`SELECT 1`;
  checks.canConnect = true;

  checks.groupedStatuses = await prisma.notificationLog.groupBy({
    by: ['status'],
    where: { channel: 'telegram' },
    _count: { _all: true },
  });

  checks.latest = await prisma.notificationLog.findMany({
    where: { channel: 'telegram' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      type: true,
      status: true,
      recipient: true,
      createdAt: true,
      sentAt: true,
    },
  });

  return checks;
}

async function checkTelegram() {
  const me = await bot.telegram.getMe();
  return {
    ok: true,
    username: me.username,
    id: me.id,
  };
}

async function main() {
  const startedAt = new Date();

  console.log('=================================');
  console.log('FinOK Telegram Bot Health Check');
  console.log('=================================');
  console.log('Started at:', startedAt.toISOString());

  const envReport = {
    BOT_TOKEN: Boolean(config.botToken),
    TELEGRAM_TEAM_CHAT_ID: config.teamChatId || 'missing',
    TELEGRAM_ADMIN_IDS_COUNT: config.adminIds.length,
    DATABASE_URL: maskConnectionString(config.databaseUrl),
    SITE_URL: config.siteUrl,
  };

  console.log('\n[1/3] Environment');
  console.table(envReport);

  console.log('\n[2/3] Database');
  let dbResult;
  try {
    dbResult = await checkDatabase();
    console.log('Database connection: OK');
    console.log('Telegram notification statuses:');
    console.table(
      dbResult.groupedStatuses.map((row) => ({
        status: row.status,
        count: row._count._all,
      }))
    );

    if (dbResult.latest.length) {
      console.log('Latest telegram notifications:');
      console.table(
        dbResult.latest.map((item) => ({
          id: item.id,
          type: item.type,
          status: item.status,
          recipient: item.recipient,
          createdAt: item.createdAt,
          sentAt: item.sentAt,
        }))
      );
    } else {
      console.log('No telegram notifications found yet.');
    }
  } catch (error) {
    console.error('Database connection: FAILED');
    console.error(error?.message || error);
    process.exitCode = 1;
  }

  console.log('\n[3/3] Telegram API');
  try {
    const tg = await checkTelegram();
    console.log(`Telegram API: OK (@${tg.username}, id=${tg.id})`);
  } catch (error) {
    console.error('Telegram API: FAILED');
    console.error(error?.message || error);
    process.exitCode = 1;
  }

  await prisma.$disconnect();

  const finishedAt = new Date();
  console.log('\nFinished at:', finishedAt.toISOString());
  console.log('Duration:', `${Math.max(1, Math.round((finishedAt - startedAt) / 1000))}s`);

  if (process.exitCode && process.exitCode !== 0) {
    console.log('\nResult: FAILED');
    process.exit(process.exitCode);
  }

  console.log('\nResult: OK');
}

main().catch(async (error) => {
  console.error('Health check crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
