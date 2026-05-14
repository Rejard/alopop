"use client";

import { useState, useEffect } from "react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Stethoscope, PawPrint, Activity, Brain, ShieldAlert, Clock, Loader2, TrendingUp, AlertTriangle, Hospital, RefreshCw } from "lucide-react";
import Link from "next/link";

type StatsData = {
  overview: {
    totalUsers: number;
    totalAnalyses: number;
    todayAnalyses: number;
    totalPets: number;
    totalActivities: number;
  };
  ai: {
    successRate: number;
    success24h: number;
    fail24h: number;
    fallback24h: number;
    total24h: number;
  };
  sso: {
    fail24h: number;
  };
  recentLogs: Array<{
    id: string;
    type: string;
    endpoint: string;
    detail: string | null;
    model: string | null;
    createdAt: string;
  }>;
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  GEMINI_FAIL: { label: "AI 실패", color: "text-red-500 bg-red-50" },
  GEMINI_FALLBACK: { label: "AI Fallback", color: "text-amber-600 bg-amber-50" },
  SSO_FAIL: { label: "SSO 실패", color: "text-purple-500 bg-purple-50" },
};

export default function AdminPage() {
  const { user } = usePet365Auth();
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ totalHospitals: number; hasApiKey: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace("/");
      return;
    }
    if (user?.isAdmin) {
      fetch("/api/admin/stats")
        .then(r => r.json())
        .then(data => {
          if (data.success) setStats(data.data);
          else setError(data.error);
        })
        .catch(() => setError("통계를 불러오는 데 실패했습니다."))
        .finally(() => setLoading(false));
      fetch("/api/admin/sync-hospitals").then(r => r.json()).then(d => { if (d.success) setSyncStatus(d.data); });
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F4F6]">
        <Loader2 className="animate-spin text-[#FF7B6E]" size={32} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F4F6] px-8 text-center">
        <AlertTriangle size={40} className="text-amber-500 mb-4" />
        <p className="text-sm font-medium text-gray-600">{error || "데이터를 불러올 수 없습니다."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F4F6] pb-24 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <header className="flex items-center gap-3 p-6">
        <Link href="/profile" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-gray-900 font-extrabold text-xl tracking-tight">관리자 대시보드</h1>
      </header>

      <main className="px-6 flex flex-col gap-5">

        {/* 서비스 현황 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <TrendingUp size={14} /> 서비스 현황
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Users size={18} />} label="사용자" value={stats.overview.totalUsers} color="bg-blue-50 text-blue-600" />
            <StatCard icon={<Stethoscope size={18} />} label="총 분석" value={stats.overview.totalAnalyses} color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={<PawPrint size={18} />} label="등록 펫" value={stats.overview.totalPets} color="bg-amber-50 text-amber-600" />
          </div>
        </section>

        {/* 오늘의 활동 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <Activity size={14} /> 오늘
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-[24px] p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-1">AI 분석</p>
              <p className="text-3xl font-black text-gray-900">{stats.overview.todayAnalyses}<span className="text-sm font-medium text-gray-400 ml-1">건</span></p>
            </div>
            <div className="bg-white rounded-[24px] p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-1">활동 세션</p>
              <p className="text-3xl font-black text-gray-900">{stats.overview.totalActivities}<span className="text-sm font-medium text-gray-400 ml-1">건</span></p>
            </div>
          </div>
        </section>

        {/* AI 상태 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <Brain size={14} /> AI 상태 (24h)
          </h2>
          <div className="bg-white rounded-[24px] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500">Gemini 성공률</p>
              <span className={`text-2xl font-black ${stats.ai.successRate >= 90 ? 'text-emerald-500' : stats.ai.successRate >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                {stats.ai.successRate}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stats.ai.successRate >= 90 ? 'bg-emerald-400' : stats.ai.successRate >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${stats.ai.successRate}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 rounded-2xl py-2.5">
                <p className="text-lg font-bold text-emerald-600">{stats.ai.success24h}</p>
                <p className="text-[10px] font-semibold text-emerald-500">성공</p>
              </div>
              <div className="bg-amber-50 rounded-2xl py-2.5">
                <p className="text-lg font-bold text-amber-600">{stats.ai.fallback24h}</p>
                <p className="text-[10px] font-semibold text-amber-500">Fallback</p>
              </div>
              <div className="bg-red-50 rounded-2xl py-2.5">
                <p className="text-lg font-bold text-red-500">{stats.ai.fail24h}</p>
                <p className="text-[10px] font-semibold text-red-400">실패</p>
              </div>
            </div>
          </div>
        </section>

        {/* 인증 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <ShieldAlert size={14} /> 인증 (24h)
          </h2>
          <div className="bg-white rounded-[24px] p-5 shadow-sm flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">SSO 실패</p>
            <span className={`text-2xl font-black ${stats.sso.fail24h === 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.sso.fail24h}<span className="text-sm font-medium text-gray-400 ml-1">건</span>
            </span>
          </div>
        </section>

        {/* 병원 데이터 동기화 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <Hospital size={14} /> 공공데이터 병원 동기화
          </h2>
          <div className="bg-white rounded-[24px] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">등록된 병원</p>
                <p className="text-2xl font-black text-gray-900">{syncStatus?.totalHospitals ?? '...'}<span className="text-sm font-medium text-gray-400 ml-1">곳</span></p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${syncStatus?.hasApiKey ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {syncStatus?.hasApiKey ? '✅ API 키 설정됨' : '⚠️ API 키 미설정'}
              </span>
            </div>
            <button
              onClick={async () => {
                setSyncing(true); setSyncResult(null);
                try {
                  const r = await fetch('/api/admin/sync-hospitals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxPages: 20 }) });
                  const d = await r.json();
                  if (d.success) {
                    setSyncResult(`✅ 신규 ${d.data.inserted}건, 업데이트 ${d.data.updated}건 (총 ${d.data.totalHospitals}곳)`);
                    setSyncStatus(prev => prev ? { ...prev, totalHospitals: d.data.totalHospitals } : prev);
                  } else setSyncResult(`❌ ${d.error}`);
                } catch { setSyncResult('❌ 동기화 실패'); } finally { setSyncing(false); }
              }}
              disabled={syncing}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-400 text-white font-bold rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {syncing ? <><Loader2 size={18} className="animate-spin" /> 동기화 중...</> : <><RefreshCw size={18} /> 공공데이터 동기화</>}
            </button>
            {syncResult && <p className="text-sm font-medium text-gray-600 mt-3 text-center">{syncResult}</p>}

            {/* 전국 동기화 CLI 명령어 */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-500 mb-2">🗺️ 전국 전체 동기화 (터미널용)</p>
              <p className="text-[11px] text-gray-400 mb-2">아래 명령어를 pet365care 폴더에서 실행하세요 (3~5분 소요)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-900 text-emerald-400 text-xs font-mono px-4 py-3 rounded-xl overflow-x-auto whitespace-nowrap">cd c:\home\pet365care; npx tsx prisma/sync-hospitals.ts --clear</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('cd c:\\home\\pet365care; npx tsx prisma/sync-hospitals.ts --clear');
                    const btn = document.getElementById('copy-cmd-btn');
                    if (btn) { btn.textContent = '✅'; setTimeout(() => btn.textContent = '📋', 1500); }
                  }}
                  id="copy-cmd-btn"
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg shrink-0 hover:bg-gray-200 active:scale-95 transition-all"
                  title="명령어 복사"
                >📋</button>
              </div>
            </div>
          </div>
        </section>

        {/* 최근 로그 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <Clock size={14} /> 최근 이벤트 로그
          </h2>
          {stats.recentLogs.length === 0 ? (
            <div className="bg-white rounded-[24px] p-6 shadow-sm text-center">
              <p className="text-sm font-medium text-gray-400">이벤트가 없습니다 — 좋은 신호입니다! 🎉</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.recentLogs.map(log => {
                const typeInfo = TYPE_LABELS[log.type] || { label: log.type, color: "text-gray-500 bg-gray-50" };
                const time = new Date(log.createdAt);
                const timeStr = `${String(time.getMonth() + 1).padStart(2, '0')}/${String(time.getDate()).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

                return (
                  <div key={log.id} className="bg-white rounded-[20px] p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.label}</span>
                      <span className="text-[11px] font-semibold text-gray-400">{timeStr}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-600 truncate">
                      {log.endpoint}{log.model ? ` · ${log.model}` : ""}
                    </p>
                    {log.detail && (
                      <p className="text-[11px] text-gray-400 mt-1 truncate">{log.detail}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-[24px] p-4 shadow-sm flex flex-col items-center text-center">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <p className="text-xl font-black text-gray-900">{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
