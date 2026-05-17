'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, History, RefreshCw, Search, Users } from 'lucide-react';

type ActivityStatus = 'ACTIVE_ESTIMATE' | 'QUIET_ESTIMATE' | 'INACTIVE_ESTIMATE';
type WalletDirection = 'CREDIT' | 'DEBIT';

type AdminMember = {
  id: string;
  username: string;
  emailMasked: string | null;
  hasGoogleAccount: boolean;
  avatar_url: string | null;
  walletBalance: number;
  isAdmin: boolean;
  isAi: boolean;
  aiOwnerId: string | null;
  isAgent: boolean;
  isQaUser: boolean;
  createdAt: string;
  latestActivityAt: string | null;
  activityStatus: ActivityStatus;
  hasOpenaiKey: boolean;
  hasGeminiKey: boolean;
  hasAnthropicKey: boolean;
  hasAnyApiKey: boolean;
  sponsorHostRooms: number;
  counts: {
    rooms: number;
    friendsAdded: number;
    addedBy: number;
    pushSubscriptions: number;
    eventRewards: number;
    eventUsages: number;
    offlineNotices: number;
  };
};

type AdminAuditLog = {
  id: string;
  action: string;
  reason: string;
  metadata: {
    amount?: number;
    beforeBalance?: number;
    afterBalance?: number;
  } | null;
  createdAt: string;
  admin: {
    id: string;
    username: string;
  };
  targetUser: {
    id: string;
    username: string | null;
  } | null;
};

type AdminUsersOverview = {
  caveats: {
    activity: string;
    privacy: string;
  };
  stats: {
    totalUsers: number;
    activity: {
      activeEstimate: number;
      quietEstimate: number;
      inactiveEstimate: number;
    };
    roles: {
      admins: number;
      regularUsers: number;
      aiUsers: number;
      agents: number;
      qaUsers: number;
    };
    access: {
      googleAccounts: number;
      apiKeyHolders: number;
      eventOnlyUsers: number;
    };
    sponsor: {
      sponsorHosts: number;
      sponsoredRooms: number;
    };
    wallet: {
      negativeBalances: number;
      zeroBalances: number;
      lowBalances: number;
    };
  };
  members: AdminMember[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const roleOptions = [
  { value: 'all', label: '전체' },
  { value: 'regular', label: '일반' },
  { value: 'admin', label: '관리자' },
  { value: 'ai', label: 'AI 친구' },
  { value: 'agent', label: 'Agent' },
  { value: 'qa', label: 'QA' },
];

const activityOptions = [
  { value: 'all', label: '전체 활동' },
  { value: 'ACTIVE_ESTIMATE', label: '활동 추정' },
  { value: 'QUIET_ESTIMATE', label: '저활동 추정' },
  { value: 'INACTIVE_ESTIMATE', label: '비활동 추정' },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: ActivityStatus) {
  if (status === 'ACTIVE_ESTIMATE') return '활동';
  if (status === 'QUIET_ESTIMATE') return '저활동';
  return '비활동';
}

function statusClass(status: ActivityStatus) {
  if (status === 'ACTIVE_ESTIMATE') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (status === 'QUIET_ESTIMATE') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
}

function StatTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'good' | 'warn' | 'danger' }) {
  const toneClass = {
    default: 'text-primary',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    danger: 'text-red-300',
  }[tone];

  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
      <div className="text-[11px] font-bold text-on-surface-variant">{label}</div>
      <div className={`mt-1 text-2xl font-black tracking-normal ${toneClass}`}>{formatNumber(value)}</div>
    </div>
  );
}

