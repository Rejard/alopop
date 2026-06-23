# Notification System Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair Alopop notifications so offline users recover real missed messages, push alerts open the right destination, subscription lifecycle is explicit and reversible, Pet365 alarms send from one source only, and push sending reuses server resources safely.

**Architecture:** Convert `OfflineMessage` from a notice-only queue into a short-lived replay queue, then update the client to ingest replay batches and rebuild unread state from real messages. In parallel, make push payloads contextual, move permission prompting behind explicit user action, consolidate Pet365 alarm polling into `Pet365AlarmBridge`, and remove per-send Prisma allocation.

**Tech Stack:** Next.js App Router, React 19, Socket.IO, Express, Prisma with SQLite, Service Worker Web Push, Node `test`, custom `.mjs` verification scripts.

---

## File Map

- Modify: `server.js`
  Add replay payload persistence, reconnect replay delivery, contextual push payloads, and Prisma reuse.
- Modify: `store/useChatStore.ts`
  Add `receive_offline_messages` ingestion and duplicate-safe IndexedDB persistence.
- Modify: `app/page.tsx`
  Update unread recomputation and deep-link handling for room-targeted notification entry.
- Modify: `components/PwaRegistry.tsx`
  Keep worker registration at boot, but remove boot-time permission prompt and expose explicit subscribe/unsubscribe helpers.
- Modify: `app/api/push/subscribe/route.ts`
  Keep authenticated upsert behavior and accept explicit client-driven requests.
- Create: `app/api/push/unsubscribe/route.ts`
  Delete the current endpoint row for the logged-in user.
- Modify: `public/sw.js`
  Display readable fallback copy and deep-link to `data.url`.
- Modify: `components/pet365care/AlarmBridge.tsx`
  Keep the only alarm polling loop here and normalize room naming.
- Modify: `components/pet365care/BottomNav.tsx`
  Remove duplicated alarm polling side effect and leave navigation-only behavior.
- Modify: `scripts/notification-system-check.mjs`
  Replace notice-only assertions with replay-queue assertions.
- Modify: `scripts/notification-hard-test.mjs`
  Assert actual offline replay delivery and post-delivery cleanup/transition.
- Modify: `tests/pet365care-lnb-navigation.test.mjs`
  Assert that alarm ownership stays in `Pet365AlarmBridge` only.

### Task 1: Offline Replay Queue On The Server

**Files:**
- Modify: `server.js`
- Modify: `scripts/notification-system-check.mjs`
- Modify: `scripts/notification-hard-test.mjs`

- [ ] **Step 1: Write the failing static and hard-test expectations**

Update `scripts/notification-system-check.mjs` so the client/server checks expect replay delivery instead of summary-only behavior:

```js
{
  name: 'server emits offline replay batches',
  pass: server.includes("socket.emit('receive_offline_messages'")
    && !server.includes("socket.emit('offline_activity_summary'"),
},
{
  name: 'offline fallback stores replay payloads for delivery',
  pass: /saveOfflineMessage\(/.test(server)
    && /payload:\s*JSON\.stringify\(message\)/.test(server),
},
```

Update `scripts/notification-hard-test.mjs` so reconnect waits for `receive_offline_messages` and asserts the real message content is returned:

```js
socket.on('receive_offline_messages', (payload) => {
  clearTimeout(timeout);
  socket.close();
  resolve(payload);
});

assert(Array.isArray(replay.messages), 'Offline replay payload should include messages');
assert(replay.messages.some((item) => item.messageId === sourceMessageId), 'Replayed batch did not include the queued message');
assert(replay.messages.some((item) => item.content === SECRET_MARKER), 'Replayed batch lost message content');
```

- [ ] **Step 2: Run the targeted checks to verify they fail against the current implementation**

Run:

```powershell
node scripts/notification-system-check.mjs
node scripts/notification-hard-test.mjs
```

Expected:
- `notification-system-check.mjs` fails because the code still emits `offline_activity_summary`.
- `notification-hard-test.mjs` fails because reconnect never receives actual replay messages.

- [ ] **Step 3: Implement short-lived replay storage and delivery in `server.js`**

Replace notice-specific helper naming and delivery with replay semantics:

```js
function serializeOfflineReplay(message) {
  return JSON.stringify(message);
}

async function saveOfflineMessage(receiverId, message) {
  if (!receiverId || !message?.messageId) return null;
  return prisma.$executeRawUnsafe(
    `INSERT INTO OfflineMessage (id, receiverId, kind, status, payload, createdAt, expiresAt, attemptCount)
     VALUES (?, ?, 'REPLAY', 'PENDING', ?, ?, ?, 0)`,
    crypto.randomUUID(),
    receiverId,
    serializeOfflineReplay(message),
    new Date().toISOString(),
    new Date(Date.now() + OFFLINE_NOTICE_TTL_MS).toISOString()
  );
}

async function deliverOfflineMessages(socket) {
  const records = await prisma.$queryRawUnsafe(
    `SELECT id, payload, createdAt
     FROM OfflineMessage
     WHERE receiverId = ? AND status = 'PENDING' AND expiresAt > ?
     ORDER BY createdAt ASC`,
    socket.userId,
    new Date().toISOString()
  );

  const messages = records
    .map((record) => {
      try { return JSON.parse(record.payload); } catch { return null; }
    })
    .filter(Boolean);

  if (messages.length > 0) {
    socket.emit('receive_offline_messages', { messages });
  }
}
```

