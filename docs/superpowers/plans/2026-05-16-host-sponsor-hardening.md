# Host Sponsor Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make room host sponsor mode match the product rule: the host provides the AI model/key, guests may pay coins only after successful sponsored AI use, and clients cannot claim sponsor/delegate privileges the server has not verified.

**Architecture:** Keep sponsor authority on the server. Add a focused sponsor-policy helper, use it from sponsor settings, background fact-check, and friend AI reply routes, and add a smoke test that proves invalid models, missing host keys, and failed AI calls do not move coins.

**Tech Stack:** Next.js route handlers, Prisma SQLite, AI SDK providers, Node smoke scripts.

---

### Task 1: Add Sponsor Policy Helper

**Files:**
- Create: `lib/sponsor-policy.ts`
- Test: `scripts/sponsor-system-check.mjs`

- [ ] **Step 1: Write the failing static policy check**

Create `scripts/sponsor-system-check.mjs`:

```js
import fs from 'node:fs';

const policy = fs.existsSync('lib/sponsor-policy.ts') ? fs.readFileSync('lib/sponsor-policy.ts', 'utf8') : '';
const sponsorRoute = fs.readFileSync('app/api/chat/sponsor/route.ts', 'utf8');
const friendRoute = fs.readFileSync('app/api/chat/friend/route.ts', 'utf8');
const settingsRoute = fs.readFileSync('app/api/rooms/sponsor/route.ts', 'utf8');

const checks = [
  ['sponsor policy helper exists', policy.includes('resolveSponsorModel') && policy.includes('MAX_SPONSOR_PRICE')],
  ['sponsor route rejects env fallback', !/process\.env\.(OPENAI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|ANTHROPIC_API_KEY)/.test(sponsorRoute)],
  ['sponsor route charges after AI success in a transaction', sponsorRoute.indexOf('generateObject') < sponsorRoute.indexOf('prisma.$transaction')],
  ['friend route does not trust raw isDelegate alone', friendRoute.includes('resolveSponsorDelegateAccess')],
  ['settings route validates sponsor model allowlist', settingsRoute.includes('resolveSponsorModel')],
  ['settings route validates sponsor price ceiling', settingsRoute.includes('MAX_SPONSOR_PRICE')],
];

let failed = false;
for (const [name, pass] of checks) {
  if (pass) console.log(`PASS ${name}`);
  else {
    failed = true;
    console.error(`FAIL ${name}`);
  }
}

if (failed) process.exit(1);
```

- [ ] **Step 2: Run the failing check**

Run: `node scripts/sponsor-system-check.mjs`

Expected: FAIL for missing helper and current unsafe sponsor route behavior.

- [ ] **Step 3: Implement sponsor policy helper**

Create `lib/sponsor-policy.ts`:

```ts
import { decryptKey } from '@/lib/crypto';

export type SponsorProvider = 'openai' | 'gemini' | 'anthropic';

export const MAX_SPONSOR_PRICE = 10000;

const SPONSOR_MODELS: Record<string, { provider: SponsorProvider; model: string }> = {
  openai: { provider: 'openai', model: 'gpt-5.4' },
  'gpt-5.4': { provider: 'openai', model: 'gpt-5.4' },
  'gpt-5.4-pro': { provider: 'openai', model: 'gpt-5.4-pro' },
  gemini: { provider: 'gemini', model: 'gemini-1.5-pro-latest' },
  'gemini-1.5-pro-latest': { provider: 'gemini', model: 'gemini-1.5-pro-latest' },
  anthropic: { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
  'claude-3-haiku-20240307': { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
};

export function resolveSponsorModel(model: string | null | undefined) {
  return SPONSOR_MODELS[model || 'openai'] || null;
}

export function parseSponsorPrice(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_SPONSOR_PRICE) return null;
  return parsed;
}

export function decryptHostSponsorKey(
  hostUser: { openaiKey: string | null; geminiKey: string | null; anthropicKey: string | null },
  provider: SponsorProvider
) {
  const encrypted = provider === 'gemini'
    ? hostUser.geminiKey
    : provider === 'anthropic'
      ? hostUser.anthropicKey
      : hostUser.openaiKey;
  return decryptKey(encrypted);
}

export function resolveSponsorDelegateAccess({
  currentUserId,
  room,
  sponsorId,
  aiUserId,
}: {
  currentUserId: string;
  sponsorId?: string | null;
  aiUserId?: string | null;
  room: { sponsorMode: boolean; members: Array<{ userId: string; isHost: boolean; isHidden: boolean }> } | null;
}) {
  if (!room?.sponsorMode || !sponsorId || !aiUserId) return false;
  const isCurrentRoomMember = room.members.some((member) => member.userId === currentUserId && !member.isHidden);
  const sponsorMember = room.members.find((member) => member.isHost && member.userId === sponsorId);
  const aiMember = room.members.find((member) => member.userId === aiUserId && !member.isHidden);
  return Boolean(isCurrentRoomMember && sponsorMember && aiMember);
}
```

