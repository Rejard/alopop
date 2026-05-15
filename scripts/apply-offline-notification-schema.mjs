import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEGACY_EXPIRY = '1970-01-01T00:00:00.000Z';

async function getColumns() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info('OfflineMessage')`);
  return new Set(columns.map((column) => column.name));
}

async function addColumnIfMissing(columns, name, sql) {
  if (columns.has(name)) return false;
  await prisma.$executeRawUnsafe(sql);
  columns.add(name);
  return true;
}

try {
  const columns = await getColumns();
  const changes = [];

  if (await addColumnIfMissing(columns, 'kind', `ALTER TABLE "OfflineMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'NOTICE'`)) {
    changes.push('kind');
  }
  if (await addColumnIfMissing(columns, 'status', `ALTER TABLE "OfflineMessage" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING'`)) {
    changes.push('status');
  }
  if (await addColumnIfMissing(columns, 'expiresAt', `ALTER TABLE "OfflineMessage" ADD COLUMN "expiresAt" DATETIME NOT NULL DEFAULT '${LEGACY_EXPIRY}'`)) {
    changes.push('expiresAt');
  }
  if (await addColumnIfMissing(columns, 'deliveredAt', `ALTER TABLE "OfflineMessage" ADD COLUMN "deliveredAt" DATETIME`)) {
    changes.push('deliveredAt');
  }
  if (await addColumnIfMissing(columns, 'attemptCount', `ALTER TABLE "OfflineMessage" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0`)) {
    changes.push('attemptCount');
  }

  if (columns.has('expiresAt')) {
    await prisma.$executeRawUnsafe(
      `UPDATE "OfflineMessage"
       SET "expiresAt" = CASE
         WHEN typeof("createdAt") = 'integer' THEN datetime("createdAt" / 1000, 'unixepoch', '+7 days')
         ELSE datetime("createdAt", '+7 days')
       END
       WHERE "expiresAt" = ?`,
      LEGACY_EXPIRY
    );
  }

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OfflineMessage_expiresAt_idx" ON "OfflineMessage"("expiresAt")`);

  console.log(`OfflineMessage schema changes applied: ${changes.length ? changes.join(', ') : 'none'}`);
} finally {
  await prisma.$disconnect();
}
