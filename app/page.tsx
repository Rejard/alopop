'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, LogOut, Send, Menu, Users, Crown, UserMinus, Coins, Wallet, Edit2, Check, X, UserPlus, MessageSquare, User, Copy, QrCode, MoreVertical, Link as LinkIcon, Paperclip, File, Image as ImageIcon, Loader2, ChevronDown, Calendar, HelpCircle, Bot, Zap, ShieldAlert, Sparkles, Key, ChevronRight, CheckCircle2, BarChart2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ChatMessage } from '@/lib/db';
import { useChatStore } from '@/store/useChatStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SettingsModal } from '@/components/SettingsModal';
import { v4 as uuidv4 } from 'uuid';

// AI MODELS loaded dynamically

function WalletTransactionList() {
  const [activeTxTab, setActiveTxTab] = useState<'USAGE' | 'TRANSFER'>('USAGE');
  const allTransactions = useLiveQuery(() => db.walletTx?.orderBy('createdAt').reverse().toArray());

  if (!allTransactions) return <div className="text-zinc-500 text-xs text-center py-4 flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" />로컬 장부를 불러오는 중...</div>;

  const transactions = allTransactions.filter(tx => 
    activeTxTab === 'TRANSFER' ? tx.category === 'P2P_TRANSFER' : tx.category !== 'P2P_TRANSFER'
  );

  return (
    <div className="space-y-4 mb-20 flex flex-col h-full">
      {/* 탭 버튼들 */}
      <div className="flex bg-surface-container rounded-lg p-1">
        <button 
          onClick={() => setActiveTxTab('USAGE')}
          className={`flex-1 py-1.5 text-[11px] font-bold tracking-wider rounded-md transition-all ${activeTxTab === 'USAGE' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-white'}`}
        >
          AI 이용 내역
        </button>
        <button 
          onClick={() => setActiveTxTab('TRANSFER')}
          className={`flex-1 py-1.5 text-[11px] font-bold tracking-wider rounded-md transition-all ${activeTxTab === 'TRANSFER' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-white'}`}
        >
          P2P 송금 내역
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-zinc-500 text-xs text-center py-8 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">
          해당 카테고리의 기록된 💸 거래 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-surface-container-low p-3.5 rounded-xl flex items-center justify-between border border-outline-variant/20 shadow-sm transition-all hover:bg-surface-variant">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-inner ${tx.type === 'SPEND' ? 'bg-error/10 text-error border border-error/20' : 'bg-tertiary/10 text-tertiary border border-tertiary/20'}`}>
                  {tx.type === 'SPEND' ? <LogOut size={14} className="" /> : <Send size={14} className="rotate-180" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-on-surface tracking-tight">{tx.description}</span>
                  <span className="text-[10px] text-on-surface-variant">{new Date(tx.createdAt).toLocaleString('ko-KR')}</span>
                </div>
              </div>
              <div className={`font-mono font-bold text-sm tracking-tighter ${tx.type === 'SPEND' ? 'text-error' : 'text-tertiary'}`}>
                {tx.type === 'SPEND' ? '-' : '+'} {tx.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string; inviteCode?: string; walletBalance?: number } | null>(null);
  const [myProfile, setMyProfile] = useState<{ id: string; username: string; avatar_url: string | null; statusMessage: string | null; inviteCode?: string; walletBalance: number } | null>(null);

  const [isGuideOpen, setIsGuideOpen] = useState(false); // 가이드 모달 오픈 상태

  const [inputText, setInputText] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]); // 개별 친구 목록 (상태: ACTIVE 대상)
  const [currentRoom, setCurrentRoom] = useState<{ id: string, name: string | null, isHost: boolean, isGroup?: boolean, members: any[], sponsorMode?: boolean, sponsorPrice?: number, sponsorModel?: string | null } | null>(null);
  const currentRoomRef = useRef<{ id: string, name: string | null, isHost: boolean, isGroup?: boolean, members: any[], sponsorMode?: boolean, sponsorPrice?: number, sponsorModel?: string | null } | null>(null);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [latestMessageTimes, setLatestMessageTimes] = useState<Record<string, number>>({});
  const [roomMemberReadTimes, setRoomMemberReadTimes] = useState<Record<string, Record<string, number>>>({});
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToUnreadRef = useRef(false);
  const [initialUnreadTime, setInitialUnreadTime] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [editRoomNameValue, setEditRoomNameValue] = useState('');
  const [currentTab, setCurrentTab] = useState<'chats' | 'friends' | 'stats' | 'wallet'>('chats'); // 좌측 LNB 탭 상태

  // 친구 목록 컨텍스트 메뉴 상태
  const [activeFriendMenuId, setActiveFriendMenuId] = useState<string | null>(null);

  // 친구 추가 모달 관련 상태
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [addFriendIdValue, setAddFriendIdValue] = useState('');

  // 내 프로필(상태메시지 수정) 모달 관련 상태
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [statusMsgValue, setStatusMsgValue] = useState('');

  // 친구 프로필 보기 관련 상태
  const [selectedFriendProfile, setSelectedFriendProfile] = useState<any | null>(null);

  // 오라클 HUD 디지털 시계 상태
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const markRoomAsRead = useCallback(async (roomId: string) => {
    if (!user?.id) return;

    // 디바이스간 시간(Clock)이 안 맞는 경우(상대방 시간이 내 폰 시간보다 미래일 때)
    // 현재 읽고 있는 시점의 시간이 메시지 발송 시간보다 작아져서 읽음 표시가 안 지워지는 버그(1 안사라짐) 방어
    let maxMsgTime = 0;
    try {
      const msgs = await db.messages.where('receiverId').equals(roomId).toArray();
      if (msgs.length > 0) {
        maxMsgTime = Math.max(...msgs.map(m => m.createdAt || 0));
      }
    } catch (err) { }

    const now = Math.max(Date.now(), maxMsgTime + 100); // 확보한 최신 메시지 시간보다 무조건 약간 미래로 마크

    setRoomMemberReadTimes(prev => ({
      ...prev,
      [roomId]: { ...(prev[roomId] || {}), [user.id]: now }
    }));
    fetch('/api/rooms/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, roomId, localTimestamp: now })
    }).catch(err => console.error(err));

    const { socket } = useChatStore.getState();
    if (socket) {
      socket.emit('read_receipt', { roomId, userId: user.id, timestamp: now });
    }
  }, [user?.id]);

  useEffect(() => {
    if (currentRoom?.id) {
      if (user?.id) {
        const time = roomMemberReadTimes[currentRoom.id]?.[user.id] || 0;
        setInitialUnreadTime(time);
        hasScrolledToUnreadRef.current = false;
        setShowScrollBottomBtn(false);
      }
      markRoomAsRead(currentRoom.id);
    } else {
      setInitialUnreadTime(null);
      hasScrolledToUnreadRef.current = false;
      setShowScrollBottomBtn(false);
    }
  }, [currentRoom?.id, markRoomAsRead, user?.id]);

  // 파일 첨부 관련 상태
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 미디어 뷰어(Lightbox) 상태
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, type: 'IMAGE' | 'VIDEO' } | null>(null);

  // AI 분석 로딩 상태
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // AI 자율 응답 작성 중(Typing...) 상태
  const [typingAIs, setTypingAIs] = useState<Record<string, { aiId: string, aiName: string }[]>>({});

  // 현재 방에 접속 중인 유저 명단 (스텔스 고스트 임시 방장용)
  const [activeRoomUsers, setActiveRoomUsers] = useState<string[]>([]);

  // 리얼 유저(사람) 타이핑 상태
  const [humanTyping, setHumanTyping] = useState<Record<string, { userId: string, userName: string }[]>>({});

  const getRoomName = (room: any, currentUserId?: string) => {
    if (room?.name) return room.name;
    if (!room?.members || room.members.length === 0) return '개인 채팅방';

    const others = room.members
      .filter((m: any) => m.userId !== currentUserId)
      .map((m: any) => m.user?.username || '알 수 없음');

    if (others.length === 0) return '나와의 채팅';
    return `${others.join(', ')}`;
  };

  const chatStore = useChatStore();
  const { setIsOpen: setSettingsOpen, selectedProvider, apiKeys, loadSettings } = useSettingsStore();

  // 앱 최초 로드 시 로컬 스토리지의 AI 설정을 스토어에 즉시 동기화
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedAiModel, setSelectedAiModel] = useState<string>('');
  const [isAiModelDropdownOpen, setIsAiModelDropdownOpen] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(false);

  // [NEW] Dynamic AI Models state
  const [aiModels, setAiModels] = useState<Record<string, { id: string, name: string }[]>>({});
  const [aiModelsLoaded, setAiModelsLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        setAiModels(data);
        setAiModelsLoaded(true);
      })
      .catch(err => {
        console.error('Failed to load AI models:', err);
        setAiModelsLoaded(true);
      });
  }, []);

  // AI 켜짐/꺼짐 상태 로컬스토리지 동기화 (방장 팩트체크용)
  useEffect(() => {
    localStorage.setItem('alo_ai_enabled', isAiEnabled.toString());
  }, [isAiEnabled]);

  // AI 친구 생성 폼 상태
  const [addFriendTab, setAddFriendTab] = useState<'NORMAL' | 'AI'>('NORMAL');
  const [aiNameValue, setAiNameValue] = useState('');
  const [aiMbtiValue, setAiMbtiValue] = useState('ENFP');
  const [aiGenderValue, setAiGenderValue] = useState('여성');
  const [aiAgeValue, setAiAgeValue] = useState('20대 초반');
  const [aiToneValue, setAiToneValue] = useState('발랄하고 친근한 반말');
  const [aiHobbyValue, setAiHobbyValue] = useState('');

  // 신규: AI 수정용 상태 유지
  const [editingAiFriend, setEditingAiFriend] = useState<any | null>(null);
  const [aiAvatarUrl, setAiAvatarUrl] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [generationElapsedSec, setGenerationElapsedSec] = useState(0); // 신규: 그림 그리는 초 단위 대기 시간 표시
  const [avatarGenMode, setAvatarGenMode] = useState<'system' | 'pollinations' | 'dicebear' | 'robohash'>('system');
  const [isAiCreating, setIsAiCreating] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGeneratingAvatar) {
      setGenerationElapsedSec(0);
      timer = setInterval(() => {
        setGenerationElapsedSec(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isGeneratingAvatar]);

  // 일일 전체 AI 누적 사용량 추적 및 API 키 여부
  const [totalAiUsageCount, setTotalAiUsageCount] = useState<number>(0);
  const [hasPersonalKey, setHasPersonalKey] = useState(false);

  useEffect(() => {
    // 1. 누적 사용량 로드 (무료/유료 통합)
    const saved = localStorage.getItem('alo_total_ai_usage');
    // 날짜 포맷 차이로 인한 버그를 방지하기 위해 가장 안정적인 en-CA 포맷(YYYY-MM-DD) 사용
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    let used = 0;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          used = parsed.used || 0;
        } else {
          // 날짜가 일치하지 않거나(과거 데이터) date 필드가 없는 경우 로컬 스토리지도 확실히 초기화해야 함
          localStorage.setItem('alo_total_ai_usage', JSON.stringify({ date: today, used: 0 }));
        }
      } catch (e) {
        localStorage.setItem('alo_total_ai_usage', JSON.stringify({ date: today, used: 0 }));
      }
    } else {
      localStorage.setItem('alo_total_ai_usage', JSON.stringify({ date: today, used: 0 }));
    }
    setTotalAiUsageCount(used);

    // 2. 초기 키 로드
    const checkKey = () => {
      try {
        const savedKeys = JSON.parse(localStorage.getItem('alo_api_keys') || '{}');
        const provider = localStorage.getItem('alo_ai_provider') || 'openai';
        setHasPersonalKey(!!savedKeys[provider]);
      } catch (e) {
        setHasPersonalKey(false);
      }
    };
    checkKey();

    // 설정 모달 닫힐 때 등 스토리지 변경 시 업데이트 폴링(간이)
    const interval = setInterval(checkKey, 2000);
    return () => clearInterval(interval);
  }, [selectedProvider]);

  useEffect(() => {
    setIsAiEnabled(false);
  }, [currentRoom?.id]);

  useEffect(() => {
    if (!aiModelsLoaded) return;
    const providerValue = selectedProvider || 'openai';
    const list = aiModels[providerValue] || [];
    const savedModel = localStorage.getItem('alo_ai_model') || selectedAiModel;
    
    if (!savedModel || !list.some(m => m.id === savedModel)) {
      const defaultModel = providerValue === 'gemini' ? 'gemini-3.1-flash-lite-preview' : (providerValue === 'openai' ? 'gpt-5.4-mini' : list[0]?.id || 'gpt-5.4');
      setSelectedAiModel(defaultModel);
      localStorage.setItem('alo_ai_model', defaultModel);
    } else if (selectedAiModel !== savedModel) {
      setSelectedAiModel(savedModel);
    }
  }, [selectedProvider, selectedAiModel, aiModels, aiModelsLoaded]);

  // 로컬 스토리지에서 인증 정보 확인
  useEffect(() => {
    // 모바일 가상 키보드(Visual Viewport) 높이 대응
    const handleViewportResize = () => {
      if (window.visualViewport) {
        document.documentElement.style.setProperty('--vh', `${window.visualViewport.height}px`);
      }
    };
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('scroll', handleViewportResize);
    handleViewportResize();

    const storedUser = localStorage.getItem('alo_user');
    if (!storedUser) {
      // 홍보 페이지용으로 미로그인 시 곧바로 릴리즈 노트 페이지로 이동시킵니다.
      window.location.href = '/release.html';
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const savedAiEnabled = localStorage.getItem('alo_ai_enabled');
    if (savedAiEnabled !== null) {
      setIsAiEnabled(savedAiEnabled === 'true');
    } else {
      setIsAiEnabled(true); // 기본적으로 켜둠
    }

    // 컴포넌트 마운트 시 소켓 연결
    chatStore.connectSocket(parsedUser.id);

    // 내 방 목록, 친구 목록, 내 프로필 가져오기 함수
    const loadData = async (userId: string) => {
      try {
        const [roomsRes, friendsRes, profileRes] = await Promise.all([
          fetch(`/api/rooms/user?userId=${userId}`),
          fetch(`/api/friends?userId=${userId}`), // 내 친구 목록 API 호출
          fetch(`/api/users/profile?userId=${userId}`) // 내 프로필/상태 조회
        ]);
        if (roomsRes.ok) {
          const roomsData = await roomsRes.json();
          // api/rooms/user 응답은 최상위 배열로 오기 때문에 바로 세팅
          setRooms(Array.isArray(roomsData) ? roomsData : []);

          const readTimesDict: Record<string, Record<string, number>> = {};
          if (Array.isArray(roomsData)) {
            roomsData.forEach((r: any) => {
              // 백그라운드에서도 내가 속한 모든 방의 실시간 이벤트(가격 변경, 타이핑 등)를 수신하기 위해 소켓 조인
              chatStore.joinRoom(r.id);
              
              readTimesDict[r.id] = {};
              r.members?.forEach((m: any) => {
                readTimesDict[r.id][m.userId] = new Date(m.lastReadAt || m.joinedAt).getTime();
              });
            });
          }
          setRoomMemberReadTimes(readTimesDict);
        }
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          // 가져온 우정 목록 중 ACTIVE인 친구 데이터만 매핑하여 set
          const activeFriends = friendsData.friendships
            .filter((fs: any) => fs.status === 'ACTIVE')
            .map((fs: any) => fs.friend);

          setFriends(activeFriends);
        }
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setMyProfile(profileData.user);
          setStatusMsgValue(profileData.user.statusMessage || '');
        }
      } catch (e) {
        console.error('Failed to load initial data', e);
      }
    };

    loadData(parsedUser.id);

    const playNotificationSound = () => {
      try {
        const audio = new Audio('/alert.wav?v=3'); // 캐시 무효화를 위해 버전 쿼리 파라미터 부여
        audio.volume = 1.0; // 100% 볼륨 설정
        audio.play().catch(e => console.warn('오디오 자동재생 권한 제한:', e));
      } catch (e) {
        console.error('Failed to play notification audio', e);
      }
    };

    const playChatSound = () => {
      try {
        const audio = new Audio('/chat_pop.wav?v=2');
        audio.volume = 0.5; // 채팅 중 전송음은 거슬리지 않게 50% 볼륨으로 설정
        audio.play().catch(e => console.warn('오디오 자동재생 권한 제한:', e));
      } catch (e) {
        console.error('Failed to play chat audio', e);
      }
    };

    const handleNewMessage = (e: any) => {
      const msg = e.detail;

      // 송금 메시지 또는 스폰서 AI 메시지 수신 시 잔액 즉시 동기화 (실시간 차감/증가 표시용)
      if ((msg.content && msg.content.includes('[송금 알림]')) || (msg.aiAnalysis?.isSponsored && msg.aiAnalysis?.sponsorPrice > 0)) {
        fetch(`/api/users/profile?userId=${parsedUser.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.user) {
              setMyProfile(data.user);
              setUser((prev: any) => prev ? { ...prev, walletBalance: data.user.walletBalance } : null);
            }
          })
          .catch(err => console.error('Failed to update balance', err));
      }

      setRooms((prevRooms: any[]) => {
        if (!prevRooms.some(r => r.id === msg.receiverId)) {
          console.log('[DEBUG] Unknown room message received, refreshing rooms');
          loadData(parsedUser.id);
        }
        return prevRooms;
      });

      // [신규] 기존 프론트엔드 방장 브라우저 대리 팩트체크 스니핑 로직(P2P Edge Compute)은
      // 서버사이드(Node.js server.js 백그라운드 연산)로 성공적으로 마이그레이션 되어 
      // 더 이상 클라이언트에서 무거운 연산을 수행하지 않습니다. 프론트엔드가 쾌적해졌습니다!

      setLatestMessageTimes(prev => ({
        ...prev,
        [msg.receiverId]: msg.createdAt
      }));

      // 현재 보고있는 화면(방) 상태에 따른 알림음 및 읽음 처리 분기
      setCurrentRoom((curr) => {
        const isMyMsg = msg.senderId === parsedUser.id;
        const isCurrentRoom = curr?.id === msg.receiverId;

        // 상대방이 내가 지금 안 보고 있는 화면(다른 방/로비)으로 메시지를 보냈을 때만 알림/진동 쾅!
        if (!isMyMsg && !isCurrentRoom) {
          playNotificationSound();
          if (typeof window !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200]);
          }

          setUnreadCounts(prev => ({
            ...prev,
            [msg.receiverId]: (prev[msg.receiverId] || 0) + 1
          }));
        }
        // 내가 보고 있는 방에 메시지가 도착했거나(조용히 즉시 읽음 처리), 
        // 혹은 내가 그 방에 직접 메시지를 보냈을 때
        else if (isCurrentRoom) {
          // 채팅 중 서로 전송/수신 할 때 '도미솔 타격 화음' 을 작게 재생 (유저 요청)
          playChatSound();

          // 내가 보고 있는 방에 메시지가 오면: 클라이언트 딜레이 대비 버퍼를 더해 로컬타임 수정 (상대방 시간이 더 빠를 때 방어)
          const now = Math.max(Date.now(), msg.createdAt + 100);
          setRoomMemberReadTimes(prev => ({
            ...prev,
            [curr!.id]: { ...(prev[curr!.id] || {}), [parsedUser.id]: now }
          }));
          fetch('/api/rooms/read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: parsedUser.id, roomId: curr!.id, localTimestamp: now })
          }).catch(console.error);
          useChatStore.getState().socket?.emit('read_receipt', { roomId: curr!.id, userId: parsedUser.id, timestamp: now });
        }
        return curr;
      });
    };

    const handleReadUpdateEvent = (e: any) => {
      const { roomId, userId, timestamp } = e.detail;
      setRoomMemberReadTimes(prev => ({
        ...prev,
        [roomId]: {
          ...(prev[roomId] || {}),
          [userId]: timestamp
        }
      }));
    };

    const handleRoomNameUpdated = (e: any) => {
      const payload = e.detail;
      setRooms(prev => prev.map((r: any) => r.id === payload.roomId ? { ...r, name: payload.name } : r));
      setCurrentRoom(prev => prev?.id === payload.roomId ? { ...prev, name: payload.name } as any : prev);
    };

    const handleHumanTypingStart = (e: any) => {
      const { roomId, userId, userName } = e.detail;
      setHumanTyping(prev => {
        const roomTypers = prev[roomId] || [];
        if (!roomTypers.find(t => t.userId === userId)) {
          return { ...prev, [roomId]: [...roomTypers, { userId, userName }] };
        }
        return prev;
      });
    };

    const handleHumanTypingEnd = (e: any) => {
      const { roomId, userId } = e.detail;
      setHumanTyping(prev => {
        const roomTypers = prev[roomId] || [];
        return { ...prev, [roomId]: roomTypers.filter(t => t.userId !== userId) };
      });
    };

    const handleMessageUpdated = (e: any) => {
      const payload = e.detail;
      // 팩트체크 결제 결과가 담겨 돌아왔다면 잔액 동기화 (게스트 화면용)
      if (payload.aiAnalysis?.isSponsored && payload.aiAnalysis?.sponsorPrice > 0) {
        fetch(`/api/users/profile?userId=${parsedUser.id}`)
          .then(res => res.json())
          .then(data => {
            setUser((prev: any) => prev ? { ...prev, walletBalance: data.user.walletBalance } : null);
            setMyProfile((prev: any) => prev ? { ...prev, walletBalance: data.user.walletBalance } : null);
          }).catch(console.error);
      }
    };

    const handleSponsorSettingsChanged = (e: any) => {
      const { sponsorId, sponsorPrice: newSponsorPrice, sponsorMode, sponsorModel, isPriceChanged, roomId } = e.detail;

      // 내가 방장이 아니고, 현재 보고 있는 방의 요금이 변경된 실시간 이벤트를 받았을 때
      if (isPriceChanged && sponsorId !== parsedUser.id && currentRoomRef.current?.id === roomId) {
        if (newSponsorPrice > 0) {
          alert(`💡 방장님이 AI 자율 요금을 ${newSponsorPrice}코인으로 변경했습니다.\n\n새로운 과금 정책 확인을 위해 AI 스위치가 자동으로 꺼집니다.`);
        } else {
          alert(`🎉 방장님이 AI 자율 요금을 '무료'로 변경했습니다!\n\n부담 없이 AI 서비스를 마음껏 즐겨보세요! 🥳\n(안전을 위해 일시 차단된 AI 스위치를 다시 켜주세요)`);
        }
        setIsAiEnabled(false);
      }
      setRooms((prevRooms: any[]) => prevRooms.map((r: any) => {
        if (r.id !== roomId) return r;
        return {
          ...r,
          sponsorMode: sponsorMode,
          sponsorModel: sponsorModel,
          sponsorPrice: Number(newSponsorPrice)
        };
      }));

      setCurrentRoom(prev => {
        if (!prev || prev.id !== roomId) return prev;
        return {
          ...prev,
          sponsorMode: sponsorMode,
          sponsorModel: sponsorModel,
          sponsorPrice: Number(newSponsorPrice)
        };
      });
    };

    const handleHostSponsorSettingsSaved = (e: any) => {
      // 1. 방장 본인의 화면 상태 강제 갱신
      handleSponsorSettingsChanged(e);
      
      // 2. 서버를 통해 현재 방의 다른 유저(게스트)들에게 설정 갱신 브로드캐스트
      const { roomId, isPriceChanged, sponsorPrice, isModelChanged, sponsorModelName } = e.detail;
      useChatStore.getState().socket?.emit('sponsor_settings_changed', e.detail);
      
      // 요금이 변경되었을 때만 방장이 시스템 메시지를 전송하여 모두가 인지하도록 함
      if (isPriceChanged) {
        const sysMsg = sponsorPrice > 0 
          ? `💡 방장님이 AI 자율 요금을 ${sponsorPrice}코인으로 변경했습니다.`
          : `🎉 방장님이 AI 자율 요금을 '무료'로 변경했습니다! 마음껏 이용해 보세요! 🥳`;
        useChatStore.getState().sendMessage(
          roomId, 
          sysMsg, 
          'SYSTEM', 'SYSTEM', 'SYSTEM'
        );
      }

      // 모델이 변경되었을 때 시스템 메시지 전송
      if (isModelChanged) {
        const sysMsg = `🎁 [방장 스폰서 AI 설정 변경] 방장이 팩트체크용 AI 모델을 [${sponsorModelName}]으로 선택했습니다.`;
        // 방금 요금 메시지를 보냈을 수 있으므로 충돌 회피를 위해 약간 지연
        setTimeout(() => {
          useChatStore.getState().sendMessage(
            roomId, 
            sysMsg, 
            'SYSTEM', 'SYSTEM', 'SYSTEM'
          );
        }, 100);
      }
    };

    const handleRoomPresenceUpdate = (e: any) => {
      const { roomId, activeUsers } = e.detail;
      // 현재 보고 있는 방이면 접속자 명단 동기화
      setActiveRoomUsers(activeUsers);
    };

    window.addEventListener('new_chat_message', handleNewMessage);
    window.addEventListener('room_read_update', handleReadUpdateEvent);
    window.addEventListener('room_name_updated', handleRoomNameUpdated as EventListener);
    window.addEventListener('typing_start', handleHumanTypingStart as EventListener);
    window.addEventListener('typing_end', handleHumanTypingEnd as EventListener);
    window.addEventListener('message_updated', handleMessageUpdated as EventListener);
    window.addEventListener('sponsor_settings_changed', handleSponsorSettingsChanged as EventListener);
    window.addEventListener('host_sponsor_settings_saved', handleHostSponsorSettingsSaved as EventListener);
    window.addEventListener('room_presence_update', handleRoomPresenceUpdate as EventListener);

    return () => {
      window.removeEventListener('new_chat_message', handleNewMessage);
      window.removeEventListener('room_read_update', handleReadUpdateEvent);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
      window.removeEventListener('room_name_updated', handleRoomNameUpdated as EventListener);
      window.removeEventListener('typing_start', handleHumanTypingStart as EventListener);
      window.removeEventListener('typing_end', handleHumanTypingEnd as EventListener);
      window.removeEventListener('message_updated', handleMessageUpdated as EventListener);
      window.removeEventListener('sponsor_settings_changed', handleSponsorSettingsChanged as EventListener);
      window.removeEventListener('host_sponsor_settings_saved', handleHostSponsorSettingsSaved as EventListener);
      window.removeEventListener('room_presence_update', handleRoomPresenceUpdate as EventListener);

      // 언마운트 시엔 연결 끊기
      chatStore.disconnectSocket();
    };
  }, [router]);

  useEffect(() => {
    const fetchLatestData = async () => {
      if (rooms.length === 0 || !user) return;
      const times: Record<string, number> = {};
      const unreads: Record<string, number> = {};

      await Promise.all(rooms.map(async (r) => {
        const msgs = await db.messages.where('receiverId').equals(r.id).toArray();
        if (msgs.length > 0) {
          times[r.id] = Math.max(...msgs.map(m => m.createdAt));

          const myReadTime = roomMemberReadTimes[r.id]?.[user.id] || 0;
          unreads[r.id] = msgs.filter(m => m.senderId !== user.id && m.createdAt > myReadTime).length;
        }
      }));
      setLatestMessageTimes(prev => ({ ...prev, ...times }));
      setUnreadCounts(prev => ({ ...prev, ...unreads }));
    };
    fetchLatestData();
  }, [rooms, roomMemberReadTimes, user?.id]);

  const sortedRooms = [...rooms].sort((a, b) => {
    const aTime = latestMessageTimes[a.id] || new Date(a.createdAt || 0).getTime();
    const bTime = latestMessageTimes[b.id] || new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  // IndexedDB 메시지 실시간 쿼리 (현재 선택된 방 기준)
  const messages = useLiveQuery(
    () => db.messages.where('receiverId').equals(currentRoom?.id || 'none').sortBy('createdAt'),
    [currentRoom?.id]
  );

  // AI 통계 실시간 쿼리 및 월별 그룹화 (Stats Tab)
  const aiStatsData = useLiveQuery(() => db.aiStats ? db.aiStats.toArray() : [], []) || [];

  const monthlyStats = useMemo(() => {
    if (!aiStatsData || !aiStatsData.length) return {};
    const grouped: Record<string, { date: string, count: number }[]> = {};
    aiStatsData.forEach(stat => {
      const month = stat.date.substring(0, 7); // "YYYY-MM"
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(stat);
    });
    // 각 리스트 내에서 일자 최신순 정렬
    Object.keys(grouped).forEach(m => {
      grouped[m].sort((a, b) => b.date.localeCompare(a.date));
    });
    return grouped;
  }, [aiStatsData]);

  // 통계 아코디언 상태 (가장 최근 월을 기본 오픈)
  const [expandedStatMonth, setExpandedStatMonth] = useState<string | null>(null);
  useEffect(() => {
    if (Object.keys(monthlyStats).length > 0 && !expandedStatMonth) {
      const sortedMonths = Object.keys(monthlyStats).sort().reverse();
      setExpandedStatMonth(sortedMonths[0]);
    }
  }, [monthlyStats, expandedStatMonth]);

  // 내 타이핑 상태 소켓 브로드캐스트
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!user || !currentRoom) return;
    const { socket } = useChatStore.getState();
    if (!socket) return;

    const hasText = inputText.trim().length > 0;
    if (hasText && !isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { roomId: currentRoom.id, userId: user.id, userName: user.username });
    } else if (!hasText && isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing_end', { roomId: currentRoom.id, userId: user.id });
    }
  }, [inputText, user, currentRoom]);

  // 방을 이동할 때, 켜진 타이핑 상태 끄기
  useEffect(() => {
    return () => {
      if (isTypingRef.current && currentRoom && user) {
        const { socket } = useChatStore.getState();
        if (socket) socket.emit('typing_end', { roomId: currentRoom.id, userId: user.id });
        isTypingRef.current = false;
      }
    };
  }, [currentRoom, user]);

  // 메시지 자동 스크롤 관리 (최초 입장 시 안읽은곳, 이후엔 맨 아래 유지)
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    if (!hasScrolledToUnreadRef.current) {
      hasScrolledToUnreadRef.current = true;
      if (unreadDividerRef.current && messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        const dividerTop = unreadDividerRef.current.offsetTop;
        container.scrollTo({ top: dividerTop - (container.clientHeight / 2), behavior: 'auto' });
      } else if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    } else {
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;

        const lastMsg = messages[messages.length - 1];
        const isMyMsg = lastMsg?.senderId === user?.id;

        if (isNearBottom || isMyMsg) {
          messagesContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
        }
      }
    }
  }, [messages, currentRoom?.id, user?.id]);

  // AI 자율 응답 트리거 (단톡방 / 1:1방 모두 적용)
  const lastProcessedAiMsgIdRef = useRef<string | null>(null);
  const pendingAiReplyRef = useRef<Record<string, boolean>>({});
  const aiTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const aiAbortControllersRef = useRef<Record<string, AbortController>>({});
  const inputTextRef = useRef(inputText);
  const humanTypingRef = useRef(humanTyping);
  const typingAIsRef = useRef(typingAIs);

  useEffect(() => { inputTextRef.current = inputText; }, [inputText]);
  useEffect(() => { humanTypingRef.current = humanTyping; }, [humanTyping]);
  useEffect(() => { typingAIsRef.current = typingAIs; }, [typingAIs]);

  const abortAiReplies = useCallback(() => {
    // 진행 중인 타이머 해제
    Object.values(aiTimeoutsRef.current).forEach(clearTimeout);
    aiTimeoutsRef.current = {};

    // 진행 중인 Fetch 차단
    Object.values(aiAbortControllersRef.current).forEach(ctrl => ctrl.abort());
    aiAbortControllersRef.current = {};

    if (currentRoom?.id) {
      const { socket } = useChatStore.getState();
      if (socket) {
        Object.keys(pendingAiReplyRef.current).forEach(aiId => {
          if (pendingAiReplyRef.current[aiId]) {
            socket.emit('typing_end', { roomId: currentRoom.id, userId: aiId });
          }
        });
      }
      setTypingAIs(prev => ({ ...prev, [currentRoom.id]: [] }));
    }
    pendingAiReplyRef.current = {};
  }, [currentRoom?.id]);

  // 사용자가 타이핑 치기 시작하면 진행 중인 AI 대답을 모두 취소하는 기존 '눈치보기' 훅(useEffect)을 완전히 삭제했습니다.
  // 이제 AI는 사용자가 치든 말든 자기가 할 말은 끝까지 하고 던집니다.

  useEffect(() => {
    if (!currentRoom || !messages || messages.length === 0 || !user) return;

    const lastMsg = messages[messages.length - 1];

    // 이미 처리한 메시지면 패스 (렌더링 사이클 방어)
    if (lastProcessedAiMsgIdRef.current === lastMsg.messageId) return;
    lastProcessedAiMsgIdRef.current = lastMsg.messageId;

    // 텍스트 메시지가 아니면 (사진/파일/시스템메시지) 무시
    if (lastMsg.messageType !== 'TEXT') return;

    // 내 환경의 AI 통합 설정 확인 (API 키가 없어도 서버 무료 제공량으로 작동 가능)
    const selectedProvider = localStorage.getItem('alo_ai_provider') || 'openai';
    const keysStr = localStorage.getItem('alo_api_keys');
    const apiKeys = keysStr ? JSON.parse(keysStr) : {};
    const byokKey = apiKeys[selectedProvider];

    // [신규] 방장 스폰서 옵션 체크 (방장이 아니더라도 이 방이 스폰서 방인지 알아야 함)
    const isSponsorMode = currentRoom.sponsorMode === true;

    // [중요 로직 보완] 이 방이 '스폰서 락' 상태인지 확인 (단톡, 1:1 무관하게 오직 방장(isHost)의 설정만 따름)
    let sponsorMember = currentRoom.members?.find((m: any) => m.isHost);
    const amISponsor = sponsorMember?.userId === user?.id;

    // [고스트 임시 방장 선출 알고리즘]
    const isHostOnline = activeRoomUsers.includes(sponsorMember?.userId);
    const sortedOnlineUsers = [...activeRoomUsers].sort();
    const delegateUserId = isHostOnline ? null : sortedOnlineUsers[0];
    const amIDelegate = delegateUserId === user?.id;
    
    const isGuestInSponsorRoom = !amISponsor && currentRoom.sponsorMode;

    // 현재 방 멤버 중, 내 클라이언트(이 브라우저)가 연산을 책임질 AI 발라내기
    const activeAIs = currentRoom.members.filter((m: any) => {
      if (!m.user?.isAi) return false; // 사람이면 제외

      // 스폰서 모드일 경우: 내가 진짜 방장이거나, 스텔스 임시 방장으로 뽑혔다면 모든 AI 연산을 떠맡음!
      if (isSponsorMode && (amISponsor || amIDelegate)) return true;

      // 반대로, 내가 스폰서 방에 들어왔는데, 방장도 아니고 임시 방장도 아니라면 절대 연산 금지!
      if (isGuestInSponsorRoom && !amIDelegate) return false;

      // 일반 모드일 경우: 내가 직접 창조한(내 로컬 기기에 본적이 있는) AI만 연산
      return m.user?.aiOwnerId === user.id;
    });

    if (activeAIs.length === 0) return;

    // [신규] 유저의 가장 마지막 메시지가 언제였는지 인덱스 찾기
    let lastHumanMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const isSenderAi = activeAIs.some((ai: any) => ai.userId === m.senderId || ai.user?.id === m.senderId || ai.user?.username === m.senderName) || m.senderName.includes('(AI)');
      if (!isSenderAi) {
        lastHumanMsgIndex = i;
        break;
      }
    }

    // 최근 메시지 5개 추출하여 문맥 조합 (누가 무슨 말을 했는지)
    const recentContext = messages.slice(-5).map(m => `[${m.senderName}]: ${m.content}`).join('\n');

    // 내가 책임지는 각각의 AI들에 대해 개입 여부 평가
    activeAIs.forEach((aiMember: any) => {
      const aiUser = aiMember.user;

      // 사람 발언 이후 이 특정 AI가 몇 번 말했는지(Quota) 검사
      let mySpeakCountSinceLastHuman = 0;
      for (let i = lastHumanMsgIndex + Math.max(0, 1); i < messages.length; i++) {
        const m = messages[i];
        if (m.senderId === aiUser.id || m.senderName === aiUser.username) {
          mySpeakCountSinceLastHuman++;
        }
      }

      // 각 AI들은 사람의 한마디 이후 최대 연속 2번(티키타카 1회분)까지만 끼어들 수 있음
      if (mySpeakCountSinceLastHuman >= 2) {
        console.log(`[DEBUG] ${aiUser.username}는 이미 2번 발언했습니다. 다른 AI의 턴을 위해 침묵합니다.`);
        return;
      }

      // 연속으로 "자기 자신"이 두 번 말하는 진정한 의미의 혼잣말은 차단 (다른 AI가 받아쳐야 대답함)
      if (lastMsg.senderId === aiUser.id || lastMsg.senderName === aiUser.username) {
        return;
      }

      // 1:1 채팅방 여부 판별
      const isOneOnOne = currentRoom.members.length === 2 && !currentRoom.isGroup;

      // 멘션되었거나(@AI이름), 단톡방에선 25% 확률로 눈치껏 개입 (1:1 방은 100% 개입)
      const isMentioned = lastMsg.content.includes(aiUser.username) || lastMsg.content.includes('@' + aiUser.username);
      const isCommandQuiet = lastMsg.content.includes('조용히 해') || lastMsg.content.includes('그만');
      const randomTrigger = isOneOnOne ? true : Math.random() < 0.25;

      // 조용히 하라고 한 경우엔 멘션되어도 무조건 사과하고 침묵
      if (isCommandQuiet) {
        setTimeout(() => {
          chatStore.sendMessage(currentRoom.id, "앗... 넵 조용히 할게요 🤐", aiUser.id, aiUser.username, 'TEXT');
        }, isOneOnOne ? 1000 : 3000);
        return;
      }

      // AI 응답 실행 함수 (독립 분리)
      const executeAiReply = (startDelayMs: number) => {
        // 이미 답변 대기열에 들어갔다면 스킵
        if (pendingAiReplyRef.current[aiUser.id]) return;

        // 짧은 망설임(Delay) 시간이 지난 후 턴을 확인하고 타이핑 시작
        const timeoutId = setTimeout(async () => {
          try {
            // [신규] 턴 양보 (Turn-Yielding) 로직: 내가 실제로 타자를 치기 직전에 다른 AI가 이미 치고 있다면 턴 양보(취소)
            const roomTyping = typingAIsRef.current[currentRoom.id] || [];
            const isOtherAiTypingState = roomTyping.some((a: any) => a.aiId !== aiUser.id);
            const isOtherAiPendingLocal = Object.entries(pendingAiReplyRef.current).some(([id, isPending]) => id !== aiUser.id && isPending);

            if (isOtherAiTypingState || isOtherAiPendingLocal) {
              console.log(`[DEBUG] ${aiUser.username}는 다른 AI의 턴을 존중하여 이번 대답을 미룹니다(턴 양보).`);
              return; // 아무 일도 하지 않고 스킵! (다음 메시지 렌더링 사이클에서 다시 기회 획득)
            }

            // 내 턴이 통과되었으므로 타이핑 시작 선언!
            pendingAiReplyRef.current[aiUser.id] = true;

            setTypingAIs(prev => {
              const roomAIs = prev[currentRoom.id] || [];
              if (!roomAIs.find(a => a.aiId === aiUser.id)) {
                return { ...prev, [currentRoom.id]: [...roomAIs, { aiId: aiUser.id, aiName: aiUser.username }] };
              }
              return prev;
            });
            const { socket } = useChatStore.getState();
            if (socket) socket.emit('typing_start', { roomId: currentRoom.id, userId: aiUser.id, userName: aiUser.username });

            const controller = new AbortController();
            aiAbortControllersRef.current[aiUser.id] = controller;

            // 최신 문맥을 다시 추출 (딜레이 동안 쌓인 메시지 반영)
            let currentContext = "";
            db.messages
              .where('receiverId').equals(currentRoom.id)
              .sortBy('createdAt')
              .then((allMsgs: any[]) => {
                currentContext = allMsgs.slice(-5).map((m: any) => `[${m.senderName}]: ${m.content}`).join('\n');

                const realProvider = localStorage.getItem('alo_ai_provider') || 'openai';
                const savedKeys = JSON.parse(localStorage.getItem('alo_api_keys') || '{}');
                const realByokKey = savedKeys[realProvider] || '';

                // 전체 AI 사용량 무조건 1 증가
                const savedUsage = JSON.parse(localStorage.getItem('alo_total_ai_usage') || '{"used": 0}');
                const newUsed = (savedUsage.used || 0) + 1;
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                localStorage.setItem('alo_total_ai_usage', JSON.stringify({ ...savedUsage, date: todayStr, used: newUsed }));
                setTotalAiUsageCount(newUsed);

                // Dexie 로컬 영구 DB에도 오늘 날짜로 기록 동기화
                db.aiStats?.put({ date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }), count: newUsed }).catch(e => console.error("aiStats put 에러", e));

                // [신규] 스폰서 방이고, 현재 이 AI 모델이 실제 진짜 방장의 소유가 아니라 (게스트 소유)라면 과금 처리!
                // (대리 연산자가 연산하더라도 수익은 무조건 원래 방장에게 귀속)
                const hostSponsorPrice = currentRoom.sponsorPrice || 0;
                
                // 결제를 진행하는 프로미스 체인
                let paymentPromise = Promise.resolve();
                if (isSponsorMode && aiUser.aiOwnerId !== sponsorMember?.userId && hostSponsorPrice > 0) {
                  paymentPromise = fetch('/api/wallet/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      senderId: aiUser.aiOwnerId, // 이 AI의 본주인(게스트)
                      receiverId: sponsorMember?.userId, // 돈은 오직 진짜 방장에게 넣어야 함 (대리 연산자용 은닉)
                      amount: hostSponsorPrice,
                      reason: `[AI 대화 요금] 방장 스폰서 연산 (${aiUser.username})` // 임시 방장이 했다는 사실 은폐
                    })
                  }).then(async paymentRes => {
                    if (!paymentRes.ok) {
                      const errData = await paymentRes.json();
                      throw new Error(`PAY_FAIL:${errData.error || '잔액 부족'}`);
                    }
                    // 결제 성공 시 당사자(방장 본인이거나 게스트 본인일 때만) 내 지갑 렌더링 최신화
                    if (sponsorMember?.userId === user?.id || aiUser.aiOwnerId === user?.id) {
                      // 내(현재 브라우저 사용자)가 돈을 내는 측(게스트)인지, 받는 측(방장)인지 판별
                      const isSpender = aiUser.aiOwnerId === user?.id; 
                      const isEarner = sponsorMember?.userId === user?.id; 
                      
                      if (isSpender) {
                        db.walletTx?.add({
                          type: 'SPEND',
                          category: 'SPONSOR_REVENUE',
                          amount: hostSponsorPrice,
                          counterpartyId: sponsorMember?.userId,
                          counterpartyName: '방장',
                          createdAt: Date.now(),
                          description: `AI(${aiUser.username}) 방장 스폰서망 연산`
                        }).catch(console.error);
                      }
                      
                      if (isEarner) {
                        db.walletTx?.add({
                          type: 'EARN',
                          category: 'SPONSOR_REVENUE',
                          amount: hostSponsorPrice,
                          counterpartyId: aiUser.aiOwnerId,
                          counterpartyName: aiUser.username,
                          createdAt: Date.now(),
                          description: `AI(${aiUser.username}) 대리연산 스폰서 수익`
                        }).catch(console.error);
                      }

                      fetch(`/api/users/profile?userId=${user?.id}`)
                        .then(r => r.json())
                        .then(d => { 
                          if (d.user) {
                            setUser(d.user); 
                            setMyProfile(d.user);
                          }
                        })
                        .catch(console.error);
                    }
                  });
                }

                return paymentPromise.then(() => {
                  return fetch('/api/chat/friend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                      provider: isSponsorMode 
                        ? (currentRoom.sponsorModel?.includes('gemini') ? 'gemini' : currentRoom.sponsorModel?.includes('claude') ? 'anthropic' : 'openai')
                        : realProvider,
                      byokKey: realByokKey,
                      aiModel: isSponsorMode ? currentRoom.sponsorModel : localStorage.getItem('alo_ai_model') || '',
                      systemPrompt: aiUser.aiPrompt,
                      isDelegate: amIDelegate,
                      sponsorId: sponsorMember?.userId,
                      content: `현재 채팅방 대화 문맥 (최근 5개):\n${currentContext}\n\n위 문맥을 참고하여 네 차례야. 혼잣말을 연속으로 하지 않게 주의하며 자연스럽게 사람처럼 1문장 내지 2문장으로 짧게 답장해줘.`
                    })
                  });
                });
              })
              .then((aiResponse: any) => {
                if (!aiResponse.ok) {
                  if (aiResponse.status === 429) {
                    chatStore.sendMessage(currentRoom.id, `⚠️ [AI 알림] 오늘 무료 제공량을 모두 소진한 것 같습니다. 내일 다시 이용하시거나 환경설정에서 API 키를 등록해주세요. (혹은 스폰서 방 이용)`, 'system', 'System', 'SYSTEM');
                  } else if (aiResponse.status === 400) {
                    chatStore.sendMessage(currentRoom.id, `⚠️ [AI 알림] 무료 AI 시스템이 막혀 있습니다 (서버 관리자가 Google API Key를 등록하지 않았습니다).`, 'system', 'System', 'SYSTEM');
                  }
                }
                return aiResponse.json();
              })
              .then((resData: any) => {
                if (resData && resData.reply) {
                  const aiReplyContent = resData.reply;
                  
                  // 스폰서가 결제해준 AI 메시지라면 팩트체크와 동일한 💸 결제 꼬리표 배지 부착!
                  let extraAnalysis = undefined;
                  const hostSponsorPrice = currentRoom.sponsorPrice || 0;
                  
                  // 임시 방장이 화면을 보고 있든 아니든, 찐방장의 AI가 아니라면 무조건 뱃지를 달고 결제 내역을 띄움
                  if (isSponsorMode && aiUser.aiOwnerId !== sponsorMember?.userId && hostSponsorPrice > 0) {
                    const aiModelStr = currentRoom.sponsorModel || 'AI 모델';
                    
                    extraAnalysis = {
                      category: 'AI_GENERATED', // AI 배지로 항상 출력되도록 설정
                      confidence: 1,
                      reason: 'AI 친구 챗봇 자율 응답',
                      isSponsored: true,
                      sponsorModel: aiModelStr,
                      sponsorPrice: hostSponsorPrice
                    };
                  }
                  chatStore.sendMessage(currentRoom.id, aiReplyContent, aiUser.id, aiUser.username, 'TEXT', extraAnalysis);
                }
              })
              .catch((e: any) => {
                if (e.name === 'AbortError') {
                  console.log(`[DEBUG] AI ${aiUser.username} 응답이 사용자의 타이핑으로 인해 차단됨(Aborted)`);
                } else if (e.message && e.message.startsWith('PAY_FAIL:')) {
                  const errorDesc = e.message.replace('PAY_FAIL:', '');
                  chatStore.sendMessage(currentRoom.id, `⚠️ [결제 실패] ${aiUser.username}의 코인 부족(${errorDesc})으로 대화가 중단되었습니다.`, 'system', 'System', 'SYSTEM');
                } else {
                  console.error("AI 자율 응답 트리거 에러:", e);
                }
              })
              .finally(() => {
                pendingAiReplyRef.current[aiUser.id] = false;

                const { socket } = useChatStore.getState();
                if (socket) socket.emit('typing_end', { roomId: currentRoom.id, userId: aiUser.id });

                // 타이핑 인디케이터 끄기
                setTypingAIs(prev => {
                  const roomAIs = prev[currentRoom.id] || [];
                  return { ...prev, [currentRoom.id]: roomAIs.filter(a => a.aiId !== aiUser.id) };
                });
              });
          } catch (err) {
            pendingAiReplyRef.current[aiUser.id] = false;
          }
        }, startDelayMs);

        aiTimeoutsRef.current[aiUser.id] = timeoutId;
      };

      if (isMentioned || randomTrigger) {
        // 즉시 개입 처리 (단톡방 1.5~3.5초, 1:1 방은 0.3~0.8초로 매우 반응성 향상)
        const delayMs = isOneOnOne ? Math.floor(Math.random() * 500) + 300 : Math.floor(Math.random() * 2000) + 1500;
        executeAiReply(delayMs);
      } else {
        // [신규] 어색한 침묵 깨기 (단톡방 전용)
        // 누군가 말하고 나서 아무도 대답이 없고 4초~6초의 정적이 흐르면 100% 확률로 AI가 개입합니다.
        const silenceDelayMs = Math.floor(Math.random() * 2000) + 4000;

        const timeoutId = setTimeout(() => {
          // 침묵 시간 후, 여전히 마지막 메시지가 방금 검사했던 lastMsg인지 확인 (누구도 말하지 않음)
          db.messages.where('receiverId').equals(currentRoom.id).sortBy('createdAt').then((allMsgs: any[]) => {
            if (allMsgs.length === 0) return;
            const absoluteLastMsg = allMsgs[allMsgs.length - 1];

            // 침묵이 깨졌거나 현재 누군가 치고 있다면 개입 포기 (정적이 아님)
            const hasLocalText = inputTextRef.current.trim().length > 0;
            const otherTypers = humanTypingRef.current[currentRoom.id] || [];
            if (hasLocalText || otherTypers.length > 0) return;

            if (absoluteLastMsg.messageId === lastMsg.messageId) {
              // 아무도 말 안했으므로 침묵 깨기 발동 (타이핑은 1~2초만 짧게 주고 바로 입력)
              executeAiReply(Math.floor(Math.random() * 1000) + 1000);
            }
          });
        }, silenceDelayMs);

        aiTimeoutsRef.current[aiUser.id + "_silence"] = timeoutId;
      }
    });

  }, [messages, currentRoom?.id, user?.id]);

  if (!user) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Loading...</div>;
  }

  const handleLogout = () => {
    localStorage.removeItem('alo_user');
    chatStore.disconnectSocket();
    router.push('/login');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !currentRoom) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        const { socket } = chatStore;
        if (!socket) return;

        // 스폰서 락(isSponsorLocked) 상태 계산
        let sponsorMember = currentRoom?.members?.find((m: any) => m.isHost);
        const amISponsor = currentRoom ? sponsorMember?.userId === user?.id : false;
        const isSponsorLocked = currentRoom && !amISponsor && currentRoom.sponsorMode;

        const msgId = uuidv4();
        const newMessage: ChatMessage = {
          messageId: msgId,
          senderId: user.id,
          senderName: user.username,
          receiverId: currentRoom.id,
          content: data.type === 'IMAGE' ? '(사진이 전송되었습니다)' : data.type === 'VIDEO' ? '(동영상이 전송되었습니다)' : '(파일이 전송되었습니다)',
          messageType: data.type as 'IMAGE' | 'FILE' | 'VIDEO',
          fileUrl: data.url,
          fileName: data.name,
          aiAnalysis: (data.type === 'IMAGE' && isAiEnabled) ? { category: 'PENDING' } : undefined,
          aiRequested: isAiEnabled,
          createdAt: Date.now()
        };

        // 낙관적 UI: 로컬 DB 즉시 추가 및 소켓 전송
        await db.messages.add(newMessage);
        setLatestMessageTimes(prev => ({ ...prev, [newMessage.receiverId]: newMessage.createdAt }));
        const emitMessage = { ...newMessage } as any;
        delete emitMessage.id;
        socket.emit('send_message', { receiverId: currentRoom.id, message: emitMessage });

        // 백그라운드 AI 비전 스레드 (비동기)
        if (data.type === 'IMAGE' && isAiEnabled && !isSponsorLocked) {
          (async () => {
            try {
              const selectedProvider = localStorage.getItem('alo_ai_provider') || 'openai';
              const keysStr = localStorage.getItem('alo_api_keys');
              const apiKeys = keysStr ? JSON.parse(keysStr) : {};
              const byokKey = apiKeys[selectedProvider];
              const aiRes = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '', imageUrl: data.url, provider: selectedProvider, byokKey, aiModel: selectedAiModel })
              });
              
              let aiAnalysisResult;
              if (aiRes.ok) {
                aiAnalysisResult = await aiRes.json();
              } else {
                console.error('Image fact-check APi error');
                aiAnalysisResult = { category: 'ERROR', confidence: 0, reason: 'AI 서버 에러 (크레딧 부족 또는 용량 초과)' };
              }
              
              await db.messages.where('messageId').equals(msgId).modify({ aiAnalysis: aiAnalysisResult });
              if (socket) {
                socket.emit('update_message', {
                  roomId: currentRoom?.id || 'global',
                  messageId: msgId,
                  aiAnalysis: aiAnalysisResult
                });
              }
            } catch (err) {
              console.warn('AI Vision Analysis failed (skipped):', err);
              const aiAnalysisResult = { category: 'ERROR', confidence: 0, reason: 'AI 연결 실패' };
              await db.messages.where('messageId').equals(msgId).modify({ aiAnalysis: aiAnalysisResult });
              if (socket) socket.emit('update_message', { roomId: currentRoom?.id || 'global', messageId: msgId, aiAnalysis: aiAnalysisResult });
            }
          })();
        }
      }
    } catch (err) {
      console.error('File upload failed', err);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageContent = inputText.trim();
    setInputText('');

    // --- 1. 송금 명령어 파싱 ---
    if (messageContent.startsWith('/송금 ')) {
      const parts = messageContent.split(' ');
      const amountStr = parts[1];
      const amount = parseInt(amountStr, 10);

      if (isNaN(amount) || amount <= 0) {
        alert('올바른 금액을 입력해주세요. 예: /송금 100');
        return;
      }

      const reason = parts.slice(2).join(' ');

      // 상대방 이름 및 ID 찾기 (현재 방에 둘만 있거나, 내가 아닌 다른 첫 번째 멤버를 가져옴)
      let targetName = '상대방';
      let receiverId = null;
      if (currentRoom && currentRoom.members) {
        const otherMember = currentRoom.members.find(m => m.userId !== user.id);
        if (otherMember && otherMember.user && otherMember.user.username) {
          targetName = otherMember.user.username;
          receiverId = otherMember.userId;
        }
      }

      if (!receiverId) {
        alert('수신자를 찾을 수 없습니다. 개인 채팅방에서 송금 명령어를 사용해주세요.');
        return;
      }

      try {
        const res = await fetch('/api/wallet/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senderId: user.id, receiverId, amount, reason })
        });
        const data = await res.json();

        if (data.error) {
          alert('송금 실패: ' + data.error);
          return;
        }

        setUser(prev => prev ? { ...prev, walletBalance: data.balance } : null);
        setMyProfile(prev => prev ? { ...prev, walletBalance: data.balance } : null);

        // [신규] Dexie 로컬 장부에 P2P 송금 내역 기록
        await db.walletTx?.add({
          type: 'SPEND',
          category: 'P2P_TRANSFER',
          amount,
          counterpartyId: receiverId,
          counterpartyName: targetName,
          createdAt: Date.now(),
          description: reason || `${targetName}님에게 금액 송금`
        }).catch(err => console.error("로컬 장부 기록 실패:", err));

        const msgStr = `💸 [송금 알림] ${user.username}님이 ${targetName}님에게 ${amount} 원을 송금했습니다.`;
        await chatStore.sendMessage(currentRoom?.id || 'global', msgStr, user.id, user.username);
      } catch (err) {
        console.error('송금 중 오류 발생:', err);
      }
      return;
    }

    // --- 2. 일반 메시지 전송 및 Optimistic UI (병렬 처리) ---
    // 스폰서 락(isSponsorLocked) 상태라면 내 설정을 무시하고 방장(스폰서)의 대리연산으로 전적으로 위임해야 함!
    let sponsorMember = currentRoom?.members?.find((m: any) => m.isHost);
    const amISponsor = currentRoom ? sponsorMember?.userId === user?.id : false;
    const isSponsorLocked = currentRoom && !amISponsor && currentRoom.sponsorMode;

    const msgId = uuidv4();
    const newMessage: ChatMessage = {
      messageId: msgId,
      senderId: user.id,
      senderName: user.username,
      receiverId: currentRoom?.id || 'global',
      content: messageContent,
      messageType: 'TEXT',
      aiAnalysis: isAiEnabled ? { category: 'PENDING' } : undefined,
      aiRequested: isAiEnabled, // 내 기기의 AI 토글 상태를 담아서 보냄 (방장이 보고 대리연산할지 결정하도록)
      createdAt: Date.now(),
    };

    // 1️⃣ 로컬 스토어에 **즉시** 추가 (딜레이 0초)
    await db.messages.add(newMessage);
    setLatestMessageTimes(prev => ({ ...prev, [newMessage.receiverId]: newMessage.createdAt }));

    // 2️⃣ 소켓 릴레이 즉시 호출
    const { socket } = chatStore;
    if (socket) {
      const emitMessage = { ...newMessage } as any;
      delete emitMessage.id;
      socket.emit('send_message', { receiverId: currentRoom?.id || 'global', message: emitMessage });
    }

    // 3️⃣ AI 팩트체크 백그라운드 연산 (결과 도착 시 사후 업데이트)
    if (isAiEnabled && !isSponsorLocked) {
      (async () => {
        try {
          const selectedProvider = localStorage.getItem('alo_ai_provider') || 'openai';
          const keysStr = localStorage.getItem('alo_api_keys');
          const apiKeys = keysStr ? JSON.parse(keysStr) : {};
          const byokKey = apiKeys[selectedProvider];

          // 전체 AI 사용량 1 증가 (팩트체크 요청)
          const savedUsage = JSON.parse(localStorage.getItem('alo_total_ai_usage') || '{"used": 0}');
          const newUsed = (savedUsage.used || 0) + 1;
          const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
          localStorage.setItem('alo_total_ai_usage', JSON.stringify({ ...savedUsage, date: todayStr, used: newUsed }));
          setTotalAiUsageCount(newUsed);
          db.aiStats?.put({ date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }), count: newUsed }).catch(e => console.error(e));

          const aiRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: messageContent,
              provider: selectedProvider,
              byokKey,
              aiModel: selectedAiModel
            })
          });

          if (aiRes.ok) {
            const aiAnalysisResult = await aiRes.json();

            // 로컬 DB 사후 업데이트 (PK id 이슈 방지를 위해 messageId 기준 검색)
            await db.messages.where('messageId').equals(msgId).modify({ aiAnalysis: aiAnalysisResult });

            // 다른 참여자들에게도 AI 분석 결과 전파
            if (socket) {
              socket.emit('update_message', {
                roomId: currentRoom?.id || 'global',
                messageId: msgId,
                aiAnalysis: aiAnalysisResult
              });
            }
          } else {
            let reasonText = 'AI 서버 연산 실패 (나중에 다시 시도해주세요)';
            if (aiRes.status === 429) {
              reasonText = '오늘 무료 제공량을 모두 소진한 것 같습니다. 내일 다시 이용하시거나 설정에서 개인 API 키를 등록하세요.';
            } else if (aiRes.status === 400) {
              reasonText = '서버 무료 AI 미설정 (관리자 키가 없습니다. 설정에서 개인 키를 등록하세요)';
            }
            const fallbackResult = { category: 'ERROR', confidence: 0, reason: reasonText };
            await db.messages.where('messageId').equals(msgId).modify({ aiAnalysis: fallbackResult });
            if (socket) {
              socket.emit('update_message', {
                roomId: currentRoom?.id || 'global',
                messageId: msgId,
                aiAnalysis: fallbackResult
              });
            }
          }
        } catch (err) {
          console.warn('AI 분석 처리 중 예외 발생:', err);
          const errorCat = { category: 'ERROR', confidence: 0, reason: 'AI 엔진 접속 오류' };
          db.messages.where('messageId').equals(msgId).modify({ aiAnalysis: errorCat }).catch(console.error);
        }
      })();
    }
  };

  const handleCreateRoom = async (friendId: string) => {
    // 1. 기존 1:1 방이 있는지 확인 (나와 친구 ID 둘만 있는 방)
    const existingRoom = rooms.find((room: any) =>
      room.members?.length === 2 &&
      room.members.some((m: any) => m.userId === friendId)
    );

    if (existingRoom) {
      // 기존 방이 있으면 해당 방으로 입장 처리 (새로 만들지 않음)
      setCurrentRoom({
        id: existingRoom.id,
        name: existingRoom.name,
        isHost: existingRoom.members.find((m: any) => m.userId === user?.id)?.isHost || false,
        members: existingRoom.members
      });
      chatStore.joinRoom(existingRoom.id);
      return;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user?.id,
          memberIds: [friendId]
        })
      });
      if (res.ok) {
        const newRoom = await res.json();
        setRooms(prev => [newRoom, ...prev]);
        setCurrentRoom({ id: newRoom.id, name: newRoom.name, isHost: true, members: newRoom.members });
        chatStore.joinRoom(newRoom.id);
      }
    } catch (e) {
      console.error('Failed to create room', e);
    }
  };

  const handleUpdateRoomName = async () => {
    if (!currentRoom || !user) return;
    const newName = editRoomNameValue.trim() || null;
    try {
      const res = await fetch('/api/rooms/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: currentRoom.id, name: newName, requesterId: user.id }),
      });
      if (res.ok) {
        setIsEditingRoomName(false);
        // 내 로컬 상태 업데이트
        setRooms(prev => prev.map((r: any) => r.id === currentRoom.id ? { ...r, name: newName } : r));
        setCurrentRoom({ ...currentRoom, name: newName });

        // 시스템 메시지 발송 (방 안의 모든 사람에게 변경 알림)
        const sysMsgStr = newName ? `${user.username}님이 방 이름을 '${newName}'(으)로 변경했습니다.` : `${user.username}님이 방 이름을 초기화했습니다.`;
        const newMessage: ChatMessage = {
          messageId: uuidv4(),
          senderId: 'system',
          senderName: 'System',
          receiverId: currentRoom.id,
          content: sysMsgStr,
          messageType: 'SYSTEM',
          createdAt: Date.now()
        };
        await db.messages.add(newMessage);

        const { socket } = chatStore;
        if (socket) {
          socket.emit('send_message', { receiverId: currentRoom.id, message: newMessage });
          // 방 이름 업데이트 소켓 이벤트 발송
          socket.emit('update_room_name', { roomId: currentRoom.id, name: newName });
        }
      } else {
        const err = await res.json();
        alert(`수정 실패: ${err.error || '알 수 없는 오류'}`);
      }
    } catch (e) {
      console.error(e);
      alert('방 이름 변경에 실패했습니다.');
    }
  };

  const handleDelegateHost = async (targetUserId: string) => {
    if (!currentRoom || !user) return;

    // 방장권한 위임 전송
    try {
      const res = await fetch('/api/rooms/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: currentRoom.id,
          requesterId: user.id,
          targetUserId
        })
      });

      if (res.ok) {
        // 성공 시 로컬 상태 업데이트
        const updatedMembers = currentRoom.members.map(m => {
          if (m.userId === user.id) return { ...m, isHost: false };
          if (m.userId === targetUserId) return { ...m, isHost: true };
          return m;
        });
        setCurrentRoom({ ...currentRoom, isHost: false, members: updatedMembers });

        // 전체 방 목록도 갱신
        setRooms(prevRooms => prevRooms.map(r => {
          if (r.id === currentRoom.id) {
            return { ...r, members: updatedMembers };
          }
          return r;
        }));
        setSelectedMemberId(null); // 메뉴 닫기
      } else {
        const errorData = await res.json();
        alert(`권한 위임 실패: ${errorData.error}`);
      }
    } catch (e) {
      console.error('Failed to delegate host', e);
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!currentRoom || !user) return;

    // 강퇴 전송
    try {
      const res = await fetch('/api/rooms/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: currentRoom.id,
          requesterId: user.id,
          targetUserId
        })
      });

      if (res.ok) {
        // 성공 시 로컬 상태 업데이트
        const updatedMembers = currentRoom.members.filter(m => m.userId !== targetUserId);
        setCurrentRoom({ ...currentRoom, members: updatedMembers });

        // 전체 방 목록도 갱신
        setRooms(prevRooms => prevRooms.map(r => {
          if (r.id === currentRoom.id) {
            return { ...r, members: updatedMembers };
          }
          return r;
        }));
        setSelectedMemberId(null); // 메뉴 닫기
      } else {
        const errorData = await res.json();
        alert(`강퇴 실패: ${errorData.error}`);
      }
    } catch (e) {
      console.error('Failed to kick member', e);
    }
  };

  const handleLeaveRoom = async (roomId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return;

    if (!confirm('정말 이 채팅방을 나가시겠습니까? 로컬 대화 내역도 모두 삭제됩니다.')) return;

    if (currentRoom?.members && currentRoom.members.length > 2) {
      const { socket } = chatStore;
      if (socket) {
        const sysMsg: ChatMessage = {
          messageId: uuidv4(), senderId: 'system', senderName: 'System', receiverId: roomId,
          content: `${user.username}님이 나갔습니다.`, messageType: 'SYSTEM', createdAt: Date.now()
        };
        socket.emit('send_message', { receiverId: roomId, message: sysMsg });
      }
    }

    try {
      const res = await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId: user.id })
      });
      if (res.ok) {
        // 로컬 IndexedDB 메시지 모두 삭제
        await db.messages.where('receiverId').equals(roomId).delete();

        // 상태 업데이트
        setRooms(prev => prev.filter(r => r.id !== roomId));
        if (currentRoom?.id === roomId) {
          setCurrentRoom(null);
          setIsDrawerOpen(false);
          setIsInviteModalOpen(false);
        }
      } else {
        const err = await res.json();
        alert('방 나가기 실패: ' + err.error);
      }
    } catch (err) {
      console.error('Leave Room error', e);
    }
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!currentRoom || !user) return;

    // 1:1 방(멤버 2명)인 상태에서 새로운 사람을 초대하는 경우 -> 새 그룹 채팅방 생성
    if (currentRoom.members.length === 2) {
      // 기존 멤버들의 ID 추출 (나 포함)
      const existingMemberIds = currentRoom.members.map(m => m.userId);
      // 초대할 친구 ID를 포함하여 새 방을 생성하기 위한 멤버 배열 구성 (나 자신인 creatorId 제외)
      const newMemberIds = Array.from(new Set([...existingMemberIds, friendId])).filter(id => id !== user.id);

      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId: user.id,
            memberIds: newMemberIds
          })
        });
        if (res.ok) {
          const newRoom = await res.json();
          setRooms(prev => [newRoom, ...prev]);
          setCurrentRoom({ id: newRoom.id, name: newRoom.name, isHost: true, members: newRoom.members, sponsorMode: newRoom.sponsorMode, sponsorPrice: newRoom.sponsorPrice, sponsorModel: newRoom.sponsorModel });
          chatStore.joinRoom(newRoom.id);
          setIsInviteModalOpen(false);
          alert('새로운 그룹 채팅방이 생성되었습니다.');

          // 시스템 메시지 전송
          const invitedFriend = friends.find((f: any) => f.id === friendId);
          const invitedName = invitedFriend ? invitedFriend.username : '새 멤버';
          const sysMsg: ChatMessage = {
            messageId: uuidv4(), senderId: 'system', senderName: 'System', receiverId: newRoom.id,
            content: `${user.username}님이 ${invitedName}님을 초대하여 그룹 채팅을 시작했습니다.`, messageType: 'SYSTEM', createdAt: Date.now()
          };
          await db.messages.add(sysMsg);
          chatStore.socket?.emit('send_message', { receiverId: newRoom.id, message: sysMsg });
        } else {
          const err = await res.json();
          alert('그룹 채팅방 생성 실패: ' + err.error);
        }
      } catch (e) {
        console.error('Failed to create group room from invite', e);
      }
      return; // 새 방 생성을 완료했으므로 조기 종료
    }

    // 이미 그룹 방인 경우 기존 초대 로직 사용
    try {
      const res = await fetch('/api/rooms/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: currentRoom.id, targetUserId: friendId })
      });
      if (res.ok) {
        const newMember = await res.json();
        const updatedMembers = [...currentRoom.members, newMember];
        setCurrentRoom({ ...currentRoom, members: updatedMembers });
        setRooms(prevRooms => prevRooms.map(r => {
          if (r.id === currentRoom.id) {
            return { ...r, members: updatedMembers };
          }
          return r;
        }));
        setIsInviteModalOpen(false);
        alert('친구를 방에 성공적으로 초대했습니다.');

        // 새로 초대된 친구의 이름을 찾아서 시스템 메시지 전송
        const invitedFriend = friends.find((f: any) => f.id === friendId);
        const invitedName = invitedFriend ? invitedFriend.username : '새 멤버';
        const sysMsg: ChatMessage = {
          messageId: uuidv4(), senderId: 'system', senderName: 'System', receiverId: currentRoom.id,
          content: `${user.username}님이 ${invitedName}님을 초대했습니다.`, messageType: 'SYSTEM', createdAt: Date.now()
        };
        await db.messages.add(sysMsg);
        chatStore.socket?.emit('send_message', { receiverId: currentRoom.id, message: sysMsg });
      } else {
        const err = await res.json();
        alert('초대 실패: ' + err.error);
      }
    } catch (err) {
      console.error('Invite error', err);
    }
  };

  // 새로운 친구 추가 (ID 기반 API 호출)
  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFriendIdValue.trim() || !user?.id) return;

    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetFriendId: addFriendIdValue.trim() })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert('성공적으로 친구가 추가되었습니다.');
        setFriends(prev => [data.friendship.friend, ...prev]);
        setAddFriendIdValue('');
        setIsAddFriendModalOpen(false);
      } else {
        alert(data.error || '친구 추가에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  };

  // 프로필 사진 생성 전용 API 호출
  const handleGenerateAvatar = async () => {
    // 취미 혹은 특별한 정보가 비어있어도 진행 가능하도록 최소 요구사항만 체크
    if (!aiMbtiValue || !selectedProvider) {
      alert('MBTI 성격 설정 후 진행해주세요.');
      return;
    }
    setIsGeneratingAvatar(true);
    try {
      const res = await fetch('/api/users/ai/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mbti: aiMbtiValue,
          gender: aiGenderValue,
          age: aiAgeValue,
          aiName: aiNameValue,
          aiProvider: avatarGenMode === 'system' ? selectedProvider : avatarGenMode,
          apiKey: apiKeys[selectedProvider]
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.avatarUrl) {
        if (data.avatarUrl.startsWith('http')) {
          // 브라우저 캐시에 Preload 될 때까지 대기
          const img = new Image();
          img.src = data.avatarUrl;
          img.onload = () => {
            setAiAvatarUrl(data.avatarUrl);
            setIsGeneratingAvatar(false);
          };
          img.onerror = () => {
            alert('외부 이미지 서버 접속이 지연되어 이미지를 불러올 수 없습니다.');
            setIsGeneratingAvatar(false);
          };
          return; // 여기서 함수 종료 (onload에서 false 처리)
        } else {
          setAiAvatarUrl(data.avatarUrl); // 로컬 URL (/uploads/...)
          setIsGeneratingAvatar(false);
        }
      } else {
        alert('프로필 생성 실패: ' + (data.error || '알 수 없는 오류'));
        setIsGeneratingAvatar(false);
      }
    } catch (err) {
      console.error(err);
      alert('프로필 생성 중 오류가 발생했습니다.');
      setIsGeneratingAvatar(false);
    }
  };

  const handleSubmitAiFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiNameValue.trim() || !user) return;
    setIsAiCreating(true);
    try {
      if (editingAiFriend) {
        // AI 친구 수정
        const res = await fetch(`/api/users/ai/${editingAiFriend.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerId: user.id,
            name: aiNameValue,
            mbti: aiMbtiValue,
            gender: aiGenderValue,
            age: aiAgeValue,
            tone: aiToneValue,
            hobby: aiHobbyValue,
            avatarUrl: aiAvatarUrl,
            aiProvider: selectedProvider,
            apiKey: apiKeys[selectedProvider]
          })
        });
        const data = await res.json();
        if (data.success) {
          alert('AI 정보가 성공적으로 수정되었습니다.');
          setFriends(prev => prev.map(f => f.id === editingAiFriend.id ? { ...f, ...data.aiUser } : f));
          setIsAddFriendModalOpen(false);
          setEditingAiFriend(null);
        } else {
          alert('수정 실패: ' + data.error);
        }
      } else {
        // AI 친구 신규 생성
        const res = await fetch('/api/users/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerId: user.id,
            name: aiNameValue,
            mbti: aiMbtiValue,
            gender: aiGenderValue,
            age: aiAgeValue,
            tone: aiToneValue,
            hobby: aiHobbyValue,
            avatarUrl: aiAvatarUrl,
            aiProvider: selectedProvider,
            apiKey: apiKeys[selectedProvider]
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`${data.aiUser.username} AI 친구가 생성되어 친구 목록에 추가되었습니다!`);
          setFriends(prev => [...prev, data.aiUser]);
          setAddFriendTab('NORMAL');
          setIsAddFriendModalOpen(false);
          setAiNameValue('');
        } else {
          alert('AI 생성 실패: ' + data.error);
        }
      }
    } catch (err) {
      console.error(err);
      alert('AI 저장 중 오류가 발생했습니다.');
    } finally {
      setIsAiCreating(false);
    }
  };

  // 내 코드 클립보드 복사
  const handleCopyMyId = () => {
    const code = myProfile?.inviteCode || user?.inviteCode || user?.id;
    if (code) {
      navigator.clipboard.writeText(code);
      alert('내 6자리 초대 코드가 복사되었습니다!');
    }
  };

  // 내 초대 링크 복사
  const handleCopyMyLink = () => {
    const code = myProfile?.inviteCode || user?.inviteCode || user?.id;
    if (code) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3099';
      navigator.clipboard.writeText(`${baseUrl}/invite/${code}`);
      alert('초대 링크가 복사되었습니다! 친구에게 공유해보세요.');
    }
  };

  // 기존 친구의 상태 업데이트 (숨김, 차단)
  const handleUpdateFriendStatus = async (friendId: string, status: 'HIDDEN' | 'BLOCKED') => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, status })
      });
      if (res.ok) {
        alert(status === 'HIDDEN' ? '친구가 숨김 처리되었습니다.' : '친구가 차단되었습니다.');
        // 방금 처리한 친구를 목록(friends)에서 솎아냄
        setFriends(prev => prev.filter(f => f.id !== friendId));
        setActiveFriendMenuId(null);
      } else {
        const errorData = await res.json();
        alert('처리 실패: ' + errorData.error);
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  };

  // 신규: AI 친구 영구 삭제
  const handleDeleteAiFriend = async (friend: any) => {
    if (!user?.id) return;
    if (friend.aiOwnerId !== user.id) {
      alert('본인이 생성한 AI만 삭제할 수 있습니다.');
      return;
    }
    if (!confirm(`'${friend.username}' AI를 정말 삭제하시겠습니까? (복구할 수 없습니다)`)) return;

    try {
      const res = await fetch(`/api/users/ai/${friend.id}?ownerId=${user.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        alert('AI 친구가 완전히 삭제되었습니다.');
        setFriends(prev => prev.filter(f => f.id !== friend.id));
        setActiveFriendMenuId(null);
      } else {
        const errorData = await res.json();
        alert('삭제 실패: ' + errorData.error);
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  };

  // AI 친구 성격/이름/사진 수정 모달 열기
  const handleEditAiFriend = (friend: any) => {
    if (!user?.id) return;
    if (friend.aiOwnerId !== user.id) {
      alert('본인이 생성한 AI만 수정할 수 있습니다.');
      return;
    }

    const promptStr = friend.aiPrompt || '';

    // 이전에 저장된 통문장에서 값을 뽑아냅니다. (없으면 기본값)
    const nameMatch = promptStr.match(/- 이름: (.*)/);
    const mbtiMatch = promptStr.match(/- MBTI: (.*)/);
    const genderMatch = promptStr.match(/- 성별: (.*)/);
    const ageMatch = promptStr.match(/- 연령대: (.*)/);
    const toneMatch = promptStr.match(/- 말투\/성격: (.*)/);
    const hobbyMatch = promptStr.match(/- 관심사\/취미: (.*)/);

    setAiNameValue(nameMatch ? nameMatch[1].trim() : friend.username);
    setAiMbtiValue(mbtiMatch ? mbtiMatch[1].trim() : 'ENFP');
    setAiGenderValue(genderMatch ? genderMatch[1].trim() : '여성');
    setAiAgeValue(ageMatch ? ageMatch[1].trim() : '20대 초반');
    setAiToneValue(toneMatch ? toneMatch[1].trim() : '유쾌발랄, 친드레');
    setAiHobbyValue(hobbyMatch && hobbyMatch[1].trim() !== '특별한 관심사 없음' ? hobbyMatch[1].trim() : '');

    setEditingAiFriend(friend);
    setAiAvatarUrl(friend.avatar_url || null);
    setActiveFriendMenuId(null);
    setAddFriendTab('AI');
    setIsAddFriendModalOpen(true);
  };


  // 내 상태메시지 업데이트 API 호출
  const handleUpdateStatusMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, statusMessage: statusMsgValue.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMyProfile(prev => prev ? { ...prev, statusMessage: data.user.statusMessage } : null);
        setIsProfileModalOpen(false);
      } else {
        alert(data.error || '상태메시지 갱신에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  };

  // 프로필 아바타 이미지 업로드(Phase 10)
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('file', file);

    try {
      const res = await fetch('/api/users/avatar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert('프로필 사진이 성공적으로 등록되었습니다!');
        setMyProfile(prev => prev ? { ...prev, avatar_url: data.user.avatar_url } : null);
      } else {
        alert(data.error || '프로필 업로드 실패');
      }
    } catch (err) {
      console.error(err);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    }
  };

  const promptTransfer = async (receiverId: string, receiverName: string) => {
    if (!user) return;
    const amountStr = window.prompt(`${receiverName}님에게 송금할 금액을 입력하세요 (원):`, '100');
    if (amountStr) {
      const amount = parseInt(amountStr, 10);
      if (!isNaN(amount) && amount > 0) {
        try {
          const res = await fetch('/api/wallet/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: user.id, receiverId, amount })
          });
          if (res.ok) {
            const data = await res.json();
            setUser(prev => prev ? { ...prev, walletBalance: data.balance } : null);
            setMyProfile(prev => prev ? { ...prev, walletBalance: data.balance } : null);
            alert(`성공적으로 ${amount} 원을 ${receiverName}님에게 송금했습니다. 잔액: ${data.balance} 원`);

            // [신규] Dexie 로컬 장부에 P2P 송금 내역 기록
            await db.walletTx?.add({
              type: 'SPEND',
              category: 'P2P_TRANSFER',
              amount,
              counterpartyId: receiverId,
              counterpartyName: receiverName,
              createdAt: Date.now(),
              description: `${receiverName}님에게 통장 송금`
            }).catch(err => console.error("로컬 장부 기록 실패:", err));

            // 송금 완료 후 채팅방(현재 룸)에 시스템 메시지 전송
            const msgStr = `💸 [송금 알림] ${user.username}님이 ${receiverName}님에게 ${amount} 원을 송금했습니다.`;
            await chatStore.sendMessage(currentRoom?.id || 'global', msgStr, user.id, user.username);
          } else {
            const err = await res.json();
            alert('송금 실패: ' + err.error);
          }
        } catch (e) {
          console.error(e);
          alert('송금 중 오류가 발생했습니다.');
        }
        setSelectedMemberId(null); // 메뉴 닫기
      } else {
        alert('올바른 금액을 입력해주세요.');
      }
    }
  };

  // --- [스폰서 UI Lock 상태 계산] ---
  const isSponsorLocked = currentRoom && currentRoom.sponsorMode;
  const sponsorPrice = currentRoom?.sponsorPrice || 0;
  
  const lockedModelId = currentRoom?.sponsorModel || 'openai';
  let foundModelName = '스폰서 제공';
  for (const provider of Object.keys(aiModels)) {
    const model = aiModels[provider]?.find(m => m.id === lockedModelId);
    if (model) {
      foundModelName = model.name;
      break;
    }
  }
  const lockedModelName = `🔒 ${foundModelName}`;

  return (
    <div
      className="fixed top-0 left-0 w-full bg-dark-bg flex justify-center items-center text-on-surface p-0 sm:p-4 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      style={{ height: 'var(--vh, 100%)' }}
    >
      <SettingsModal currentRoom={currentRoom} />

      {/* 가이드(사용법) 모달창 */}
      {isGuideOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-dark-bg/80 backdrop-blur-md">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface-container border border-outline-variant/15 rounded-lg shadow-ambient p-6 relative animate-in fade-in zoom-in duration-200 hide-scrollbar">
            <button
              onClick={() => setIsGuideOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Sparkles className="text-primary" size={24} /> 알로팝 초보자 가이드</h2>
            <p className="text-xs text-zinc-400 mb-6 font-medium">실시간 AI 팩트 필터 & 나만의 AI 챗봇 사용 설명서</p>

            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-bold text-primary flex items-center gap-1.5 mb-2"><Key size={16} /> 1. Gemini 입장권 발급받는 방법 (권장)</h3>
                <ol className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 list-decimal pl-6 space-y-1.5 marker:text-primary marker:font-bold">
                  <div className="ml-[-16px] mb-2 text-primary font-medium">똑똑한 AI 비서와 놀려면 구글에서 발급해주는 '무료/유료 입장권(API 키)'이 반드시 필요해요!</div>
                  <li>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline font-bold px-1 py-0.5 rounded bg-secondary/10 inline-flex items-center gap-1 transition-colors">
                      [구글 스튜디오 접속하기]
                    </a>
                    버튼을 눌러 회원가입/구글 로그인을 해주세요.
                  </li>
                  <li className="pb-1">
                    <span className="mb-2 block">다음 순서대로 화면의 버튼을 차례차례 클릭해서 입장권을 만드세요:</span>
                    <div className="flex flex-wrap items-center gap-2 mb-3 bg-dark-bg p-3 rounded-md border border-outline-variant/30 text-[11px] font-mono">
                      <div className="bg-blue-600/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30 whitespace-nowrap">1. "API 키 만들기" 버튼 클릭</div>
                      <ChevronRight size={14} className="text-zinc-600 hidden sm:block shrink-0" />
                      <div className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 whitespace-nowrap">2. "새 키 만들기" 클릭</div>
                      <ChevronRight size={14} className="text-zinc-600 hidden sm:block shrink-0" />
                      <div className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 whitespace-nowrap">3. "키 만들기" 버튼 클릭</div>
                      <ChevronRight size={14} className="text-zinc-600 hidden sm:block shrink-0" />
                      <div className="bg-zinc-200 text-zinc-900 font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm whitespace-nowrap"><Copy size={12} /> Copy API key (복사 버튼)</div>
                    </div>
                    <div className="flex items-center gap-2 mb-1 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span className="text-emerald-200 text-[11px]">기본적으로 <strong>무료 등급</strong>으로 발급되니, 본인이 직접 결제 카드를 구글에 등록하지 않는 한 자동 결제 걱정은 전혀 안 하셔도 됩니다!</span>
                    </div>
                  </li>
                  <li>이제 알로팝 우측 상단의 <strong>옵션(⚙️)버튼 &gt; [Gemini]</strong> 탭에 복사한 키를 붙여넣고 저장하면 채팅 준비 끝!</li>
                </ol>
              </section>

              <section className="mt-6">
                <h3 className="text-sm font-bold text-amber-500 flex items-center gap-1.5 mb-2"><Key size={16} /> 1-2. OpenAI 입장권 발급받는 방법 (선택)</h3>
                <ol className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 list-decimal pl-6 space-y-1.5 marker:text-amber-500 marker:font-bold">
                  <div className="ml-[-16px] mb-2 text-amber-400 font-medium">유명한 ChatGPT와 놀고 싶다면, 전용(유료) OpenAPI 티켓이 필요해요!</div>
                  <li>
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline font-bold px-1 py-0.5 rounded bg-amber-500/10 inline-flex items-center gap-1 transition-colors">
                      [OpenAI 플랫폼 접속하기]
                    </a>
                    버튼을 눌러 로그인 해주세요.
                  </li>
                  <li className="pb-1">
                    <span className="mb-2 block">다음 순서대로 화면의 메뉴를 클릭해서 입장권을 만드세요:</span>
                    <div className="flex flex-wrap items-center gap-2 mb-3 bg-dark-bg p-3 rounded-md border border-outline-variant/30 text-[11px] font-mono">
                      <div className="bg-emerald-600/20 text-emerald-300 px-2 py-1 rounded border border-emerald-500/30 whitespace-nowrap">+ Create new secret key 버튼 클릭</div>
                      <ChevronRight size={14} className="text-zinc-600 hidden sm:block shrink-0" />
                      <div className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 whitespace-nowrap">이름 대충 입력 후 Create 클릭</div>
                      <ChevronRight size={14} className="text-zinc-600 hidden sm:block shrink-0" />
                      <div className="bg-zinc-200 text-zinc-900 font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm whitespace-nowrap"><Copy size={12} /> Copy (복사 버튼)</div>
                    </div>
                    <div className="flex items-center gap-2 mb-1 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
                      <CheckCircle2 size={16} className="text-amber-500 shrink-0" />
                      <span className="text-amber-200/80 text-[11px]">주의: OpenAI는 가입 직후를 제외하고는 기본적으로 <strong>본인 결제 카드를 설정(Billing)하고 5달러 이상 선불 충전</strong>해야만 API가 대답을 시작합니다. 과금 없이 가볍게 즐기시길 원한다면 1번 안내의 Gemini 무료 모드를 강력히 추천합니다!</span>
                    </div>
                  </li>
                  <li>이제 알로팝 우측 상단의 <strong>옵션(⚙️)버튼 &gt; [OpenAI]</strong> 탭에 복사한 키를 붙여넣고 저장하면 준비 끝!</li>
                </ol>
              </section>

              <section className="mt-6">
                <h3 className="text-sm font-bold text-fuchsia-400 flex items-center gap-1.5 mb-2"><Key size={16} /> 1-3. Anthropic 입장권 발급받는 방법 (선택)</h3>
                <ol className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 list-decimal pl-6 space-y-1.5 marker:text-fuchsia-500 marker:font-bold">
                  <div className="ml-[-16px] mb-2 text-fuchsia-400 font-medium">따뜻하고 감성적인 Claude 모델과 대화하려면 전용(유료) Anthropic 티켓이 필요해요!</div>
                  <li>
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-fuchsia-400 hover:underline font-bold px-1 py-0.5 rounded bg-fuchsia-500/10 inline-flex items-center gap-1 transition-colors">
                      [Anthropic 콘솔 접속하기]
                    </a>
                    버튼을 눌러 가입 및 로그인을 해주세요.
                  </li>
                  <li className="pb-1">
                    <span className="mb-2 block">다음 순서대로 화면의 메뉴를 클릭해서 입장권을 만드세요:</span>
                    <div className="flex flex-wrap items-center gap-2 mb-3 bg-dark-bg p-3 rounded-md border border-outline-variant/30 text-[11px] font-mono">
                      <div className="bg-fuchsia-600/20 text-fuchsia-300 px-2 py-1 rounded border border-fuchsia-500/30 whitespace-nowrap">Create Key 버튼 클릭</div>
                      <ChevronRight size={14} className="text-zinc-600 hidden sm:block shrink-0" />
                      <div className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 whitespace-nowrap">이름(예: alopop) 입력 후 Create Key 클릭</div>
                      <ChevronRight size={14} className="text-zinc-600 hidden sm:block shrink-0" />
                      <div className="bg-zinc-200 text-zinc-900 font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm whitespace-nowrap"><Copy size={12} /> Copy 키 복사</div>
                    </div>
                    <div className="flex items-center gap-2 mb-1 p-2 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-md">
                      <CheckCircle2 size={16} className="text-fuchsia-400 shrink-0" />
                      <span className="text-fuchsia-200/80 text-[11px]">주의: Anthropic(Claude) 역시 기본적으로 <strong>본인 결제 카드(Billing)를 등록하고 5달러 이상 선불 충전(Claim)</strong>해야만 정상적으로 대답합니다. 과금 없이 가볍게 즐기시길 원한다면 똑똑한 1번 'Gemini 무료 모드'를 강력히 추천합니다!</span>
                    </div>
                  </li>
                  <li>이제 알로팝 우측 상단의 <strong>옵션(⚙️)버튼 &gt; [Anthropic]</strong> 탭에 복사한 키를 붙여넣고 저장하면 준비 끝!</li>
                </ol>
              </section>

              <section>
                <h3 className="text-sm font-bold text-teal-400 flex items-center gap-1.5 mb-2"><Bot size={16} /> 2. 대화형 AI 설정 및 결제 모드 선택</h3>
                <div className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 space-y-3">
                  <div>
                    <strong className="text-zinc-100 mb-1 block">📌 사용할 AI 모델 세팅하기</strong>
                    설정(⚙️) 메뉴에서 본인에게 맞는 주력 AI(Gemini, OpenAI, Anthropic 등)를 선택하세요. 방을 만들거나 챗봇을 추가할 때 해당 모델이 기본으로 작동합니다.
                  </div>
                  <div>
                    <strong className="text-zinc-100 mb-1 block">💳 채팅방 API 과금(결제) 방식 설정</strong>
                    방장이 채팅방을 개설할 때, 방의 AI 지원 모드를 설정할 수 있습니다:
                    <ul className="list-disc pl-5 mt-1 space-y-1 marker:text-teal-500/50">
                      <li><strong>비활성화 시 (기본)</strong>: 참여자 각자가 가입 시 등록해둔 개인의 API 키를 소모하여 작동합니다.</li>
                      <li><strong>방장 지원 활성화</strong>: <strong>[NEW]</strong> 방장의 API 키로 채팅방의 모든 AI 연산 비용을 대신 지불합니다. <strong>(방장의 API 키는 마스터 서버에 군사급 AES-256 암호화로 안전하게 보관되며, 방장이 오프라인이어도 24시간 백그라운드로 AI가 자동 응답합니다!)</strong> 또한 게스트에게 1회 응답당 알로팝 코인을 자동 징수해 수익을 낼 수 있습니다.</li>
                      <li><strong>P2P 코인 생태계</strong>: 알로팝은 중앙 서버에 요금을 지불하는 대신 유저 간 자율적으로 코인을 주고받으며 초저지연 AI를 활용하는 웹3 스타일의 경제 구조입니다.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mb-2"><ShieldAlert size={16} /> 3. 실시간 AI 팩트 필터 사용법</h3>
                <div className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 space-y-2">
                  <ol className="list-decimal pl-5 space-y-1.5 marker:text-emerald-500 marker:font-bold">
                    <li>채팅방 입장 후 하단 입력창 옆의 <strong>AI 활성화 버튼(🟢)</strong>을 켭니다.</li>
                    <li>모든 참여자의 대화를 AI가 모니터링하기 시작합니다.</li>
                    <li>단 "안녕", "ㅋㅋㅋ" 등 단순 친목 대화에는 AI가 반응하지 않습니다 (불필요한 과금 방지 표적).</li>
                    <li>전문 지식, 시사, 역사 등 <strong>참과 거짓의 검증이 필요한 정보</strong>가 언급될 경우, AI가 실시간으로 객관적 팩트를 검색하여 채팅창에 정답 도장을 찍어줍니다.</li>
                  </ol>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-pink-400 flex items-center gap-1.5 mb-2"><UserPlus size={16} /> 4. AI 챗봇 자동 프로필 얼굴 생성 기능</h3>
                <div className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 space-y-2">
                  <ol className="list-decimal pl-5 space-y-1.5 marker:text-pink-500 marker:font-bold">
                    <li>좌측 메뉴에서 <strong>[+ 친구 추가]</strong> 버튼을 누르고 <strong>'AI 챗봇'</strong> 탭을 선택합니다.</li>
                    <li>가상 챗봇의 성격(MBTI), 연령대, 특이사항을 텍스트로 자세히 설정합니다.</li>
                    <li>복잡하게 이미지를 업로드할 필요 없이 <strong>프로필 사진 칸을 그대로 빈칸</strong>으로 둡니다.</li>
                    <li>[추가하기] 버튼을 누르면, 입력된 캐릭터의 설정값을 바탕으로 <strong>AI가 약 10초 내외로 최적화된 아바타 이미지를 자동 완성</strong>하여 프로필에 부착해 줍니다.</li>
                  </ol>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-blue-400 flex items-center gap-1.5 mb-2"><UserPlus size={16} /> 5. 실제 사람 친구 초대 및 맺기</h3>
                <div className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 space-y-2">
                  <ol className="list-decimal pl-5 space-y-1.5 marker:text-blue-500 marker:font-bold">
                    <li>좌측 하단의 <strong>[+ 친구 추가]</strong> 버튼을 누르고 <strong>'친구 추가'</strong> 탭을 선택합니다.</li>
                    <li><strong>QR코드 스캔:</strong> 내 화면의 QR코드를 직접 친구에게 보여주거나, 반대로 내 카메라를 켜서 친구의 QR코드를 스캔하면 즉시 친구가 맺어집니다.</li>
                    <li><strong>6자리 고유 코드:</strong> 화면에 표시된 영문/숫자 조합의 6자리 보안 코드를 상대방이 입력하면 원격으로도 친구를 추가할 수 있습니다.</li>
                    <li><strong>초대 링크 공유:</strong> [초대 링크 복사] 버튼을 눌러 카카오톡 등 외부 연락처로 보내면, 해당 링크를 통해 가입 및 친구 추가가 동시에 진행됩니다.</li>
                  </ol>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-violet-400 flex items-center gap-1.5 mb-2"><MessageSquare size={16} /> 6. 채팅방 내 주요 기능 및 활용법</h3>
                <div className="text-xs text-zinc-300 leading-relaxed bg-surface-container-high p-3 rounded-lg border border-outline-variant/20 space-y-3">
                  <div>
                    <strong className="text-zinc-100 mb-1 block">📌 채팅방 상단 메뉴 (우측 상단 ☰)</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li><strong>채팅방 이름 변경:</strong> 연필(✏️) 아이콘을 눌러 그룹 채팅방의 제목을 자유롭게 수정할 수 있습니다.</li>
                      <li><strong>AI 응답 모델 교체:</strong> 채팅방 상단의 드롭다운 메뉴를 눌러, 현재 방에서 대답을 전담할 AI 모델(Gemini, GPT, Claude 등)을 실시간으로 바꿀 수 있습니다.</li>
                      <li><strong>새로운 친구 & AI 초대:</strong> <em>[+ 멤버 초대]</em> 버튼을 활용하여 내 친구나 내가 만든 AI 가상 챗봇을 한 방에 여러 명 추가하고 <strong>그룹 채팅</strong>을 즐겨보세요!</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-zinc-100 mb-1 block">👑 방장 전용 관리 기능</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li><strong>방장 양도:</strong> 우측 멤버 탭에서 특정 친구를 눌러 <em>[👑 방장 양도]</em>를 실행하면, 채팅방 소유권과 과금 주체가 해당 유저에게 양도됩니다.</li>
                      <li><strong>강퇴 (추방):</strong> 방 분위기를 흐리는 멤버를 방장 권한으로 <em>[강퇴]</em> 하여 내보낼 수 있습니다.</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-zinc-100 mb-1 block">💰 송금 및 AI 컨트롤</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li><strong>송금 (코인 이체):</strong> 우측 멤버 탭에서 <strong>[💸 송금]</strong> 아이콘을 누르면, 원하는 친구에게 수수료 없이 나의 알로팝 코인을 즉시 이체할 수 있습니다.</li>
                      <li><strong>AI 팩트 필터 스위치:</strong> 대화창 텍스트 입력 칸 우측 상단의 <strong>(🟢 / ⛔) 버튼</strong>을 누르면 언제든지 실시간 팩트체크 요정의 개입을 끄고 켤 수 있습니다.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>

            <button
              onClick={() => setIsGuideOpen(false)}
              className="w-full mt-8 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 모바일 뷰 컨테이너 (최대 너비 480px, 세로로 꽉 찬 형태) */}
      <div className="w-full h-full sm:h-[850px] sm:max-h-[90dvh] mx-auto max-w-md bg-surface-container sm:rounded-lg sm:border sm:border-outline-variant/15 flex flex-col relative overflow-hidden shadow-ambient">

        {/* 상단 헤더 */}
        <header className="h-16 flex items-center justify-between px-5 bg-surface-container-high/60 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            {currentRoom && (
              <button
                className="text-zinc-400 hover:text-white transition-colors"
                onClick={() => { setCurrentRoom(null); setIsDrawerOpen(false); }}
              >
                <Menu size={22} />
              </button>
            )}
            <div className="flex flex-col gap-1">
              <div className="font-semibold text-lg flex items-center gap-1.5 line-clamp-1 max-w-[160px] sm:max-w-xs group">
                {currentRoom && <span className="text-purple-400 shrink-0">#</span>}
                {currentRoom && isEditingRoomName ? (
                  <div className="flex items-center gap-1.5 bg-zinc-800 rounded px-1 -ml-1 font-normal">
                    <input
                      type="text"
                      value={editRoomNameValue}
                      onChange={e => setEditRoomNameValue(e.target.value)}
                      className="bg-transparent text-sm text-zinc-100 outline-none w-24 sm:w-32 placeholder-zinc-500"
                      placeholder="채팅방 이름"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleUpdateRoomName()}
                    />
                    <button onClick={handleUpdateRoomName} className="text-emerald-400 p-0.5 hover:bg-zinc-700 rounded transition-colors"><Check size={14} /></button>
                    <button onClick={() => setIsEditingRoomName(false)} className="text-zinc-400 p-0.5 hover:bg-zinc-700 rounded transition-colors"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    {currentRoom ? (
                      <h2 className="truncate">{getRoomName(currentRoom, user?.id)}</h2>
                    ) : (
                      <div className="flex items-center gap-1.5 ml-1 select-none pointer-events-none">
                        <svg width="24" height="24" viewBox="0 0 24 24" className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                          <circle cx="10" cy="12" r="5" fill="currentColor" />
                          <circle cx="17" cy="8" r="3" fill="currentColor" opacity="0.8" />
                          <circle cx="16" cy="16" r="2.5" fill="currentColor" opacity="0.6" />
                        </svg>
                        <span className="font-extrabold text-[22px] tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-purple-200 drop-shadow-[0_0_12px_rgba(168,85,247,0.5)] mt-0.5">Alopop</span>
                      </div>
                    )}
                    {currentRoom?.isHost && <span className="text-xs shrink-0 ml-1">👑</span>}
                    {currentRoom && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditRoomNameValue(currentRoom.name || ''); setIsEditingRoomName(true); }}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 ml-0.5 shrink-0"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-purple-400 font-semibold bg-purple-500/10 px-1.5 py-0.5 rounded w-fit h-fit shrink-0">
                  잔액: {(myProfile?.walletBalance ?? user?.walletBalance ?? 0).toLocaleString()} 코인
                </span>
                {currentRoom && (
                  <div className="relative z-50 flex items-center gap-1.5 block md:hidden lg:block">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSponsorLocked) setIsAiModelDropdownOpen(!isAiModelDropdownOpen);
                      }}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border shrink-0 shadow-sm ${isSponsorLocked
                        ? 'bg-teal-500/10 text-teal-400 border-teal-500/30 cursor-not-allowed'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/50'
                        }`}
                    >
                      <span className="truncate max-w-[90px]">{isSponsorLocked ? lockedModelName : (aiModels[selectedProvider]?.find(m => m.id === selectedAiModel)?.name || '기본 AI')}</span>
                      {!isSponsorLocked && <ChevronDown size={10} className="opacity-70" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextState = !isAiEnabled;
                        if (nextState && isSponsorLocked && sponsorPrice > 0) {
                          if (!confirm(`💡 이 채팅방은 방장 스폰서 모드로 운영되며, AI 1회 이용당 ${sponsorPrice}코인이 차감됩니다. 동의하십니까?`)) return;
                        }
                        setIsAiEnabled(nextState);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full shadow-sm border transition-all active:scale-95 shrink-0 ${isAiEnabled
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500 font-medium'
                        }`}
                    >
                      {isAiEnabled ? 'AI 🟢' : 'AI 🔘'}
                    </button>
                    {isAiModelDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1.5 w-40 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                        {aiModels[selectedProvider]?.map(model => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedAiModel(model.id);
                              localStorage.setItem('alo_ai_model', model.id);
                              setIsAiModelDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 text-xs transition-colors ${selectedAiModel === model.id ? 'bg-purple-600/20 text-purple-400 font-bold' : 'text-zinc-300 hover:bg-zinc-700'}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="truncate pr-1">{model.name}</span>
                              {selectedAiModel === model.id ? <Check size={12} className="shrink-0" /> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentRoom && (
              <>
                <div className="relative z-50 hidden md:block lg:hidden mr-1 flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSponsorLocked) setIsAiModelDropdownOpen(!isAiModelDropdownOpen);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors border shrink-0 shadow-sm ${isSponsorLocked
                      ? 'bg-teal-500/10 text-teal-400 border-teal-500/30 cursor-not-allowed'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/50'
                      }`}
                  >
                    <span className="truncate max-w-[100px]">{isSponsorLocked ? lockedModelName : (aiModels[selectedProvider]?.find(m => m.id === selectedAiModel)?.name || '기본 AI')}</span>
                    {!isSponsorLocked && <ChevronDown size={12} className="opacity-70" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextState = !isAiEnabled;
                      if (nextState && isSponsorLocked && sponsorPrice > 0) {
                        if (!confirm(`💡 이 채팅방은 방장 스폰서 모드로 운영되며, AI 1회 이용당 ${sponsorPrice}코인이 차감됩니다. 동의하십니까?`)) return;
                      }
                      setIsAiEnabled(nextState);
                    }}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs shadow-sm border transition-all active:scale-95 shrink-0 ${isAiEnabled
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500 font-semibold'
                      }`}
                  >
                    {isAiEnabled ? 'AI 🟢' : 'AI 🔘'}
                  </button>
                  {isAiModelDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-44 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                      {aiModels[selectedProvider]?.map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedAiModel(model.id);
                            localStorage.setItem('alo_ai_model', model.id);
                            setIsAiModelDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedAiModel === model.id ? 'bg-purple-600/20 text-purple-400 font-bold' : 'text-zinc-300 hover:bg-zinc-700'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="truncate pr-1">{model.name}</span>
                            {selectedAiModel === model.id ? <Check size={14} className="shrink-0" /> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="text-zinc-400 hover:text-white transition-colors relative"
                >
                  <Users size={20} />
                  <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[9px] w-3.5 h-3.5 flex items-center justify-center rounded-full">
                    {currentRoom.members?.length || 0}
                  </span>
                </button>
              </>
            )}
            <button onClick={() => setSettingsOpen(true)} className="text-zinc-400 hover:text-white transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        {!currentRoom ? (
          // 홈 화면 (LNB 탭 메뉴 방식으로 변경됨)
          <div className="flex-1 flex overflow-hidden">
            {/* 좌측 사이드바 LNB */}
            <div className="w-[4.5rem] bg-surface-container-lowest flex flex-col items-center py-6 shrink-0 z-0 relative">
              <div className="flex flex-col gap-6 w-full items-center">
                {/* 탭 전환 상태 인디케이터 배지 (동적 위치) */}
                <div
                  className="absolute left-0 w-1 bg-gradient-to-b from-primary to-primary-dim shadow-[0_0_10px_rgba(204,151,255,0.8)] rounded-r-lg transition-all duration-300 ease-in-out"
                  style={{
                    height: '24px',
                    top: currentTab === 'chats' ? '32px' : '96px' // 6 * 4 (py-6) + 8 = 32px (첫번 요소 초기위치 얼추 매칭), 차이 64px 계산
                  }}
                />

                {/* 채팅 목록 탭 */}
                <button
                  onClick={() => setCurrentTab('chats')}
                  className={`relative p-3 rounded-xl transition-all ${currentTab === 'chats' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
                  title="채팅 목록"
                >
                  <MessageSquare size={24} strokeWidth={currentTab === 'chats' ? 2.5 : 2} />
                  {/* 새 메시지 알림용 배지(Red Dot) */}
                  {Object.values(unreadCounts).some(count => count > 0) && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-900"></span>}
                </button>

                {/* 친구 목록 탭 */}
                <button
                  onClick={() => setCurrentTab('friends')}
                  className={`p-3 rounded-xl transition-all ${currentTab === 'friends' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
                  title="친구 목록"
                >
                  <Users size={24} strokeWidth={currentTab === 'friends' ? 2.5 : 2} />
                </button>

                {/* 지갑 탭 */}
                <button
                  onClick={() => setCurrentTab('wallet')}
                  className={`relative p-3 rounded-xl transition-all ${currentTab === 'wallet' ? 'text-primary bg-surface-variant shadow-inner' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'}`}
                  title="내 지갑 / 로컬 장부"
                >
                  <Wallet size={24} strokeWidth={currentTab === 'wallet' ? 2.5 : 2} />
                </button>
              </div>

              {/* LNB 하단: 알림, 디지털 번호판 및 내 프로필 */}
              <div className="flex flex-col items-center gap-4 mt-auto w-full pb-6">

                {/* AI 사용 통계 타일 */}
                <button
                  onClick={() => { setCurrentTab('stats'); setIsDrawerOpen(false); setCurrentRoom(null); }}
                  className="flex flex-col items-center justify-center gap-1 w-10 h-10 mb-2 rounded-xl bg-purple-900/20 border border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-900/40 text-purple-300 shadow-inner group transition-all"
                  title="오늘 AI 총 대화 횟수"
                >
                  <Bot size={16} className="opacity-80 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono font-bold leading-none">{totalAiUsageCount}</span>
                </button>

                {/* 헬프/가이드 버튼 */}
                <button
                  className="mb-1 text-zinc-500 hover:text-white transition-colors p-1 rounded-full hover:bg-zinc-800"
                  onClick={() => setIsGuideOpen(true)}
                  title="알로팝 사용 안내"
                >
                  <HelpCircle size={22} />
                </button>

                {/* 오라클 디지털 타이머 */}
                <div className="flex flex-col items-center gap-0.5">
                  <div className="text-[10px] font-mono font-bold text-secondary tracking-widest tabular-nums animate-pulse">
                    {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '00:00'}
                  </div>
                  <div className="text-[8px] font-mono text-outline-variant font-bold">UTC+9</div>
                </div>

                <div
                  className="w-10 h-10 rounded-lg bg-surface-container-high shadow-ambient border border-outline-variant/30 flex items-center justify-center text-primary font-bold cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
                  title={user.username}
                  onClick={() => { setCurrentTab('friends'); setIsProfileModalOpen(true); }}
                >
                  {myProfile?.avatar_url ? (
                    <img src={myProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    myProfile?.username?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
            </div>

            {/* 오른쪽 주 컨텐츠 영역 */}
            <div className="flex-1 flex flex-col bg-surface-container overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

              {currentTab === 'chats' && (
                <div className="p-4 space-y-5">
                  <div className="px-2 pt-2">
                    <h3 className="text-white text-display-sm font-extrabold tracking-tight">채팅</h3>
                  </div>
                  <div className="space-y-2">
                    {rooms.length === 0 ? (
                      <div className="text-zinc-500 text-sm text-center py-12 flex flex-col items-center gap-3">
                        <MessageSquare size={48} className="opacity-20" />
                        <div>참여 중인 채팅방이 없습니다.<br />친구 탭에서 대화를 시작해보세요.</div>
                      </div>
                    ) : (
                      sortedRooms.map(room => (
                        <div
                          key={room.id}
                          onClick={() => {
                            const myMemberInfo = room.members.find((m: any) => m.userId === user?.id);
                            setCurrentRoom({ id: room.id, name: room.name, isHost: !!myMemberInfo?.isHost, members: room.members, sponsorMode: room.sponsorMode, sponsorPrice: room.sponsorPrice, sponsorModel: room.sponsorModel });
                            chatStore.joinRoom(room.id);

                            // 방 입장 시 해당 방의 안읽은 메시지 수 초기화
                            setUnreadCounts(prev => ({ ...prev, [room.id]: 0 }));
                          }}
                          role="button"
                          tabIndex={0}
                          className="w-full flex items-center justify-between p-4 bg-surface-container hover:bg-surface-container-high rounded-xl transition-all text-left group border border-outline-variant/15 hover:border-outline-variant/30 cursor-pointer shadow-ambient"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="relative w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0 shadow-inner">
                              <MessageSquare size={22} />
                              {unreadCounts[room.id] > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-secondary border-2 border-dark-bg text-dark-bg text-[10px] sm:text-xs font-bold leading-none min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full z-10 shadow-[0_0_10px_rgba(98,250,227,0.5)]">
                                  {unreadCounts[room.id] > 99 ? '99+' : unreadCounts[room.id]}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="font-semibold text-[15px] text-zinc-100 truncate mb-1">
                                {getRoomName(room, user?.id)}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {(() => {
                                  // 채팅방 자체에 방장 스폰서 모드가 활성화되어 있는지 확인
                                  if (room.sponsorMode) {
                                    const price = room.sponsorPrice || 0;
                                    const isMeHost = room.members.find((m: any) => m.userId === user?.id)?.isHost;
                                    return (
                                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-extrabold bg-gradient-to-r from-primary/20 to-secondary/10 text-primary border border-primary/30 rounded-full flex items-center shadow-sm">
                                        {isMeHost ? '👑 내 스폰서 방' : '👑 방장지원'} ({price === 0 ? '무료' : `${price}코인`})
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                                <div className="text-[13px] text-on-surface-variant truncate flex items-center gap-1.5 hidden sm:flex font-mono">
                                  <Users size={12} /> 참여자 {room.members.length}명
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleLeaveRoom(room.id, e)}
                            className="text-xs font-bold bg-surface-container-high hover:bg-red-500/10 text-outline-variant hover:text-red-400 border border-outline-variant/15 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                          >
                            나가기
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {currentTab === 'stats' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="text-secondary" size={24} />
                    <h2 className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary drop-shadow-sm flex-1">
                      나의 AI 사용 통계
                    </h2>
                  </div>

                  {Object.keys(monthlyStats).length > 0 ? (
                    Object.entries(monthlyStats).sort((a, b) => b[0].localeCompare(a[0])).map(([month, stats]) => {
                      const isExpanded = expandedStatMonth === month;
                      const maxCount = Math.max(...stats.map(s => s.count), 1);
                      // 이번 달 표시 리스트 중 상위 최신 7개 항목 기준 주간 사용량
                      const weekTotal = stats.slice(0, 7).reduce((acc, curr) => acc + curr.count, 0);
                      const monthTotal = stats.reduce((acc, curr) => acc + curr.count, 0);

                      return (
                        <div key={month} className="bg-surface-container rounded-xl border border-outline-variant/15 overflow-hidden shadow-sm">
                          {/* 아코디언 헤더 */}
                          <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-variant/30 transition-colors"
                            onClick={() => setExpandedStatMonth(isExpanded ? null : month)}
                          >
                            <div>
                              <div className="font-bold text-zinc-200">{month.replace('-', '년 ')}월 리포트</div>
                              <div className="text-[11px] text-zinc-500 mt-0.5">총 {monthTotal.toLocaleString()}회 AI 대화</div>
                            </div>
                            <ChevronDown size={18} className={`text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>

                          {/* 아코디언 본문 (수제 막대 차트) */}
                          {isExpanded && (
                            <div className="px-4 pb-5 pt-3 border-t border-outline-variant/10 bg-surface-container-low/50">
                              <div className="text-xs text-secondary/90 font-semibold mb-4 bg-secondary/15 w-fit px-2.5 py-1.5 rounded-md inline-flex items-center gap-1.5 border border-secondary/20">
                                <Sparkles size={14} />
                                최근 주간(7일) 대화량: {weekTotal.toLocaleString()}회
                              </div>

                              {/* 막대 차트 가로 스크롤 영역 */}
                              <div className="h-44 flex items-end gap-3 overflow-x-auto pb-4 custom-scrollbar">
                                {stats.slice().reverse().map((stat) => {
                                  // x축 표기: 'DD일'
                                  const displayDate = stat.date.substring(8);
                                  const heightRatio = Math.max(5, (stat.count / maxCount) * 100);
                                  return (
                                    <div key={stat.date} className="flex flex-col items-center gap-1.5 min-w-[32px] group relative" title={`${stat.date}: ${stat.count}회`}>
                                      <div className="text-[10px] font-mono font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute -top-5">
                                        {stat.count}
                                      </div>
                                      <div className="w-6 bg-surface-container-highest rounded-t-sm relative overflow-hidden group-hover:ring-1 group-hover:ring-secondary/50 transition-all border border-b-0 border-outline-variant/20" style={{ height: '110px' }}>
                                        <div
                                          className="absolute bottom-0 w-full bg-gradient-to-t from-purple-600 to-teal-400 rounded-t-sm transition-all duration-500 group-hover:brightness-125 saturate-150"
                                          style={{ height: `${heightRatio}%` }}
                                        ></div>
                                      </div>
                                      <div className="text-[10px] text-zinc-500 tracking-tighter shrink-0 mt-0.5 font-medium">
                                        {displayDate}일
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3 bg-surface-container-low rounded-xl border border-outline-variant/10 border-dashed">
                      <Bot size={32} className="opacity-40" />
                      <p className="text-sm font-medium">아직 기록된 통계가 없습니다.</p>
                      <p className="text-xs opacity-70 text-center px-4">AI 친구와 한 번이라도 대화를 나누면<br />이곳에 멋진 그래프가 그려집니다!</p>
                    </div>
                  )}
                </div>
              )}

              {currentTab === 'friends' && (
                <div className="p-4 space-y-4">
                  {/* 최상단 내 프로필 카드 영역 */}
                  <div
                    onClick={() => setIsProfileModalOpen(true)}
                    className="p-4 bg-surface-container-lowest border border-outline-variant/15 hover:border-outline-variant/30 rounded-[16px] shadow-inner cursor-pointer flex items-center gap-4 group transition-colors"
                  >
                    <div className="w-14 h-14 rounded-xl bg-surface-container border border-outline-variant/30 group-hover:border-primary/50 flex items-center justify-center text-primary font-bold overflow-hidden shadow-ambient text-xl shrink-0 transition-colors">
                      {myProfile?.avatar_url ? (
                        <img src={myProfile.avatar_url} alt="My Profile" className="w-full h-full object-cover" />
                      ) : (
                        myProfile?.username?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-extrabold text-white text-xl tracking-tight truncate whitespace-nowrap">{myProfile?.username || user.username}</h3>
                      <p className="text-sm text-secondary font-mono tracking-wide truncate mt-0.5">
                        {myProfile?.statusMessage || '상태메시지를 입력해주세요.'}
                      </p>
                    </div>
                  </div>

                  {/* 친구 리스트 헤더 */}
                  <div className="px-2 pt-4 flex items-center justify-between">
                    <h3 className="text-white text-display-sm font-extrabold tracking-tight">친구<span className="text-base font-mono text-outline-variant ml-1">{friends.length}</span></h3>
                    <button
                      onClick={() => {
                        setIsAddFriendModalOpen(true);
                        setAiAvatarUrl(null);
                      }}
                      className="text-on-surface-variant hover:text-white transition-colors bg-surface-container-high hover:bg-surface-variant border border-outline-variant/20 px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-sm"
                    >
                      <UserPlus size={14} /> 친구 추가
                    </button>
                  </div>


                  <div className="space-y-2.5">
                    {friends.length === 0 ? (
                      <div className="text-zinc-500 text-sm text-center py-12 flex flex-col items-center gap-3">
                        <UserPlus size={48} className="opacity-20" />
                        <div>아직 친구가 없습니다.<br />우측 상단 버튼을 눌러 추가해보세요.</div>
                      </div>
                    ) : (
                      friends.map((friend: any) => (
                        <div
                          key={friend.id}
                          onClick={() => handleCreateRoom(friend.id)}
                          className="relative flex items-center justify-between p-4 mb-3 bg-[#150f1d] hover:bg-[#1f172b] border border-white/5 rounded-[16px] transition-colors cursor-pointer group shadow-sm"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div
                              className="relative w-14 h-14 rounded-xl flex items-center justify-center font-bold text-[16px] shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (friend.isAi) {
                                  // AI 친구는 기존 프로필(설정) 팝업 열기
                                  handleEditAiFriend(friend);
                                } else {
                                  // 일반 친구는 조회용 프로필 팝업 열기
                                  setSelectedFriendProfile(friend);
                                }
                              }}
                            >
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt={friend.username} className="w-full h-full object-cover rounded-xl border-[1.5px] border-purple-900/60" />
                              ) : (
                                <div className="w-full h-full rounded-xl bg-surface-container border-[1.5px] border-purple-900/60 flex items-center justify-center text-secondary">
                                  {friend.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-extrabold text-[16px] text-white truncate">{friend.username}</span>
                              <span className="text-[13px] text-zinc-400 truncate mt-0.5">
                                {friend.isAi
                                  ? (friend.aiPrompt?.match(/- 관심사\/취미: (.*)/)?.[1]?.trim() || '')
                                  : (friend.statusMessage || '')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pl-2">
                            {friend.isAi && friend.aiPrompt && (() => {
                              const mbtiMatch = friend.aiPrompt.match(/- MBTI: (.*)/);
                              const mbti = mbtiMatch ? mbtiMatch[1].trim() : null;
                              return mbti ? (
                                <span className="mr-1 px-2.5 py-0.5 text-xs font-bold tracking-widest text-white bg-primary-dim border border-primary/20 rounded-full whitespace-nowrap shadow-sm">
                                  {mbti}
                                </span>
                              ) : null;
                            })()}

                            <ChevronRight size={18} className="text-zinc-600 shrink-0" />

                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFriendMenuId(activeFriendMenuId === friend.id ? null : friend.id);
                                }}
                                className="text-on-surface-variant hover:text-white p-1.5 rounded-lg hover:bg-surface-container transition-colors"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeFriendMenuId === friend.id && (
                                <div className="absolute right-0 top-full mt-1.5 w-28 bg-zinc-800 border border-zinc-700/50 rounded-xl overflow-hidden shadow-lg z-10 animate-in fade-in zoom-in duration-100">
                                  {friend.isAi ? (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEditAiFriend(friend); }}
                                        className="w-full text-left px-3.5 py-2.5 text-xs text-blue-300 hover:bg-zinc-700 hover:text-blue-200 transition-colors"
                                      >
                                        수정
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateFriendStatus(friend.id, 'HIDDEN'); }}
                                        className="w-full text-left px-3.5 py-2.5 text-xs text-red-400 hover:bg-zinc-700 hover:text-red-300 transition-colors"
                                      >
                                        숨김
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateFriendStatus(friend.id, 'HIDDEN'); }}
                                        className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                                      >
                                        숨김
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateFriendStatus(friend.id, 'BLOCKED'); }}
                                        className="w-full text-left px-3.5 py-2.5 text-xs text-red-400 hover:bg-zinc-700 hover:text-red-300 transition-colors"
                                      >
                                        차단
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 지갑(Wallet) 탭 */}
              {currentTab === 'wallet' && (
                <div className="p-4 space-y-4">
                  {/* 지갑 카드 UI */}
                  <div className="w-full h-48 rounded-3xl p-6 flex flex-col justify-between shadow-ambient relative overflow-hidden group bg-surface-container-high border border-outline-variant/30">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/5 rounded-full blur-2xl -ml-5 -mb-5 pointer-events-none"></div>
                    <h2 className="text-on-surface-variant font-bold tracking-wider text-[13px] z-10 flex items-center gap-2">
                       <Wallet size={16} className="text-primary" />
                       TOTAL BALANCE
                    </h2>
                    <div className="z-10 flex items-baseline gap-2">
                      <span className="text-5xl font-black text-on-surface drop-shadow-sm font-mono tracking-tighter">
                        {(myProfile?.walletBalance ?? user?.walletBalance ?? 0).toLocaleString()}
                      </span>
                      <span className="text-on-surface-variant font-bold tracking-widest text-lg ml-1">원</span>
                    </div>
                  </div>

                  {/* 거래 내역 (로컬 장부) */}
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h3 className="text-[13px] font-bold text-zinc-300 tracking-wide flex items-center gap-2">
                        <File size={16} className="text-zinc-400" />
                        로컬 장부 타임라인
                      </h3>
                      <span className="text-[9px] text-zinc-500 px-2.5 py-1 bg-zinc-800/80 rounded-full border border-zinc-700/50 flex items-center gap-1">
                        <ShieldAlert size={10} />
                        기기에만 암호화 보관됨
                      </span>
                    </div>
                    {/* dexie livequery 로 로컬 walletTx 불러오기 */}
                    <WalletTransactionList />
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          // 선택된 채팅방 뷰
          <>
            <div
              className="flex-1 overflow-y-auto overscroll-none p-4 space-y-5 flex flex-col relative"
              ref={messagesContainerRef}
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                setShowScrollBottomBtn(scrollHeight - scrollTop - clientHeight > 150);
              }}
              onClick={() => { setSelectedMemberId(null); setIsAiModelDropdownOpen(false); }}
            >
              <div className="flex justify-center mb-6 mt-2">
                <div className="bg-surface-container-high px-4 py-2 rounded-full text-xs text-on-surface-variant border border-outline-variant/15 text-center shadow-sm font-mono tracking-tight">
                  이전 대화 내역이 로컬 기기에 암호화되어 보관됩니다. (No-Log)<br />
                  /송금 [금액] 명령어로 지갑을 테스트 해보세요!
                </div>
              </div>

              {(() => {
                let firstUnreadMsgId: string | null = null;
                if (initialUnreadTime) {
                  const firstUnread = messages?.find(m => m.senderId !== user?.id && m.createdAt > initialUnreadTime);
                  if (firstUnread) firstUnreadMsgId = firstUnread.messageId;
                }

                return messages?.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;

                  // --------------------- 날짜 구분선 로직 ---------------------
                  const msgDate = new Date(msg.createdAt);
                  let showDateBadge = false;
                  if (idx === 0) {
                    showDateBadge = true;
                  } else {
                    const prevDate = new Date(messages[idx - 1].createdAt);
                    if (
                      msgDate.getFullYear() !== prevDate.getFullYear() ||
                      msgDate.getMonth() !== prevDate.getMonth() ||
                      msgDate.getDate() !== prevDate.getDate()
                    ) {
                      showDateBadge = true;
                    }
                  }

                  const dateBadge = showDateBadge ? (
                    <div className="flex justify-center my-6 w-full relative z-10">
                      <div className="bg-surface-container-high/80 px-5 py-2 rounded-full text-[12px] text-primary border border-primary/20 shadow-ambient shadow-inner-glow flex items-center gap-2 backdrop-blur-md font-bold tracking-wide">
                        <Calendar size={13} className="opacity-90 drop-shadow-md" />
                        {msgDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                      </div>
                    </div>
                  ) : null;
                  // -------------------------------------------------------------

                  // AI 분석 태그 렌더링
                  let aiTag = null;
                  if (msg.aiAnalysis) {
                    const cat = msg.aiAnalysis.category;
                    const isFakeOld = msg.aiAnalysis.is_fake; // 구버전 호환용

                    // 팩트체크가 불필요한 일상 대화('PASS', 'NORMAL')는 이전 디자인 기획처럼 배지를 숨겨서 사용자 피로도를 줄임
                    // 단, 사용자의 요청에 의해 이미지 타입('IMAGE') 메시지는 사진 검증 결과를 무조건 렌더링하도록 조건 변경
                    if ((cat === 'NORMAL' || cat === 'PASS') && msg.messageType !== 'IMAGE') {
                      // Do not render tag
                    } else if (cat === 'PENDING') {
                      aiTag = (
                        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full w-fit text-primary bg-primary/10 border border-primary/20 shadow-sm animate-pulse">
                          <Loader2 size={12} className="animate-spin opacity-80" />
                          <span className="opacity-90">AI 팩트체크 분석 중...</span>
                        </div>
                      );
                    } else if (cat || isFakeOld !== undefined) {
                      let config = { icon: '🤖', color: 'text-on-surface-variant', bg: 'bg-surface-container-high' };
                      if (cat === 'FAKE' || isFakeOld === true) config = { icon: '🚨', color: 'text-rose-400', bg: 'bg-rose-500/20' };
                      else if (cat === 'AI_GENERATED') config = { icon: '🤖', color: 'text-primary text-glow-purple', bg: 'bg-purple-500/20' };
                      else if (cat === 'SUSPICIOUS') config = { icon: '⚠️', color: 'text-amber-400', bg: 'bg-amber-500/20' };
                      else if (cat === 'VERIFIED' || cat === 'NORMAL' || cat === 'PASS' || isFakeOld === false) config = { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
                      else if (cat === 'ERROR') config = { icon: '🛑', color: 'text-red-300', bg: 'bg-red-500/10 border-red-500/30' };

                      const reasonText = msg.aiAnalysis.reason || '특이사항 없음';

                      // 스폰서 제공 정보 꼬리표
                      const sponsorInfo = msg.aiAnalysis.isSponsored ? `\n\n🎁 [방장 스폰서 AI가 대신 분석함]\n제공 모델: ${msg.aiAnalysis.sponsorModel}` : '';

                      aiTag = (
                        <div
                          className={`mt-1.5 flex items-center justify-center gap-0.5 text-[12px] font-medium px-2 py-0.5 rounded-full cursor-pointer w-fit transition-colors hover:brightness-110 shadow-sm ${config.color} ${config.bg} border border-white/5 active:scale-95`}
                          title={`${reasonText} (${Math.round(msg.aiAnalysis.confidence * 100)}%)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            alert(`[AI 팩트체크 실시간 분석]\n\n판정 이유: ${reasonText}\nAI 확신도: ${Math.round(msg.aiAnalysis.confidence * 100)}%` + sponsorInfo);
                          }}
                        >
                          <span className="-ml-0.5 drop-shadow-md">{config.icon}</span>
                          <span className="opacity-80 flex items-center justify-center w-3.5 h-3.5 text-[10px] rounded-full bg-black/30 font-bold ml-1 font-mono">(?)</span>
                          {msg.aiAnalysis.isSponsored && msg.aiAnalysis.sponsorPrice > 0 && (
                            (() => {
                              const hostId = currentRoom?.members?.find((m: any) => m.isHost)?.userId;
                              let sign = '-';
                              let color = 'text-yellow-500 bg-yellow-900/40';
                              
                              if (user?.id === hostId) {
                                sign = '+'; // 방장이면 돈을 딴것이니 + 처리
                                color = 'text-emerald-400 bg-emerald-900/40';
                              } else if (user?.id === msg.senderId) {
                                sign = '-'; // 돈을 지불한 게스트 본인이면 명확한 - 처리 (레드)
                                color = 'text-rose-400 bg-rose-900/40';
                              } else {
                                sign = '-'; // 제3자에겐 보낸 사람이 돈 썼다는 의미로 - 처리 (흑백)
                                color = 'text-zinc-400 bg-zinc-800/60';
                              }
                              
                              return (
                                <span className={`ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-sm drop-shadow-sm tracking-tighter ${color}`}>
                                  💸{sign}{msg.aiAnalysis.sponsorPrice}
                                </span>
                              );
                            })()
                          )}
                        </div>
                      );
                    }
                  }

                  const attachmentBlock = (msg.messageType === 'IMAGE' || msg.messageType === 'VIDEO' || msg.messageType === 'FILE') && msg.fileUrl ? (
                    <div className="mt-2 text-[15px]">
                      {msg.messageType === 'IMAGE' ? (
                        <div
                          className="relative rounded-xl overflow-hidden shadow-sm border border-black/10 bg-black/5 flex justify-center cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedMedia({ url: msg.fileUrl!, type: 'IMAGE' })}
                        >
                          <img src={msg.fileUrl} alt="attachment" className="max-w-full max-h-60 object-contain rounded-xl" />
                        </div>
                      ) : msg.messageType === 'VIDEO' ? (
                        <div
                          className="relative rounded-xl overflow-hidden shadow-sm border border-black/10 bg-black/5 flex justify-center cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedMedia({ url: msg.fileUrl!, type: 'VIDEO' })}
                        >
                          <video src={msg.fileUrl} className="max-w-full max-h-60 object-cover rounded-xl block pointer-events-none" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <span className="bg-black/50 text-white rounded-full p-2 backdrop-blur-sm text-lg shadow-lg">
                              ▶️
                            </span>
                          </div>
                        </div>
                      ) : (
                        <a href={msg.fileUrl} download={msg.fileName} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-black/10 hover:bg-black/20 rounded-xl transition-colors w-fit">
                          <File size={20} className="shrink-0" />
                          <span className="font-medium text-sm truncate max-w-[200px] underline underline-offset-2">{msg.fileName || '파일 다운로드'}</span>
                        </a>
                      )}
                    </div>
                  ) : null;

                  const roomReadTimes = currentRoom ? roomMemberReadTimes[currentRoom.id] || {} : {};
                  let unreadMembersCount = 0;
                  if (currentRoom?.members && msg.senderId) {
                    currentRoom.members.forEach((m: any) => {
                      if (m.userId === msg.senderId) return; // 보낸 사람은 당연히 읽음
                      if (m.user?.isAi) return; // AI는 읽음 확인 로직에서 완전히 제외 (항상 즉시 읽은 것으로 간주)
                      const userReadTime = roomReadTimes[m.userId] || new Date(m.lastReadAt || m.joinedAt || 0).getTime();
                      if (userReadTime < new Date(msg.createdAt).getTime()) {
                        unreadMembersCount++;
                      }
                    });
                  }
                  const readBadge = unreadMembersCount > 0 ? (
                    <span className="text-[10px] font-bold text-yellow-500 mb-0.5 mx-1 flex-shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                      {unreadMembersCount}
                    </span>
                  ) : null;

                  const isFirstUnread = msg.messageId === firstUnreadMsgId;
                  const unreadDivider = isFirstUnread ? (
                    <div ref={unreadDividerRef} className="flex justify-center my-6 w-full relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-purple-500/30"></div>
                      </div>
                      <div className="bg-zinc-900 px-4 py-1.5 rounded-full text-[12px] text-purple-400 border border-purple-500/30 shadow-sm relative z-10 font-bold tracking-wide">
                        여기까지 읽으셨습니다
                      </div>
                    </div>
                  ) : null;

                  if (msg.messageType === 'SYSTEM') {
                    return (
                      <div key={msg.messageId} className="flex flex-col w-full">
                        {unreadDivider}
                        {dateBadge}
                        <div className="flex justify-center my-2 w-full">
                          <div className="bg-zinc-800/40 px-3 py-1.5 rounded-lg text-[13px] text-zinc-400 border border-zinc-700/30 text-center shadow-sm">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.messageId} className="flex flex-col w-full">
                      {unreadDivider}
                      {dateBadge}
                      {isMe ? (
                        <div className="flex justify-end gap-2 w-full mt-2">
                          <div className="flex flex-col items-end max-w-[75%]">
                            <div className="bg-gradient-to-r from-primary to-primary-dim text-white p-4 rounded-xl rounded-tr-none text-[15px] shadow-ambient shadow-inner-glow leading-relaxed font-bold break-words whitespace-pre-wrap">
                              {msg.content}
                              {attachmentBlock}
                            </div>
                            {aiTag && <div className="mt-1 flex justify-end">{aiTag}</div>}
                            <div className="flex items-end justify-end mt-1 mr-1.5 gap-0.5">
                              {readBadge}
                              <span className="text-[10px] text-outline-variant font-mono font-bold tracking-wider">
                                {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 w-full mt-2 group">
                          {(() => {
                            const senderMember = currentRoom?.members?.find((m: any) => m.userId === msg.senderId);
                            const avatarUrl = senderMember?.user?.avatar_url;
                            return (
                              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-sm font-bold shrink-0 shadow-inner border border-outline-variant/15 text-secondary overflow-hidden">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt="profile" className="w-full h-full object-cover" />
                                ) : (
                                  (msg.senderName || '?').charAt(0).toUpperCase()
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex flex-col max-w-[75%]">
                            <span className="text-[11px] text-on-surface-variant mb-1 ml-1 font-bold">{msg.senderName || '익명'}</span>
                            <div className="bg-surface-variant text-on-surface p-4 rounded-xl rounded-tl-none text-[15px] shadow-sm leading-relaxed break-words whitespace-pre-wrap font-medium">
                              {msg.content || ''}
                              {attachmentBlock}
                            </div>
                            {aiTag && <div className="mt-1 flex justify-start">{aiTag}</div>}
                            <div className="flex items-end justify-start mt-1 ml-1 gap-1">
                              <span className="text-[10px] text-outline-variant font-mono font-bold tracking-wider">
                                {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {readBadge}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              <div ref={messagesEndRef} className="h-4" />
            </div>

            {showScrollBottomBtn && (
              <div className="absolute bottom-24 right-4 z-20">
                <button
                  onClick={() => {
                    if (messagesContainerRef.current) {
                      messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' });
                    }
                    hasScrolledToUnreadRef.current = true;
                  }}
                  className="w-11 h-11 bg-zinc-800/95 hover:bg-zinc-700 border border-zinc-700/50 rounded-full flex items-center justify-center text-zinc-300 shadow-xl backdrop-blur transition-all active:scale-95"
                >
                  <ChevronDown size={28} />
                  {currentRoom && unreadCounts[currentRoom.id] > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-md">
                      {unreadCounts[currentRoom.id]}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* 타이핑 인디케이터 (AI & 휴먼 통합 작성 중) */}
            {(() => {
              if (!currentRoom) return null;
              const currentAIs = typingAIs[currentRoom.id] || [];
              const currentHumans = humanTyping[currentRoom.id] || [];
              const allTypers = [...currentAIs.map(a => a.aiName), ...currentHumans.map(h => h.userName)];

              if (allTypers.length === 0) return null;

              return (
                <div className="absolute bottom-[76px] left-4 bg-zinc-800/95 backdrop-blur-md px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-xl border border-zinc-700/50 flex flex-col items-start gap-1.5 z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                  <span className="text-[11px] font-bold text-zinc-400">
                    <strong className="text-purple-400 font-extrabold">{allTypers.join(', ')}</strong> 님이 메시지를 작성 중입니다
                  </span>
                  <div className="flex gap-1 h-2 items-center ml-1">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                  </div>
                </div>
              );
            })()}

            {/* 하단 입력 영역 */}
            <div className="p-3 bg-surface-container-low shrink-0 pb-[calc(env(safe-area-inset-bottom)+12px)] relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              {isUploading && (
                <div className="absolute inset-x-0 -top-12 z-10 flex justify-center pointer-events-none">
                  <div className="flex items-center gap-2 bg-surface-container-high/90 py-1.5 px-4 rounded-full border border-primary/30 text-secondary font-bold text-sm shadow-ambient shadow-inner-glow animate-in slide-in-from-bottom-2 fade-in">
                    <Loader2 size={16} className="animate-spin text-primary" /> 전송 중...
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAiProcessing}
                  className="w-12 h-12 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors shrink-0 shadow-inner active:scale-95 disabled:opacity-50"
                >
                  <Paperclip size={20} />
                </button>
                <div className={`flex-1 bg-surface-container-highest border-b-2 ${isAiProcessing ? 'border-b-primary shadow-inner-glow' : 'border-b-transparent focus-within:border-b-secondary'} rounded-t-lg rounded-b-none overflow-hidden transition-all font-mono`}>
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isAiProcessing) handleSendMessage(e);
                      }
                    }}
                    onFocus={(e) => {
                      // 모바일 사파리/안드로이드 환경에서 키보드가 올라올 때 입력창이 가려지는 문제 방어
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: 'smooth', block: 'end' });
                      }, 300);
                    }}
                    disabled={isAiProcessing}
                    placeholder={isAiProcessing ? "AI 분석 중..." : "메시지 입력..."}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    className="w-full bg-transparent text-on-surface px-4 py-3 outline-none resize-none max-h-24 placeholder-outline-variant/50 text-[15px] disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputText.trim() || isAiProcessing}
                  className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all shrink-0 active:scale-95 disabled:cursor-not-allowed
                    ${inputText.trim() && !isAiProcessing ? 'bg-primary text-dark-bg shadow-ambient shadow-[0_0_15px_rgba(204,151,255,0.4)] font-bold' : 'bg-surface-container border border-outline-variant/15 text-outline-variant shadow-none'}`}
                >
                  {isAiProcessing ? <Loader2 size={18} className="animate-spin text-primary" /> : <Send size={18} className="ml-0.5" />}
                </button>
              </form>
            </div>

            {/* 참가자 목록 사이드서랍 (Drawer) */}
            {isDrawerOpen && (
              <div className="absolute inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-md" onClick={() => { setIsDrawerOpen(false); setSelectedMemberId(null); }}>
                <div
                  className="w-64 h-full bg-surface-container-lowest border-l border-outline-variant/15 shadow-ambient flex flex-col p-4 animate-in slide-in-from-right-full duration-300"
                  onClick={(e) => { e.stopPropagation(); setSelectedMemberId(null); }} // 드로어 내부 클릭 시 열린 메뉴 닫기
                >
                  <div className="flex justify-between items-start pb-4 border-b border-outline-variant/15 mb-4">
                    <div className="flex flex-col w-full mr-2 gap-1.5">
                      {isEditingRoomName ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editRoomNameValue}
                            onChange={e => setEditRoomNameValue(e.target.value)}
                            className="bg-zinc-800 text-sm text-white px-2 py-1.5 rounded border border-zinc-700 w-full outline-none focus:border-purple-500"
                            placeholder="방 이름 (기본값: 상대방 이름)"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleUpdateRoomName()}
                          />
                          <button onClick={handleUpdateRoomName} className="text-emerald-400 hover:text-emerald-300 p-1"><Check size={16} /></button>
                          <button onClick={() => setIsEditingRoomName(false)} className="text-zinc-400 hover:text-zinc-300 p-1"><X size={16} /></button>
                        </div>
                      ) : (
                        <h3 className="font-semibold text-zinc-100 flex items-center justify-between group min-w-0">
                          <span className="truncate pr-2 text-[15px] min-w-0 flex-1">{getRoomName(currentRoom, user?.id)}</span>
                          <button
                            onClick={() => { setEditRoomNameValue(currentRoom.name || ''); setIsEditingRoomName(true); }}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1 shrink-0"
                          >
                            <Edit2 size={14} className="shrink-0" />
                          </button>
                        </h3>
                      )}
                      <span className="text-xs text-zinc-500">참가자 {currentRoom.members?.length}명</span>
                    </div>
                    <button onClick={() => setIsDrawerOpen(false)} className="text-zinc-400 hover:text-white p-1 shrink-0">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2">
                    {currentRoom.members?.map((member: any) => {
                      const isMe = member.userId === user?.id;
                      const isSelected = selectedMemberId === member.userId;

                      return (
                        <div key={member.id} className="flex flex-col bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl transition-colors overflow-hidden">
                          {/* 고정된 사용자 한 줄 뷰 */}
                          <div
                            className="flex items-center justify-between p-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isMe) return; // 자신은 선택되지 않음
                              setSelectedMemberId(isSelected ? null : member.userId);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {member.user.avatar_url ? (
                                <img src={member.user.avatar_url} alt={member.user.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200 shrink-0">
                                  {member.user.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm font-medium text-zinc-200">
                                {member.user.username} {isMe && <span className="text-xs text-zinc-500 ml-1">(나)</span>}
                              </span>
                              {member.isHost && <Crown size={14} className="text-yellow-500 ml-0.5" />}
                            </div>
                          </div>

                          {/* 사용자를 클릭했을 때 펼쳐지는 메뉴 영역 (자신 제외) */}
                          {isSelected && !isMe && (
                            <div className="flex justify-end gap-2 px-3 pb-2 pt-1 border-t border-zinc-800/50 mt-1 bg-zinc-800/40">
                              {/* 공통 메뉴: 송금하기 (AI 제외) */}
                              {!member.user?.isAi && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); promptTransfer(member.userId, member.user.username); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors"
                                >
                                  <Coins size={14} /> 송금
                                </button>
                              )}

                              {/* 방장 전용 메뉴 또는 자신의 AI 친구 관리 메뉴 */}
                              {(currentRoom.isHost || (member.user?.isAi && member.user?.aiOwnerId === user?.id)) && (
                                <>
                                  {currentRoom.isHost && !member.user?.isAi && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelegateHost(member.userId); }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-md transition-colors"
                                    >
                                      <Crown size={14} /> 방장 양도
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleKickMember(member.userId); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-md transition-colors"
                                  >
                                    <UserMinus size={14} /> 강퇴
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 친구 초대 액션 버튼 영역 */}
                  <div className="pt-3 mt-4 border-t border-zinc-800/80">
                    <button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 hover:text-purple-300 rounded-xl transition-colors text-sm font-medium"
                    >
                      <UserPlus size={16} /> 새로운 친구 초대
                    </button>
                  </div>
                </div>

                {/* 초대 모달 오버레이 */}
                {isInviteModalOpen && (
                  <div className="absolute inset-x-0 bottom-0 top-auto h-2/3 bg-zinc-900 border-t border-zinc-800 p-4 z-50 flex flex-col animate-in slide-in-from-bottom shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.5)]">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-zinc-100">초대할 친구 선택</h4>
                      <button onClick={() => setIsInviteModalOpen(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {friends.filter(f => !currentRoom.members.some((m: any) => m.userId === f.id)).length === 0 ? (
                        <div className="text-center text-sm text-zinc-500 py-4">초대 가능한 친구가 없습니다.</div>
                      ) : (
                        friends.filter(f => !currentRoom.members.some((m: any) => m.userId === f.id)).map((friend: any) => (
                          <div key={friend.id} className="flex justify-between items-center p-2.5 bg-zinc-800/50 rounded-xl">
                            <span className="text-sm font-medium text-zinc-200">{friend.username}</span>
                            <button
                              onClick={() => handleInviteFriend(friend.id)}
                              className="text-xs font-semibold bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg text-white transition-colors"
                            >
                              초대
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 내 프로필 및 상태메시지 수정 모달 */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsProfileModalOpen(false)}>
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center mt-4">
                <div className="relative group w-24 h-24 mb-4">
                  <div className="w-full h-full rounded-full bg-indigo-500/20 text-indigo-400 text-3xl font-bold flex items-center justify-center border-2 border-indigo-500/30 overflow-hidden shadow-inner cursor-default">
                    {myProfile?.avatar_url ? (
                      <img src={myProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      myProfile?.username?.charAt(0).toUpperCase() || user?.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* 이미지 업로드 인풋 덮어 씌우기 (Hover시 노출) */}
                  <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-medium text-xs">
                    <Edit2 size={16} className="mb-1 block mx-auto" />
                    사진 변경
                    <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                </div>

                <h3 className="text-xl font-bold text-zinc-100 mb-1">{myProfile?.username || user?.username}</h3>
                <div className="flex flex-wrap justify-center items-center gap-2 mb-6 w-full px-2">
                  <button className="text-xs font-mono text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800 flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shrink-0" onClick={handleCopyMyId}>
                    초대 코드: <span className="text-zinc-300 font-bold tracking-widest">{myProfile?.inviteCode || user?.inviteCode || user?.id.substring(0, 8)}</span> <Copy size={12} className="shrink-0" />
                  </button>
                  <button className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 flex items-center justify-center gap-2 hover:bg-indigo-500/20 transition-colors shrink-0" onClick={handleCopyMyLink} title="초대 링크 복사">
                    <LinkIcon size={12} className="shrink-0" /> 링크 복사
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateStatusMessage} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">상태메시지 (최대 60자)</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={statusMsgValue}
                    onChange={(e) => setStatusMsgValue(e.target.value)}
                    placeholder="상태메시지를 적어보세요"
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-3.5 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[15px] transition-colors shadow-lg active:scale-[0.98]"
                >
                  저장하기
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 일반 친구 프로필 조회 모달 */}
        {selectedFriendProfile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedFriendProfile(null)}>
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setSelectedFriendProfile(null)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center mt-4">
                <div className="relative w-24 h-24 mb-4">
                  <div className="w-full h-full rounded-full bg-indigo-500/20 text-indigo-400 text-3xl font-bold flex items-center justify-center border-2 border-indigo-500/30 overflow-hidden shadow-inner cursor-default">
                    {selectedFriendProfile.avatar_url ? (
                      <img src={selectedFriendProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      selectedFriendProfile.username.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-zinc-100 mb-1">{selectedFriendProfile.username}</h3>
                <div className="text-sm text-zinc-400 whitespace-pre-wrap max-w-full px-4 mb-4 min-h-[1.5rem]">
                  {selectedFriendProfile.statusMessage || '(상태메시지 없음)'}
                </div>

                <div className="w-full pt-4 mt-2 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setSelectedFriendProfile(null);
                      handleCreateRoom(selectedFriendProfile.id);
                    }}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[15px] transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                  >
                    <MessageSquare size={16} /> 1:1 대화 시작
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* 최상단 친구 추가 모달 (전역 탭뷰 위 표시) */}
        {isAddFriendModalOpen && !currentRoom && (
          <div className="absolute inset-x-0 bottom-0 top-auto h-[85%] bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 z-50 flex flex-col animate-in slide-in-from-bottom shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-zinc-100 text-lg flex items-center gap-2">
                <UserPlus className="text-primary text-glow-purple" size={20} />
                {editingAiFriend ? 'AI 친구 정보 수정' : '새로운 친구 추가'}
              </h4>
              <button
                onClick={() => {
                  setIsAddFriendModalOpen(false);
                  setAddFriendTab('NORMAL');
                  setEditingAiFriend(null);
                }}
                className="text-zinc-400 hover:text-white p-1 bg-zinc-800/50 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* 탭 헤더 (수정 모드일때는 숨김) */}
            {!editingAiFriend && (
              <div className="flex bg-zinc-800/50 p-1 rounded-xl mb-6 shrink-0">
                <button
                  onClick={() => setAddFriendTab('NORMAL')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${addFriendTab === 'NORMAL' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-300'}`}
                >
                  👤 친구 추가
                </button>
                <button
                  onClick={() => setAddFriendTab('AI')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${addFriendTab === 'AI' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-300'}`}
                >
                  🤖 AI 생성
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6 pb-4">
              {addFriendTab === 'NORMAL' ? (
                <>
                  {/* 내 QR 및 ID 영역 */}
                  <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 text-center flex flex-col items-center">
                    <span className="text-sm text-zinc-400 mb-4 font-medium">나의 QR 코드 & 초대 코드</span>
                    <div className="bg-white p-3 rounded-xl mb-4">
                      <QRCode value={myProfile?.inviteCode || user?.inviteCode || user?.id || ''} size={120} level="M" />
                    </div>

                    <div className="w-full flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                      <div className="flex-1 truncate text-xl font-bold tracking-widest text-zinc-200 pl-2">
                        {myProfile?.inviteCode || user?.inviteCode || user?.id}
                      </div>
                      <button onClick={handleCopyMyId} className="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2.5 rounded-md transition-colors" title="코드 복사">
                        <Copy size={16} />
                      </button>
                      <button onClick={handleCopyMyLink} className="shrink-0 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 p-2.5 rounded-md transition-colors" title="초대 링크 복사">
                        <LinkIcon size={16} />
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-2">친구에게 위 QR 코드를 보여주거나 6자리 코드 및 링크를 공유하세요.</p>
                  </div>

                  {/* 대상 ID 검색/추가 폼 */}
                  <form onSubmit={handleAddFriendSubmit} className="space-y-3">
                    <label className="block text-sm font-semibold text-zinc-300 mb-1 ml-1">코드로 추가하기</label>
                    <input
                      type="text"
                      value={addFriendIdValue}
                      onChange={(e) => setAddFriendIdValue(e.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="친구의 6자리 초대 코드를 입력하세요"
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-4 py-3.5 rounded-xl text-lg uppercase font-bold tracking-widest focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:font-sans placeholder:text-zinc-600 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
                    />
                    <button
                      type="submit"
                      disabled={!addFriendIdValue.trim()}
                      className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm"
                    >
                      친구추가하기
                    </button>
                  </form>
                </>
              ) : (
                <form onSubmit={handleSubmitAiFriend} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">AI 이름 (표시될 닉네임) <span className="text-red-400">*</span></label>
                    <input type="text" required value={aiNameValue} onChange={e => setAiNameValue(e.target.value)} placeholder="예: 챗봇 매니저" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">MBTI 성격 <span className="text-red-400">*</span></label>
                      <select value={aiMbtiValue} onChange={e => setAiMbtiValue(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors">
                        {['ESTJ', 'ESTP', 'ESFJ', 'ESFP', 'ENTJ', 'ENTP', 'ENFJ', 'ENFP', 'ISTJ', 'ISTP', 'ISFJ', 'ISFP', 'INTJ', 'INTP', 'INFJ', 'INFP'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">성별 <span className="text-red-400">*</span></label>
                      <select value={aiGenderValue} onChange={e => setAiGenderValue(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors">
                        <option value="여성">여성</option>
                        <option value="남성">남성</option>
                        <option value="성별 없음">성별 없음</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">연령대 <span className="text-red-400">*</span></label>
                      <select value={aiAgeValue} onChange={e => setAiAgeValue(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors">
                        <option value="10대">10대</option>
                        <option value="20대 초반">20대 초반</option>
                        <option value="20대 후반">20대 후반</option>
                        <option value="30대">30대</option>
                        <option value="40대">40대</option>
                        <option value="50대">50대</option>
                        <option value="60대 이상 (노년층)">60대 이상 (노년층)</option>
                        <option value="연령 미상">연령 미상</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">말투/성격 <span className="text-red-400">*</span></label>
                      <select value={aiToneValue} onChange={e => setAiToneValue(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors">
                        <option value="발랄하고 친근한 반말">발랄하고 친근한 반말</option>
                        <option value="정중하고 다정한 존댓말">정중하고 다정한 존댓말</option>
                        <option value="시니컬하고 팩트폭력 반말">시니컬하고 팩트폭력 반말</option>
                        <option value="건조하고 차가운 사무적 비서 존댓말">건조하고 차가운 사무적 비서 존댓말</option>
                        <option value="애교 섞인 귀여운 말투">애교 섞인 귀여운 말투</option>
                        <option value="트렌디한 MZ 신조어 밈 말투">트렌디한 MZ 신조어 밈 말투</option>
                        <option value="인간미 넘치는 구수한 아재 밈 말투">인간미 넘치는 구수한 아재 밈 말투</option>
                        <option value="찐한 경상도 사투리 반말">찐한 경상도 사투리 반말</option>
                        <option value="구수한 전라도 사투리 반말">구수한 전라도 사투리 반말</option>
                        <option value="군대식 다나까 말투">군대식 다나까 말투</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">주요 관심사 (선택)</label>
                    <input type="text" value={aiHobbyValue} onChange={e => setAiHobbyValue(e.target.value)} placeholder="예: 게임, IT, 음악, 아이돌 등" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors" />
                  </div>

                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg mt-2 flex items-center justify-between gap-4">
                    <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden shadow-inner cursor-pointer" onClick={() => aiAvatarUrl && setSelectedMedia({ url: aiAvatarUrl, type: 'IMAGE' })}>
                      {aiAvatarUrl ? (
                        <img src={aiAvatarUrl} alt="Preview Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="text-zinc-500" size={24} />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <span className="text-[13px] text-zinc-300 font-bold mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="text-secondary" size={14} />
                        현재 작동 화가 : {
                          avatarGenMode === 'system'
                            ? (selectedProvider === 'openai' && apiKeys['openai'] ? 'OpenAI DALL-E 3' :
                              (selectedProvider === 'gemini' || selectedProvider === 'gemini-free') && apiKeys[selectedProvider] ? 'Gemini Imagen 3 (불안정)' :
                                '무료 그림 AI (Pollinations)')
                            : avatarGenMode === 'pollinations' ? '무료 그림 AI (Pollinations)'
                              : avatarGenMode === 'dicebear' ? '무료 로봇 일러스트 (DiceBear)'
                                : '무료 동물 일러스트 (Robohash)'
                        }
                      </span>
                      <div className="flex flex-col gap-1.5 mb-2.5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                          <input type="radio" name="avG" value="system" checked={avatarGenMode === 'system'} onChange={() => setAvatarGenMode('system')} className="accent-purple-500" />
                          <span>현재 설정된 화가 (DALL-E / Gemini)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                          <input type="radio" name="avG" value="pollinations" checked={avatarGenMode === 'pollinations'} onChange={() => setAvatarGenMode('pollinations')} className="accent-purple-500" />
                          <span>Pollinations AI (약 15초 대기)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                          <input type="radio" name="avG" value="dicebear" checked={avatarGenMode === 'dicebear'} onChange={() => setAvatarGenMode('dicebear')} className="accent-purple-500" />
                          <span>DiceBear 로봇 타일 (0.1초 무료)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                          <input type="radio" name="avG" value="robohash" checked={avatarGenMode === 'robohash'} onChange={() => setAvatarGenMode('robohash')} className="accent-purple-500" />
                          <span>Robohash 동물 타일 (0.1초 무료)</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateAvatar}
                        disabled={isGeneratingAvatar}
                        className="bg-zinc-800 hover:bg-zinc-700 text-purple-300 text-xs py-2 rounded-lg font-bold border border-purple-500/20 shadow-sm transition-colors disabled:opacity-50"
                      >
                        {isGeneratingAvatar ? `🎨 사진 생성 중... (${generationElapsedSec}초 경과)` : '프로필 사진 생성하기'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!aiNameValue.trim() || isAiCreating}
                    className="w-full mt-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isAiCreating ? <span className="animate-pulse">처리 중...</span> : (editingAiFriend ? '수정 완료' : 'AI 친구 생성 및 등록')}
                  </button>
                  <p className="text-[11px] text-zinc-500 text-center mt-3">※ 이 AI는 내 환경에 등록된 API 키 권한으로 응답합니다.</p>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 미디어 풀스크린 뷰어 (Lightbox) */}
        {selectedMedia && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-center items-center animate-in fade-in duration-200"
            onClick={() => setSelectedMedia(null)}
          >
            <button
              className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-[110]"
              onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}
            >
              <X size={28} />
            </button>
            <div className="w-full h-full max-w-5xl max-h-screen flex items-center justify-center p-2 sm:p-8" onClick={(e) => e.stopPropagation()}>
              {selectedMedia.type === 'IMAGE' ? (
                <img src={selectedMedia.url} alt="Full screen media" className="max-w-full max-h-full object-contain rounded-sm select-none" />
              ) : (
                <video src={selectedMedia.url} controls autoPlay playsInline className="max-w-full max-h-full object-contain rounded-sm outline-none shadow-2xl" />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
