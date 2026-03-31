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
      className="fixed top-0 left-0 w-full bg-dark-bg flex justify-center items-center text-on-surface p-0 sm:p-4 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
      style={{ height: 'var(--vh, 100%)' }}
    >
      <div className="w-full h-full sm:h-[850px] sm:max-h-[90dvh] mx-auto max-w-md bg-surface-container sm:rounded-lg sm:border sm:border-outline-variant/15 p-8 shadow-ambient flex flex-col justify-center relative overflow-hidden">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-dim rounded-lg mx-auto mb-8 flex items-center justify-center shadow-ambient shadow-inner-glow transform rotate-3">
            <span className="text-4xl font-extrabold text-white tracking-[tight]">alo</span>
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight text-white leading-tight">THE DIRECT<br/><span className="text-primary">ORACLE</span></h1>
          <p className="text-secondary text-sm font-medium tracking-wide font-mono mt-4">PRIVATE • SECURE • PEER-TO-PEER</p>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4">
          {isWebview && (
            <div className="w-full bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-xl text-center shadow-lg animate-pulse mb-2">
              <p className="text-[13px] font-bold text-yellow-400 mb-1">⚠️ 인앱 브라우저 제한 안내</p>
              <p className="text-xs text-yellow-100/80 leading-relaxed">
                현재 브라우저에서는 구글의 보안 정책으로 인하여 로그인 화면이 뜨지 않을 수 있습니다.<br/>
                화면 우측 상단이나 하단의 <strong>[ ⋮ ]</strong> 메뉴를 눌러<br/>
                <span className="text-white font-bold bg-yellow-600/50 px-1 py-0.5 rounded">다른 브라우저(Safari/Chrome)로 열기</span>를 선택해주세요!
              </p>
            </div>
          )}

          {!clientId && isClient ? (
            <div className="text-sm text-red-400 text-center bg-red-900/20 p-4 rounded-xl border border-red-500/30 w-full">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID 환견변수가 설정되지 않았습니다.
            </div>
          ) : (
            isClient && (
              <div className="w-full flex justify-center py-2">
                <GoogleOAuthProvider clientId={clientId}>
                  <CustomGoogleButton
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      console.error('Google Login Failed');
                      alert('구글 로그인에 실패했습니다. 다른 브라우저 기능을 이용해주세요.');
                    }}
                  />
                </GoogleOAuthProvider>
              </div>
            )
          )}
        </div>
        
        <div className="mt-12 text-center text-xs text-outline-variant font-mono">
          <p>NO CLOUD MEMORY. NO TRACES.</p>
        </div>
      </div>
    </div>
  );
}
