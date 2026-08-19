import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { decideAiFriendCommerce } from "../lib/ai-friend-commerce.ts";
import { isAllowedCommerceActionUrl } from "../lib/commerce-action-policy.ts";
import {
  appendCommerceCardMarker,
  parseCommerceCardMarker,
} from "../lib/commerce-message.ts";

const offers = JSON.parse(
  readFileSync(new URL("../config/commerce_offers.json", import.meta.url), "utf8"),
);

const bookingDecision = decideAiFriendCommerce(
  "[민수]: 제주 공연 예매하고 싶어\n[민수]: 5만원 이하로 찾아줘",
  offers,
);
assert.equal(bookingDecision.mode, "offer");
assert.equal(bookingDecision.offerId, "demo-jeju-concert");

const followupDecision = decideAiFriendCommerce("[민수]: 공연 예매하고 싶어", offers);
assert.equal(followupDecision.mode, "followup");
assert.equal(followupDecision.offerId, null);
assert.match(followupDecision.systemContext, /지역/);

const budgetFollowupDecision = decideAiFriendCommerce("[민수]: 제주 공연 예매하고 싶어", offers);
assert.equal(budgetFollowupDecision.mode, "followup");
assert.equal(budgetFollowupDecision.offerId, null);
assert.match(budgetFollowupDecision.systemContext, /예산/);

const restrictedDecision = decideAiFriendCommerce("[민수]: 두통 약 추천하고 구매하고 싶어", offers);
assert.equal(restrictedDecision.mode, "restricted");
assert.equal(restrictedDecision.offerId, null);

const ordinaryDecision = decideAiFriendCommerce("[민수]: 오늘 기분이 좋아", offers);
assert.equal(ordinaryDecision.mode, "none");

const markedReply = appendCommerceCardMarker("공식 판매처에서 확인해보세요.", "demo-jeju-concert");
const parsedReply = parseCommerceCardMarker(markedReply);
assert.equal(parsedReply.text, "공식 판매처에서 확인해보세요.");
assert.equal(parsedReply.offerId, "demo-jeju-concert");

const repeatedDecision = decideAiFriendCommerce(markedReply, offers);
assert.equal(repeatedDecision.offerId, null);

const concertOffer = offers.find((offer) => offer.id === "demo-jeju-concert");
assert.equal(concertOffer?.actionType, "EXTERNAL_BOOKING");
assert.equal(isAllowedCommerceActionUrl(concertOffer?.actionUrl || ""), true);
assert.equal(isAllowedCommerceActionUrl("https://example.com/fake-checkout"), false);
assert.equal(isAllowedCommerceActionUrl("javascript:alert(1)"), false);

const componentSource = readFileSync(
  new URL("../components/commerce/CommerceMessageContent.tsx", import.meta.url),
  "utf8",
);
assert.match(componentSource, /\/api\/commerce\/offer\//);
assert.match(componentSource, /광고 · 스폰서 추천/);
assert.match(componentSource, /rel="sponsored noopener noreferrer"/);

const friendRouteSource = readFileSync(
  new URL("../app/api/chat/friend/route.ts", import.meta.url),
  "utf8",
);
assert.match(friendRouteSource, /decideAiFriendCommerce/);
assert.match(friendRouteSource, /appendCommerceCardMarker/);
