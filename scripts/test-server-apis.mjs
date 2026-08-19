const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000';

const results = { passed: 0, failed: 0, total: 0 };

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  let body = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function report(name, pass, detail = '') {
  results.total++;
  if (pass) {
    results.passed++;
    console.log(`  ✅ PASS  ${name}`);
  } else {
    results.failed++;
    console.log(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function assertStatus(name, actual, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  report(name, allowed.includes(actual), `expected ${allowed.join('/')} but got ${actual}`);
}

// ─── 1. Backup API ───

async function testBackupApi() {
  console.log('\n── Backup API (/api/admin/backup) ──');

  const getRes = await request('/api/admin/backup');
  assertStatus('GET backup list (no auth → 401/403)', getRes.status, [401, 403]);

  const postRes = await request('/api/admin/backup', { method: 'POST' });
  assertStatus('POST create backup (no auth → 401/403)', postRes.status, [401, 403]);
}

// ─── 2. Messages API ───

async function testMessagesApi() {
  console.log('\n── Messages API (/api/messages) ──');

  const noAuth = await request('/api/messages');
  assertStatus('GET messages (no auth → 401/403)', noAuth.status, [401, 403]);

  const noRoom = await request('/api/messages?roomId=');
  assertStatus('GET messages without roomId (no auth → 401/403 or 400)', noRoom.status, [400, 401, 403]);

  const withRoom = await request('/api/messages?roomId=test-room-id');
  assertStatus('GET messages with roomId (no auth → 401/403)', withRoom.status, [401, 403]);
}

// ─── 3. Wallet Transactions API ───

async function testWalletApi() {
  console.log('\n── Wallet Transactions API (/api/wallet/transactions) ──');

  const res = await request('/api/wallet/transactions');
  assertStatus('GET transactions (no auth → 401/403)', res.status, [401, 403]);
}

// ─── 4. AI Usage API ───

async function testAiUsageApi() {
  console.log('\n── AI Usage API (/api/users/ai-usage) ──');

  const res = await request('/api/users/ai-usage');
  assertStatus('GET ai-usage (no auth → 401/403)', res.status, [401, 403]);
}

// ─── 5. API Keys API ───

async function testKeysApi() {
  console.log('\n── API Keys API (/api/users/keys) ──');

  const res = await request('/api/users/keys');
  assertStatus('GET keys (no auth → 401/403)', res.status, [401, 403]);
}

// ─── 6. Data Export API ───

async function testExportApi() {
  console.log('\n── Data Export API (/api/users/export) ──');

  const res = await request('/api/users/export');
  assertStatus('GET export (no auth → 401/403)', res.status, [401, 403]);
}

// ─── Runner ───

async function runAll() {
  console.log(`\n🔧 Server API Test Suite`);
  console.log(`   Target: ${BASE_URL}\n`);

  const suites = [
    testBackupApi,
    testMessagesApi,
    testWalletApi,
    testAiUsageApi,
    testKeysApi,
    testExportApi,
  ];

  for (const suite of suites) {
    try {
      await suite();
    } catch (err) {
      const name = suite.name || 'unknown';
      results.total++;
      results.failed++;
      console.log(`  ❌ FAIL  ${name} threw: ${err.message || err}`);
    }
  }

  console.log('\n═══ Test Results ═══');
  console.log(`Passed: ${results.passed} / Total: ${results.total}`);
  console.log(`Failed: ${results.failed}`);

  if (results.failed > 0) process.exit(1);
}

runAll();