Also update all fallback call sites from `saveOfflineNotice(...)` to `saveOfflineMessage(...)`.

- [ ] **Step 4: Run the targeted checks again**

Run:

```powershell
node scripts/notification-system-check.mjs
node scripts/notification-hard-test.mjs
```

Expected:
- Both scripts pass.
- `notification-hard-test.mjs` reports the replay batch includes the source message.

- [ ] **Step 5: Commit**

```powershell
git add server.js scripts/notification-system-check.mjs scripts/notification-hard-test.mjs
git commit -m "fix: restore offline notification message replay"
```

### Task 2: Client Replay Ingestion And Room Deep-Linking

**Files:**
- Modify: `store/useChatStore.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the failing client-side assertions**

Add static assertions near the bottom of `scripts/notification-system-check.mjs`:

```js
{
  name: 'client stores replayed offline messages',
  pass: /socket\.on\('receive_offline_messages'[\s\S]*db\.messages\.bulkPut/s.test(store),
},
{
  name: 'page reads roomId from query params for notification entry',
  pass: page.includes("searchParams.get('roomId')"),
},
```

- [ ] **Step 2: Run the static verification**

Run:

```powershell
node scripts/notification-system-check.mjs
```

Expected:
- It fails because the client only listens to `offline_activity_summary` and the page does not open a room from notification query state.

- [ ] **Step 3: Implement replay ingestion and deep-link support**

In `store/useChatStore.ts`, add an offline replay listener:

```ts
socket.on('receive_offline_messages', async (payload: { messages: ChatMessage[] }) => {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  if (messages.length === 0) return;

  const deduped = [];
  for (const message of messages) {
    const exists = await db.messages.where('messageId').equals(message.messageId).first();
    if (!exists) deduped.push(message);
  }

  if (deduped.length > 0) {
    await db.messages.bulkPut(deduped as any[]);
    window.dispatchEvent(new CustomEvent('offline_messages_restored', { detail: { messages: deduped } }));
  }
});
```

In `app/page.tsx`, add room-targeted entry handling:

```ts
const searchParams = new URLSearchParams(window.location.search);
const initialRoomId = searchParams.get('roomId');
if (initialRoomId) {
  setCurrentTab('chats');
  setCurrentRoom((prev) => prev?.id === initialRoomId ? prev : roomsData.find((room: any) => room.id === initialRoomId) || null);
}
```

Also replace `offline_activity_summary` usage with `offline_messages_restored`-driven unread recomputation from real stored messages.

- [ ] **Step 4: Run the verification**

Run:

```powershell
node scripts/notification-system-check.mjs
```

Expected:
- The static notification checks pass, including replay ingestion and `roomId` deep-link detection.

- [ ] **Step 5: Commit**

```powershell
git add store/useChatStore.ts app/page.tsx scripts/notification-system-check.mjs
git commit -m "fix: restore offline messages into client state"
```

### Task 3: Contextual Web Push And Subscription Lifecycle

**Files:**
- Modify: `server.js`
- Modify: `public/sw.js`
- Modify: `components/PwaRegistry.tsx`
- Modify: `app/api/push/subscribe/route.ts`
- Create: `app/api/push/unsubscribe/route.ts`

- [ ] **Step 1: Write the failing assertions for push semantics**

Extend `scripts/notification-system-check.mjs` with contextual payload checks:

```js
{
  name: 'web push payload includes room-aware destination',
  pass: /roomId/.test(server) && /url:\s*`\\/\?roomId=/.test(server),
},
{
  name: 'service worker opens the notification target url',
  pass: sw.includes("event.notification.data.url"),
},
{
  name: 'pwa registry no longer requests permission at boot',
  pass: !pwaRegistry.includes('Notification.requestPermission()'),
},
```

- [ ] **Step 2: Run the static verification to confirm it fails**

Run:

```powershell
node scripts/notification-system-check.mjs
```

Expected:
- It fails because push payloads are generic and `PwaRegistry` still requests permission on mount.

- [ ] **Step 3: Implement contextual payloads and explicit subscribe/unsubscribe flow**

In `server.js`, build payloads from message context:

```js
const payload = JSON.stringify({
  title: `${messageData.senderName || 'Alopop'} 님의 새 메시지`,
  body: typeof messageData.content === 'string' ? messageData.content.slice(0, 80) : '새 메시지가 도착했습니다.',
  roomId: messageData.receiverId,
  url: `/?roomId=${encodeURIComponent(messageData.receiverId)}`,
  kind: 'chat_message',
});
```

In `components/PwaRegistry.tsx`, keep worker registration but move permission/subscription into exported helpers:

```ts
export async function subscribeToPush(registration: ServiceWorkerRegistration, userId: string) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { success: false, reason: 'denied' };
  // fetch vapid key, subscribe, POST /api/push/subscribe
}
```

Create `app/api/push/unsubscribe/route.ts`:

```ts
export async function POST(request: Request) {
  const { user: currentUser, response } = await requireCurrentUser(request);
  if (!currentUser) return response;

  const { endpoint } = await request.json();
  await prisma.pushSubscription.deleteMany({
    where: { userId: currentUser.id, endpoint },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run the static verification again**

Run:

```powershell
node scripts/notification-system-check.mjs
```

Expected:
- Push payload and service worker assertions pass.
- The boot-time permission request assertion passes.

- [ ] **Step 5: Commit**

```powershell
git add server.js public/sw.js components/PwaRegistry.tsx app/api/push/subscribe/route.ts app/api/push/unsubscribe/route.ts scripts/notification-system-check.mjs
git commit -m "fix: improve push notification routing and lifecycle"
```

### Task 4: Consolidate Pet365 Alarm Dispatch

**Files:**
- Modify: `components/pet365care/AlarmBridge.tsx`
- Modify: `components/pet365care/BottomNav.tsx`
- Modify: `tests/pet365care-lnb-navigation.test.mjs`

- [ ] **Step 1: Write the failing Pet365 test expectations**

Update `tests/pet365care-lnb-navigation.test.mjs` so it asserts `BottomNav` no longer owns alarm polling:

```js
const bottomNavSource = readFileSync(new URL("../components/pet365care/BottomNav.tsx", import.meta.url), "utf8");

test("Pet365Care bottom nav is navigation-only", () => {
  assert.doesNotMatch(bottomNavSource, /pet365care-store/);
  assert.doesNotMatch(bottomNavSource, /setInterval\(checkAlarms, 60000\)/);
  assert.doesNotMatch(bottomNavSource, /\/api\/pet365care\/notify/);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```powershell
node --test tests/pet365care-lnb-navigation.test.mjs
```

Expected:
- The new test fails because `BottomNav.tsx` still contains polling logic.

- [ ] **Step 3: Remove duplicate polling and normalize strings**

Keep polling only in `AlarmBridge.tsx`, with normalized room naming:

```ts
body: JSON.stringify({
  petName: pet.name,
  species: pet.species || "other",
  roomName: "Pet365 알림",
  message,
}),
```

Reduce `BottomNav.tsx` to navigation-only UI by removing the `useEffect` alarm block and its alarm-specific types if they become unused.

- [ ] **Step 4: Run the targeted test again**

Run:

```powershell
node --test tests/pet365care-lnb-navigation.test.mjs
```

Expected:
- All tests pass.

- [ ] **Step 5: Commit**

```powershell
git add components/pet365care/AlarmBridge.tsx components/pet365care/BottomNav.tsx tests/pet365care-lnb-navigation.test.mjs
git commit -m "fix: dedupe pet365 notification polling"
```

### Task 5: Reuse Prisma In Push Sending And Final Verification

**Files:**
- Modify: `server.js`
- Modify: `scripts/notification-system-check.mjs`

- [ ] **Step 1: Write the failing resource-hygiene assertion**

Add this check to `scripts/notification-system-check.mjs`:

```js
{
  name: 'sendWebPush reuses the shared prisma client',
  pass: !/async function sendWebPush[\s\S]*new PrismaClient\(\)/s.test(server),
},
```

- [ ] **Step 2: Run the static verification to confirm it fails**

Run:

```powershell
node scripts/notification-system-check.mjs
```

Expected:
- It fails because `sendWebPush` still allocates `new PrismaClient()`.

- [ ] **Step 3: Reuse the shared Prisma client and run the full notification verification set**

Update `server.js`:

```js
async function sendWebPush(targetUserId, messageData) {
  if (!publicVapidKey || !privateVapidKey) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: targetUserId }
  });

  // send payloads with the shared prisma instance
}
```

Then run:

```powershell
node scripts/notification-system-check.mjs
node scripts/notification-hard-test.mjs
node --test tests/pet365care-lnb-navigation.test.mjs
```

Expected:
- All verification commands pass.

- [ ] **Step 4: Run a final workspace safety check**

Run:

```powershell
git status --short
```

Expected:
- Only the intended notification-related files appear as modified or staged.

- [ ] **Step 5: Commit**

```powershell
git add server.js scripts/notification-system-check.mjs
git commit -m "refactor: reuse prisma for push notification delivery"
```

## Manual Verification Checklist

- [ ] Log in, open the app, and confirm push permission is not requested automatically.
- [ ] Trigger the explicit notification opt-in control and confirm the browser permission prompt appears only then.
- [ ] Send a message to an offline user, reconnect that user, and confirm the actual missed message appears in the correct room.
- [ ] Trigger a push notification and confirm clicking it opens `/?roomId=<target>`.
- [ ] Trigger a Pet365 reminder and confirm only one notification message is sent.

## Self-Review

- Spec coverage: This plan covers offline replay, push payloads, subscribe/unsubscribe lifecycle, Pet365 dedupe, and Prisma reuse.
- Placeholder scan: No incomplete placeholder markers remain.
- Type consistency: The plan consistently uses `receive_offline_messages`, `saveOfflineMessage`, `roomId`, and `offline_messages_restored`.
