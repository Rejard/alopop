import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { listCommerceOffers } from "@/lib/commerce-offers";
import { recommendCommerceOffers } from "@/lib/conversational-commerce";

const RecommendationSchema = z.object({
  query: z.string().trim().min(2).max(200),
  region: z.string().trim().max(30).optional().default(""),
  budget: z.coerce.number().int().min(0).max(100000000).optional(),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const { user, response } = await requireCurrentUser(request);
  if (!user) return response;

  if (!checkRateLimit(`commerce_recommend_${user.id}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "추천 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요." },
      { status: 429 },
    );
  }

  const parsed = RecommendationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "추천 내용과 개인정보 활용 동의를 확인해주세요." },
      { status: 400 },
    );
  }

  const result = recommendCommerceOffers(listCommerceOffers(), {
    query: parsed.data.query,
    region: parsed.data.region,
    budget: parsed.data.budget,
  });

  return NextResponse.json({
    ...result,
    requestId: crypto.randomUUID(),
    disclosure: "추천 결과에는 스폰서 콘텐츠가 포함될 수 있으며 카드마다 광고 여부를 표시합니다.",
    privacy: "입력한 추천 질문·지역·예산만 이번 요청에 사용하며 주변 대화 내용은 사용하지 않습니다.",
  });
}
