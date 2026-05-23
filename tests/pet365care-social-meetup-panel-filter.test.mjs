import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");

assert.match(source, /activeMeetupType/, "Meetup panel should track whether local or mate content is active.");
assert.match(source, /openWalkMateMeetups/, "Walk mate activity button should open its own listing panel.");
assert.match(source, /\.filter\(meetup => meetup\.category === activeMeetupType\)/, "Meetup list should only render the active meetup category.");
assert.match(source, /activeMeetupType === "mate" \? "산책 메이트 목록" : "내 주변 지역 모임"/, "Panel title should switch between local and walk mate labels.");
assert.match(source, /activeMeetupType === "mate" \? "정해진 장소와 시간에 만나 함께 출발해요\." : "동네 반려인들과 넓게 이어지는 모임이에요\."/u, "Panel helper copy should switch by meetup category.");
assert.doesNotMatch(source, /LOCAL_MEETUPS\.map\(meetup/u, "Meetup panel should not map the mixed source list directly.");
assert.match(source, /산책 메이트 모집/u, "Walk mate CTA should say 모집, not 찾기.");
assert.doesNotMatch(source, /산책 메이트 찾기/u, "Old walk mate CTA wording should be removed.");
