import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceDb = path.join(projectRoot, 'dev.db');
const backupsDir = path.join(projectRoot, 'backups');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const targetDb = path.join(backupsDir, `dev-${timestamp}.db`);

async function main() {
  await fs.mkdir(backupsDir, { recursive: true });
  await fs.copyFile(sourceDb, targetDb);
  console.log(`Backup created: ${targetDb}`);
}

main().catch((error) => {
  console.error('Backup failed:', error);
  process.exit(1);
});
