import { createRequire } from 'module';
import { config } from './config.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const team = config.teamChatId;
  if (!team) {
    console.error('TELEGRAM_TEAM_CHAT_ID not set in config. Aborting.');
    process.exit(1);
  }

  console.log('Fixing telegram notifications with null recipient, setting to', team);

  const toUpdate = await prisma.notificationLog.findMany({
    where: {
      channel: 'telegram',
      recipient: null,
      status: { in: ['queued', 'failed'] },
    },
    take: 1000,
  });

  console.log('Found', toUpdate.length, 'records to update (showing up to 10 ids)');
  console.log(toUpdate.slice(0, 10).map((r) => r.id));

  if (!toUpdate.length) {
    console.log('Nothing to update.');
    await prisma.$disconnect();
    return;
  }

  const ids = toUpdate.map((r) => r.id);

  const result = await prisma.notificationLog.updateMany({
    where: { id: { in: ids } },
    data: { recipient: String(team) },
  });

  console.log('Updated count:', result.count);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Script error:', err?.message || err);
  await prisma.$disconnect();
  process.exit(1);
});
