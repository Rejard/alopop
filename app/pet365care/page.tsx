"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Apple, Bell, ChevronDown, ChevronRight, Moon, Sun, Play, Square, Heart, Loader2, X, Flame, Check, Plus, PawPrint } from "lucide-react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";
import {
  getPets, getCareChecklist, toggleCareCheck as toggleCareCheckStore,
  getStreaks, getActivityToday, startActivity, stopActivity,
  type Pet, type CareCheck
} from "@/lib/pet365care/local-store";
import { generateCareTip } from "@/lib/pet365care/gemini-client";
import { getSpeciesEmoji } from "@/lib/pet365care/utils";
import { notifyCareComplete } from "@/lib/pet365care/notify";

type ChecklistData = {
  items: CareCheck[];
  checkedCount: number;
  totalCount: number;
  completionRate: number;
};

type StreakData = { currentStreak: number; bestStreak: number; totalWalks: number };
type ActivityData = { walkDistance: number; sleepHours: number; sleepMinutes: number; activeWalkId: string | null; activeSleepId: string | null };

const CATEGORY_MAP: Record<string, { emoji: string; label: string }> = {
  feed: { emoji: "🍚", label: "밥" }, water: { emoji: "💧", label: "물" },
  snack: { emoji: "🦴", label: "간식" }, play: { emoji: "🎾", label: "놀이" }, 
  teeth: { emoji: "🪥", label: "양치" }, walk: { emoji: "🦮", label: "산책" }, 
  sleep: { emoji: "💤", label: "수면" }, brush: { emoji: "✨", label: "빗질" }
};

const SPECIES_COLOR: Record<string, string> = {
  dog: "from-[#9c48ea] to-[#62fae3]", cat: "from-[#cc97ff] to-[#9c48ea]",
  rabbit: "from-[#cc97ff] to-[#62fae3]", hamster: "from-[#62fae3] to-[#9c48ea]",
  bird: "from-emerald-400 to-[#62fae3]", turtle: "from-teal-400 to-[#62fae3]",
  duck: "from-[#62fae3] to-[#cc97ff]", hedgehog: "from-zinc-500 to-[#9c48ea]",
  fish: "from-sky-400 to-[#62fae3]", other: "from-gray-500 to-[#9c48ea]",
};

