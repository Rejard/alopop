import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const routeSource = readFileSync(new URL("../app/api/pet365care/social/posts/route.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

for (const field of [
  "meetupType",
  "verifiedRegionName",
  "verifiedRegionLat",
  "verifiedRegionLng",
  "verifiedRegionAt",
  "localTopic",
  "localJoinMode",
  "localRadiusKm",
  "mateStartPlace",
  "mateStartTime",
  "mateRouteSummary",
  "mateDurationMinutes",
  "mateCapacity",
]) {
  assert.match(schemaSource, new RegExp(`\\b${field}\\b`), `PetPost should persist structured meetup field ${field}.`);
}

assert.match(routeSource, /type SocialPostPayload = \{/, "Posts API should parse a typed social post payload.");
assert.match(routeSource, /validateLocalMeetup/, "Posts API should validate local meetup metadata.");
assert.match(routeSource, /validateWalkMate/, "Posts API should validate walk mate metadata.");
assert.match(routeSource, /category === 'local'/, "Posts API should branch local meetup validation by category.");
assert.match(routeSource, /category === 'mate'/, "Posts API should branch walk mate validation by category.");
assert.match(routeSource, /verifiedRegionName: localMeetup\?\.region\.name/, "Posts API should persist verified region name.");
assert.match(routeSource, /mateStartTime: walkMate\?\.startTime/, "Posts API should persist walk mate departure time.");
assert.match(routeSource, /meetup:/, "Posts API should expose structured meetup data back to clients.");

assert.match(pageSource, /meetup\?:/, "Social page Post type should accept structured meetup metadata.");
assert.match(pageSource, /body: JSON\.stringify\(\{ content, images: writeImages, category: writeCategory, meetup \}\)/, "Composer should submit structured meetup metadata.");
