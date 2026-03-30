'use client';

import { useEffect, useState } from 'react';
import { X, Key, Bot, LogOut, Users, EyeOff, UserX, Trash2, RefreshCw, Check } from 'lucide-react';
import { useSettingsStore, AIProvider } from '@/store/useSettingsStore';
import { useRouter } from 'next/navigation';

export function SettingsModal({ currentRoom }: { currentRoom?: any }) {
  const { isOpen, setIsOpen, selectedProvider, apiKeys, setSelectedProvider, setApiKey, loadSettings } = useSettingsStore();
  const [activeLayerTab, setActiveLayerTab] = useState<'ai' | 'friends'>('ai'); // 모달 최상단 탭 (AI / 친구관리)

  // AI 설정 탭
  const [activeTab, setActiveTab] = useState<AIProvider>('openai');
  const [inputValue, setInputValue] = useState('');

  // 친구 관리 탭
  const [hiddenBlockedFriends, setHiddenBlockedFriends] = useState<any[]>([]);
  const [isFriendsLoading, setIsFriendsLoading] = useState(false);

  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('alo_user');
    setIsOpen(false);
    router.push('/login');
  };


  // 방 자원 공유 정책 상태 (Early Return 전에 호스팅되어야 함)
  const [roomPolicy, setRoomPolicy] = useState<'individual' | 'sponsor' | 'pool'>('individual');

  // [신규] 게스트 입장 시 방장이 걸어놓은 스폰서 세팅 락온(잠금) 상태
  const [hostSponsorLocked, setHostSponsorLocked] = useState<{ isLocked: boolean; modelName?: string }>({ isLocked: false });
  const [sponsorPrice, setSponsorPrice] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setActiveLayerTab('ai');
      loadSettings();

      const savedPolicy = localStorage.getItem('alo_room_policy') as any;
      if (savedPolicy) setRoomPolicy(savedPolicy);

      const savedPrice = localStorage.getItem('alo_sponsor_price');
      if (savedPrice) setSponsorPrice(Number(savedPrice));
    }
  }, [isOpen]); // 모달이 켜질 때만 초기화

  useEffect(() => {
    if (isOpen) {
      // 내가 게스트로 방에 들어가있고 방장이 스폰서 모드를 켰다면? 그 모델로 탭을 강제고정!
      let locked = false;
      const userStr = localStorage.getItem('alo_user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      if (currentRoom && parsedUser) {
        const myMemberInfo = currentRoom.members?.find((m: any) => m.userId === parsedUser.id);
        if (myMemberInfo && !myMemberInfo.isHost) {
          const hostMember = currentRoom.members.find((m: any) => m.isHost);
          if (hostMember?.user?.sponsorMode) {
            locked = true;
            setHostSponsorLocked({ isLocked: true, modelName: hostMember.user.sponsorModel || 'openai' });
            setActiveTab((hostMember.user.sponsorModel || 'openai') as AIProvider);
          }
        }
      }

      if (!locked) {
        setHostSponsorLocked({ isLocked: false });
        setActiveTab(selectedProvider || 'openai');
      }
    }
  }, [isOpen, currentRoom, selectedProvider]);

  useEffect(() => {
    if (isOpen && activeLayerTab === 'friends') {
      fetchHiddenBlockedFriends();
    }
  }, [isOpen, activeLayerTab]);

  const fetchHiddenBlockedFriends = async () => {
    try {
      setIsFriendsLoading(true);
      const userStr = localStorage.getItem('alo_user');
      if (!userStr) return;
      const parsedUser = JSON.parse(userStr);

      const res = await fetch(`/api/friends?userId=${parsedUser.id}`);
      if (res.ok) {
        const data = await res.json();
        const inactive = data.friendships.filter((fs: any) => fs.status === 'HIDDEN' || fs.status === 'BLOCKED');
        setHiddenBlockedFriends(inactive);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFriendsLoading(false);
    }
  };

  const handleUpdateFriendStatus = async (friendId: string, status: 'ACTIVE') => {
    const userStr = localStorage.getItem('alo_user');
    if (!userStr) return;
    const parsedUser = JSON.parse(userStr);

    try {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: parsedUser.id, status })
      });
      if (res.ok) {
        alert('상태가 정상(ACTIVE)으로 복구되었습니다.');
        fetchHiddenBlockedFriends();
        // 참고: 메인 페이지의 친구 목록 상태(friends)는 새로고침 혹은 전역 상태 갱신을 통해 다시 렌더링되어야 합니다.
        // 현재 앱 구조상 브라우저 새로고침이나 다시 탭 이동 시 loadData 가 호출됩니다.
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFriend = async (friendId: string) => {
    if (!confirm("정말로 연락처에서 영구 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;

    const userStr = localStorage.getItem('alo_user');
    if (!userStr) return;
    const parsedUser = JSON.parse(userStr);

    try {
      const res = await fetch(`/api/friends/${friendId}?userId=${parsedUser.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('친구가 영구 삭제되었습니다.');
        fetchHiddenBlockedFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // 탭이 바뀔 때 해당 Provider의 로컬 키값을 인풋에 셋팅
    setInputValue(apiKeys[activeTab] || '');
  }, [activeTab, apiKeys]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostSponsorLocked.isLocked) {
      setApiKey(activeTab, inputValue.trim());
      setSelectedProvider(activeTab);
    }

    // (선택 사항) 로컬 스토리지에 방 정책도 함께 저장
    localStorage.setItem('alo_room_policy', roomPolicy);
    localStorage.setItem('alo_sponsor_price', sponsorPrice.toString());

    // DB에 스폰서 모드 동기화 (방장일 때 남들에게 보여주기 위함)
    const userStr = localStorage.getItem('alo_user');
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      try {
        await fetch('/api/user/sponsor', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: parsedUser.id,
            sponsorMode: roomPolicy === 'sponsor',
            sponsorModel: !hostSponsorLocked.isLocked ? activeTab : (selectedProvider || 'openai'),
            sponsorPrice: roomPolicy === 'sponsor' ? sponsorPrice : 0
          })
        });
      } catch (err) {
        console.warn('Sponsor DB sync failed', err);
      }
    }

    setIsOpen(false);
  };

  const providers: { id: AIProvider; name: string }[] = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Gemini' },
    { id: 'anthropic', name: 'Anthropic' },
  ];



  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">

        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
        >
          <X size={20} />
        </button>

        {/* 탭 컨테이너 (모바일에서 X 버튼 영역 침범 방지를 위해 pr-10, 넘치면 가로 스크롤 허용) */}
        <div className="flex gap-3 sm:gap-4 mb-6 border-b border-zinc-800 pb-2 pr-10 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveLayerTab('ai')}
            className={`font-semibold text-[13px] sm:text-[15px] pb-2 relative transition-colors ${activeLayerTab === 'ai' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            AI 모델 & 방 설정
            {activeLayerTab === 'ai' && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-purple-500 rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveLayerTab('friends')}
            className={`font-semibold text-[13px] sm:text-[15px] pb-2 relative transition-colors ${activeLayerTab === 'friends' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            친구 관리
            {activeLayerTab === 'friends' && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-purple-500 rounded-t-full" />}
          </button>
        </div>

        {activeLayerTab === 'ai' && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-200">AI 및 비용 설정</h3>
                <p className="text-xs text-zinc-500 mt-0.5">사용할 토큰 제공자와 방 공유 방식을 선택하세요.</p>
              </div>
            </div>

            {/* AI 탭 내용 */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              {providers.map((p) => {
                const isDisabled = hostSponsorLocked.isLocked && activeTab !== p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!hostSponsorLocked.isLocked) setActiveTab(p.id);
                    }}
                    disabled={isDisabled}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${activeTab === p.id
                        ? 'bg-zinc-800 text-white shadow-sm ' + (hostSponsorLocked.isLocked ? 'ring-1 ring-teal-500/50 cursor-not-allowed' : '')
                        : 'text-zinc-500 hover:text-zinc-300 ' + (isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : '')
                      }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>

            {/* 모델 비활성화 락 안내 메시지 */}
            {hostSponsorLocked.isLocked && (
              <div className="mt-2 p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[11px] font-medium flex items-center justify-center gap-1.5 animate-pulse mb-3">
                <Key size={14} />
                방장 스폰서 연동 중 (방장의 모델 강제 적용)
              </div>
            )}
            <div className="mb-4" />

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 ml-1">
                  {activeTab === 'gemini' ? 'Google Gemini API Key' : activeTab === 'anthropic' ? 'Anthropic API Key (sk-ant-...)' : 'OpenAI API Key (sk-...)'}
                </label>
                <input
                  type="password"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="여기에 키를 입력하세요"
                  spellCheck={false}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-4 py-3 rounded-xl text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-mono mb-4"
                />
              </div>

              <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/80 mb-2">
                <label className="block text-xs font-medium text-zinc-400 mb-2 ml-1">채팅방 AI 리소스 공유 방식 (방장 전용)</label>
                <div className="space-y-2 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="roomPolicy"
                      value="individual"
                      checked={roomPolicy === 'individual'}
                      onChange={(e) => setRoomPolicy(e.target.value as any)}
                      className="w-4 h-4 text-purple-600 bg-zinc-800 border-zinc-700 focus:ring-purple-600 focus:ring-2"
                    />
                    <span className="text-sm text-zinc-300">각자 부담 (개인 키 사용)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="roomPolicy"
                      value="sponsor"
                      checked={roomPolicy === 'sponsor'}
                      onChange={(e) => setRoomPolicy(e.target.value as any)}
                      className="w-4 h-4 text-purple-600 bg-zinc-800 border-zinc-700 focus:ring-purple-600 focus:ring-2"
                    />
                    <span className="text-sm text-zinc-300">방장/스폰서 지원 (공용 키 제공)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="roomPolicy"
                      value="pool"
                      checked={roomPolicy === 'pool'}
                      onChange={(e) => setRoomPolicy(e.target.value as any)}
                      className="w-4 h-4 text-purple-600 bg-zinc-800 border-zinc-700 focus:ring-purple-600 focus:ring-2"
                    />
                    <span className="text-sm text-zinc-300">P2P 코인 풀링 (참여자 공동 부담)</span>
                  </label>
                </div>

                {roomPolicy === 'sponsor' && (
                  <div className="mt-4 bg-zinc-900 border border-purple-500/30 p-3 rounded-lg animate-in slide-in-from-top-2 duration-300">
                    <label className="flex items-center justify-between text-[11px] font-semibold text-purple-400 mb-1.5">
                      <span>💡 방장 자율 과금 (1회 팩트체크당)</span>
                      <span>단위: 코인</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={sponsorPrice}
                      onChange={(e) => setSponsorPrice(Number(e.target.value))}
                      className="w-full bg-black/40 border border-zinc-700 text-zinc-100 px-3 py-2 rounded-lg text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                    <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                      0코인 입력 시 무료 모델로 작동합니다.<br />
                      게스트가 팩트체크를 요청할 때마다 해당 금액이 게스트 지갑에서 방장(<strong className="text-zinc-400">나</strong>)의 지갑으로 자동 입금됩니다.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <p className="text-[11px] text-amber-500/90 leading-relaxed">
                  * 저장 클릭 시 <strong>[{providers.find(p => p.id === activeTab)?.name}]</strong> 모델이 적용되며, 정책에 따라 방 인원간 코인/API 키가 공유됩니다.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded-xl text-sm transition-colors shadow-sm active:scale-95 flex justify-center items-center gap-2"
                >
                  <Key size={16} /> 선택 및 저장
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold rounded-xl text-sm transition-colors shadow-sm active:scale-95 flex justify-center items-center gap-2"
                >
                  <LogOut size={16} /> 로그아웃
                </button>
              </div>
            </form>
          </div>
        )}


        {/* -------------------- [친구 관리] 탭 영역 -------------------- */}
        {activeLayerTab === 'friends' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col h-[400px]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-200">숨김 및 차단 목록</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">상태를 해제하거나 영구히 삭제하세요.</p>
                </div>
              </div>
              <button
                onClick={fetchHiddenBlockedFriends}
                className="text-zinc-500 hover:text-white p-2"
                title="새로고침"
              >
                <RefreshCw size={16} className={isFriendsLoading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2.5">
              {isFriendsLoading ? (
                <div className="text-center text-xs text-zinc-500 py-6">목록을 불러오는 중...</div>
              ) : hiddenBlockedFriends.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 py-10 flex flex-col items-center gap-2">
                  <Users size={32} className="opacity-20" />
                  비활성화된 친구가 없습니다.
                </div>
              ) : (
                hiddenBlockedFriends.map((fs: any) => (
                  <div key={fs.id} className="flex flex-col gap-2 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs font-semibold">
                          {fs.friend.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-zinc-200">{fs.friend.username}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${fs.status === 'BLOCKED' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-400'}`}>
                          {fs.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateFriendStatus(fs.friendId, 'ACTIVE')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                      >
                        <Check size={12} /> 복구
                      </button>
                      <button
                        onClick={() => handleDeleteFriend(fs.friendId)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} /> 삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
