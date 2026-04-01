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
  // 신규: 커스텀 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('alo_user');
    setIsOpen(false);
    router.push('/login');
  };


  // 방 자원 공유 정책 상태 (Early Return 전에 호스팅되어야 함)
  const [roomPolicy, setRoomPolicy] = useState<'individual' | 'sponsor' | 'free'>('individual');

  // [신규] 게스트 입장 시 방장이 걸어놓은 스폰서 세팅 락온(잠금) 상태
  const [hostSponsorLocked, setHostSponsorLocked] = useState<{ isLocked: boolean; modelName?: string }>({ isLocked: false });
  const [sponsorPrice, setSponsorPrice] = useState<number | string>(0);
  const [sponsorModelId, setSponsorModelId] = useState<string>('');
  const [aiModels, setAiModels] = useState<Record<string, { id: string, name: string }[]>>({});

  useEffect(() => {
    if (isOpen) {
      fetch('/api/models').then(r => r.json()).then(setAiModels).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (roomPolicy === 'sponsor' && aiModels[activeTab]?.length > 0) {
      if (!sponsorModelId || !aiModels[activeTab].some(m => m.id === sponsorModelId)) {
        setSponsorModelId(aiModels[activeTab][0].id);
      }
    }
  }, [activeTab, aiModels, roomPolicy, sponsorModelId]);

  useEffect(() => {
    if (isOpen) {
      if (!hostSponsorLocked.isLocked) {
        setInputValue(apiKeys[activeTab] || '');
      }
    }
  }, [isOpen, activeTab, apiKeys, hostSponsorLocked.isLocked]);

  const userStr = typeof window !== 'undefined' ? localStorage.getItem('alo_user') : null;
  const parsedUser = userStr ? JSON.parse(userStr) : null;
  const isAmIHost = currentRoom?.members?.find((m: any) => m.userId === parsedUser?.id)?.isHost;

  useEffect(() => {
    if (isOpen) {
      setActiveLayerTab('ai');
      loadSettings();
      
      // 개별 방 정책 적용: 모달이 열린 방의 현재 스폰서 설정을 불러옵니다.
      if (currentRoom) {
        setRoomPolicy(currentRoom.sponsorMode ? 'sponsor' : 'individual');
        setSponsorPrice(currentRoom.sponsorPrice || 0);
        setSponsorModelId(currentRoom.sponsorModel || '');
      } else {
        setRoomPolicy('individual');
        setSponsorPrice(0);
      }
    }
  }, [isOpen, currentRoom]);

  useEffect(() => {
    if (isOpen) {
      // 내가 게스트로 방에 들어가있고 방장이 스폰서 모드를 켰다면? 그 모델로 탭을 강제고정!
      let locked = false;
      if (currentRoom && parsedUser) {
        let sponsorMember = currentRoom.members?.find((m: any) => m.isHost);
        
        // 현재 내가 게스트이면서, 방의 sponsorMode가 켜져 있다면
        if (!isAmIHost && currentRoom.sponsorMode) {
          locked = true;
          setHostSponsorLocked({ isLocked: true, modelName: currentRoom.sponsorModel || 'openai' });
          setActiveTab((currentRoom.sponsorModel || 'openai') as AIProvider);
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

      // [신규] 로비에서 저장하는 경우 서버 DB에 API 키 동기화 (오프라인 상시 연동)
      if (!currentRoom && parsedUser) {
        try {
          const keyResponse = await fetch('/api/users/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: parsedUser.id,
              provider: activeTab,
              apiKey: inputValue.trim()
            })
          });

          if (keyResponse.ok) {
            const isDeleted = inputValue.trim() === '';
            setToastMessage({
              text: isDeleted 
                ? 'API 키 연동이 해제되어 마스터 DB에서 영구 삭제되었습니다.' 
                : '안전하게 특수 암호화(AES-256) 처리되어 마스터 DB에 저장되었습니다!\n앱이 꺼져도 게스트들이 알아서 코인을 보내며 AI를 사용하게 됩니다.',
              type: 'success'
            });
            setTimeout(() => {
              setToastMessage(null);
              setIsOpen(false);
            }, 3000);
            return; // 3초 대기하며 모달 닫기를 스킵
          } else {
            setToastMessage({ text: '키값 저장 중 서버 오류가 발생했습니다. 다시 시도해주세요.', type: 'error' });
            setTimeout(() => setToastMessage(null), 3000);
            return;
          }
        } catch (err) {
          console.warn('Failed to sync API key to server', err);
        }
      }
    }

    const oldPrice = currentRoom?.sponsorPrice || 0;
    const newPrice = roomPolicy === 'sponsor' ? Number(sponsorPrice) || 0 : 0;
    const isPriceChanged = oldPrice !== newPrice;

    const oldModel = currentRoom?.sponsorModel || 'openai';
    const newModel = roomPolicy === 'sponsor' ? sponsorModelId : oldModel;
    const isModelChanged = oldModel !== newModel;

    // DB에 스폰서 모드 동기화 (방별 개별 적용 설정)
    if (parsedUser && currentRoom && isAmIHost) {
      try {
        await fetch('/api/rooms/sponsor', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: parsedUser.id,
            roomId: currentRoom.id,
            sponsorMode: roomPolicy === 'sponsor',
            sponsorModel: newModel,
            sponsorPrice: newPrice
          })
        });

        const newModelName = aiModels[activeTab]?.find((m: any) => m.id === newModel)?.name || newModel;

        // [신규] 게스트에게 실시간으로 갱신내용을 브로드캐스트하기 위한 이벤트를 발생시킵니다.
        window.dispatchEvent(new CustomEvent('host_sponsor_settings_saved', {
          detail: {
            roomId: currentRoom.id,
            sponsorId: parsedUser.id,
            sponsorPrice: newPrice,
            sponsorMode: roomPolicy === 'sponsor',
            sponsorModel: newModel,
            sponsorModelName: newModelName,
            isPriceChanged, // 요금이 변동되었는지 여부를 전달
            isModelChanged // 모델 변동 여부 전달
          }
        }));
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
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800 z-50"
        >
          <X size={20} />
        </button>

        {/* 신규: 결과 토스트 메시지 */}
        {toastMessage && (
          <div className={`absolute top-4 left-4 right-14 p-3 rounded-lg shadow-2xl z-50 flex items-start gap-2 animate-in slide-in-from-top-2 fade-in duration-300 ${toastMessage.type === 'success' ? 'bg-green-600/95 text-white' : 'bg-red-600/95 text-white'}`}>
            <div className="mt-0.5 shrink-0">
              {toastMessage.type === 'success' ? <Check size={18} /> : <X size={18} />}
            </div>
            <div className="text-[13px] font-medium whitespace-pre-line leading-snug">
              {toastMessage.text}
            </div>
          </div>
        )}

        {/* 탭 컨테이너 (로비에서만 노출) */}
        {!currentRoom && (
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
        )}

        {activeLayerTab === 'ai' && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-200">{currentRoom ? '방장 스폰서 설정' : 'AI 및 비용 설정'}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{currentRoom ? '현재 채팅방의 리소스 공유 방식을 설정합니다.' : '사용할 토큰 제공자와 방 공유 방식을 선택하세요.'}</p>
              </div>
            </div>

            {/* 전역 AI 설정 (채팅방 외부에서만 노출) */}
            {!currentRoom && (
            <>
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

            <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2 ml-1">
                    {activeTab === 'gemini' ? 'Google Gemini API Key' : activeTab === 'anthropic' ? 'Anthropic API Key (sk-ant-...)' : 'OpenAI API Key (sk-...)'}
                  </label>
                  <input
                    type="text"
                    style={{ WebkitTextSecurity: 'disc' } as any}
                    autoComplete="off"
                    name="alo_api_key_prevent_autofill"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="여기에 키를 입력하세요"
                    spellCheck={false}
                    className="w-full bg-surface-container-highest border-b-[2px] border-b-transparent text-on-surface px-4 py-3 rounded-t-lg rounded-b-none text-sm focus:border-b-secondary outline-none transition-all font-mono mb-4"
                  />
                </div>
              </div>
            </>
            )}

            {/* 채팅방 개별 스폰서 설정 (방에서 열었을 때) */}
            {currentRoom && (
              isAmIHost ? (
              <div className="bg-surface-container-lowest/50 p-4 rounded-lg border border-outline-variant/15 mb-4 shadow-inner">
                <label className="block text-xs font-medium text-on-surface-variant mb-3 ml-1">현재 채팅방 AI 리소스 공유 방식 (비용 설정)</label>
                <div className="space-y-3 mt-2">

                  <label className="flex items-center gap-2 cursor-pointer p-3 bg-surface-container-high/50 rounded-lg border border-outline-variant/30 hover:bg-surface-container-high transition-colors">
                    <input
                      type="checkbox"
                      checked={roomPolicy === 'sponsor'}
                      onChange={(e) => setRoomPolicy(e.target.checked ? 'sponsor' : 'individual')}
                      className="w-4 h-4 rounded text-primary bg-surface-container-highest border-outline focus:ring-primary focus:ring-offset-dark-bg focus:ring-2 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-on-surface">현재 방장 지원 활성화 (내 API 연산 공유)</span>
                  </label>
                </div>

                {roomPolicy === 'sponsor' && (
                  <div className="mt-4 bg-surface-container-high border border-primary/20 p-4 rounded-lg animate-in slide-in-from-top-2 duration-300">
                    <label className="flex items-center justify-between text-[11px] font-semibold text-primary mb-2">
                      <span>⚙️ 상세 제공 모델</span>
                    </label>
                    <select
                      value={sponsorModelId}
                      onChange={(e) => setSponsorModelId(e.target.value)}
                      className="w-full bg-dark-bg border border-outline-variant/30 text-secondary px-3 py-2 rounded-lg text-xs focus:border-primary outline-none mb-4"
                    >
                      {aiModels[activeTab]?.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center justify-between text-[11px] font-semibold text-primary mb-2">
                      <span>💡 현재 채팅방 자율 과금 (1회 팩트체크당)</span>
                      <span>단위: 코인</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={sponsorPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSponsorPrice(val === '' ? '' : Math.max(0, Number(val)));
                      }}
                      className="w-full bg-dark-bg border-b-[2px] border-transparent text-secondary px-3 py-2 rounded-t-lg rounded-b-none text-xs focus:border-b-secondary outline-none font-mono font-bold"
                    />
                    <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed opacity-80">
                      0코인 입력 시 무료 모델로 작동합니다.<br />
                      게스트가 스폰서 연산(팩트체크 등)을 사용할 때마다 해당 금액이 게스트 지갑에서 스폰서(<strong className="text-secondary font-mono">나</strong>)의 지갑으로 자동 입금됩니다.
                    </p>
                  </div>
                )}
              </div>
              ) : (
                <div className="bg-surface-container-lowest/50 p-4 rounded-lg border border-outline-variant/15 mb-4 flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-3">
                    <UserX size={20} />
                  </div>
                  <p className="text-sm font-medium text-zinc-300">방장만 스폰서 설정을 변경할 수 있습니다.</p>
                  <p className="text-xs text-zinc-500 mt-1">스폰서 체제 변경은 방 개설자 고유 권한입니다.</p>
                </div>
              )
            )}

            {/* 나머지 하단 안내 문구 및 버튼 */}
            <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-3 mb-2 mt-2">
                <p className="text-[11px] text-secondary/90 leading-relaxed font-mono">
                  * 저장 클릭 시 <strong>[{providers.find(p => p.id === activeTab)?.name}]</strong> 허브가 연결되며, 스폰서 정책이 활성화됩니다.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-dim text-white font-bold rounded-lg text-sm transition-colors shadow-ambient shadow-inner-glow active:scale-95 flex justify-center items-center gap-2"
                >
                  <Key size={16} /> 선택 및 저장
                </button>
                {!currentRoom && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-3 px-4 bg-surface-container-high hover:bg-surface-variant text-secondary/80 border border-outline-variant/20 font-bold rounded-lg text-sm transition-colors shadow-sm active:scale-95 flex justify-center items-center gap-2"
                >
                  <LogOut size={16} /> 로그아웃
                </button>
                )}
              </div>
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
