import type { CommerceCategory, CommerceOffer } from "./conversational-commerce.ts";
import {
  inferCommerceCategory,
  isRestrictedCommerceQuery,
  recommendCommerceOffers,
} from "./conversational-commerce.ts";
import { containsCommerceCardMarker, parseCommerceCardMarker } from "./commerce-message.ts";

type AiFriendCommerceDecision = {
  mode: "none" | "followup" | "offer" | "restricted";
  systemContext: string;
  offerId: string | null;
};

const commerceIntentKeywords = [
  "추천",
  "찾아",
  "구매",
  "사고 싶",
  "필요해",
  "예약",
  "예매",
  "가격",
  "얼마",
  "먹고 싶",
  "가고 싶",
  "어디가",
];

const localCategories = new Set<CommerceCategory>(["food", "cafe", "travel", "culture"]);
const budgetCategories = new Set<CommerceCategory>(["travel", "shopping", "pet", "culture"]);

function inferRegion(query: string, offers: CommerceOffer[]) {
  const regions = [...new Set(offers.map((offer) => offer.region).filter((region) => region !== "전국"))];
  return regions
    .filter((region) => query.includes(region))
    .sort((a, b) => query.lastIndexOf(b) - query.lastIndexOf(a))[0] || "";
}

function inferBudget(query: string) {
  const matches = [...query.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*(만원|만\s*원|원)/g)];
  const match = matches.at(-1);
  if (!match) return undefined;
  const amount = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(amount)) return undefined;
  return match[2].replaceAll(" ", "") === "만원" ? amount * 10000 : amount;
}

function followupPrompt(category: CommerceCategory) {
  if (category === "shopping" || category === "pet") {
    return "사용자가 찾는 상품의 종류와 최대 예산을 한 문장으로 자연스럽게 물어보세요.";
  }
  if (category === "culture") {
    return "사용자에게 원하는 지역, 날짜, 인원, 예산 중 아직 없는 조건을 짧게 물어보세요.";
  }
  if (category === "travel") {
    return "사용자에게 여행 지역, 날짜, 인원, 최대 예산 중 아직 없는 조건을 짧게 물어보세요.";
  }
  return "사용자에게 원하는 지역과 최대 예산 중 아직 없는 조건을 짧게 물어보세요.";
}

export function decideAiFriendCommerce(
  conversation: string,
  offers: CommerceOffer[],
): AiFriendCommerceDecision {
  const hadRecentCard = containsCommerceCardMarker(conversation);
  const cleanConversation = parseCommerceCardMarker(conversation).text;
  const hasIntent = commerceIntentKeywords.some((keyword) => cleanConversation.includes(keyword));
  const category = inferCommerceCategory(cleanConversation);

  if (isRestrictedCommerceQuery(cleanConversation)) {
    return {
      mode: "restricted",
      systemContext: "의료, 금융, 법률처럼 중요한 판단이 필요한 요청에는 상품명, 복용법, 광고, 구매·결제 링크를 제시하지 마세요. 확정적인 진단이나 효능을 주장하지 말고 필요한 경우 자격 있는 전문가나 긴급 지원을 안내하세요.",
      offerId: null,
    };
  }

  if (!hasIntent || !category) {
    return { mode: "none", systemContext: "", offerId: null };
  }

  const region = inferRegion(cleanConversation, offers);
  const budget = inferBudget(cleanConversation);
  const needsRegion = localCategories.has(category) && !region;
  const needsBudget = budgetCategories.has(category) && !budget;

  if (needsRegion || needsBudget) {
    return {
      mode: "followup",
      systemContext: followupPrompt(category),
      offerId: null,
    };
  }

  if (hadRecentCard) {
    return {
      mode: "none",
      systemContext: "최근 스폰서 추천이 이미 표시되었습니다. 같은 광고를 반복하지 말고 일반적인 대화를 이어가세요.",
      offerId: null,
    };
  }

  const result = recommendCommerceOffers(offers, {
    query: cleanConversation,
    region,
    budget,
  }, 1);
  const offer = result.recommendations[0];

  if (!offer) {
    return {
      mode: "followup",
      systemContext: "조건에 맞는 검증된 상품 링크가 없습니다. 링크를 만들지 말고 조건을 조금 더 구체적으로 물어보세요.",
      offerId: null,
    };
  }

  return {
    mode: "offer",
    systemContext: `검증된 ${offer.category} 추천 카드가 답변 뒤에 별도로 표시됩니다. ${offer.title}을 자연스럽게 소개하되 URL을 직접 쓰거나 실시간 재고, 좌석, 가격 확정을 주장하지 마세요. 최종 조건과 결제 정보는 공식 판매처에서 다시 확인해야 한다고 짧게 안내하세요.`,
    offerId: offer.id,
  };
}
