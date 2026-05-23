'use client';

import { useState, useSyncExternalStore } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, LogIn, UserPlus } from 'lucide-react';

const GOOGLE_OAUTH_STATE_KEY = 'alo_google_oauth_state';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_REDIRECT_URI = 'https://alopop.alonics.com/login';

function createOAuthState() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getGoogleRedirectUri() {
  return GOOGLE_REDIRECT_URI;
}

function startGoogleRedirect(clientId: string, inviteCode: string) {
  const state = createOAuthState();
  const redirectUri = getGoogleRedirectUri();
  sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, JSON.stringify({ state, redirectUri, inviteCode, createdAt: Date.now() }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    include_granted_scopes: 'true',
    access_type: 'online',
  });

  window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
}

function GoogleButton({ clientId, inviteCode, disabled }: { clientId: string; inviteCode: string; disabled?: boolean }) {
  const handleClick = () => {
    if (!clientId || disabled) return;
    startGoogleRedirect(clientId, inviteCode);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="alo-primary-action min-h-[56px] w-full gap-2 text-[15px] disabled:opacity-50"
    >
      {disabled ? 'Google 확인 중...' : 'Google 계정으로 시작하기'}
    </button>
  );
}

type InviteUser = {
  id: string;
  username: string;
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function readStoredUser(): InviteUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem('alo_user');
    if (!stored) return null;
    const user = JSON.parse(stored) as Partial<InviteUser>;
    if (typeof user.id === 'string' && typeof user.username === 'string') return user as InviteUser;
  } catch {
    return null;
  }

  return null;
}

function subscribeStoredUser(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('storage', callback);
  window.addEventListener('alo-user-change', callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('alo-user-change', callback);
  };
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const rawCode = params?.code;
  const targetCode = typeof rawCode === 'string' ? rawCode.toUpperCase() : '';

  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'SELECT' | 'NEW' | 'EXISTING'>('SELECT');
  const [copied, setCopied] = useState(false);
  const currentUser = useSyncExternalStore(subscribeStoredUser, readStoredUser, () => null);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(targetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('초대 코드 복사에 실패했습니다.');
    }
  };

  const handleAddFriend = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, targetFriendId: targetCode }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          alert('로그인 정보가 만료되었습니다. 다시 로그인해주세요.');
          localStorage.removeItem('alo_user');
          location.href = '/login';
          return;
        }
        const errorData = await res.json();
        throw new Error(errorData.error || '친구 추가 실패');
      }

      alert('초대를 수락했습니다. 이제 친구 목록에서 대화할 수 있어요.');
      router.push('/');
    } catch (err: unknown) {
      alert(getErrorMessage(err, '오류가 발생했습니다.'));
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <main className="alo-mobile-shell">
      <div className="alo-mobile-frame flex min-h-[100dvh] items-center">
        <section className="alo-card-strong w-full p-6 text-center">
          <div className="mx-auto mb-7 h-20 w-20 alo-logo-tile text-3xl">
            <UserPlus size={34} />
          </div>

          <p className="mb-2 text-xs font-black tracking-[0.18em] text-[var(--alo-accent-mint)]">Private Night Invite</p>
          <h1 className="mb-3 text-3xl font-black tracking-[-0.05em] text-white">초대장 도착</h1>
          <p className="mb-6 text-sm leading-relaxed text-[var(--alo-text-muted)]">
            <span className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 font-mono font-black text-[var(--alo-accent-mint)]">
              {targetCode}
            </span>
            <br />
            이 사용자가 당신을 AI 단톡방으로 초대했어요.
          </p>

          {currentUser ? (
            <div className="space-y-3">
              <div className="alo-card p-4">
                <p className="text-sm leading-relaxed text-[var(--alo-text-muted)]">
                  현재 <span className="font-black text-[var(--alo-accent-mint)]">{currentUser.username}</span> 님으로 접속 중입니다.
                </p>
              </div>
              <button onClick={handleAddFriend} disabled={isLoading} className="alo-primary-action min-h-[56px] w-full text-[15px] disabled:opacity-50">
                {isLoading ? '연결 중...' : '초대 수락하고 친구 추가'}
              </button>
              <button onClick={() => router.push('/')} className="alo-secondary-action min-h-[52px] w-full">
                홈으로 돌아가기
              </button>
            </div>
          ) : viewMode === 'SELECT' ? (
            <div className="space-y-3 text-left">
              <button onClick={() => setViewMode('NEW')} className="alo-primary-action min-h-[56px] w-full gap-2 text-[15px]">
                <UserPlus size={18} />
                처음이신가요? 시작하기
              </button>
              <button onClick={() => setViewMode('EXISTING')} className="alo-secondary-action min-h-[56px] w-full gap-2">
                <LogIn size={18} />
                이미 앱을 사용 중인가요?
              </button>
            </div>
          ) : viewMode === 'NEW' ? (
            <div className="space-y-4 text-left">
              <button onClick={() => setViewMode('SELECT')} className="flex items-center gap-1 text-sm font-bold text-[var(--alo-text-muted)]">
                <ArrowLeft size={16} /> 뒤로
              </button>
              <div className="alo-card p-4 text-center">
                <p className="mb-4 text-xs leading-relaxed text-[var(--alo-text-muted)]">
                  Google 계정으로 들어오면 초대한 친구가 자동으로 연결됩니다.
                </p>
                {isLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 py-4 text-center text-sm font-bold text-[var(--alo-accent-mint)]">처리 중...</div>
                ) : clientId ? (
                  <GoogleButton clientId={clientId} inviteCode={targetCode} disabled={isLoading} />
                ) : (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-center text-sm font-bold text-red-200">
                    Google Client ID가 설정되지 않았습니다.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <button onClick={() => setViewMode('SELECT')} className="flex items-center gap-1 text-sm font-bold text-[var(--alo-text-muted)]">
                <ArrowLeft size={16} /> 뒤로
              </button>
              <div className="alo-card p-4 text-center">
                <p className="mb-4 text-sm leading-relaxed text-[var(--alo-text-muted)]">
                  기존에 쓰던 브라우저에서 알로팝을 열고, 친구 추가 메뉴에 아래 코드를 입력해주세요.
                </p>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-3">
                  <span className="ml-2 font-mono text-lg font-black tracking-widest text-[var(--alo-accent-mint)]">{targetCode}</span>
                  <button onClick={handleCopyCode} className="rounded-xl bg-white/10 p-2.5 text-white">
                    {copied ? <Check size={18} className="text-[var(--alo-accent-mint)]" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
