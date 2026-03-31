'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

function CustomGoogleButton({ onSuccess, onError }: { onSuccess: (res: any) => void; onError: () => void }) {
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      onSuccess({ credential: tokenResponse.access_token });
    },
    onError: onError,
    flow: 'implicit'
  });

  return (
    <button
      onClick={() => login()}
      className="flex items-center justify-center gap-3 w-full bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-3.5 px-4 rounded-lg shadow-ambient transition-all active:scale-95 border border-white/10"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
         <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
         <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
         <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Google 계정으로 계속하기
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isWebview, setIsWebview] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const handleViewportResize = () => {
      if (window.visualViewport) {
        document.documentElement.style.setProperty('--vh', `${window.visualViewport.height}px`);
      }
    };
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('scroll', handleViewportResize);
    handleViewportResize();

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('alo_user');
      if (stored) {
        router.push('/');
      }
      
      // 인앱 브라우저(카카오톡, 인스타, 페이스북, 라인 등) 감지
      const ua = navigator.userAgent || navigator.vendor;
      if (/KAKAOTALK|Instagram|FBAN|FBAV|Line/i.test(ua)) {
        setIsWebview(true);
      }
    }
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
    };
  }, [router]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      if (!response.ok) {
        throw new Error('Google Auth Failed');
      }

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
    <div 
      className="fixed top-0 left-0 w-full h-full bg-[#0a0a0a] text-zinc-200 overflow-y-auto overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="w-full mx-auto max-w-md min-h-full flex flex-col relative px-6 py-12">
        
        {/* 헤더 배경 블러 효과 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-sm h-64 bg-purple-900/30 blur-[80px] rounded-full pointer-events-none" />

        <div className="text-center mb-10 relative z-10 mt-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)] transform rotate-12 transition-transform hover:rotate-0 duration-500">
            <span className="text-4xl font-extrabold text-white tracking-tighter">alo</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight text-white leading-tight">
            TRUSTED<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">INTERACTION</span>
          </h1>
          <p className="text-zinc-400 text-sm font-medium tracking-wide mt-3">신뢰할 수 있는 대화의 시작, 알로팝</p>
        </div>

        {/* 로그인 영역 */}
        <div className="flex flex-col items-center justify-center space-y-4 mb-16 relative z-10">
          {isWebview && (
            <div className="w-full bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl text-center shadow-lg animate-pulse mb-2">
              <p className="text-[13px] font-bold text-yellow-400 mb-1">⚠️ 인앱 브라우저 제한 안내</p>
              <p className="text-xs text-yellow-100/70 leading-relaxed">
                현재 브라우저에서는 보안 정책으로 로그인이 제한될 수 있습니다.<br/>
                우측 상단 <strong>[ ⋮ ]</strong> 메뉴에서 <span className="text-white bg-yellow-600/50 px-1 py-0.5 rounded">다른 브라우저로 열기</span>를 선택해주세요!
              </p>
            </div>
          )}

          {!clientId && isClient ? (
            <div className="text-sm text-red-400 text-center bg-red-900/20 p-4 rounded-xl border border-red-500/30 w-full">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되지 않았습니다.
            </div>
          ) : (
            isClient && (
              <div className="w-full flex justify-center">
                <GoogleOAuthProvider clientId={clientId}>
                  <CustomGoogleButton
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      alert('구글 로그인에 실패했습니다. 기본 브라우저(Chrome/Safari)를 이용해주세요.');
                    }}
                  />
                </GoogleOAuthProvider>
              </div>
            )
          )}
        </div>

        {/* 핵심 기능 소개 영역 */}
        <div className="w-full space-y-4 pb-12 relative z-10">
          <div className="text-center mb-8">
            <p className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-2">FEATURES</p>
            <div className="h-px w-12 bg-zinc-700 mx-auto" />
          </div>

          <FeatureCard 
            icon="🛡️" 
            title="AI 팩트 필터 (Fact-Check)"
            desc="Gemini, OpenAI, Claude 리전 기반의 실시간 문맥 분석 및 딥페이크·가짜 뉴스 차단"
          />
          <FeatureCard 
            icon="🔒" 
            title="완벽한 No-Log 프라이버시"
            desc="모든 대화 내역은 브라우저 로컬 기기에만 암호화 저장되어 중앙 서버에 어떤 흔적도 남지 않습니다."
          />
          <FeatureCard 
            icon="🤖" 
            title="멀티 LLM & AI 자동 아바타"
            desc="나만의 성향을 반영한 벡터 아바타 생성 및 원하는 AI 모델(GPT, 언어모델 등)을 채팅방별로 자유롭게 스위칭"
          />
          <FeatureCard 
            icon="👥" 
            title="다자간 AI + 휴먼 그룹 채팅"
            desc="사람과 다양한 페르소나의 AI들이 한 방에 모여 대화하는 차세대 커뮤니케이션 환경"
          />
          <FeatureCard 
            icon="💸" 
            title="수수료 0% P2P 송금"
            desc="중앙 서버 개입 없이 채팅방 멤버 간 즉각적으로 알로팝 코인을 이체하고 정산하는 지갑 시스템"
          />
        </div>

        <div className="mt-8 text-center text-[10px] text-zinc-600 font-mono pb-8 tracking-widest">
          <p>© 2026 ALOPOP. NO CLOUD MEMORY.</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl backdrop-blur-sm hover:bg-zinc-800/50 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-xl border border-zinc-700/50 shadow-inner">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-100 mb-1.5">{title}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed break-keep">{desc}</p>
        </div>
      </div>
    </div>
  );
}