export default function AdminMembersPanel() {
  const [overview, setOverview] = useState<AdminUsersOverview | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [activity, setActivity] = useState('all');
  const [apiKey, setApiKey] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<AdminMember | null>(null);
  const [direction, setDirection] = useState<WalletDirection>('CREDIT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '25',
      role,
      activity,
      apiKey,
    });
    if (q.trim()) params.set('q', q.trim());
    return params.toString();
  }, [activity, apiKey, page, q, role]);

  const syncMembers = useCallback(async (ignore?: { current: boolean }) => {
    try {
      const response = await fetch(`/api/admin/users?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '회원 통계를 불러오지 못했습니다.');
      if (!ignore?.current) setOverview(data);
    } catch (err) {
      if (!ignore?.current) setError(err instanceof Error ? err.message : '회원 통계를 불러오지 못했습니다.');
    } finally {
      if (!ignore?.current) setLoading(false);
    }
  }, [query]);

  const syncAuditLogs = useCallback(async (ignore?: { current: boolean }) => {
    setAuditLoading(true);
    try {
      const response = await fetch('/api/admin/audit-logs?action=WALLET_CREDIT&limit=20');
      const creditData = await response.json();
      if (!response.ok) throw new Error(creditData?.error || '감사 로그를 불러오지 못했습니다.');

      const debitResponse = await fetch('/api/admin/audit-logs?action=WALLET_DEBIT&limit=20');
      const debitData = await debitResponse.json();
      if (!debitResponse.ok) throw new Error(debitData?.error || '감사 로그를 불러오지 못했습니다.');

      const merged = [...(creditData.logs || []), ...(debitData.logs || [])]
        .sort((a: AdminAuditLog, b: AdminAuditLog) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);
      if (!ignore?.current) setAuditLogs(merged);
    } catch (err) {
      if (!ignore?.current) setError(err instanceof Error ? err.message : '감사 로그를 불러오지 못했습니다.');
    } finally {
      if (!ignore?.current) setAuditLoading(false);
    }
  }, []);

  const refreshAll = async () => {
    setLoading(true);
    setError('');
    setActionMessage('');
    await Promise.all([syncMembers(), syncAuditLogs()]);
  };

  useEffect(() => {
    const ignore = { current: false };

    async function run() {
      try {
        const response = await fetch(`/api/admin/users?${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || '회원 통계를 불러오지 못했습니다.');
        if (!ignore.current) setOverview(data);
      } catch (err) {
        if (!ignore.current) setError(err instanceof Error ? err.message : '회원 통계를 불러오지 못했습니다.');
      } finally {
        if (!ignore.current) setLoading(false);
      }
    }

    run();
    return () => {
      ignore.current = true;
    };
  }, [query]);

  useEffect(() => {
    const ignore = { current: false };

    async function run() {
      try {
        const response = await fetch('/api/admin/audit-logs?action=WALLET_CREDIT&limit=20');
        const creditData = await response.json();
        if (!response.ok) throw new Error(creditData?.error || '감사 로그를 불러오지 못했습니다.');

        const debitResponse = await fetch('/api/admin/audit-logs?action=WALLET_DEBIT&limit=20');
        const debitData = await debitResponse.json();
        if (!debitResponse.ok) throw new Error(debitData?.error || '감사 로그를 불러오지 못했습니다.');

        const merged = [...(creditData.logs || []), ...(debitData.logs || [])]
          .sort((a: AdminAuditLog, b: AdminAuditLog) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 20);
        if (!ignore.current) setAuditLogs(merged);
      } catch (err) {
        if (!ignore.current) setError(err instanceof Error ? err.message : '감사 로그를 불러오지 못했습니다.');
      } finally {
        if (!ignore.current) setAuditLoading(false);
      }
    }

    run();
    return () => {
      ignore.current = true;
    };
  }, []);

  const beginAdjust = (member: AdminMember, nextDirection: WalletDirection) => {
    setSelectedMember(member);
    setDirection(nextDirection);
    setAmount('');
    setReason('');
    setActionMessage('');
  };

  const handleAdjustWallet = async () => {
    if (!selectedMember) return;
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setActionMessage('금액은 1 이상의 정수여야 합니다.');
      return;
    }
    if (reason.trim().length < 6) {
      setActionMessage('사유는 6자 이상 입력해야 합니다.');
      return;
    }

    setAdjusting(true);
    setActionMessage('');
    try {
      const response = await fetch('/api/admin/users/wallet-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedMember.id,
          amount: parsedAmount,
          direction,
          reason: reason.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '코인 조정에 실패했습니다.');
      setActionMessage(`${selectedMember.username}의 코인이 ${formatNumber(data.balance)}으로 조정되었습니다.`);
      setSelectedMember(null);
      setAmount('');
      setReason('');
      await refreshAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : '코인 조정에 실패했습니다.');
    } finally {
      setAdjusting(false);
    }
  };

  const stats = overview?.stats;

  return (
    <div className="max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Users size={26} /> 회원 관리
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            가입 회원의 상태, 역할, API 키 보유 여부, 스폰서/지갑 위험 신호를 개인정보 원칙 안에서 요약합니다.
          </p>
          <p className="mt-1 text-xs font-bold text-primary/80">
            상단 통계는 전체 회원 기준이며, 아래 목록만 검색/필터 조건을 적용합니다.
          </p>
        </div>
        <button
          onClick={refreshAll}
          disabled={loading || auditLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-variant disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading || auditLoading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {stats && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="전체 회원" value={stats.totalUsers} />
            <StatTile label="활동 추정" value={stats.activity.activeEstimate} tone="good" />
            <StatTile label="저활동 추정" value={stats.activity.quietEstimate} tone="warn" />
            <StatTile label="비활동 추정" value={stats.activity.inactiveEstimate} />
            <StatTile label="관리자" value={stats.roles.admins} />
            <StatTile label="일반 유저" value={stats.roles.regularUsers} />
            <StatTile label="AI 친구" value={stats.roles.aiUsers} />
            <StatTile label="Agent" value={stats.roles.agents} />
            <StatTile label="QA 계정" value={stats.roles.qaUsers} />
            <StatTile label="구글 가입" value={stats.access.googleAccounts} />
            <StatTile label="개인 API 키 보유" value={stats.access.apiKeyHolders} />
            <StatTile label="이벤트 키 의존" value={stats.access.eventOnlyUsers} />
            <StatTile label="스폰서 방장" value={stats.sponsor.sponsorHosts} />
            <StatTile label="스폰서 방 수" value={stats.sponsor.sponsoredRooms} />
            <StatTile label="코인 0" value={stats.wallet.zeroBalances} tone="warn" />
            <StatTile label="음수 코인" value={stats.wallet.negativeBalances} tone="danger" />
          </div>

          <div className="mb-5 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-xs leading-relaxed text-on-surface-variant">
            <div>{overview?.caveats.activity}</div>
            <div className="mt-1">{overview?.caveats.privacy}</div>
          </div>
        </>
      )}

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
          <div className="mb-3 flex items-center gap-2 font-bold text-on-surface">
            <Coins size={18} className="text-primary" /> 코인 조정
          </div>
          {selectedMember ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
              <div>
                <div className="truncate text-sm font-bold">{selectedMember.username}</div>
                <div className="text-xs text-on-surface-variant">현재 {formatNumber(selectedMember.walletBalance)} 코인</div>
              </div>
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as WalletDirection)}
                className="rounded-lg border border-outline-variant/30 bg-dark-bg px-3 py-2 text-sm font-bold outline-none focus:border-primary"
              >
                <option value="CREDIT">지급</option>
                <option value="DEBIT">차감</option>
              </select>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="numeric"
                placeholder="금액"
                className="rounded-lg border border-outline-variant/30 bg-dark-bg px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="조정 사유"
                className="md:col-span-2 rounded-lg border border-outline-variant/30 bg-dark-bg px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdjustWallet}
                  disabled={adjusting}
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
                >
                  적용
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  disabled={adjusting}
                  className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-bold text-on-surface-variant"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-on-surface-variant">회원 목록에서 지급 또는 차감 버튼을 선택하세요. 모든 조정은 감사 로그에 기록됩니다.</div>
          )}
          {actionMessage && <div className="mt-3 text-sm font-bold text-primary">{actionMessage}</div>}
        </div>

        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
          <div className="mb-3 flex items-center gap-2 font-bold text-on-surface">
            <History size={18} className="text-primary" /> 최근 코인 조정 로그
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-md bg-surface-container px-3 py-2 text-xs">
                <div className="flex justify-between gap-2 font-bold">
                  <span>{log.action === 'WALLET_CREDIT' ? '지급' : '차감'} · {log.targetUser?.username || '대상 없음'}</span>
                  <span className="text-on-surface-variant">{formatDate(log.createdAt)}</span>
                </div>
                <div className="mt-1 text-on-surface-variant">
                  {formatNumber(log.metadata?.amount || 0)} 코인 · {log.reason}
                </div>
              </div>
            ))}
            {!auditLoading && auditLogs.length === 0 && (
              <div className="text-sm text-on-surface-variant">아직 코인 조정 로그가 없습니다.</div>
            )}
            {auditLoading && <div className="text-sm text-on-surface-variant">감사 로그를 불러오는 중입니다.</div>}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
          <input
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
            placeholder="닉네임, 구글 이메일, ID 검색"
            className="w-full rounded-lg border border-outline-variant/30 bg-dark-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={role}
          onChange={(event) => {
            setPage(1);
            setRole(event.target.value);
          }}
          className="rounded-lg border border-outline-variant/30 bg-dark-bg px-3 py-2 text-sm font-bold outline-none focus:border-primary"
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={activity}
          onChange={(event) => {
            setPage(1);
            setActivity(event.target.value);
          }}
          className="rounded-lg border border-outline-variant/30 bg-dark-bg px-3 py-2 text-sm font-bold outline-none focus:border-primary"
        >
          {activityOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={apiKey}
          onChange={(event) => {
            setPage(1);
            setApiKey(event.target.value);
          }}
          className="rounded-lg border border-outline-variant/30 bg-dark-bg px-3 py-2 text-sm font-bold outline-none focus:border-primary"
        >
          <option value="all">API 키 전체</option>
          <option value="has">API 키 있음</option>
          <option value="none">API 키 없음</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-low">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="border-b border-outline-variant/20 bg-surface-container">
              <tr className="text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-3">회원</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">역할</th>
                <th className="px-4 py-3 text-right">코인</th>
                <th className="px-4 py-3">API</th>
                <th className="px-4 py-3 text-right">방</th>
                <th className="px-4 py-3 text-right">스폰서</th>
                <th className="px-4 py-3">최근 활동</th>
                <th className="px-4 py-3">가입일</th>
                <th className="px-4 py-3 text-right">조치</th>
              </tr>
            </thead>
            <tbody>
              {overview?.members.map((member) => (
                <tr key={member.id} className="border-b border-outline-variant/10 last:border-0">
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="truncate font-bold text-on-surface" title={member.username}>{member.username}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      <span className="inline-block max-w-[190px] truncate align-bottom">{member.emailMasked || member.id.slice(0, 8)}</span>
                      {member.hasGoogleAccount && <span className="ml-2 text-emerald-300">Google</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusClass(member.activityStatus)}`}>
                      {statusLabel(member.activityStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {member.isAdmin && <span className="rounded bg-primary/15 px-2 py-1 text-xs font-bold text-primary">관리자</span>}
                      {member.isAi && <span className="rounded bg-cyan-500/15 px-2 py-1 text-xs font-bold text-cyan-300">AI</span>}
                      {member.isAgent && <span className="rounded bg-purple-500/15 px-2 py-1 text-xs font-bold text-purple-300">Agent</span>}
                      {member.isQaUser && <span className="rounded bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-300">QA</span>}
                      {!member.isAdmin && !member.isAi && !member.isAgent && !member.isQaUser && (
                        <span className="rounded bg-zinc-500/15 px-2 py-1 text-xs font-bold text-zinc-300">일반</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatNumber(member.walletBalance)}</td>
                  <td className="px-4 py-3">
                    <span className={member.hasAnyApiKey ? 'text-emerald-300' : 'text-on-surface-variant'}>
                      {member.hasAnyApiKey ? '보유' : '없음'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(member.counts.rooms)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(member.sponsorHostRooms)}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(member.latestActivityAt)}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(member.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => beginAdjust(member, 'CREDIT')}
                        className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        지급
                      </button>
                      <button
                        onClick={() => beginAdjust(member, 'DEBIT')}
                        className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-500/25"
                      >
                        차감
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && overview?.members.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">
                    조건에 맞는 회원이 없습니다.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">
                    회원 통계를 불러오는 중입니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {overview && (
        <div className="mt-4 flex items-center justify-between text-sm text-on-surface-variant">
          <span>
            {formatNumber(overview.pagination.total)}명 중 {formatNumber(overview.members.length)}명 표시
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-outline-variant/30 px-3 py-1.5 font-bold disabled:opacity-40"
            >
              이전
            </button>
            <span className="font-mono">
              {overview.pagination.page} / {overview.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((current) => Math.min(current + 1, overview.pagination.totalPages))}
              disabled={page >= overview.pagination.totalPages || loading}
              className="rounded-lg border border-outline-variant/30 px-3 py-1.5 font-bold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
