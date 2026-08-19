import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import {
  inferCommerceCategory,
  isRestrictedCommerceQuery,
  recommendCommerceOffers,
} from "../lib/conversational-commerce.ts";

const offers = JSON.parse(
  readFileSync(new URL("../config/commerce_offers.json", import.meta.url), "utf8"),
);

assert.equal(inferCommerceCategory("강남 한식 맛집 찾아줘"), "food");
assert.equal(inferCommerceCategory("제주 호텔 추천"), "travel");
assert.equal(isRestrictedCommerceQuery("두통에 좋은 약 추천"), true);
assert.equal(isRestrictedCommerceQuery("홍대 카페 추천"), false);

const foodResult = recommendCommerceOffers(offers, {
  query: "강남 한식 맛집 찾아줘",
  region: "강남",
  budget: 20000,
});

assert.equal(foodResult.status, "ok");
assert.equal(foodResult.recommendations[0].id, "demo-gangnam-hansik");
assert.match(foodResult.recommendations[0].reason, /강남 지역 조건 일치/);
assert.equal(foodResult.recommendations.every((offer) => offer.category === "food"), true);
assert.equal(foodResult.recommendations.every((offer) => offer.region === "강남" || offer.region === "전국"), true);

const restrictedResult = recommendCommerceOffers(offers, {
  query: "주식 추천해줘",
});

assert.equal(restrictedResult.status, "restricted");
assert.equal(restrictedResult.recommendations.length, 0);

const componentSource = readFileSync(
  new URL("../components/commerce/CommerceAssistant.tsx", import.meta.url),
  "utf8",
);

assert.match(componentSource, /광고 · 데모 스폰서/);
assert.match(componentSource, /주변 채팅은 전송하지 않습니다/);
assert.match(componentSource, /rel="sponsored noreferrer"/);
