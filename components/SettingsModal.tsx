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
  const [roomPolicy, setRoomPolicy] = useState<'individual' | 'sponsor' | 'pool' | 'free'>('individual');

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
        let sponsorMember = currentRoom.members?.find((m: any) => m.isHost);
        
        // 1:1 채팅방(isGroup=false)인 경우, 스폰서는 방장이 아닌 '상대방'으로 간주
        if (currentRoom && !currentRoom.isGroup) {
          sponsorMember = currentRoom.members?.find((m: any) => m.userId !== parsedUser.id);
        }

        const amISponsor = sponsorMember?.userId === parsedUser.id;
        
        if (sponsorMember && !amISponsor && sponsorMember.user?.sponsorMode) {
          locked = true;
          setHostSponsorLocked({ isLocked: true, modelName: sponsorMember.user.sponsorModel || 'openai' });
          setActiveTab((sponsorMember.user.sponsorModel || 'openai') as AIProvider);
        }
      }

      if (!locked) {
        setHostSponsorLocked({ isLocked: false });
        if (selectedProvider === 'gemini-free') {
           setActiveTab('gemini');
           setRoomPolicy('free');
        } else {
           setActiveTab(selectedProvider || 'openai');
           if (roomPolicy === 'free') setRoomPolicy('individual'); // gemini가 아닌 경우 free 락 풀기
        }
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
      setSelectedProvider(activeTab);
      setApiKey(activeTab, inputValue.trim());
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
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-surface-container border border-outline-variant/15 rounded-lg shadow-ambient p-6 relative animate-in fade-in zoom-in duration-200">

        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
        >
          <X size={20} />
        </button>

        {/* 탭 컨테이너 (모바일에서 X 버튼 영역 침범 방지를 위해 pr-10, 넘치면 가로 스크롤 허용) */}
        <div className="flex gap-3 sm:gap-4 mb-8 pb-1 pr-10 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveLayerTab('ai')}
            className={`font-semibold text-[13px] sm:text-[15px] pb-2 relative transition-colors ${activeLayerTab === 'ai' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            AI 모델 & 방 설정
            {activeLayerTab === 'ai' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary rounded-t-full shadow-[0_0_8px_rgba(204,151,255,0.8)]" />}
          </button>
          <button
            onClick={() => setActiveLayerTab('friends')}
            className={`font-semibold text-[13px] sm:text-[15px] pb-2 relative transition-colors ${activeLayerTab === 'friends' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            친구 관리
            {activeLayerTab === 'friends' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary rounded-t-full shadow-[0_0_8px_rgba(204,151,255,0.8)]" />}
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
            <div className="flex bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/15">
              {providers.map((p) => {
                const isDisabled = hostSponsorLocked.isLocked && activeTab !== p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!hostSponsorLocked.isLocked) {
                        setActiveTab(p.id);
                        if (p.id !== 'gemini' && roomPolicy === 'free') {
                          setRoomPolicy('individual');
                        }
                      }
                    }}
                    disabled={isDisabled}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === p.id
                        ? 'bg-surface-container-high text-white shadow-sm shadow-inner-glow ' + (hostSponsorLocked.isLocked ? 'ring-1 ring-secondary/50 cursor-not-allowed' : '')
                        : 'text-on-surface-variant hover:text-on-surface ' + (isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : '')
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
                  <label className="block text-xs font-medium text-on-surface-variant mb-2 ml-1">
                    {activeTab === 'gemini' ? 'Google Gemini API Key' : activeTab === 'anthropic' ? 'Anthropic API Key (sk-ant-...)' : 'OpenAI API Key (sk-...)'}
                  </label>
                  <input
                    type="password"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="여기에 키를 입력하세요"
                    spellCheck={false}
                    className="w-full bg-surface-container-highest border-b-[2px] border-b-transparent text-on-surface px-4 py-3 rounded-t-lg rounded-b-none text-sm focus:border-b-secondary outline-none transition-all font-mono mb-4"
                  />
                </div>

              <div className="bg-surface-container-lowest/50 p-4 rounded-lg border border-outline-variant/15 mb-4 shadow-inner">
                <label className="block text-xs font-medium text-on-surface-variant mb-3 ml-1">채팅방 AI 리소스 공유 방식 (비용 설정)</label>
                <div className="space-y-3 mt-2">

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="roomPolicy"
                      value="individual"
                      checked={roomPolicy === 'individual'}
                      onChange={(e) => setRoomPolicy(e.target.value as any)}
                      className="w-4 h-4 text-primary bg-surface-container-high border-outline-variant focus:ring-primary focus:ring-offset-dark-bg focus:ring-2"
                    />
                    <span className="text-sm font-medium text-on-surface-variant">각자 부담 (개인 키 사용)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="roomPolicy"
                      value="sponsor"
                      checked={roomPolicy === 'sponsor'}
                      onChange={(e) => setRoomPolicy(e.target.value as any)}
                      className="w-4 h-4 text-primary bg-surface-container-high border-outline-variant focus:ring-primary focus:ring-offset-dark-bg focus:ring-2"
                    />
                    <span className="text-sm font-medium text-on-surface-variant">방장/스폰서 지원 (공용 키 제공)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="roomPolicy"
                      value="pool"
                      checked={roomPolicy === 'pool'}
                      onChange={(e) => setRoomPolicy(e.target.value as any)}
                      className="w-4 h-4 text-primary bg-surface-container-high border-outline-variant focus:ring-primary focus:ring-offset-dark-bg focus:ring-2"
                    />
                    <span className="text-sm font-medium text-on-surface-variant">P2P 코인 풀링 (참여자 공동 부담)</span>
                  </label>
                </div>

                {roomPolicy === 'sponsor' && (
                  <div className="mt-4 bg-surface-container-high border border-primary/20 p-4 rounded-lg animate-in slide-in-from-top-2 duration-300">
                    <label className="flex items-center justify-between text-[11px] font-semibold text-primary mb-2">
                      <span>💡 방장 자율 과금 (1회 팩트체크당)</span>
                      <span>단위: 코인</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={sponsorPrice}
                      onChange={(e) => setSponsorPrice(Number(e.target.value))}
                      className="w-full bg-dark-bg border-b-[2px] border-transparent text-secondary px-3 py-2 rounded-t-lg rounded-b-none text-xs focus:border-b-secondary outline-none font-mono font-bold"
                    />
                    <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed opacity-80">
                      0코인 입력 시 무료 모델로 작동합니다.<br />
                      게스트가 팩트체크를 요청할 때마다 해당 금액이 게스트 지갑에서 스폰서(<strong className="text-secondary font-mono">나</strong>)의 지갑으로 자동 입금됩니다.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-3">
                <p className="text-[11px] text-secondary/90 leading-relaxed font-mono">
                  * 저장 클릭 시 <strong>[{providers.find(p => p.id === activeTab)?.name}]</strong> 허브가 연결되며, 스폰서 정책이 활성화됩니다.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-dim text-white font-bold rounded-lg text-sm transition-colors shadow-ambient shadow-inner-glow active:scale-95 flex justify-center items-center gap-2"
                >
                  <Key size={16} /> 선택 및 저장
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-3 px-4 bg-surface-container-high hover:bg-surface-variant text-secondary/80 border border-outline-variant/20 font-bold rounded-lg text-sm transition-colors shadow-sm active:scale-95 flex justify-center items-center gap-2"
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
                <div className="w-10 h-10 rounded-lg bg-surface-container-high/60 text-secondary flex items-center justify-center shadow-inner">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">숨김 및 차단 목록</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 tracking-wide">상태를 해제하거나 영구히 삭제하세요.</p>
                </div>
              </div>
              <button
                onClick={fetchHiddenBlockedFriends}
                className="text-on-surface-variant hover:text-white p-2 transition-colors duration-200 bg-surface-container hover:bg-surface-variant rounded-lg"
                title="새로고침"
              >
                <RefreshCw size={16} className={isFriendsLoading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-[2.5rem] px-1" style={{ scrollbarWidth: 'none' }}>
              {isFriendsLoading ? (
                <div className="text-center text-xs text-on-surface-variant py-6 animate-pulse">목록 동기화 중...</div>
              ) : hiddenBlockedFriends.length === 0 ? (
                <div className="text-center text-xs text-on-surface-variant py-10 flex flex-col items-center gap-2">
                  <Users size={32} className="opacity-20" />
                  비활성화된 유저 정보가 없습니다.
                </div>
              ) : (
                hiddenBlockedFriends.map((fs: any) => (
                  <div key={fs.id} className="flex flex-col gap-3 p-4 bg-surface-container-low rounded-lg shadow-ambient">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary text-sm font-bold shadow-inner">
                          {fs.friend.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-on-surface tracking-wide">{fs.friend.username}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${fs.status === 'BLOCKED' ? 'bg-red-500/10 text-red-400' : 'bg-secondary/10 text-secondary'}`}>
                          {fs.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateFriendStatus(fs.friendId, 'ACTIVE')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors border border-secondary/20"
                      >
                        <Check size={12} /> RESTORE
                      </button>
                      <button
                        onClick={() => handleDeleteFriend(fs.friendId)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                      >
                        <Trash2 size={12} /> PURGE
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