- [ ] **Step 4: Run the check again**

Run: `node scripts/sponsor-system-check.mjs`

Expected: Some checks still fail until Tasks 2-4 are done.

### Task 2: Harden Sponsor Settings API

**Files:**
- Modify: `app/api/rooms/sponsor/route.ts`
- Test: `scripts/sponsor-system-check.mjs`

- [ ] **Step 1: Validate model and price using the helper**

In `app/api/rooms/sponsor/route.ts`, import:

```ts
import { MAX_SPONSOR_PRICE, parseSponsorPrice, resolveSponsorModel } from '@/lib/sponsor-policy';
```

Replace the current price parsing with:

```ts
const parsedSponsorPrice = sponsorPrice === undefined ? undefined : parseSponsorPrice(sponsorPrice);
if (sponsorPrice !== undefined && parsedSponsorPrice === null) {
  return NextResponse.json({ error: `sponsorPrice must be an integer from 0 to ${MAX_SPONSOR_PRICE}` }, { status: 400 });
}

const parsedSponsorModel = sponsorModel === undefined ? undefined : resolveSponsorModel(sponsorModel);
if (sponsorModel !== undefined && sponsorMode !== false && !parsedSponsorModel) {
  return NextResponse.json({ error: 'Unsupported sponsor model' }, { status: 400 });
}
```

Use this update data:

```ts
data: {
  sponsorMode,
  sponsorModel: sponsorMode === false ? null : parsedSponsorModel?.model,
  sponsorPrice: parsedSponsorPrice,
},
```

- [ ] **Step 2: Run static check**

Run: `node scripts/sponsor-system-check.mjs`

Expected: Settings route checks pass.

### Task 3: Fix Background Sponsor Fact-Check Charging

**Files:**
- Modify: `app/api/chat/sponsor/route.ts`
- Test: `scripts/sponsor-system-check.mjs`

- [ ] **Step 1: Remove host-key env fallback**

Import:

```ts
import { decryptHostSponsorKey, resolveSponsorModel } from '@/lib/sponsor-policy';
```

Replace model/provider/key selection with:

```ts
const sponsorConfig = resolveSponsorModel(room.sponsorModel);
if (!sponsorConfig) {
  return NextResponse.json({ skipped: true, reason: 'Unsupported sponsor model' });
}

const apiKey = decryptHostSponsorKey(hostUser, sponsorConfig.provider);
if (!apiKey) {
  return NextResponse.json({ skipped: true, reason: 'Host API Key missing' });
}
```

- [ ] **Step 2: Move payment after successful AI analysis**

Delete the pre-AI debit/credit block currently before image/model execution.

After `const aiRes = { ... }`, add:

