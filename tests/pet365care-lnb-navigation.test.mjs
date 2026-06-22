import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layoutSource = readFileSync(new URL("../app/pet365care/layout.tsx", import.meta.url), "utf8");
const alarmBridgeSource = readFileSync(new URL("../components/pet365care/AlarmBridge.tsx", import.meta.url), "utf8");
const bottomNavSource = readFileSync(new URL("../components/pet365care/BottomNav.tsx", import.meta.url), "utf8");

test("Pet365Care app shell mounts the alarm bridge without rendering the bottom nav", () => {
  assert.match(layoutSource, /Pet365AlarmBridge/);
  assert.doesNotMatch(layoutSource, /Pet365BottomNav/);
});

test("Pet365Care alarm bridge remains the only alarm polling owner", () => {
  assert.match(alarmBridgeSource, /pet365care-store/);
  assert.match(alarmBridgeSource, /\/api\/pet365care\/notify/);
  assert.match(alarmBridgeSource, /setInterval\(checkAlarms, 60000\)/);
  assert.match(alarmBridgeSource, /roomName:\s*"Pet365 알림"/);
});

test("Pet365Care bottom nav is navigation-only", () => {
  assert.match(bottomNavSource, /const navItems = \[/);
  assert.match(bottomNavSource, /usePathname/);
  assert.doesNotMatch(bottomNavSource, /pet365care-store/);
  assert.doesNotMatch(bottomNavSource, /setInterval\(checkAlarms, 60000\)/);
  assert.doesNotMatch(bottomNavSource, /\/api\/pet365care\/notify/);
});
