export type CommerceCategory = "food" | "cafe" | "travel" | "shopping" | "pet" | "culture";

export type CommerceActionType = "EXTERNAL_DISCOVERY" | "EXTERNAL_PURCHASE" | "EXTERNAL_BOOKING";

export type CommerceOffer = {
  id: string;
  title: string;
  merchant: string;
  category: CommerceCategory;
  region: string;
  summary: string;
  benefit: string;
  price: number;
  rating: number;
  tags: string[];
  sponsored: boolean;
  actionLabel: string;
  actionUrl: string;
  actionType?: CommerceActionType;
};

export type CommerceRecommendationRequest = {
  query: string;
  region?: string;
  budget?: number;
};

export type CommerceRecommendation = CommerceOffer & {
  reason: string;
  score: number;
};

export type CommerceRecommendationResult = {
  status: "ok" | "restricted" | "empty";
  category: CommerceCategory | null;
  message: string;
  recommendations: CommerceRecommendation[];
};

const categoryKeywords: Record<CommerceCategory, string[]> = {
  food: ["맛집", "식당", "한식", "중식", "일식", "양식", "점심", "저녁", "먹을", "배달"],
  cafe: ["카페", "커피", "디저트", "베이커리", "빵", "작업", "조용한"],
  travel: ["여행", "숙소", "호텔", "숙박", "관광", "명소", "펜션", "리조트"],
  shopping: ["쇼핑", "상품", "가격", "구매", "사고", "휴대폰", "노트북", "용품", "사료"],
  pet: ["반려동물", "강아지", "고양이", "동물병원", "펫", "산책"],
  culture: ["공연", "콘서트", "전시", "영화", "티켓", "예매", "뮤지컬", "연극"],
};

const restrictedKeywords = [
  "두통",
  "머리 아파",
  "머리가 아파",
  "머리가 아퍼",
  "진통제",
  "약 추천",
  "처방",
  "질병",
  "암",
  "대출",
  "투자 추천",
  "주식 추천",
  "보험 추천",
  "법률 상담",
  "변호사 추천",
];

const ignoredTokens = new Set(["추천", "찾아줘", "알려줘", "어디", "좋은", "근처", "주변", "원해", "있어"]);

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !ignoredTokens.has(token));
}

export function isRestrictedCommerceQuery(query: string) {
  const normalized = normalize(query);
  return restrictedKeywords.some((keyword) => normalized.includes(keyword));
}

export function inferCommerceCategory(query: string): CommerceCategory | null {
  const normalized = normalize(query);
  const ranked = (Object.entries(categoryKeywords) as Array<[CommerceCategory, string[]]>)
    .map(([category, keywords]) => ({
      category,
      matches: keywords.filter((keyword) => normalized.includes(keyword)).length,
    }))
    .filter((entry) => entry.matches > 0)
    .sort((a, b) => b.matches - a.matches);

  return ranked[0]?.category || null;
}

function scoreOffer(
  offer: CommerceOffer,
  request: CommerceRecommendationRequest,
  category: CommerceCategory | null,
) {
  const queryTokens = tokenize(request.query);
  const normalizedRegion = normalize(request.region || "");
  const searchable = normalize([offer.title, offer.summary, offer.region, ...offer.tags].join(" "));
  const matchingTokens = queryTokens.filter((token) => searchable.includes(token));
  let score = matchingTokens.length * 8 + offer.rating * 2;

  if (category === offer.category) score += 40;
  if (normalizedRegion && normalize(offer.region) === normalizedRegion) score += 18;
  if (normalizedRegion && offer.region === "전국") score += 4;
  if (request.budget && offer.price > 0 && offer.price <= request.budget) score += 10;
  if (request.budget && offer.price > request.budget) score -= 25;

  return { score, matchingTokens };
}

function buildReason(
  offer: CommerceOffer,
  request: CommerceRecommendationRequest,
  matchingTokens: string[],
) {
  const reasons: string[] = [];
  if (request.region && offer.region === request.region) reasons.push(`${offer.region} 지역 조건 일치`);
  if (matchingTokens.length > 0) reasons.push(`${matchingTokens.slice(0, 2).join("·")} 관심사 일치`);
  if (request.budget && offer.price > 0 && offer.price <= request.budget) reasons.push("예산 범위 충족");
  if (reasons.length === 0) reasons.push("요청과 가까운 카테고리");
  return reasons.join(" · ");
}

export function recommendCommerceOffers(
  offers: CommerceOffer[],
  request: CommerceRecommendationRequest,
  limit = 3,
): CommerceRecommendationResult {
  const query = normalize(request.query);
  if (!query) {
    return {
      status: "empty",
      category: null,
      message: "추천받고 싶은 내용을 입력해주세요.",
      recommendations: [],
    };
  }

  if (isRestrictedCommerceQuery(query)) {
    return {
      status: "restricted",
      category: null,
      message: "의료·금융·법률처럼 중요한 판단이 필요한 분야는 광고 추천을 제공하지 않습니다.",
      recommendations: [],
    };
  }

  const category = inferCommerceCategory(query);
  const ranked = offers
    .filter((offer) => !category || offer.category === category)
    .filter((offer) => !request.region || offer.region === request.region || offer.region === "전국")
    .map((offer) => {
      const { score, matchingTokens } = scoreOffer(offer, request, category);
      return {
        ...offer,
        score: Math.round(score * 10) / 10,
        reason: buildReason(offer, request, matchingTokens),
      };
    })
    .filter((offer) => offer.score >= 10)
    .sort((a, b) => b.score - a.score || Number(a.sponsored) - Number(b.sponsored))
    .slice(0, Math.max(1, Math.min(limit, 5)));

  if (ranked.length === 0) {
    return {
      status: "empty",
      category,
      message: "조건에 맞는 추천을 아직 찾지 못했습니다. 지역이나 원하는 종류를 더 구체적으로 입력해주세요.",
      recommendations: [],
    };
  }

  return {
    status: "ok",
    category,
    message: `${ranked.length}개의 추천을 찾았습니다. 스폰서 여부와 추천 이유를 함께 확인하세요.`,
    recommendations: ranked,
  };
}
