# Admin Member Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-safe admin member management area with member statistics, searchable member list, and safe member detail summaries.

**Architecture:** Create an admin-only API under `app/api/admin/users` backed by a focused helper in `lib/admin-users.ts`. Add a `MEMBERS` tab to `app/admin/page.tsx` that renders aggregate cards, activity-status counts, filters, and a paginated member table without exposing raw chat content, prompts, or API keys.

**Tech Stack:** Next.js App Router, Prisma SQLite, TypeScript, React, lucide-react, Node smoke scripts.

---

### Task 1: API Contract Smoke Test

**Files:**
- Create: `scripts/admin-users-api-check.mjs`

- [x] **Step 1: Write the failing API check**

Create a script that signs an admin session cookie, calls `/api/admin/users`, and asserts the response includes `stats`, `members`, and no raw API key fields.

- [ ] **Step 2: Run check to verify it fails**

Run: `node scripts/admin-users-api-check.mjs`

Expected before implementation: FAIL with HTTP 404 or missing contract.

### Task 2: Admin Member Query Helper

**Files:**
- Create: `lib/admin-users.ts`
- Create: `app/api/admin/users/route.ts`

- [ ] **Step 1: Implement safe field selection**

Return only safe member fields: ids, username, masked email, flags, wallet balance, created date, derived activity date, counts, and API-key presence booleans.

- [ ] **Step 2: Implement aggregate statistics**

Calculate total, active estimate, inactive estimate, admins, regular users, AI users, agents, QA test users, API-key holders, event-only users, sponsor hosts, negative balances, and zero balances.

- [ ] **Step 3: Implement filters**

Support `q`, `role`, `activity`, `apiKey`, `page`, and `pageSize` query parameters with server-side validation and bounds.

### Task 3: Admin UI Member Tab

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add member tab state and loader**

Load `/api/admin/users` after admin verification and whenever filters change.

- [ ] **Step 2: Add statistics dashboard**

Render cards for total, active estimate, inactive estimate, admins, AI friends, agents, API-key holders, event-only users, sponsor hosts, and risk counts.

- [ ] **Step 3: Add member list table**

Render searchable/filterable rows with no private chat content, prompts, or raw API keys.

### Task 4: Verification

**Files:**
- Test: `scripts/admin-users-api-check.mjs`

- [ ] **Step 1: Run API check**

Run: `node scripts/admin-users-api-check.mjs`

Expected: PASS with safe response contract.

- [ ] **Step 2: Run integrity check**

Run: `npm run qa:integrity`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build succeeds.
