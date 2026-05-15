import fs from 'node:fs';

const server = fs.readFileSync('server.js', 'utf8');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const store = fs.readFileSync('store/useChatStore.ts', 'utf8');
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
    name: 'server creates expiring offline notices through one helper',
    pass: server.includes('saveOfflineNotice(') && server.includes('OFFLINE_NOTICE_TTL_MS'),
  },
  {
    name: 'server never stores raw offline payload objects directly',
    pass: !/prisma\.offlineMessage\.create\(\{\s*data:\s*\{\s*receiverId:[^}]+payload:\s*JSON\.stringify\(message\)/s.test(server),
  },
  {
    name: 'all offline fallback routes avoid raw chat payload storage',
    pass: !/payload:\s*JSON\.stringify\((chatMessage|message|messageObj)\)/s.test(pet365Notify)
      && !/prisma\.offlineMessage\.create\([\s\S]*payload:\s*JSON\.stringify\((chatMessage|message|messageObj)\)/s.test(pet365Notify),
  },
  {
    name: 'server drops expired offline notices before delivery',
    pass: server.includes('deleteExpiredOfflineMessages') && server.includes('DELETE FROM OfflineMessage WHERE expiresAt <= ?'),
  },
  {
    name: 'server emits offline activity summary instead of message backlog',
    pass: server.includes('offline_activity_summary') && !server.includes("socket.emit('receive_offline_messages'"),
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
    name: 'client does not bulk-add offline notices as chat messages',
    pass: !/socket\.on\('receive_offline_messages'[\s\S]*bulkAdd/s.test(store)
      && store.includes('offline_activity_summary'),
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
