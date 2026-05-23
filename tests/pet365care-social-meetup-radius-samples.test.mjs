import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");
const localSeedBlock = source.match(/const LOCAL_MEETUP_SEEDS = \[([\s\S]*?)\] as const;/)?.[1] || "";
const walkSeedBlock = source.match(/const WALK_MATE_SEEDS = \[([\s\S]*?)\] as const;/)?.[1] || "";

assert.equal((localSeedBlock.match(/\bid:/g) || []).length, 30, "Social page should include 30 virtual Seoul/Gyeonggi local meetups.");
assert.equal((walkSeedBlock.match(/\bid:/g) || []).length, 30, "Social page should include 30 virtual Seoul/Gyeonggi walk mate meetups.");
assert.match(source, /const MEETUP_RADIUS_OPTIONS:/, "Meetup list should expose fixed radius options.");
assert.match(source, /\{ value: "all", label: "전체" \}/, "Radius options should include all.");
assert.match(source, /\{ value: "1", label: "1km" \}/, "Radius options should include 1km.");
assert.match(source, /\{ value: "3", label: "3km" \}/, "Radius options should include 3km.");
assert.match(source, /\{ value: "5", label: "5km" \}/, "Radius options should include 5km.");
assert.match(source, /useState<MeetupSearchRadius>\("1"\)/, "Default meetup search radius should be 1km.");
assert.match(source, /getDistanceKm/, "Meetup filtering should calculate distance from the viewer location.");
assert.match(source, /meetupSearchRadiusKm === "all"/, "Meetup filtering should support the all range.");
assert.match(source, /distanceKm: getDistanceKm\(meetup, meetupSearchLocation\)/, "Meetup cards should carry their distance from the current search location.");
assert.match(source, /const MEETUP_MAP_LEVEL_BY_RADIUS: Record<MeetupSearchRadius, number> = \{/, "Map should map radius filters to Kakao map levels.");
assert.match(source, /all: 10/, "All range should use the widest map zoom level.");
assert.match(source, /"1": 5/, "1km range should use the closest map zoom level.");
assert.match(source, /"3": 6/, "3km range should use a medium map zoom level.");
assert.match(source, /"5": 7/, "5km range should use a wider map zoom level.");
assert.match(source, /const mapLevel = MEETUP_MAP_LEVEL_BY_RADIUS\[meetupSearchRadiusKm\]/, "Map initialization should derive zoom from the selected radius.");
assert.match(source, /new window\.kakao\.maps\.Map\(mapContainerRef\.current!, \{ center, level: mapLevel \}\)/, "Kakao map should open with the radius-specific zoom level.");
