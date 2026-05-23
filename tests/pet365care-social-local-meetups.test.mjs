import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");

assert.match(source, /import Script from "next\/script"/, "Social page should load Kakao Maps through Next Script.");
assert.match(source, /const KAKAO_KEY = process\.env\.NEXT_PUBLIC_KAKAO_MAP_KEY/, "Social page should reuse the Kakao map key.");
assert.match(source, /const LOCAL_MEETUPS: LocalMeetup\[] = \[/, "Social page should define local meetup map pins.");
assert.match(source, /mapContainerRef = useRef<HTMLDivElement>\(null\)/, "Social page should keep a Kakao map container ref.");
assert.match(source, /dapi\.kakao\.com\/v2\/maps\/sdk\.js\?appkey=\$\{KAKAO_KEY\}&autoload=false/, "Social page should load the Kakao Maps SDK.");
assert.match(source, /window\.kakao\.maps\.Marker/, "Social page should render Kakao markers for meetups.");
assert.match(source, /setShowLocalMeetups\(true\)/, "Local meetup card should open the local meetup section.");
assert.match(source, /openComposer\("local"/, "Local meetup creation should preselect the local category.");
assert.match(source, /openComposer\("mate"/, "Walk mate creation should preselect the mate category.");
assert.match(source, /내 주변 지역 모임/, "Social page should present a local meetup section.");
assert.match(source, /지도에서 보기/, "Social page should offer a map view for local meetups.");
