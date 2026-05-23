import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");

assert.match(source, /type VerifiedRegion = \{/, "Local meetups should have an explicit verified-region type.");
assert.match(source, /PET365_VERIFIED_REGION_KEY/, "Verified region should persist like a neighborhood 인증 token.");
assert.match(source, /verifyLocalRegion/, "Social page should expose a local region verification action.");
assert.match(source, /coords2RegionCode/, "Kakao geocoder should be used to resolve GPS into a neighborhood.");
assert.match(source, /지역 인증이 필요해요/, "Local meetup composer should explain that neighborhood verification is required.");
assert.match(source, /writeCategory === "local" && !verifiedRegion/, "Local meetup posting should be blocked without verification.");

assert.match(source, /const \[mateStartTime, setMateStartTime\]/, "Walk mate composer should capture an exact departure time.");
assert.match(source, /const \[mateRouteSummary, setMateRouteSummary\]/, "Walk mate composer should capture a route.");
assert.match(source, /const \[mateStartPlace, setMateStartPlace\]/, "Walk mate composer should capture an exact start place.");
assert.match(source, /writeCategory === "mate" && \(!mateStartPlace\.trim\(\) \|\| !mateStartTime \|\| !mateRouteSummary\.trim\(\)\)/, "Walk mate posting should require place, time, and route.");

assert.match(source, /buildPostContent/, "Meetup metadata should be composed into the submitted post content.");
assert.match(source, /동네 인증:/, "Local meetup posts should include verified neighborhood metadata.");
assert.match(source, /출발 시간:/, "Walk mate posts should include departure time metadata.");
assert.match(source, /산책 코스:/, "Walk mate posts should include route metadata.");
