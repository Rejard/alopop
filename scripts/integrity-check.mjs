import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const QA_EMAIL_DOMAIN = 'qa-sim.alopop.test';
const QA_TAG = 'QA_SIM_STABLE';
const MAX_SPONSOR_PRICE = 10000;
const SPONSOR_MODELS = new Set([
  'openai',
  'gpt-5.4',
  'gpt-5.4-pro',
  'gemini',
  'gemini-1.5-pro-latest',
  'anthropic',
  'claude-3-haiku-20240307',
]);

const failures = [];
const warnings = [];
const notes = [];

function fail(message, details) {
  failures.push({ message, details });
}

function warn(message, details) {
  warnings.push({ message, details });
}

function note(message, details) {
  notes.push({ message, details });
}

function sample(items, limit = 10) {
  return items.slice(0, limit);
}

async function checkOfflineMessageSchema() {
  const columns = await prisma.$queryRawUnsafe("PRAGMA table_info('OfflineMessage')");
  const names = new Set(columns.map((column) => column.name));
  for (const required of ['id', 'receiverId', 'payload', 'createdAt', 'kind', 'status', 'expiresAt', 'deliveredAt', 'attemptCount']) {
    if (!names.has(required)) fail(`OfflineMessage is missing required column: ${required}`);
  }
}

async function checkUsers() {
  const negativeWalletUsers = await prisma.user.findMany({
    where: { walletBalance: { lt: 0 } },
    select: { id: true, email: true, username: true, walletBalance: true },
    take: 20,
  });
  if (negativeWalletUsers.length) fail('Users with negative walletBalance exist', negativeWalletUsers);

  const qaAdmins = await prisma.user.findMany({
    where: { email: { endsWith: `@${QA_EMAIL_DOMAIN}` }, isAdmin: true },
    select: { id: true, email: true, username: true },
    take: 20,
  });
  if (qaAdmins.length) fail('QA simulation users must never be admins', qaAdmins);

  const aiWithoutOwner = await prisma.user.findMany({
    where: { isAi: true, aiOwnerId: null },
    select: { id: true, email: true, username: true, isAgent: true },
    take: 20,
  });
  if (aiWithoutOwner.length) fail('AI users without aiOwnerId exist', aiWithoutOwner);

  const aiUsers = await prisma.user.findMany({
    where: { isAi: true, aiOwnerId: { not: null } },
    select: { id: true, email: true, username: true, aiOwnerId: true },
  });
  const ownerIds = Array.from(new Set(aiUsers.map((user) => user.aiOwnerId).filter(Boolean)));
  const existingOwners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true },
  });
  const existingOwnerIds = new Set(existingOwners.map((user) => user.id));
  const aiWithMissingOwner = aiUsers.filter((user) => !existingOwnerIds.has(user.aiOwnerId));
  if (aiWithMissingOwner.length) fail('AI users pointing to missing owners exist', sample(aiWithMissingOwner));
}

async function checkRooms() {
  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      name: true,
      isGroup: true,
      sponsorMode: true,
      sponsorModel: true,
      sponsorPrice: true,
      members: {
        select: { id: true, userId: true, isHost: true, isHidden: true },
      },
    },
  });

  const roomsWithoutMembers = [];
  const roomsWithoutVisibleMembers = [];
  const roomsWithBadHostCount = [];
  const sponsorRoomsWithBadModel = [];
  const sponsorRoomsWithBadPrice = [];

  for (const room of rooms) {
    if (room.members.length === 0) roomsWithoutMembers.push({ id: room.id, name: room.name });
    if (!room.members.some((member) => !member.isHidden)) {
      roomsWithoutVisibleMembers.push({ id: room.id, name: room.name });
    }

    const visibleHosts = room.members.filter((member) => member.isHost && !member.isHidden);
    if (room.members.length > 0 && visibleHosts.length !== 1) {
      roomsWithBadHostCount.push({
        id: room.id,
        name: room.name,
        visibleHostCount: visibleHosts.length,
        memberCount: room.members.length,
      });
    }

    if (room.sponsorMode) {
      if (!SPONSOR_MODELS.has(room.sponsorModel || 'openai')) {
        sponsorRoomsWithBadModel.push({ id: room.id, name: room.name, sponsorModel: room.sponsorModel });
      }
      if (!Number.isInteger(room.sponsorPrice) || room.sponsorPrice < 0 || room.sponsorPrice > MAX_SPONSOR_PRICE) {
        sponsorRoomsWithBadPrice.push({ id: room.id, name: room.name, sponsorPrice: room.sponsorPrice });
      }
    }
  }

  if (roomsWithoutMembers.length) warn('Rooms without members exist', sample(roomsWithoutMembers));
  if (roomsWithoutVisibleMembers.length) warn('Rooms without visible members exist', sample(roomsWithoutVisibleMembers));
  if (roomsWithBadHostCount.length) fail('Rooms must have exactly one visible host', sample(roomsWithBadHostCount));
  if (sponsorRoomsWithBadModel.length) fail('Sponsor rooms with unsupported models exist', sample(sponsorRoomsWithBadModel));
  if (sponsorRoomsWithBadPrice.length) fail('Sponsor rooms with invalid sponsorPrice exist', sample(sponsorRoomsWithBadPrice));
}

