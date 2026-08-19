import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd());
const DB_PATH = path.join(PROJECT_ROOT, 'prisma', 'dev.db');
const BACKUP_DIR = path.join(PROJECT_ROOT, '.db-backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export type BackupInfo = {
  filename: string;
  size: number;
  createdAt: string;
};

export function createBackup(): BackupInfo {
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

export function rotateBackups(maxKeep: number = 7): number {
  ensureBackupDir();

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('alopop_') && f.endsWith('.db'))
    .sort();

  let deletedCount = 0;
  while (files.length > maxKeep) {
    const oldest = files.shift()!;
    fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    deletedCount++;
  }

  return deletedCount;
}

export function listBackups(): BackupInfo[] {
  ensureBackupDir();

  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('alopop_') && f.endsWith('.db'))
    .sort()
    .reverse()
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return {
        filename,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    });
}

export function restoreBackup(filename: string): { preRestoreFile: string } {
  ensureBackupDir();

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid backup filename');
  }

  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${filename}`);
  }

  const preRestoreTimestamp = formatTimestamp(new Date());
  const preRestoreFilename = `pre_restore_${preRestoreTimestamp}.db`;
  const preRestorePath = path.join(BACKUP_DIR, preRestoreFilename);

  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, preRestorePath);
  }

  fs.copyFileSync(backupPath, DB_PATH);

  return { preRestoreFile: preRestoreFilename };
}
