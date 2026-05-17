import crypto from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const baseUrl = process.env.ALOPOP_BASE_URL || 'http://127.0.0.1:3099';

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_SESSION_SECRET_DEFAULT';
}

function createSessionToken(userId) {
  const payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postAdjust(cookie, body) {
  const response = await fetch(`${baseUrl}/api/admin/users/wallet-adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true, username: true },
  });
  assert(admin, 'No admin user found');

  const target = await prisma.user.findFirst({
    where: {
      isAdmin: false,
      isAi: false,
      email: { endsWith: '@qa-sim.alopop.test' },
    },
    select: { id: true, username: true, walletBalance: true },
  });
  assert(target, 'No non-admin QA target user found');

  const cookie = `alo_session=${createSessionToken(admin.id)}`;

  const unauthenticated = await postAdjust('', {
    targetUserId: target.id,
    amount: 1,
    direction: 'CREDIT',
    reason: 'unauthenticated smoke',
  });
  assert(unauthenticated.response.status === 401, `Unauthenticated request should be 401, got ${unauthenticated.response.status}`);

  const missingReason = await postAdjust(cookie, {
    targetUserId: target.id,
    amount: 1,
    direction: 'CREDIT',
    reason: 'no',
  });
  assert(missingReason.response.status === 400, `Short reason should be 400, got ${missingReason.response.status}`);

  const before = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: { walletBalance: true },
  });
  const reason = `ADMIN_WALLET_CHECK_${Date.now()}`;

  const credit = await postAdjust(cookie, {
    targetUserId: target.id,
    amount: 7,
    direction: 'CREDIT',
    reason,
  });
  assert(credit.response.status === 200, `Credit should be 200, got ${credit.response.status}: ${JSON.stringify(credit.data)}`);
  assert(credit.data.balance === before.walletBalance + 7, 'Credit response balance mismatch');

  const debit = await postAdjust(cookie, {
    targetUserId: target.id,
    amount: 7,
    direction: 'DEBIT',
    reason: `${reason}_REVERSAL`,
  });
  assert(debit.response.status === 200, `Debit should be 200, got ${debit.response.status}: ${JSON.stringify(debit.data)}`);
  assert(debit.data.balance === before.walletBalance, 'Debit response balance mismatch');

  const after = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: { walletBalance: true },
  });
  assert(after.walletBalance === before.walletBalance, 'Wallet balance should be restored after check');

  const auditLogs = await prisma.$queryRaw`
    SELECT "id", "adminId", "targetUserId", "action", "reason", "metadata", "createdAt"
    FROM "AdminAuditLog"
    WHERE "adminId" = ${admin.id}
      AND "targetUserId" = ${target.id}
      AND "action" IN ('WALLET_CREDIT', 'WALLET_DEBIT')
      AND "reason" LIKE ${`%${reason}%`}
    ORDER BY "createdAt" DESC
  `;
  assert(auditLogs.length >= 2, 'Expected wallet adjustment audit logs');
  for (const log of auditLogs) {
    const serialized = JSON.stringify(log);
    assert(!serialized.includes('openaiKey'), 'Audit log leaked openaiKey');
    assert(!serialized.includes('geminiKey'), 'Audit log leaked geminiKey');
    assert(!serialized.includes('anthropicKey'), 'Audit log leaked anthropicKey');
    assert(!serialized.includes('aiPrompt'), 'Audit log leaked aiPrompt');
  }

  console.log(JSON.stringify({
    status: 'PASS',
    admin: admin.username,
    target: target.username,
    balance: after.walletBalance,
    auditLogs: auditLogs.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
