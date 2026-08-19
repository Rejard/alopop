"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, ShieldCheck, TicketCheck } from "lucide-react";
import { parseCommerceCardMarker } from "@/lib/commerce-message";
import type { CommerceActionType } from "@/lib/conversational-commerce";

type CommerceCard = {
  id: string;
  title: string;
  merchant: string;
  summary: string;
  benefit: string;
  price: number;
  rating: number;
  sponsored: boolean;
  actionLabel: string;
  actionType: CommerceActionType;
  redirectPath: string;
  disclosure: string;
};

type CommerceMessageContentProps = {
  content: string;
  enabled: boolean;
};

function actionTypeLabel(actionType: CommerceActionType) {
  if (actionType === "EXTERNAL_BOOKING") return "예약·예매";
  if (actionType === "EXTERNAL_PURCHASE") return "구매";
  return "공식 정보";
}

function formatPrice(price: number) {
  return price > 0 ? `약 ${price.toLocaleString("ko-KR")}원` : "판매처 확인";
}

export function CommerceMessageContent({ content, enabled }: CommerceMessageContentProps) {
  const parsed = parseCommerceCardMarker(content);
  const offerId = enabled ? parsed.offerId : null;
  const [resolution, setResolution] = useState<{ offerId: string; card: CommerceCard | null } | null>(null);
  const card = resolution?.offerId === offerId ? resolution.card : null;
  const isLoading = Boolean(offerId && resolution?.offerId !== offerId);

  useEffect(() => {
    if (!offerId) return;

    const controller = new AbortController();
    fetch(`/api/commerce/offer/${encodeURIComponent(offerId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("추천 카드를 불러오지 못했습니다.");
        return response.json();
      })
      .then((data) => setResolution({ offerId, card: data }))
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") setResolution({ offerId, card: null });
      });

    return () => controller.abort();
  }, [offerId]);

  return (
    <>
      {enabled ? parsed.text : content}
      {isLoading && (
        <span className="mt-3 flex items-center gap-2 rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/5 px-3 py-2 text-xs text-fuchsia-200">
          <Loader2 size={14} className="animate-spin" /> 공식 추천 확인 중
        </span>
      )}
      {offerId && card?.id === offerId && (
        <article className="mt-3 overflow-hidden rounded-2xl border border-fuchsia-300/20 bg-[#1d1426] p-3.5 text-left text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-black tracking-wider">
                <span className="rounded-full bg-amber-400/15 px-2 py-1 text-amber-200">
                  {card.sponsored ? "광고 · 스폰서 추천" : "일반 추천"}
                </span>
                <span className="rounded-full bg-fuchsia-400/10 px-2 py-1 text-fuchsia-200">
                  {actionTypeLabel(card.actionType)}
                </span>
              </div>
              <h3 className="font-black tracking-tight">{card.title}</h3>
              <p className="mt-1 text-[10px] font-semibold text-zinc-500">{card.merchant}</p>
            </div>
            <div className="shrink-0 text-right text-[10px]">
              <p className="font-black text-fuchsia-200">★ {card.rating.toFixed(1)}</p>
              <p className="mt-1 text-zinc-400">{formatPrice(card.price)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-300">{card.summary}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-200/80">
            <TicketCheck size={13} /> {card.benefit}
          </p>
          <a
            href={card.redirectPath}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-xs font-extrabold text-white transition hover:brightness-110"
          >
            {card.actionLabel} <ExternalLink size={13} />
          </a>
          <p className="mt-2 flex items-start gap-1.5 text-[9px] leading-relaxed text-zinc-500">
            <ShieldCheck size={12} className="mt-0.5 shrink-0" /> {card.disclosure}
          </p>
        </article>
      )}
    </>
  );
}
