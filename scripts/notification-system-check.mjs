import fs from 'node:fs';

const server = fs.readFileSync('server.js', 'utf8');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const store = fs.readFileSync('store/useChatStore.ts', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const pet365Notify = fs.readFileSync('app/api/pet365care/notify/route.ts', 'utf8');
const vibeCoder = fs.readFileSync('scripts/vibeCoder.mjs', 'utf8');

const checks = [
  {
    name: 'OfflineMessage has an expiry timestamp',
    pass: /model OfflineMessage[\s\S]*expiresAt\s+DateTime/.test(schema),
  },
  {
    name: 'OfflineMessage tracks delivery status',
    pass: /model OfflineMessage[\s\S]*deliveredAt\s+DateTime\?/.test(schema)
      && /model OfflineMessage[\s\S]*attemptCount\s+Int/.test(schema),
  },
  {
    name: 'server creates expiring offline replay records through one helper',
    pass: server.includes('saveOfflineMessage(') && server.includes('OFFLINE_NOTICE_TTL_MS'),
  },
  {
    name: 'server stores raw offline replay payloads for reconnect delivery',
    pass: /payload:\s*serializeOfflineReplay\(message\)/s.test(server)
      || /payload:\s*JSON\.stringify\(message\)/s.test(server),
  },
  {
    name: 'pet365 fallback no longer rewrites payloads into generic notices',
    pass: !/offline_notice_/s.test(pet365Notify),
  },
  {
    name: 'server drops expired offline notices before delivery',
    pass: server.includes('deleteExpiredOfflineMessages') && server.includes('DELETE FROM OfflineMessage WHERE expiresAt <= ?'),
  },
  {
    name: 'server emits offline replay batches',
    pass: server.includes("socket.emit('receive_offline_messages'")
      && !server.includes("socket.emit('offline_activity_summary'"),
  },
  {
    name: 'web push uses explicit TTL and urgency',
    pass: /sendNotification\(pushConf,\s*payload,\s*\{[\s\S]*TTL:/s.test(server)
      && /urgency:\s*'normal'/.test(server),
  },
  {
    name: 'background task push uses bounded TTL and urgency',
    pass: /sendNotification\(pushConfig,\s*payload,\s*\{[\s\S]*TTL:/s.test(vibeCoder)
      && /urgency:\s*'normal'/.test(vibeCoder),
  },
  {
    name: 'client stores replayed offline messages',
    pass: /socket\.on\('receive_offline_messages'[\s\S]*db\.messages\.bulkPut/s.test(store),
  },
  {
    name: 'page reads roomId from query params for notification entry',
    pass: page.includes("searchParams.get('roomId')"),
  },
  {
    name: 'page rebuilds unread state from restored offline messages',
    pass: page.includes("offline_messages_restored"),
  },
];

let failed = false;
for (const check of checks) {
  if (check.pass) {
    console.log(`PASS ${check.name}`);
  } else {
    failed = true;
    console.error(`FAIL ${check.name}`);
  }
}

if (failed) process.exit(1);
