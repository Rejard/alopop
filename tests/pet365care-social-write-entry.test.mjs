import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /<button[\s\S]{0,400}aria-label="Open daily share composer"[\s\S]{0,400}onClick=\{\(\) => openComposer\("daily"\)\}/,
  "Daily share activity card should open the write composer."
);

assert.doesNotMatch(
  source,
  /fixed\s+bottom-24\s+right-5[\s\S]{0,300}<Plus\s+size=/,
  "Floating + composer button should be removed because the daily share card is the entry point."
);

assert.doesNotMatch(
  source,
  /import\s+\{[^}]*\bPlus\b[^}]*\}\s+from\s+"lucide-react"/,
  "Plus icon import should be removed with the floating button."
);

assert.match(
  source,
  /\{!showWrite && !editingPost && !detailPost && !viewImage && \(/,
  "Feed should be hidden while a full-screen compose/detail/edit mode is active."
);

assert.match(
  source,
  /showWrite && \([\s\S]{0,200}<main className="pet365-compose-screen/,
  "Write composer should render as a full-screen content mode, not a popup."
);

assert.doesNotMatch(
  source,
  /showWrite && \([\s\S]{0,250}fixed inset-0/,
  "Write composer should not use a fixed modal overlay."
);

assert.doesNotMatch(
  source,
  /editingPost && \([\s\S]{0,250}fixed inset-0/,
  "Post editor should not use a fixed modal overlay."
);

assert.doesNotMatch(
  source,
  /detailPost && \([\s\S]{0,250}fixed inset-0/,
  "Post detail and comments should not use a fixed modal overlay."
);