// 펫별 케어 카드 컴포넌트
function PetCareCard({ pet, isExpanded, onToggle }: { pet: Pet; isExpanded: boolean; onToggle: () => void }) {
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(false);

  const emoji = getSpeciesEmoji(pet.species);
  const gradientColor = SPECIES_COLOR[pet.species] || "from-gray-400 to-zinc-500";

  const fetchPetData = useCallback(() => {
    if (!isExpanded) return;
    setLoading(true);
    try {
      setChecklist(getCareChecklist(pet.id));
      setStreak(getStreaks(pet.id));
      setActivity(getActivityToday(pet.id));
    } finally {
      setLoading(false);
    }
  }, [isExpanded, pet.id]);

  useEffect(() => {
    const timer = window.setTimeout(fetchPetData, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPetData]);

  const toggleCheck = (category: string, currentChecked: boolean) => {
    toggleCareCheckStore(pet.id, category, !currentChecked);
    const updated = getCareChecklist(pet.id);
    setChecklist(updated);

    // 모두 완료 → 채팅 알림
    if (updated.completionRate === 100) {
      notifyCareComplete(pet.name, pet.species);
    }
  };

  const toggleAction = (type: "WALK" | "SLEEP") => {
    if (!activity) return;
    const isActive = type === "WALK" ? !!activity.activeWalkId : !!activity.activeSleepId;
    if (isActive) {
      stopActivity(pet.id, type);
    } else {
      startActivity(pet.id, type);
    }
    setActivity(getActivityToday(pet.id));
  };

  const nextVaccination = pet.vaccinations
    ?.filter(v => v.nextDate && v.nextDate >= new Date().toISOString().slice(0, 10))
    ?.sort((a, b) => (a.nextDate || "").localeCompare(b.nextDate || ""))[0];

  return (
    <div className={`rounded-[28px] overflow-hidden transition-all duration-500 ease-out ${
      isExpanded ? "bg-white shadow-lg border-2 border-gray-100" : "bg-white shadow-sm hover:shadow-md border-2 border-transparent"
    }`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3.5 p-4 pr-5 text-left transition-colors">
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center text-2xl shadow-md shrink-0`}>{emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-gray-900 text-[15px] truncate">{pet.name}</h3>
            <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{pet.breed}</span>
          </div>
          {!isExpanded && checklist && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all" style={{ width: `${checklist.completionRate}%` }} />
              </div>
              <span className="text-[10px] font-bold text-gray-400 shrink-0">{checklist.completionRate}%</span>
            </div>
          )}
        </div>
        <div className={`transition-transform duration-300 text-gray-400 ${isExpanded ? "rotate-180" : ""}`}><ChevronDown size={20} /></div>
      </button>

      <div className={`transition-all duration-500 ease-out overflow-hidden ${isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-5 pb-5 flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : (
            <>
              {streak && streak.currentStreak > 0 && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-[#efe7ff] to-[#e8fbf8] rounded-2xl p-3.5 border border-[#9c48ea]/15">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#9c48ea] to-[#62fae3] rounded-full flex items-center justify-center text-white shadow-sm"><Flame size={20} /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#9c48ea]">연속 산책</p>
                    <span className="text-xl font-black text-gray-900">{streak.currentStreak}</span>
                    <span className="text-xs font-semibold text-gray-500 ml-0.5">일</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400">최고</p>
                    <span className="text-sm font-black text-[#9c48ea]">{streak.bestStreak}일</span>
                  </div>
                </div>
              )}

              {checklist && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-gray-500">오늘의 케어 ✅</h4>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${checklist.completionRate === 100 ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                      {checklist.completionRate === 100 ? "🎉 완료!" : `${checklist.checkedCount}/${checklist.totalCount}`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${checklist.completionRate}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {checklist.items.map(item => {
                      const info = CATEGORY_MAP[item.category] || { emoji: "✅", label: item.category };
                      return (
                        <button key={item.category} onClick={() => toggleCheck(item.category, item.checked)}
                          className={`relative flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-300 active:scale-95 ${
                            item.checked ? "bg-emerald-50 border-2 border-emerald-300" : "bg-gray-50 border-2 border-transparent"
                          }`}>
                          {item.checked && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                              <Check size={10} className="text-white" strokeWidth={3} />
                            </div>
                          )}
                          <span className={`text-lg ${item.checked ? "" : "grayscale-[30%]"}`}>{info.emoji}</span>
                          <span className={`text-[9px] font-bold ${item.checked ? "text-emerald-600" : "text-gray-400"}`}>{info.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {nextVaccination && (
                <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-3.5 border border-blue-100">
                  <span className="text-xl">💉</span>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-blue-600">다음 접종</p>
                    <p className="text-sm font-bold text-gray-900">{nextVaccination.name}</p>
                  </div>
                  <span className="text-xs font-bold text-blue-500 bg-blue-100 px-2.5 py-1 rounded-full">{nextVaccination.nextDate}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
export default function HomePage() {
  const { user } = usePet365Auth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tip, setTip] = useState({ title: "케어 팁을 불러오는 중...", content: "분석 중입니다.", iconType: "Apple" });
  const [tipModalOpen, setTipModalOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      const loadedPets = getPets();
      setPets(loadedPets);
      if (loadedPets.length > 0) setExpandedPetId(loadedPets[0].id);
      setLoading(false);

      // AI 케어 팁 (Gemini API 키가 있을 때만)

      if (loadedPets.length > 0) {
        const firstPet = loadedPets[0];
        generateCareTip(firstPet.name, firstPet.species, firstPet.breed, firstPet.age)
          .then(t => setTip(t))
          .catch(() => setTip({ title: "반려동물과 함께하는 하루", content: "오늘도 사랑으로 케어해주세요! 🐾", iconType: "Heart" }));
      } else {
        setTip({ title: "반려동물과 함께하는 하루", content: "오늘도 사랑으로 케어해주세요! 🐾", iconType: "Apple" });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  const getIcon = (type: string) => {
    switch (type) {
      case "Sun": return <Sun size={24} />;
      case "Moon": return <Moon size={24} />;
      case "Heart": return <Heart size={24} />;
      case "Activity": return <Activity size={24} />;
      default: return <Apple size={24} />;
    }
  };

  if (!loading && pets.length === 0) {
    return (
      <div className="flex flex-col min-h-full bg-[#f7f5fb] pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
        <header className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : ( <span className="text-xl">🐾</span> )}
            </div>
            <div>
              <h1 className="text-gray-900 font-extrabold text-lg">{user?.username || "보호자"} 님</h1>
              <p className="text-xs text-gray-500 font-medium">반려동물을 등록해보세요!</p>
            </div>
          </div>
        </header>
        <main className="px-6 flex flex-col items-center gap-6 mt-6">
          <div className="w-full bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 rounded-[32px] p-8 text-white text-center shadow-xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
            <span className="text-6xl block mb-4">🐾</span>
            <h2 className="text-2xl font-black mb-2">Pet365Care</h2>
            <p className="text-white/80 text-sm leading-relaxed mb-6">반려동물을 등록하고<br />AI 맞춤 건강 관리를 시작하세요</p>
            <a href="/pet365care/profile" className="inline-flex items-center gap-2 bg-white text-purple-600 font-bold text-sm px-6 py-3.5 rounded-2xl shadow-lg hover:bg-purple-50 transition-colors active:scale-95">
              <PawPrint size={18} /> 반려동물 추가하기
            </a>
          </div>
          <div className="w-full grid grid-cols-2 gap-3">
            {[
              { emoji: "✅", title: "맞춤 케어", desc: "일일 체크리스트" },
              { emoji: "💉", title: "접종 관리", desc: "일정 리마인더" },
              { emoji: "🏥", title: "AI 건강 진단", desc: "사진 분석" },
              { emoji: "📊", title: "활동 기록", desc: "산책·수면 추적" },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
                <span className="text-2xl">{item.emoji}</span>
                <h4 className="text-sm font-bold text-gray-900 mt-2">{item.title}</h4>
                <p className="text-[11px] text-gray-400 font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#f7f5fb] pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : ( <span className="text-xl">🐾</span> )}
          </div>
          <div>
            <h1 className="text-gray-900 font-extrabold text-lg tracking-tight leading-tight">{user ? `${user.username} 님,` : "보호자 님,"}</h1>
            <p className="text-xs text-gray-500 font-medium">오늘도 산뜻한 하루 보내세요!</p>
          </div>
        </div>
      </header>
      <main className="px-5 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
            <PawPrint size={16} className="text-purple-500" /> 내 반려동물
            <span className="text-xs font-bold text-gray-400 ml-1">{pets.length}</span>
          </h2>
          <a href="/pet365care/profile" className="flex items-center gap-1 text-xs font-bold text-purple-500 hover:text-purple-600 transition-colors">
            <Plus size={14} /> 추가
          </a>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
        ) : (
          pets.map(pet => (
            <PetCareCard key={pet.id} pet={pet} isExpanded={expandedPetId === pet.id}
              onToggle={() => setExpandedPetId(expandedPetId === pet.id ? null : pet.id)} />
          ))
        )}
        {!loading && (
          <section onClick={() => setTipModalOpen(true)}
            className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-[28px] p-5 text-white flex items-center justify-between shadow-lg cursor-pointer hover:bg-gray-800 transition-all active:scale-[0.98] mt-1">
            <div className="flex items-center gap-3.5 w-[85%]">
              <div className="w-11 h-11 shrink-0 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm text-[#62fae3]">{getIcon(tip.iconType)}</div>
              <div className="w-full">
                <p className="text-[10px] text-white/70 font-semibold mb-0.5">오늘의 AI 케어 팁 ✨</p>
                <h4 className="text-sm font-bold leading-tight truncate">{tip.title}</h4>
              </div>
            </div>
            <ChevronRight className="text-white/50 shrink-0" />
          </section>
        )}
      </main>
      {tipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl relative">
            <button onClick={() => setTipModalOpen(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
            <div className="p-8 pt-10 pb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-tr from-[#efe7ff] to-[#e8fbf8] rounded-full flex items-center justify-center text-[#9c48ea] mb-4 shadow-inner">{getIcon(tip.iconType)}</div>
              <h3 className="text-2xl font-extrabold text-gray-900 mb-3">{tip.title}</h3>
              <div className="w-10 h-1 bg-[#62fae3] rounded-full mb-5"></div>
              <p className="text-gray-600 text-sm leading-relaxed text-left bg-gray-50 p-4 rounded-2xl border border-gray-100">{tip.content}</p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setTipModalOpen(false)} className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-colors shadow-md">확인했어요</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
