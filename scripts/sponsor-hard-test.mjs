import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const BASE_URL = process.env.ALOPOP_BASE_URL || 'http://127.0.0.1:3099';
const SESSION_COOKIE_NAME = 'alo_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const TEST_PREFIX = `qa-sponsor-${Date.now()}`;

let hostId = '';
let guestId = '';
let poorGuestId = '';
let roomId = '';

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

function cookieFor(userId) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(createSessionToken(userId))}`;
}

function internalSecret() {
  return process.env.INTERNAL_API_SECRET
    || process.env.SESSION_SECRET
    || process.env.ENCRYPTION_KEY
    || 'ALO_POP_INTERNAL_SECRET_DEFAULT';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function createFixture() {
  const host = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-host@example.test`,
      username: `${TEST_PREFIX}-host`,
      walletBalance: 1000,
    },
  });
  const guest = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-guest@example.test`,
      username: `${TEST_PREFIX}-guest`,
      walletBalance: 1000,
    },
  });
  const poorGuest = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-poor@example.test`,
      username: `${TEST_PREFIX}-poor`,
      walletBalance: 0,
    },
  });
  const room = await prisma.room.create({
    data: {
      name: TEST_PREFIX,
      isGroup: true,
      sponsorMode: true,
      sponsorModel: 'gpt-5.4',
      sponsorPrice: 25,
      members: {
        create: [
          { userId: host.id, isHost: true },
          { userId: guest.id },
          { userId: poorGuest.id },
        ],
      },
    },
  });

  hostId = host.id;
  guestId = guest.id;
  poorGuestId = poorGuest.id;
  roomId = room.id;
}

async function cleanup() {
  if (roomId) {
    await prisma.room.deleteMany({ where: { id: roomId } });
  }
  await prisma.transaction.deleteMany({
    where: {
      OR: [
        { senderId: { in: [hostId, guestId, poorGuestId].filter(Boolean) } },
        { receiverId: { in: [hostId, guestId, poorGuestId].filter(Boolean) } },
        { reason: { contains: TEST_PREFIX } },
      ],
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: TEST_PREFIX,
      },
    },
  });
}

async function putSponsorSettings(asUserId, body) {
  return fetch(`${BASE_URL}/api/rooms/sponsor`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieFor(asUserId),
    },
    body: JSON.stringify(body),
  });
}

async function postSponsorFactCheck(senderId, content = 'QA sponsor message') {
  return fetch(`${BASE_URL}/api/chat/sponsor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-alopop-internal': internalSecret(),
    },
    body: JSON.stringify({
      roomId,
      message: {
        messageId: `${TEST_PREFIX}-${senderId}`,
        senderId,
        senderName: 'QA Guest',
        receiverId: roomId,
        messageType: 'TEXT',
        content,
        createdAt: Date.now(),
      },
    }),
  });
}

try {
  await createFixture();

  const nonHostUpdate = await putSponsorSettings(guestId, {
    roomId,
    sponsorMode: false,
  });
  assert(nonHostUpdate.status === 403, `Non-host update should be forbidden, got HTTP ${nonHostUpdate.status}`);

  const badModel = await putSponsorSettings(hostId, {
    roomId,
    sponsorMode: true,
    sponsorModel: 'not-a-real-sponsor-model',
  });
  const badModelBody = await readJson(badModel);
  assert(badModel.status === 400, `Unsupported model should fail with 400, got HTTP ${badModel.status}`);
  assert(String(badModelBody.error || '').includes('Unsupported sponsor model'), 'Unsupported model response should name the model error');

  const badPrice = await putSponsorSettings(hostId, {
    roomId,
    sponsorMode: true,
    sponsorPrice: 10001,
  });
  const badPriceBody = await readJson(badPrice);
  assert(badPrice.status === 400, `High sponsor price should fail with 400, got HTTP ${badPrice.status}`);
  assert(String(badPriceBody.error || '').includes('sponsorPrice'), 'High sponsor price response should name sponsorPrice');

  const missingKey = await postSponsorFactCheck(guestId, 'QA missing host key');
  const missingKeyBody = await readJson(missingKey);
  assert(missingKey.ok, `Missing host key should skip safely, got HTTP ${missingKey.status}`);
  assert(missingKeyBody.skipped === true, 'Missing host key should return skipped=true');
  assert(missingKeyBody.reason === 'Host API Key missing', 'Missing host key should not fall back to an env API key');

  const unchangedAfterMissingKey = await prisma.user.findMany({
    where: { id: { in: [hostId, guestId] } },
    select: { id: true, walletBalance: true },
  });
  const missingKeyBalances = new Map(unchangedAfterMissingKey.map((user) => [user.id, user.walletBalance]));
  assert(missingKeyBalances.get(hostId) === 1000, 'Host balance should not change when host key is missing');
  assert(missingKeyBalances.get(guestId) === 1000, 'Guest balance should not change when host key is missing');

  await prisma.user.update({
    where: { id: hostId },
    data: { openaiKey: 'qa-fake-host-openai-key' },
  });
  await prisma.room.update({
    where: { id: roomId },
    data: { sponsorPrice: 50 },
  });

  const insufficient = await postSponsorFactCheck(poorGuestId, 'QA insufficient funds');
  const insufficientBody = await readJson(insufficient);
  assert(insufficient.status === 402, `Insufficient funds should fail before AI call with 402, got HTTP ${insufficient.status}`);
  assert(insufficientBody.error === 'INSUFFICIENT_FUNDS', 'Insufficient funds should return the structured error code');

  const unchangedAfterInsufficient = await prisma.user.findMany({
    where: { id: { in: [hostId, poorGuestId] } },
    select: { id: true, walletBalance: true },
  });
  const insufficientBalances = new Map(unchangedAfterInsufficient.map((user) => [user.id, user.walletBalance]));
  assert(insufficientBalances.get(hostId) === 1000, 'Host balance should not change when guest lacks coins');
  assert(insufficientBalances.get(poorGuestId) === 0, 'Guest balance should not go negative when guest lacks coins');

  console.log('PASS sponsor hard test');
  console.log(`Room fixture: ${roomId}`);
} finally {
  try {
    await cleanup();
  } finally {
    await prisma.$disconnect();
  }
}
