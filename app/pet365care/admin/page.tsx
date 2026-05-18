"use client";

import { useState, useEffect } from "react";
import { usePet365Auth } from "@/lib/pet365care/use-pet365-auth";
import { useRouter } from "next/navigation";
import { ArrowLeft, Brain, Activity, Hospital, RefreshCw, PawPrint, MessageSquare, Loader2, TrendingUp, AlertTriangle, Clock, Terminal } from "lucide-react";
import Link from "next/link";

type StatsData = {
  overview: {
    totalHospitals: number;
    emergencyHospitals: number;
    totalBotUsers: number;
    totalBotRooms: number;
    aiTotal: number;
    aiToday: number;
  };
  ai: {
    successRate: number;
    success24h: number;
    fail24h: number;
    fallback24h: number;
    total24h: number;
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
  AI_FAIL: { label: "AI 실패", color: "text-red-500 bg-red-50" },
  AI_FALLBACK: { label: "AI Fallback", color: "text-amber-600 bg-amber-50" },
};

export default function Pet365AdminPage() {
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
      router.replace("/pet365care");
      return;
    }
    if (user?.isAdmin) {
      fetch("/api/pet365care/admin/stats")
        .then(r => r.json())
        .then(data => {
          if (data.success) setStats(data.data);
          else setError(data.error);
        })
        .catch(() => setError("통계를 불러오는 데 실패했습니다."))
        .finally(() => setLoading(false));
      fetch("/api/pet365care/admin/sync-hospitals").then(r => r.json()).then(d => { if (d.success) setSyncStatus(d.data); });
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="pet365-page flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-[#9c48ea]" size={32} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="pet365-page flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <AlertTriangle size={40} className="text-amber-500 mb-4" />
        <p className="text-sm font-medium text-gray-600">{error || "데이터를 불러올 수 없습니다."}</p>
      </div>
    );
  }

  return (
    <div className="pet365-page flex flex-col min-h-full pb-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <header className="flex items-center gap-3 p-6">
        <Link href="/pet365care/profile" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600">
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
            <StatCard icon={<Hospital size={18} />} label="동물병원" value={stats.overview.totalHospitals} color="bg-blue-50 text-blue-600" />
            <StatCard icon={<PawPrint size={18} />} label="응급 병원" value={stats.overview.emergencyHospitals} color="bg-red-50 text-red-500" />
            <StatCard icon={<MessageSquare size={18} />} label="펫 채팅방" value={stats.overview.totalBotRooms} color="bg-[#efe7ff] text-[#9c48ea]" />
          </div>
        </section>

        {/* 오늘의 활동 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <Activity size={14} /> AI 분석
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="pet365-card p-5">
              <p className="text-xs font-semibold text-gray-500 mb-1">오늘 분석</p>
              <p className="text-3xl font-black text-gray-900">{stats.overview.aiToday}<span className="text-sm font-medium text-gray-400 ml-1">건</span></p>
            </div>
            <div className="pet365-card p-5">
              <p className="text-xs font-semibold text-gray-500 mb-1">전체 분석</p>
              <p className="text-3xl font-black text-gray-900">{stats.overview.aiTotal}<span className="text-sm font-medium text-gray-400 ml-1">건</span></p>
            </div>
          </div>
        </section>

        {/* AI 상태 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <Brain size={14} /> AI 상태 (24h)
          </h2>
          <div className="pet365-card p-5">
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

        {/* 병원 데이터 동기화 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3 ml-1 flex items-center gap-1.5">
            <Hospital size={14} /> 공공데이터 병원 동기화
          </h2>
          <div className="pet365-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">등록된 병원</p>
                <p className="text-2xl font-black text-gray-900">{syncStatus?.totalHospitals ?? '...'}<span className="text-sm font-medium text-gray-400 ml-1">곳</span></p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${syncStatus?.hasApiKey ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {syncStatus?.hasApiKey ? '✅ API 키 설정됨' : '⚠️ API 키 미설정'}
              </span>
            </div>

            {/* 🖥️ 서버 터미널에서 전국 동기화 실행 */}
            <button
              onClick={async () => {
                if (!confirm('전국 전체 동기화를 서버에서 실행합니다.\n기존 데이터를 초기화하고 공공데이터에서 전국 병원을 다시 수집합니다.\n3~5분 소요됩니다. 실행하시겠습니까?')) return;
                setSyncing(true); setSyncResult('🖥️ 서버 터미널에서 실행 중... 3~5분 소요');
                try {
                  const r = await fetch('/api/pet365care/admin/sync-cli', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clear: true }) });
                  const d = await r.json();
                  if (d.success) {
                    setSyncResult('🖥️ 서버에서 실행 시작됨! 3~5분 후 "결과 확인" 버튼을 눌러주세요.');
                  } else setSyncResult(`❌ ${d.error}`);
                } catch { setSyncResult('❌ 서버 실행 실패'); } finally { setSyncing(false); }
              }}
              disabled={syncing}
                className="w-full bg-gradient-to-r from-[#9c48ea] to-[#62fae3] text-white font-bold rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 mb-2"
            >
              {syncing ? <><Loader2 size={18} className="animate-spin" /> 요청 전송 중...</> : <><Terminal size={16} /> 🖥️ 서버에서 전국 동기화 실행</>}
            </button>

            {/* 결과 확인 버튼 */}
            <button
              onClick={async () => {
                try {
                  const r = await fetch('/api/pet365care/admin/sync-cli');
                  const d = await r.json();
                  if (d.success && d.data) {
                    const s = d.data;
                    if (s.status === 'running') {
                      setSyncResult('⏳ 아직 실행 중입니다... 잠시 후 다시 확인해주세요.');
                    } else if (s.status === 'done') {
                      setSyncResult(`✅ 완료! 신규 ${s.inserted ?? '?'}건, 업데이트 ${s.updated ?? '?'}건 (총 ${s.totalHospitals ?? '?'}곳)`);
                      if (s.totalHospitals) setSyncStatus(prev => prev ? { ...prev, totalHospitals: s.totalHospitals } : prev);
                    } else if (s.status === 'error') {
                      setSyncResult(`❌ 오류: ${s.error || s.stderr?.slice(0, 100)}`);
                    } else {
                      setSyncResult('📋 아직 실행된 적 없습니다.');
                    }
                  }
                } catch { setSyncResult('❌ 상태 확인 실패'); }
              }}
              className="w-full bg-gray-100 text-gray-700 font-bold rounded-2xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-sm"
            >
              <RefreshCw size={14} /> 동기화 결과 확인
            </button>

            {syncResult && <p className="text-sm font-medium text-gray-600 mt-3 text-center">{syncResult}</p>}

            {/* 📋 터미널 명령어 (수동 실행용) */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-500 mb-2">📋 터미널 수동 실행 명령어</p>
              <p className="text-[11px] text-gray-400 mb-1">📂 실행 폴더: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">c:\home\alopop</code></p>
              <p className="text-[11px] text-gray-400 mb-2">아래 명령어를 서버 터미널에서 직접 실행하세요 (3~5분 소요)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-900 text-emerald-400 text-xs font-mono px-4 py-3 rounded-xl overflow-x-auto whitespace-nowrap">cd c:\home\alopop && npx tsx scripts/sync-hospitals.ts --clear</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('cd c:\\home\\alopop && npx tsx scripts/sync-hospitals.ts --clear');
                    const btn = document.getElementById('copy-sync-cmd');
                    if (btn) { btn.textContent = '✅'; setTimeout(() => btn.textContent = '📋', 1500); }
                  }}
                  id="copy-sync-cmd"
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
            <div className="pet365-card p-6 text-center">
              <p className="text-sm font-medium text-gray-400">이벤트가 없습니다 — 좋은 신호입니다! 🎉</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.recentLogs.map(log => {
                const typeInfo = TYPE_LABELS[log.type] || { label: log.type, color: "text-gray-500 bg-gray-50" };
                const time = new Date(log.createdAt);
                const timeStr = `${String(time.getMonth() + 1).padStart(2, '0')}/${String(time.getDate()).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

                return (
                  <div key={log.id} className="pet365-card-tight p-4">
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
    <div className="pet365-card p-4 flex flex-col items-center text-center">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <p className="text-xl font-black text-gray-900">{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
