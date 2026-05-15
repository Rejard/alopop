import crypto from 'node:crypto';
import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const BASE_URL = process.env.ALOPOP_BASE_URL || 'http://127.0.0.1:3099';
const SESSION_COOKIE_NAME = 'alo_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const TEST_EMAIL = process.env.ALOPOP_TEST_USER_EMAIL || 'lemaiiiaiii@gmail.com';
const SECRET_MARKER = `qa-private-marker-${Date.now()}`;
let sourceMessageId = '';

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_SESSION_SECRET_DEFAULT';
}

function createSessionToken(userId) {
  const payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

async function getEnhancedColumns() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info('OfflineMessage')`);
  return new Set(columns.map((column) => column.name));
}

async function findLatestNotice(receiverId, sourceMessageId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, receiverId, payload, status, expiresAt, deliveredAt, attemptCount
     FROM OfflineMessage
     WHERE receiverId = ?
     ORDER BY createdAt DESC
     LIMIT 20`,
    receiverId
  );

  return rows.find((row) => row.payload.includes(`offline_notice_${sourceMessageId}`));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForDelivered(id) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const delivered = await prisma.$queryRawUnsafe(
      `SELECT status, deliveredAt, attemptCount
       FROM OfflineMessage
       WHERE id = ?
       LIMIT 1`,
      id
    );
    if (delivered[0]?.status === 'DELIVERED') return delivered;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return prisma.$queryRawUnsafe(
    `SELECT status, deliveredAt, attemptCount
     FROM OfflineMessage
     WHERE id = ?
     LIMIT 1`,
    id
  );
}

try {
  const columns = await getEnhancedColumns();
  assert(columns.has('expiresAt') && columns.has('status'), 'OfflineMessage enhanced schema is not applied');

  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    select: { id: true, email: true },
  });
  assert(user, `Test user not found: ${TEST_EMAIL}`);

  const room = await prisma.room.findFirst({
    where: {
      members: { some: { userId: user.id } },
    },
    select: { id: true },
  });
  assert(room, `No room found for test user: ${TEST_EMAIL}`);

  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_INTERNAL_SECRET_DEFAULT';
  sourceMessageId = `qa-notification-${Date.now()}`;
  const relayResponse = await fetch(`${BASE_URL}/api/internal/pet365-relay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-alopop-internal': internalSecret,
    },
    body: JSON.stringify({
      targetUserId: user.id,
      message: {
        messageId: sourceMessageId,
        senderId: 'qa-sender',
        senderName: 'QA Sender',
        receiverId: room.id,
        messageType: 'TEXT',
        content: SECRET_MARKER,
        createdAt: Date.now(),
      },
    }),
  });
  assert(relayResponse.ok, `Relay failed with HTTP ${relayResponse.status}`);

  const relayBody = await relayResponse.json();
  assert(relayBody.delivered === false, 'Relay should queue notice while test socket is offline');

  const queued = await findLatestNotice(user.id, sourceMessageId);
  assert(queued, 'Queued offline notice was not found');
  assert(queued.status === 'PENDING', 'Queued offline notice should be PENDING');
  assert(queued.expiresAt && queued.expiresAt !== '1970-01-01T00:00:00.000Z', 'Queued notice must have a real expiry');
  assert(!queued.payload.includes(SECRET_MARKER), 'Queued notice leaked raw message content');

  const token = createSessionToken(user.id);
  const summary = await new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
      timeout: 5000,
    });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out waiting for offline_activity_summary'));
    }, 8000);

    socket.on('offline_activity_summary', (payload) => {
      clearTimeout(timeout);
      socket.close();
      resolve(payload);
    });

    const register = () => {
      socket.emit('register');
    };

    socket.on('connect', () => {
      setTimeout(register, 100);
    });

    socket.on('server_version', register);

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      socket.close();
      reject(error);
    });
  });

  assert(Array.isArray(summary.rooms), 'Offline summary payload should include rooms');
  assert(summary.rooms.some((item) => item.roomId === room.id && item.count >= 1), 'Offline summary did not include the queued room');

  const delivered = await waitForDelivered(queued.id);
  assert(delivered[0]?.status === 'DELIVERED', 'Notice should be marked DELIVERED after reconnect summary');
  assert(delivered[0]?.deliveredAt, 'Delivered notice should record deliveredAt');
  assert(Number(delivered[0]?.attemptCount || 0) >= 1, 'Delivered notice should increment attemptCount');

  console.log('PASS notification hard test');
  console.log(`Test user: ${TEST_EMAIL}`);
  console.log(`Queued notice id: ${queued.id}`);
  console.log(`Summary rooms: ${summary.rooms.length}`);
} finally {
  if (sourceMessageId) {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM OfflineMessage WHERE payload LIKE ?`,
        `%${sourceMessageId}%`
      );
    } catch (error) {
      console.warn(`WARN cleanup failed for ${sourceMessageId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await prisma.$disconnect();
}
