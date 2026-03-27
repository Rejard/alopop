'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { UserPlus, LogIn, Copy, Check, ArrowLeft } from 'lucide-react';

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const rawCode = params?.code;
  const targetCode = typeof rawCode === 'string' ? rawCode.toUpperCase() : '';

  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [viewMode, setViewMode] = useState<'SELECT' | 'NEW' | 'EXISTING'>('SELECT');
  const [copied, setCopied] = useState(false);

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

  // 비로그인 상태의 유저가 닉네임만 입력하고 가입과 동시에 친구 추가를 할 때 호출
  const handleGuestJoinAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setIsLoading(true);
    
    try {
      // 1. 게스트 회원가입 및 코드 발급
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nickname.trim() }),
      });
      
      if (!res.ok) throw new Error('가입에 실패했습니다.');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
      <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-zinc-800 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
        <div className="w-20 h-20 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 rounded-2xl mx-auto mb-6 flex items-center justify-center border border-indigo-500/30">
          <UserPlus size={36} className="text-indigo-400" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">초대장 도착</h1>
        <p className="text-zinc-400 text-sm mb-6">
          <span className="font-bold text-zinc-200 tracking-widest bg-zinc-800 px-2 py-0.5 rounded mr-1">{targetCode}</span> 사용자로부터 메신저 초대를 받았습니다.
        </p>

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
          <form onSubmit={handleGuestJoinAndAdd} className="space-y-4 text-left">
            <button 
              type="button" 
              onClick={() => setViewMode('SELECT')}
              className="text-zinc-400 hover:text-white mb-2 flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeft size={16} /> 뒤로
            </button>
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 mb-4 text-center">
              <p className="text-xs text-zinc-400 leading-relaxed">
                alo-pop 초보안 프라이빗 메신저입니다.<br/>사용하실 닉네임을 입력하고 수락해 보세요!
              </p>
            </div>
            <div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="멋진 닉네임을 입력하세요"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                required
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !nickname.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-2"
            >
              {isLoading ? '처리 중...' : '시작하고 자동 수락하기'}
            </button>
          </form>
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