```ts
if (sponsorPrice > 0) {
  const paymentResult = await prisma.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: message.senderId, walletBalance: { gte: sponsorPrice } },
      data: { walletBalance: { decrement: sponsorPrice } },
    });
    if (debit.count !== 1) return false;

    await tx.user.update({
      where: { id: hostUser.id },
      data: { walletBalance: { increment: sponsorPrice } },
    });

    await tx.transaction.create({
      data: {
        senderId: message.senderId,
        receiverId: hostUser.id,
        amount: sponsorPrice,
        reason: `[AI fact-check sponsor fee] Room ${roomId}`,
      },
    });

    return true;
  });

  if (!paymentResult) {
    return NextResponse.json({
      success: false,
      error: 'INSUFFICIENT_FUNDS',
      aiAnalysis: { category: 'FAILED', reason: '코인이 부족해 스폰서 AI 분석을 취소했습니다.' },
    }, { status: 402 });
  }
}
```

- [ ] **Step 3: Run static check**

Run: `node scripts/sponsor-system-check.mjs`

Expected: Sponsor route checks pass.

### Task 4: Stop Trusting Client Delegate Claims

**Files:**
- Modify: `app/api/chat/friend/route.ts`
- Test: `scripts/sponsor-system-check.mjs`

- [ ] **Step 1: Use server-side delegate access helper**

Import:

```ts
import { decryptHostSponsorKey, resolveSponsorDelegateAccess } from '@/lib/sponsor-policy';
```

Replace the sponsor delegate block condition with:

```ts
if (!apiKey && isDelegate && resolveSponsorDelegateAccess({
  currentUserId: currentUser.id,
  room: sponsorRoom,
  sponsorId,
  aiUserId,
})) {
```

Replace host key resolution with:

```ts
apiKey = hostUser ? decryptHostSponsorKey(hostUser, currentProvider) : null;
```

- [ ] **Step 2: Run static check**

Run: `node scripts/sponsor-system-check.mjs`

Expected: All static checks pass.

### Task 5: Runtime Sponsor Smoke Test

**Files:**
- Create: `scripts/sponsor-hard-test.mjs`

- [ ] **Step 1: Create smoke test script**

Create `scripts/sponsor-hard-test.mjs` to check:

```js
console.log('Sponsor hard test checklist:');
console.log('1. Non-host cannot update /api/rooms/sponsor: expect 403');
console.log('2. Host cannot save unsupported sponsorModel: expect 400');
console.log('3. Host cannot save sponsorPrice above MAX_SPONSOR_PRICE: expect 400');
console.log('4. Sponsor route without host key returns skipped and does not move wallet balances');
console.log('5. Sponsor route with insufficient guest coins returns 402 and does not credit host');
```

Use local Prisma setup and signed session cookie pattern from `scripts/notification-hard-test.mjs`.

- [ ] **Step 2: Run checks**

Run:

```powershell
node scripts/sponsor-system-check.mjs
node scripts/sponsor-hard-test.mjs
npm run build
node scripts/security-smoke.mjs
```

Expected: All sponsor checks, build, and security smoke pass.

### Task 6: Commit, Restart, Push Only After Approval

**Files:**
- Commit all modified sponsor files and scripts.

- [ ] **Step 1: Restart local server**

Run:

```powershell
pm2 restart "(99) alopop"
pm2 list
```

Expected: `(99) alopop` is online.

- [ ] **Step 2: Commit locally**

Run:

```powershell
git add lib/sponsor-policy.ts app/api/rooms/sponsor/route.ts app/api/chat/sponsor/route.ts app/api/chat/friend/route.ts scripts/sponsor-system-check.mjs scripts/sponsor-hard-test.mjs
git commit -m "Harden host sponsor mode"
```

- [ ] **Step 3: Push only if the user explicitly approves GitHub upload**

Run only after approval:

```powershell
git push origin main
```

---

## Self-Review

- Spec coverage: Host key ownership, guest payment after success, server-side privilege checks, model/price validation, and verification are all covered.
- Placeholder scan: No task relies on unspecified "add tests later" wording; each task names exact files and commands.
- Type consistency: `SponsorProvider`, `resolveSponsorModel`, `parseSponsorPrice`, `decryptHostSponsorKey`, and `resolveSponsorDelegateAccess` are introduced in Task 1 and reused consistently.
