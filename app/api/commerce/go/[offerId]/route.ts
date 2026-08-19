import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { findCommerceOffer } from "@/lib/commerce-offers";
import { isAllowedCommerceActionUrl } from "@/lib/commerce-action-policy";
import { logUserActivity } from "@/lib/auditLogger";

export async function GET(
  request: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  const { user, response } = await requireCurrentUser(request);
  if (!user) return response;

  const { offerId } = await context.params;
  const offer = findCommerceOffer(offerId);
  if (!offer || !isAllowedCommerceActionUrl(offer.actionUrl)) {
    return NextResponse.json({ error: "허용된 공식 링크를 찾을 수 없습니다." }, { status: 404 });
  }

  await logUserActivity({
    userId: user.id,
    activityType: "COMMERCE_LINK_CLICK",
    status: "SUCCESS",
    metadata: {
      offerId: offer.id,
      category: offer.category,
      sponsored: offer.sponsored,
    },
  });

  return NextResponse.redirect(offer.actionUrl, 302);
}
