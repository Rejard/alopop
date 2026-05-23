import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const pageSource = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/pet365care/social/posts/route.ts", import.meta.url), "utf8");

assert.match(pageSource, /openMeetupMap/, "Meetup map should open through a dedicated location-aware handler.");
assert.match(pageSource, /const openMeetupMap = \(\) => \{[\s\S]*verifyLocalRegion\(\{ openMapAfter: true \}\)/, "Map opening should automatically start location verification.");
assert.match(pageSource, /type VerifyLocalRegionOptions = \{ openMapAfter\?: boolean \}/, "Location verification should support opening the map after success.");
assert.match(pageSource, /if \(openMapAfter\) setLocalViewMode\("map"\)/, "Successful verification should open the map automatically.");
assert.doesNotMatch(pageSource, /지도를 보려면 위치 인증이 필요합니다/u, "Map opening should not stop at a manual verification alert.");
assert.match(pageSource, /const mapCenter = verifiedRegion \|\| viewerLocation \|\| DEFAULT_MEETUP_SEARCH_LOCATION/, "Map should center on the viewer's location when it opens.");
assert.match(pageSource, /new window\.kakao\.maps\.LatLng\(mapCenter\.lat, mapCenter\.lng\)/, "Kakao map should use the viewer location for its center.");
assert.match(pageSource, /myLocationOverlay/, "Map should create a separate overlay for the viewer location.");
assert.match(pageSource, /내 위치/u, "Viewer location marker should be labeled as my location.");
assert.match(pageSource, /#2563eb/, "Viewer location marker should use a distinct blue color.");
assert.match(pageSource, /border:3px solid white/, "Viewer location marker should be visually distinct from meetup markers.");

assert.match(routeSource, /export async function PUT/, "Posts API should support editing social posts.");
assert.match(routeSource, /post\.authorId !== user\.id/, "Only the post owner should be able to edit their social post.");
assert.match(routeSource, /prisma\.petPost\.update/, "Edit API should update the existing post.");

assert.match(pageSource, /editingPost/, "Social page should track the post being edited.");
assert.match(pageSource, /handleEditPost/, "Social page should submit edited posts.");
assert.match(pageSource, /method: "PUT"/, "Social page should call the PUT edit API.");
assert.match(pageSource, /<Edit3 size=\{14\}/, "Own posts should show an edit action.");
