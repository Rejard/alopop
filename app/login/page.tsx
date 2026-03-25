'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // 이미 캐시(식별자)가 존재하면 로그인 과정을 생략하고 바로 통과
  useEffect(() => {
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
    }
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);

    try {
      // 닉네임만 기반으로 하는 가짜 로그인(익명 게스트 입장)
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const user = await response.json();
      
      // 사용자 ID 및 정보를 로컬 스토리지에 저장 (클라이언트 인증)
      localStorage.setItem('alo_user', JSON.stringify(user));
      
      router.push('/');
    } catch (error) {
      console.error('Login error:', error);
      alert('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed top-0 left-0 w-full bg-zinc-950 flex justify-center items-center text-zinc-100 p-0 sm:p-4 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
      style={{ height: 'var(--vh, 100%)' }}
    >
      <div className="w-full h-full sm:h-[850px] sm:max-h-[90dvh] mx-auto max-w-md bg-zinc-900 sm:rounded-[2.5rem] sm:border-[8px] border-zinc-800 p-8 shadow-2xl flex flex-col justify-center relative overflow-hidden">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/30 transform rotate-3">
            <span className="text-3xl font-bold text-white tracking-tighter">alo</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">alo-pop 에 오신 것을 환영합니다</h1>
          <p className="text-zinc-400">당신만의 프라이빗한 대화 공간</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-zinc-400 mb-2">닉네임</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="멋진 닉네임을 입력해주세요"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-zinc-100 placeholder-zinc-600"
              required
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium py-3 px-4 rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              '시작하기'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-zinc-500">
          <p>alo-pop은 서버에 대화 내역을 저장하지 않는 초보안 메신저입니다.</p>
        </div>
      </div>
    </div>
  );
}
