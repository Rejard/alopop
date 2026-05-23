import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shellSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/pet365care/layout.tsx", import.meta.url), "utf8");
const alarmBridgeSource = readFileSync(new URL("../components/pet365care/AlarmBridge.tsx", import.meta.url), "utf8");

test("Pet365Care navigation is hosted by the Alopop LNB", () => {
  assert.match(shellSource, /PET365CARE_LNB_ITEMS\s*=\s*\[/);
  assert.match(shellSource, /const \[pet365Path, setPet365Path\] = useState\("\/pet365care"\)/);
  assert.match(shellSource, /setPet365Path\(item\.path\)/);
  assert.match(shellSource, /iframe src=\{pet365Path\}/);
  assert.match(shellSource, /title=\{`Pet365Care \$\{item\.name\}`\}/);
});

test("Pet365Care expansion compresses the main LNB with animation", () => {
  assert.match(shellSource, /currentTab === 'pet365care' \? 'gap-1' : 'gap-6'/);
  assert.match(shellSource, /currentTab === 'pet365care' \? 'p-2' : 'p-3'/);
  assert.match(shellSource, /duration-300 ease-\[cubic-bezier\(0\.2,0\.8,0\.2,1\)\]/);
  assert.match(shellSource, /currentTab === 'pet365care' \? 21 : 24/);
});

test("Pet365Care app shell no longer renders its own bottom nav", () => {
  assert.doesNotMatch(layoutSource, /Pet365BottomNav/);
  assert.match(layoutSource, /Pet365AlarmBridge/);
});

test("Pet365Care alarm side effect remains mounted without visible navigation UI", () => {
  assert.match(alarmBridgeSource, /pet365care-store/);
  assert.match(alarmBridgeSource, /\/api\/pet365care\/notify/);
  assert.match(alarmBridgeSource, /setInterval\(checkAlarms, 60000\)/);
  assert.doesNotMatch(alarmBridgeSource, /<nav/);
});
