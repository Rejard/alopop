'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function CustomGoogleButton({ onSuccess, onError }: { onSuccess: (res: { credential: string }) => void; onError: () => void }) {
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => onSuccess({ credential: tokenResponse.access_token }),
    onError,
    flow: 'implicit',
  });

  return (
    <button
      onClick={() => login()}
      className="alo-primary-action w-full min-h-[58px] gap-3 text-[16px]"
    >
      <GoogleMark />
      Google 계정으로 계속하기
    </button>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="alo-card p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg">
        {icon}
      </div>
      <h3 className="mb-1 text-[14px] font-black tracking-[-0.03em] text-white">{title}</h3>
      <p className="text-[12px] leading-relaxed text-[var(--alo-text-muted)]">{desc}</p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('alo_user');
    if (stored) {
      router.push('/');
    }
  }, [router]);

  const handleGoogleSuccess = async (credentialResponse: { credential: string }) => {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      if (!response.ok) throw new Error('Google Auth Failed');

      const user = await response.json();
      localStorage.setItem('alo_user', JSON.stringify(user));
      router.push('/');
    } catch (error) {
      console.error('Login error:', error);
      alert('로그인 처리 중 오류가 발생했습니다.');
    }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <main className="alo-mobile-shell overflow-y-auto">
      <div className="alo-mobile-frame flex flex-col">
        <header className="mb-8 pt-4">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="alo-logo-tile h-11 w-11 text-[18px]">alo</div>
              <span className="text-lg font-black tracking-[-0.04em]">Alopop</span>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-extrabold text-white/75">
              Private Night
            </span>
          </div>

          <div className="w-fit rounded-full border border-[rgba(204,151,255,0.22)] bg-[rgba(204,151,255,0.16)] px-3 py-2 text-xs font-black text-[#ead7ff]">
            No-Log AI 채팅
          </div>
          <h1 aria-label="단톡방에 AI 친구를 초대하세요" className="mt-5 text-[42px] font-black leading-[0.98] tracking-[-0.07em] text-white">
            단톡방에<br />AI 친구를<br />초대하세요
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--alo-text-muted)]">
            가짜뉴스는 잡고, AI 친구는 대화하고, 내 대화 기록은 내 기기에만 남습니다.
          </p>
        </header>

        <section className="mb-7">
          {!clientId ? (
            <div className="alo-card border-red-400/30 bg-red-500/10 p-4 text-center text-sm font-bold text-red-200">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되지 않았습니다.
            </div>
          ) : (
            <GoogleOAuthProvider clientId={clientId}>
              <CustomGoogleButton
                onSuccess={handleGoogleSuccess}
                onError={() => alert('Google 로그인에 실패했습니다. Chrome/Safari에서 다시 시도해주세요.')}
              />
            </GoogleOAuthProvider>
          )}
          <p className="mt-3 text-center text-[11px] text-[var(--alo-text-soft)]">Google 로그인으로 바로 시작합니다.</p>
        </section>

        <section className="grid grid-cols-2 gap-3 pb-8">
          <FeatureCard icon="✓" title="팩트체크" desc="수상한 말과 이미지만 빠르게 표시" />
          <FeatureCard icon="AI" title="AI 친구" desc="성격 있는 봇을 채팅방에 초대" />
          <FeatureCard icon="🔒" title="No-Log" desc="대화 기록은 서버에 저장하지 않음" />
          <FeatureCard icon="G" title="간편 시작" desc="Google 계정으로 바로 입장" />
        </section>
      </div>
    </main>
  );
}
