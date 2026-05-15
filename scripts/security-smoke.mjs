const baseUrl = process.env.ALOPOP_TEST_BASE_URL || 'http://127.0.0.1:3099';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function assertStatus(name, actual, allowed) {
  if (!allowed.includes(actual)) {
    throw new Error(`${name}: expected ${allowed.join('/')} but got ${actual}`);
  }
}

const json = { 'content-type': 'application/json' };
const tests = [
  {
    name: 'anonymous admin chaos GET is blocked',
    run: async () => assertStatus('admin chaos GET', (await request('/api/admin/chaos')).status, [401, 403]),
  },
  {
    name: 'anonymous internal claw relay is blocked before validation',
    run: async () => assertStatus(
      'internal claw POST',
      (await request('/api/internal/claw-message', { method: 'POST', headers: json, body: '{}' })).status,
      [401, 403],
    ),
  },
  {
    name: 'anonymous internal vibe notify is blocked before validation',
    run: async () => assertStatus(
      'internal vibe POST',
      (await request('/api/internal/vibe-notify', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ action: 'start', roomId: 'qa-room', aiUserId: 'qa-ai' }),
      })).status,
      [401, 403],
    ),
  },
  {
    name: 'anonymous friends GET is blocked',
    run: async () => assertStatus(
      'friends GET',
      (await request('/api/friends?userId=85346042-2319-4164-8e7f-3972eedc3d7b')).status,
      [401, 403],
    ),
  },
  {
    name: 'anonymous event claim is blocked before body validation',
    run: async () => assertStatus(
      'event claim POST',
      (await request('/api/user/events/claim', { method: 'POST', headers: json, body: '{}' })).status,
      [401, 403],
    ),
  },
  {
    name: 'anonymous push subscribe is blocked before body validation',
    run: async () => assertStatus(
      'push subscribe POST',
      (await request('/api/push/subscribe', { method: 'POST', headers: json, body: '{}' })).status,
      [401, 403],
    ),
  },
];

const failures = [];
for (const test of tests) {
  try {
    await test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    console.error(`FAIL ${test.name}`);
  }
}

if (failures.length) {
  console.error('\nSecurity smoke failures:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
