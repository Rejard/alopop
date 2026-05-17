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

function assertNoRawSecrets(value, path = 'response') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(
      ![
        'googleId',
        'openaiKey',
        'geminiKey',
        'anthropicKey',
        'agentToken',
        'aiPrompt',
        'content',
        'message',
        'messages',
        'chat',
      ].includes(key),
      `Raw secret/private field leaked at ${path}.${key}`,
    );
    assertNoRawSecrets(child, `${path}.${key}`);
  }
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true, username: true },
  });
  assert(admin, 'No admin user found for admin users API check');

  const response = await fetch(`${baseUrl}/api/admin/users?pageSize=5`, {
    headers: {
      cookie: `alo_session=${createSessionToken(admin.id)}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Expected HTTP 200, got ${response.status}: ${await response.text()}`);
  }
  const body = await response.json();
  assert(body && typeof body === 'object', 'Response body must be an object');
  assert(body.stats && typeof body.stats.totalUsers === 'number', 'stats.totalUsers is required');
  assert(body.stats.activity && typeof body.stats.activity.activeEstimate === 'number', 'stats.activity.activeEstimate is required');
  assert(body.stats.roles && typeof body.stats.roles.admins === 'number', 'stats.roles.admins is required');
  assert(typeof body.stats.access.googleAccounts === 'number', 'stats.access.googleAccounts is required');
  assert(Array.isArray(body.members), 'members array is required');
  assert(body.pagination && typeof body.pagination.total === 'number', 'pagination.total is required');
  assertNoRawSecrets(body);

  const unauthenticated = await fetch(`${baseUrl}/api/admin/users?pageSize=1`);
  assert(
    unauthenticated.status === 401,
    `Unauthenticated admin users request should be 401, got ${unauthenticated.status}`,
  );

  for (const member of body.members) {
    assert(typeof member.id === 'string', 'member.id is required');
    assert(typeof member.username === 'string', 'member.username is required');
    assert(typeof member.hasGoogleAccount === 'boolean', 'member.hasGoogleAccount boolean is required');
    assert(typeof member.hasAnyApiKey === 'boolean', 'member.hasAnyApiKey boolean is required');
    assert(typeof member.activityStatus === 'string', 'member.activityStatus is required');
  }

  const filtered = await fetch(`${baseUrl}/api/admin/users?role=ai&pageSize=5`, {
    headers: {
      cookie: `alo_session=${createSessionToken(admin.id)}`,
    },
  });
  if (!filtered.ok) {
    throw new Error(`Expected filtered HTTP 200, got ${filtered.status}: ${await filtered.text()}`);
  }
  const filteredBody = await filtered.json();
  assert(Array.isArray(filteredBody.members), 'filtered members array is required');
  assert(filteredBody.stats.totalUsers === body.stats.totalUsers, 'Filtered requests should keep global stats stable');
  for (const member of filteredBody.members) {
    assert(member.isAi === true, `role=ai returned non-AI member ${member.id}`);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    admin: admin.username,
    totalUsers: body.stats.totalUsers,
    returnedMembers: body.members.length,
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
