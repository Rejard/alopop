'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { UserPlus, LogIn } from 'lucide-react';

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const rawCode = params?.code;
  const targetCode = typeof rawCode === 'string' ? rawCode.toUpperCase() : '';

  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');

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
        ) : (
          <form onSubmit={handleGuestJoinAndAdd} className="space-y-4 text-left">
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

            <div className="pt-4 mt-6 border-t border-zinc-800/80 text-center">
              <button 
                type="button"
                onClick={() => router.push('/login')}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 mx-auto"
              >
                <LogIn size={14} /> 기존 계정이 있으신가요?
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
