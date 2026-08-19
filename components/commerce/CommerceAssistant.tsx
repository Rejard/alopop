"use client";

import { FormEvent, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { CommerceRecommendation } from "@/lib/conversational-commerce";

type ApiResult = {
  status: "ok" | "restricted" | "empty";
  message: string;
  disclosure: string;
  privacy: string;
  recommendations: CommerceRecommendation[];
};

const quickQueries = ["강남 한식 맛집", "홍대 조용한 카페", "제주 숙소", "반려동물 용품"];
const regions = ["", "강남", "홍대", "성수", "여의도", "부산", "제주"];

function formatPrice(price: number) {
  if (price === 0) return "가격 조건 없음";
  return `약 ${price.toLocaleString("ko-KR")}원`;
}

export function CommerceAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [budget, setBudget] = useState("");
  const [consent, setConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);

  if (pathname !== "/") return null;

  const submitRecommendation = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("추천 질문을 이번 요청에 사용하는 데 동의해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/commerce/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          region,
          budget: budget ? Number(budget) : undefined,
          consent: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "추천을 불러오지 못했습니다.");
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "추천 요청에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{ right: "max(1rem, calc((100vw - 448px) / 2 + 1rem))" }}
        className="fixed bottom-24 z-[70] flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-[#22132f]/95 px-4 py-3 text-sm font-extrabold text-fuchsia-100 shadow-[0_16px_50px_rgba(168,85,247,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-fuchsia-300/50 hover:bg-[#30183f]"
        aria-label="대화형 추천 열기"
      >
        <Sparkles size={17} className="text-fuchsia-300" />
        추천받기
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="flex max-h-[92dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[linear-gradient(160deg,#24152f_0%,#15101d_62%,#10141c_100%)] text-white shadow-[0_30px_100px_rgba(0,0,0,0.6)] sm:rounded-[28px]">
            <header className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[11px] font-black tracking-[0.16em] text-fuchsia-300 uppercase">
                  <Sparkles size={14} /> AloPop Context Pick
                </div>
                <h2 className="text-xl font-black tracking-tight">대화로 찾는 맞춤 추천</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">대화방 내용은 읽지 않고 지금 입력한 조건만 사용합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="대화형 추천 닫기"
              >
                <X size={18} />
              </button>
            </header>

            <div className="overflow-y-auto px-5 py-4">
              <form onSubmit={submitRecommendation} className="space-y-4">
                <div>
                  <label htmlFor="commerce-query" className="mb-2 block text-xs font-bold text-zinc-300">무엇을 찾고 있나요?</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 text-fuchsia-300" size={17} />
                    <textarea
                      id="commerce-query"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="예: 강남에서 2만원 이하 한식 맛집 찾아줘"
                      maxLength={200}
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/10"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quickQueries.map((quickQuery) => (
                      <button
                        key={quickQuery}
                        type="button"
                        onClick={() => setQuery(quickQuery)}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-fuchsia-300/30 hover:text-fuchsia-200"
                      >
                        {quickQuery}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="relative">
                    <span className="mb-1.5 block text-[11px] font-bold text-zinc-400">지역</span>
                    <MapPin className="absolute bottom-3 left-3 text-zinc-500" size={15} />
                    <select
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                      className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-fuchsia-400/50"
                    >
                      {regions.map((regionOption) => (
                        <option key={regionOption || "all"} value={regionOption} className="bg-[#18111f]">
                          {regionOption || "지역 무관"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold text-zinc-400">최대 예산</span>
                    <input
                      type="number"
                      min="0"
                      max="100000000"
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="예: 20000"
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-fuchsia-400/50"
                    />
                  </label>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 accent-emerald-400"
                  />
                  <span className="text-[11px] leading-relaxed text-emerald-100/75">
                    입력한 질문·지역·예산을 이번 추천 요청에만 사용하는 데 동의합니다. 주변 채팅은 전송하지 않습니다.
                  </span>
                </label>

                {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading || query.trim().length < 2}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#a855f7,#ec4899)] text-sm font-black shadow-[0_10px_30px_rgba(192,38,211,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {isLoading ? "조건을 확인하는 중" : "조건에 맞는 추천 보기"}
                </button>
              </form>

              {result && (
                <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                  <div className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-xs text-zinc-300">
                    <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="font-bold text-zinc-100">{result.message}</p>
                      <p className="mt-1 leading-relaxed text-zinc-500">{result.privacy}</p>
                    </div>
                  </div>

                  {result.recommendations.map((offer) => (
                    <article key={offer.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-1 text-[9px] font-black tracking-wider ${offer.sponsored ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/10 text-emerald-200"}`}>
                              {offer.sponsored ? "광고 · 데모 스폰서" : "일반 추천"}
                            </span>
                            <span className="text-[10px] font-semibold text-zinc-500">{offer.merchant}</span>
                          </div>
                          <h3 className="font-black tracking-tight text-white">{offer.title}</h3>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-black text-fuchsia-200">★ {offer.rating.toFixed(1)}</p>
                          <p className="mt-1 text-[10px] text-zinc-500">{formatPrice(offer.price)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{offer.summary}</p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
                        <BadgePercent size={13} className="text-fuchsia-300" />
                        <span>{offer.benefit}</span>
                        <span className="text-zinc-700">|</span>
                        <span>{offer.reason}</span>
                      </div>
                      <a
                        href={offer.actionUrl}
                        target="_blank"
                        rel="sponsored noreferrer"
                        className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 text-xs font-extrabold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                      >
                        {offer.actionLabel}
                        <ExternalLink size={13} />
                      </a>
                    </article>
                  ))}

                  <p className="px-1 text-[10px] leading-relaxed text-zinc-600">{result.disclosure}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
