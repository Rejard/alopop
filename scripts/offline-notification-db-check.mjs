import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parsePayload(payload) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

try {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info('OfflineMessage')`);
  const columnNames = new Set(columns.map((column) => column.name));
  const records = await prisma.offlineMessage.findMany({
    select: { id: true, payload: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  let safe = 0;
  let raw = 0;
  let malformed = 0;

  for (const record of records) {
    const payload = parsePayload(record.payload);
    if (!payload) {
      malformed += 1;
      continue;
    }

    if (
      payload.offlineNotice === true &&
      payload.senderId === 'system' &&
      payload.messageType === 'SYSTEM' &&
      typeof payload.content === 'string' &&
      payload.content.length > 0
    ) {
      safe += 1;
      continue;
    }

    if (typeof payload.content === 'string' && payload.content.length > 0) {
      raw += 1;
    }
  }

  console.log(`OfflineMessage rows checked: ${records.length}`);
  console.log(`Safe notice rows: ${safe}`);
  console.log(`Raw-looking rows: ${raw}`);
  console.log(`Malformed rows: ${malformed}`);
  console.log(`Enhanced schema columns: ${columnNames.has('expiresAt') && columnNames.has('status') ? 'yes' : 'no'}`);

  if (raw > 0 || malformed > 0) {
    process.exit(1);
  }
} finally {
  await prisma.$disconnect();
}
