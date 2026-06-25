'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, XOctagon, RotateCw, ChevronDown, ChevronUp, Gauge, FileCode, CheckCircle2 } from 'lucide-react';

interface DiagnosticItem {
  step: number;
  category: string;
  name: string;
  status: 'passed' | 'warning' | 'failed';
  score: number;
  details: string;
  logic: string;
}

interface DiagnosticSummary {
  total: number;
  passed: number;
  warning: number;
  failed: number;
  score: number;
  status: 'safe' | 'warning' | 'danger';
}

export default function DiagnosticsPanel() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setItems(data.diagnostics);
      } else {
        console.error('Failed to fetch diagnostics data');
      }
    } catch (err) {
      console.error('Error fetching diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const toggleExpand = (step: number) => {
    setExpandedStep(expandedStep === step ? null : step);
  };

  if (!summary) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <RotateCw className="animate-spin text-primary" size={40} />
        <span className="text-zinc-400 font-medium">서버 보안 상태 진단 중...</span>
      </div>
    );
  }

  // overall status color
  const statusColorMap = {
    safe: {
      text: '안전함',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
      shadowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      borderClass: 'border-emerald-500/30'
    },
    warning: {
      text: '점검 권장',
      badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
      shadowClass: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
      borderClass: 'border-amber-500/30'
    },
    danger: {
      text: '보안 위협',
      badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
      shadowClass: 'shadow-[0_0_20px_rgba(244,63,94,0.2)]',
      borderClass: 'border-rose-500/30'
    }
  };

  const statusMeta = statusColorMap[summary.status] || statusColorMap.warning;

  return (
    <div className="max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-on-surface drop-shadow-sm flex items-center gap-2">
            🛡️ 실시간 서버 자가진단 모니터
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            서버의 21대 핵심 위협 보안 가드 및 성능 안전장치 작동 유무를 실시간으로 교차 진단합니다.
          </p>
        </div>
        
        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className={`px-5 py-2.5 rounded-full font-bold flex items-center gap-2 transition-all ${
            loading
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-primary text-on-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_rgba(204,151,255,0.4)]'
          }`}
        >
          <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? '진단 진행 중...' : '실시간 자가진단 실행'}
        </button>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {/* Score Card */}
        <div className={`bg-surface-container border ${statusMeta.borderClass} rounded-2xl p-6 flex flex-col justify-between items-center text-center ${statusMeta.shadowClass} transition-all duration-300 hover:scale-[1.01]`}>
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-2">안전 및 개선 지수</div>
          <div className="relative flex justify-center items-center h-28 w-28">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="46"
                stroke="rgba(63, 63, 70, 0.3)"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r="46"
                stroke={summary.status === 'safe' ? '#10B981' : summary.status === 'warning' ? '#F59E0B' : '#F43F5E'}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="289"
                strokeDashoffset={289 - (289 * summary.score) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black font-mono tracking-tighter text-on-surface">
                {summary.score}%
              </span>
              <span className="text-[10px] text-zinc-400 font-bold">Improvement</span>
            </div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-bold mt-4 ${statusMeta.badgeClass}`}>
            {statusMeta.text}
          </span>
        </div>

        {/* Metric 2: Passed */}
        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.01] transition-all duration-300">
          <div>
            <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">안전 가드 작동</div>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-4 flex items-baseline gap-1.5">
              {summary.passed} <span className="text-sm font-medium text-zinc-500">건</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 border-t border-outline-variant/10 pt-4 mt-6">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>21대 핵심 보완책 적용 완료</span>
          </div>
        </div>

        {/* Metric 3: Warning */}
        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.01] transition-all duration-300">
          <div>
            <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">개선 및 보완 권장</div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-4 flex items-baseline gap-1.5">
              {summary.warning} <span className="text-sm font-medium text-zinc-500">건</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 border-t border-outline-variant/10 pt-4 mt-6">
            <AlertTriangle size={14} className="text-amber-400" />
            <span>코드 외 인프라 보조 조치 검토</span>
          </div>
        </div>

        {/* Metric 4: Failed */}
        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.01] transition-all duration-300">
          <div>
            <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">미해결 위협 요인</div>
            <div className="text-3xl font-extrabold font-mono text-rose-400 mt-4 flex items-baseline gap-1.5">
              {summary.failed} <span className="text-sm font-medium text-zinc-500">건</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 border-t border-outline-variant/10 pt-4 mt-6">
            <XOctagon size={14} className={summary.failed > 0 ? 'text-rose-400' : 'text-zinc-500'} />
            <span>{summary.failed > 0 ? '보안 조치 긴급 필요' : '보안 무결점 유지 중'}</span>
          </div>
        </div>
      </div>

      {/* Accordion List */}
      <h3 className="text-lg font-bold mb-4 text-on-surface-variant flex items-center gap-2">
        <Gauge size={18} className="text-primary" /> 21대 핵심 자가진단 내역 상세 리포트
      </h3>

      <div className="space-y-3.5 mb-12">
        {items.map((item) => {
          const isOpen = expandedStep === item.step;
          let icon = <ShieldCheck size={18} className="text-emerald-400" />;
          let badge = (
            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-tight">
              안전
            </span>
          );
          let itemBorder = 'border-outline-variant/20 hover:border-primary/30';
          let itemBg = 'bg-surface-container-low';

          if (item.status === 'warning') {
            icon = <AlertTriangle size={18} className="text-amber-400" />;
            badge = (
              <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-tight">
                경고
              </span>
            );
            itemBorder = 'border-amber-500/30';
          } else if (item.status === 'failed') {
            icon = <XOctagon size={18} className="text-rose-400" />;
            badge = (
              <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-tight animate-pulse">
                위험
              </span>
            );
            itemBorder = 'border-rose-500/40';
            itemBg = 'bg-rose-950/10';
          }

          if (isOpen) {
            itemBorder = item.status === 'passed' ? 'border-primary/50 ring-1 ring-primary/20' : itemBorder;
          }

          return (
            <div
              key={item.step}
              className={`${itemBg} border ${itemBorder} rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md`}
            >
              {/* Header block */}
              <div
                onClick={() => toggleExpand(item.step)}
                className="flex items-center justify-between p-4 cursor-pointer select-none transition-colors hover:bg-surface-variant/20"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className="flex-shrink-0">{icon}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                        {item.category} ({item.step}단계)
                      </span>
                      {badge}
                    </div>
                    <h4 className="text-sm font-bold text-on-surface mt-0.5 truncate">
                      {item.name}
                    </h4>
                  </div>
                </div>
                <div className="text-on-surface-variant ml-2">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expansive panel */}
              {isOpen && (
                <div className="border-t border-outline-variant/10 p-5 bg-surface-container text-xs leading-relaxed text-on-surface-variant space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div>
                    <h5 className="font-bold text-zinc-300 mb-1 flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-primary" /> 개선 결과 및 안전 수준
                    </h5>
                    <p className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/10 text-[11px] text-zinc-200">
                      {item.details}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-bold text-zinc-300 mb-1 flex items-center gap-1.5">
                        <FileCode size={12} className="text-tertiary" /> 실시간 검증 방식
                      </h5>
                      <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/10 text-[11px] font-mono text-tertiary">
                        {item.logic}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-bold text-zinc-300 mb-1">
                        위험도 통제 등급
                      </h5>
                      <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/10 text-[11px]">
                        자가진단 점수: <span className="font-bold font-mono text-on-surface">{item.score} / 100</span>
                        <div className="mt-1">
                          {item.status === 'passed' && (
                            <span className="text-emerald-400">완전 복구됨: 보안 리스크 0% 실현 완료.</span>
                          )}
                          {item.status === 'warning' && (
                            <span className="text-amber-400">잔존 위험 제어: 인프라 보조 조치 검토 권장.</span>
                          )}
                          {item.status === 'failed' && (
                            <span className="text-rose-400">즉각 조치 필요: 보안 무결성 상실 상태.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
