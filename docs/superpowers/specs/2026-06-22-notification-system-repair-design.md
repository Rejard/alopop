# Notification System Repair Design

**Date:** 2026-06-22

**Scope:** Repair the Alopop notification flow across offline chat delivery, web push payloads, push subscription lifecycle, Pet365Care alarm dispatch, and server-side push resource handling.

## Problem Summary

The current notification system has five structural issues:

1. Offline chat delivery stores only generic notices, so real missed messages cannot be recovered after reconnect.
2. Web push payloads are generic and always deep-link to `/`, so alerts do not open the relevant conversation or Pet365 destination.
3. Push permission is requested automatically during app boot, which is likely to reduce browser grant rates.
4. Push subscriptions can be created but do not have an explicit unsubscribe or logout cleanup path.
5. Pet365Care alarm polling exists in duplicated forms, which creates drift and a plausible duplicate-send race.

## Approaches Considered

### Option A: Keep notice-only offline storage

This keeps privacy exposure lowest, because the server never temporarily stores raw missed messages. The tradeoff is that users continue losing actual offline message content, which keeps the most serious defect unresolved.

### Option B: Store short-lived replay payloads in `OfflineMessage` and delete after delivery

This preserves the no-long-term-history model while allowing reconnect recovery. The server stores missed message payloads only until delivery or TTL expiry. This is the recommended option because it fixes the user-visible failure without introducing permanent message history.

### Option C: Build a separate encrypted offline queue subsystem

This would be cleaner from a security perspective, but it is too large for the current repair scope. It adds schema, crypto, migration, and client decryption complexity that is unnecessary for this rollout.

**Recommendation:** Option B.

## Proposed Design

### 1. Offline Replay Queue

`OfflineMessage` will become a short-lived replay queue for actual missed message payloads rather than notice-only summaries. The payload remains transient: it is marked delivered and deleted or expired quickly. Reconnect delivery will send a bounded `receive_offline_messages` batch so the client can restore the actual missed messages into IndexedDB and recompute unread counts from real data.

### 2. Push Payload Semantics

Web push payloads will include `kind`, `roomId`, `senderName`, `body`, and a destination URL such as `/?roomId=<id>` or the appropriate Pet365 path. The service worker will continue to show the notification, but click handling will open the specific route instead of the home screen.

### 3. Permission and Subscription Lifecycle

Permission prompting moves out of passive boot-time registration. `PwaRegistry` should still register the service worker, but push permission and subscription sync should happen only after an explicit user action from settings or a dedicated "enable notifications" control. A new unsubscribe API will remove the current browser endpoint, and logout should call it when possible.

### 4. Pet365Care Alarm Ownership

Alarm polling should exist in exactly one mounted component. `Pet365AlarmBridge` is already mounted at the Pet365 layout level, so the duplicate polling logic inside `BottomNav` should be removed. Pet365 room naming and user-facing strings should be normalized at the same time.

### 5. Server Resource Hygiene

`sendWebPush` should reuse the server’s existing Prisma client rather than allocating a new client per push send. This keeps push bursts from multiplying SQLite handles and unnecessary memory pressure.

## Impacted Files

- `server.js`
  Offline replay persistence, reconnect delivery event, push payload contents, Prisma reuse.
- `store/useChatStore.ts`
  Receive and persist offline replay batches.
- `app/page.tsx`
  Recompute unread counts from restored messages and handle push deep-link state.
- `components/PwaRegistry.tsx`
  Boot-time registration only; explicit permission/subscribe flow hook-up.
- `app/api/push/subscribe/route.ts`
  Keep subscribe path; align request contract with explicit action flow.
- `app/api/push/unsubscribe/route.ts`
  New endpoint to delete endpoint rows.
- `public/sw.js`
  Deep-link aware click routing and readable fallback strings.
- `components/pet365care/AlarmBridge.tsx`
  Single source of truth for Pet365 alarm polling.
- `components/pet365care/BottomNav.tsx`
  Remove duplicated polling side effects.
- `scripts/notification-system-check.mjs`
  Update static assertions to match replay-queue behavior.
- `scripts/notification-hard-test.mjs`
  Expand reconnect verification from summary-only to actual replay delivery.
- `tests/pet365care-lnb-navigation.test.mjs`
  Update assertions so layout still mounts `Pet365AlarmBridge` and does not rely on `BottomNav` for alarms.

## Testing Strategy

1. Static structure checks for replay queue behavior, push payload fields, and single Pet365 alarm loop.
2. Hard integration test for offline message queueing, reconnect replay, and delivery state transition.
3. Manual browser verification for:
   - enabling notifications from an explicit action,
   - receiving a push with contextual copy,
   - clicking the push into the correct destination,
   - reconnecting after offline and seeing actual missed messages restored.

## Non-Goals

- Building permanent server-side chat history.
- Reworking the entire chat architecture away from Socket.IO.
- Introducing a new crypto subsystem for offline queues in this rollout.
