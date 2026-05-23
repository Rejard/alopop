import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");

assert.match(source, /showWriteCategoryChips/, "Composer should explicitly decide when category chips are visible.");
assert.match(source, /writeCategory !== "local" && writeCategory !== "mate"/, "Local meetup and walk mate compose flows should hide category chips.");
assert.match(source, /\{showWriteCategoryChips && \(/, "Category chip row should be conditionally rendered.");
assert.match(source, /WRITE_CATEGORIES/, "General daily composer should have a dedicated category list.");
assert.match(source, /WRITE_CATEGORIES\.map/, "Composer chip row should render the dedicated general category list.");
assert.doesNotMatch(source, /CATEGORIES\.filter\(c => c\.value !== "all"\)\.map\(c => \(/, "General composer should not include local meetup or walk mate chips.");
