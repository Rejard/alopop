import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { findCommerceOffer, resolveCommerceActionType } from "@/lib/commerce-offers";

export async function GET(
  request: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  const { user, response } = await requireCurrentUser(request);
  if (!user) return response;

  const { offerId } = await context.params;
  const offer = findCommerceOffer(offerId);
  if (!offer) {
    return NextResponse.json({ error: "추천 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    id: offer.id,
    title: offer.title,
    merchant: offer.merchant,
    summary: offer.summary,
    benefit: offer.benefit,
    price: offer.price,
    rating: offer.rating,
    sponsored: offer.sponsored,
    actionLabel: offer.actionLabel,
    actionType: resolveCommerceActionType(offer),
    redirectPath: `/api/commerce/go/${encodeURIComponent(offer.id)}`,
    disclosure: "가격, 재고, 좌석, 예약 가능 여부는 공식 판매처에서 최종 확인해주세요.",
  });
}