async function checkTransactions() {
  const invalidTransactions = await prisma.transaction.findMany({
    where: { amount: { lte: 0 } },
    select: { id: true, senderId: true, receiverId: true, amount: true, reason: true, createdAt: true },
    take: 20,
  });
  if (invalidTransactions.length) fail('Transactions with non-positive amount exist', invalidTransactions);

  const selfTransferRows = await prisma.$queryRawUnsafe(`
    SELECT id, senderId, receiverId, amount, reason, createdAt
    FROM "Transaction"
    WHERE senderId = receiverId
    ORDER BY createdAt DESC
  `);
  const rewardSelfTransfers = selfTransferRows.filter((row) => String(row.reason || '').includes('이벤트 보상'));
  const suspiciousSelfTransfers = selfTransferRows.filter((row) => !String(row.reason || '').includes('이벤트 보상'));
  if (rewardSelfTransfers.length) {
    note('Event reward self-transfer transactions exist', { count: rewardSelfTransfers.length, sample: sample(rewardSelfTransfers, 5) });
  }
  if (suspiciousSelfTransfers.length) {
    warn('Non-reward self-transfer transactions exist', sample(suspiciousSelfTransfers));
  }
}

async function checkFriendships() {
  const duplicateRows = await prisma.$queryRawUnsafe(`
    SELECT userId, friendId, COUNT(*) as count
    FROM Friendship
    GROUP BY userId, friendId
    HAVING COUNT(*) > 1
  `);
  if (duplicateRows.length) fail('Duplicate friendship rows exist', duplicateRows);

  const qaAiUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${QA_EMAIL_DOMAIN}` }, isAi: true },
    select: { id: true, email: true, username: true, aiOwnerId: true },
  });
  const missingQaFriendships = [];
  for (const ai of qaAiUsers) {
    if (!ai.aiOwnerId) continue;
    const ownerToAi = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: ai.aiOwnerId, friendId: ai.id } },
      select: { id: true, status: true },
    });
    const aiToOwner = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: ai.id, friendId: ai.aiOwnerId } },
      select: { id: true, status: true },
    });
    if (!ownerToAi || !aiToOwner) {
      missingQaFriendships.push({ aiId: ai.id, email: ai.email, ownerId: ai.aiOwnerId });
    }
  }
  if (missingQaFriendships.length) fail('QA AI owner friendships are not bidirectional', missingQaFriendships);
}

async function checkQaStablePool() {
  const qaHumans = await prisma.user.count({
    where: { email: { endsWith: `@${QA_EMAIL_DOMAIN}` }, isAi: false, isAdmin: false },
  });
  const qaAiUsers = await prisma.user.count({
    where: { email: { endsWith: `@${QA_EMAIL_DOMAIN}` }, isAi: true, isAdmin: false },
  });
  const qaRooms = await prisma.room.count({ where: { name: { startsWith: QA_TAG } } });

  if (qaHumans < 36) fail('QA stable human pool is smaller than expected', { expectedAtLeast: 36, actual: qaHumans });
  if (qaAiUsers < 12) fail('QA stable AI pool is smaller than expected', { expectedAtLeast: 12, actual: qaAiUsers });
  if (qaRooms < 4) fail('QA stable room pool is smaller than expected', { expectedAtLeast: 4, actual: qaRooms });
  note('QA stable pool', { qaHumans, qaAiUsers, qaRooms });
}

async function checkPolicyScriptsPresent() {
  for (const file of [
    'scripts/security-smoke.mjs',
    'scripts/sponsor-system-check.mjs',
    'scripts/ai-friend-policy-check.mjs',
    'scripts/sponsor-hard-test.mjs',
    'scripts/ai-friend-hard-test.mjs',
    'scripts/qa-persona-simulation.mjs',
  ]) {
    if (!fs.existsSync(file)) fail(`Required QA script is missing: ${file}`);
  }
}

try {
  await checkPolicyScriptsPresent();
  await checkOfflineMessageSchema();
  await checkUsers();
  await checkRooms();
  await checkTransactions();
  await checkFriendships();
  await checkQaStablePool();

  const summary = {
    status: failures.length ? 'FAIL' : 'PASS',
    failures,
    warnings,
    notes,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (failures.length) process.exit(1);
} finally {
  await prisma.$disconnect();
}
