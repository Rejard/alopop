const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'prisma', 'dev.db');
const BACKUP_DIR = path.join(PROJECT_ROOT, '.db-backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function createBackup() {
  ensureBackupDir();

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Source DB not found: ${DB_PATH}`);
  }

  const timestamp = formatTimestamp(new Date());
  const filename = `alopop_${timestamp}.db`;
  const destPath = path.join(BACKUP_DIR, filename);

  fs.copyFileSync(DB_PATH, destPath);

  const stat = fs.statSync(destPath);
  return {
    filename,
    size: stat.size,
    createdAt: stat.birthtime.toISOString(),
  };
}

function rotateBackups(maxKeep) {
  if (maxKeep === undefined) maxKeep = 7;
  ensureBackupDir();

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('alopop_') && f.endsWith('.db'))
    .sort();

  let deletedCount = 0;
  while (files.length > maxKeep) {
    const oldest = files.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    deletedCount++;
  }

  return deletedCount;
}

module.exports = { createBackup, rotateBackups };
