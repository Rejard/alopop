import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const careSource = readFileSync(new URL("../app/pet365care/care/page.tsx", import.meta.url), "utf8");
const hospitalSource = readFileSync(new URL("../app/pet365care/hospitals/page.tsx", import.meta.url), "utf8");

assert.match(
  careSource,
  /recordFormType \? \([\s\S]{0,300}<section className="pet365-medical-record-screen/,
  "Medical record add/edit should render as a full-screen main-content mode."
);

assert.doesNotMatch(
  careSource,
  /\{recordFormType && \([\s\S]{0,300}fixed inset-0/,
  "Medical record form should not render a fixed popup overlay."
);

assert.match(
  careSource,
  /const isNormalCareMode = !recordFormType/,
  "Care page should explicitly hide normal content while record editing is active."
);

assert.match(
  careSource,
  /className="pet365-card p-5 flex flex-col gap-4 border border-white\/10"/,
  "AI summary cards should use the dark Pet365 card surface."
);

assert.match(
  careSource,
  /text-\[var\(--pet365-text\)\]/,
  "AI summary text should use high-contrast Pet365 text colors."
);

assert.match(
  hospitalSource,
  /onReady=\{\(\) => setMapReady\(true\)\}/,
  "Hospital map script should mark Kakao as ready even when the script was loaded before this page mounted."
);

assert.match(
  hospitalSource,
  /if \(window\.kakao\?\.maps\) setMapReady\(true\)/,
  "Hospital map should detect an already-loaded Kakao Maps SDK."
);
