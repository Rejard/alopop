'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { UserPlus, LogIn, Copy, Check, ArrowLeft } from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

function CustomGoogleButton({ onSuccess, onError, disabled }: { onSuccess: (res: any) => void; onError: () => void; disabled?: boolean }) {
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
      disabled={disabled}
      className={`flex items-center justify-center gap-3 w-full bg-white text-zinc-900 font-bold py-3.5 px-4 rounded-full shadow-md transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-100 active:scale-95'}`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
         <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
         <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
         <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {disabled ? '처리 중...' : 'Google 계정으로 승인하기'}
    </button>
  );
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const rawCode = params?.code;
  const targetCode = typeof rawCode === 'string' ? rawCode.toUpperCase() : '';

  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'SELECT' | 'NEW' | 'EXISTING'>('SELECT');
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isWebview, setIsWebview] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || navigator.vendor;
      if (/KAKAOTALK|Instagram|FBAN|FBAV|Line/i.test(ua)) {
        setIsWebview(true);
      }
    }
  }, []);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(targetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('초대 코드 복사에 실패했습니다.');
    }
  };

  // 클라이언트 환경에서 기존 로그인 세션이 있는지 확인합니다.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('alo_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    }
  }, []);

  // 로그인된 유저가 접속했을 때 호출
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
          alert('인증 정보가 만료되었거나 초기화된 이전 계정입니다. 안전을 위해 다시 로그인해주세요.');
          localStorage.removeItem('alo_user');
          location.href = '/login';
          return;
        }
        const errorData = await res.json();
        throw new Error(errorData.error || '친구 추가 실패');
      }
      alert('초대가 수락되었습니다! 이제 친구 목록에서 대화할 수 있습니다.');
      router.push('/');
    } catch (err: any) {
      alert(err.message || '오류가 발생했습니다.');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  // 비로그인 상태의 유저가 구글로 가입과 동시에 친구 추가를 할 때 호출
  const handleGoogleJoinAndAdd = async (credentialResponse: any) => {
    setIsLoading(true);
    
    try {
      // 1. 구글 회원가입/로그인 처리
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      
      if (!res.ok) throw new Error('구글 인증 혹은 가입에 실패했습니다.');
      const newUser = await res.json();
      
      localStorage.setItem('alo_user', JSON.stringify(newUser));
      setCurrentUser(newUser);

      // 2. 가입 시 발급된 ID로 초대 코드를 보낸 사람과 즉시 양방향 친구 맺기
      const friendRes = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUser.id, targetFriendId: targetCode }),
      });
      
      if (friendRes.ok) {
         alert('환영합니다! 초대한 상대방이 자동으로 친구 목록에 등록되었습니다.');
      } else {
         alert('가입은 성공했으나, 친구 추가에 실패했습니다. 코드가 만료되었거나 오류입니다.');
      }
      router.push('/');
    } catch (err: any) {
      alert(err.message || '초대 처리 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
      <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-zinc-800 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
        <div className="w-20 h-20 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 rounded-2xl mx-auto mb-6 flex items-center justify-center border border-indigo-500/30">
          <UserPlus size={36} className="text-indigo-400" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">초대장 도착</h1>
        <p className="text-zinc-400 text-sm mb-4">
          <span className="font-bold text-zinc-200 tracking-widest bg-zinc-800 px-2 py-0.5 rounded mr-1">{targetCode}</span> 사용자로부터 메신저 초대를 받았습니다.
        </p>

        {isWebview && (
          <div className="w-full bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-xl text-center shadow-lg animate-pulse mb-6">
            <p className="text-[13px] font-bold text-yellow-400 mb-1">⚠️ 카카오톡 등 인앱 브라우저 제한 안내</p>
            <p className="text-xs text-yellow-100/80 leading-relaxed">
              현재 환경에서는 구글 보안 정책으로 로그인이 차단됩니다.<br/>
              화면 상단/하단의 <strong>[ ⋮ ]</strong> 메뉴를 눌러 가입을 위해<br/>
              <span className="text-white font-bold bg-yellow-600/50 px-1 py-0.5 rounded">다른 브라우저(Safari/Chrome)로 열기</span>를 선택해주세요!
            </p>
          </div>
        )}

        {currentUser ? (
          <div className="space-y-4">
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 mb-6">
              <p className="text-sm text-zinc-300 leading-relaxed">
                현재 <span className="font-semibold text-white">{currentUser.username}</span> 님으로 접속 중입니다.<br/>
              </p>
            </div>
            <button
              onClick={handleAddFriend}
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? '연동 중...' : '친구 추가 수락하기'}
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 rounded-xl transition-all"
            >
              그냥 홈으로 돌아가기
            </button>
          </div>
        ) : viewMode === 'SELECT' ? (
          <div className="space-y-4 text-left mt-2">
            <button
              onClick={() => setViewMode('NEW')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              처음이신가요? 시작하기
            </button>
            
            <button
              onClick={() => setViewMode('EXISTING')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 border border-zinc-700"
            >
              <LogIn size={18} />
              이미 앱을 사용 중이신가요?
            </button>
          </div>
        ) : viewMode === 'NEW' ? (
          <div className="space-y-4 text-left">
            <button 
              type="button" 
              onClick={() => setViewMode('SELECT')}
              className="text-zinc-400 hover:text-white mb-2 flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeft size={16} /> 뒤로
            </button>
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 mb-4 text-center">
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                alo-pop 초보안 프라이빗 메신저입니다.<br/>
                안전한 구글 계정으로 초대를 수락해 보세요!
              </p>
              
              {isLoading ? (
                <div className="w-full py-4 text-zinc-400 text-sm animate-pulse border border-zinc-700 rounded-xl">처리 중...</div>
              ) : isClient && clientId ? (
                <div className="flex justify-center w-full bg-zinc-950 py-3 rounded-xl border border-zinc-800">
                  <GoogleOAuthProvider clientId={clientId}>
                    <CustomGoogleButton
                      onSuccess={handleGoogleJoinAndAdd}
                      onError={() => {
                        console.error('Google Login Failed');
                        alert('구글 로그인에 실패했습니다.');
                      }}
                      disabled={isLoading}
                    />
                  </GoogleOAuthProvider>
                </div>
              ) : (
                <div className="text-sm text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/30">
                  Google Client ID가 설정되지 않았습니다.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <button 
              type="button" 
              onClick={() => setViewMode('SELECT')}
              className="text-zinc-400 hover:text-white mb-2 flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeft size={16} /> 뒤로
            </button>
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 mb-4 text-center">
              <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                현재 환경에서는 로그인되어 있지 않습니다.<br />
                <span className="text-xs text-zinc-500 font-normal">(카카오톡 등 외부 브라우저일 수 있습니다)</span>
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed mb-4 bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/50">
                기존에 사용하시던 브라우저나 알로팝 앱을 켜고, <br/>
                <span className="font-semibold text-white">친구 추가</span> 메뉴에서 아래 초대 코드를 입력해주세요.
              </p>
              
              <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="font-mono text-indigo-400 tracking-widest text-lg ml-2">{targetCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-300 active:scale-95"
                  title="코드 복사"
                >
                  {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
