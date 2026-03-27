'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, LogOut, Send, Menu, Users, Crown, UserMinus, Coins, Edit2, Check, X, UserPlus, MessageSquare, User, Copy, QrCode, MoreVertical, Link as LinkIcon, Paperclip, File, Image as ImageIcon, Loader2, ChevronDown, Calendar } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ChatMessage } from '@/lib/db';
import { useChatStore } from '@/store/useChatStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SettingsModal } from '@/components/SettingsModal';
import { v4 as uuidv4 } from 'uuid';

const AI_MODELS: Record<string, { id: string, name: string }[]> = {
  openai: [
    { id: 'gpt-5.4', name: 'GPT-5.4 (범용/기본)' },
    { id: 'gpt-5.4-pro', name: 'GPT-5.4-Pro (추론)' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4-Mini (빠른 속도)' },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4-Nano (초경량)' }
  ],
  gemini: [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
    { id: 'gemini-3.1-flash-preview', name: 'Gemini 3.1 Flash' },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
  ]
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string; inviteCode?: string; walletBalance?: number } | null>(null);
  const [myProfile, setMyProfile] = useState<{ id: string; username: string; avatar_url: string | null; statusMessage: string | null; inviteCode?: string; walletBalance: number } | null>(null);

  const [inputText, setInputText] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]); // 개별 친구 목록 (상태: ACTIVE 대상)
  const [currentRoom, setCurrentRoom] = useState<{ id: string, name: string | null, isHost: boolean, isGroup?: boolean, members: any[] } | null>(null);
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
  const [currentTab, setCurrentTab] = useState<'chats' | 'friends'>('chats'); // 좌측 LNB 탭 상태

  // 친구 목록 컨텍스트 메뉴 상태
  const [activeFriendMenuId, setActiveFriendMenuId] = useState<string | null>(null);

  // 친구 추가 모달 관련 상태
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [addFriendIdValue, setAddFriendIdValue] = useState('');

  // 내 프로필(상태메시지 수정) 모달 관련 상태
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [statusMsgValue, setStatusMsgValue] = useState('');

  const markRoomAsRead = useCallback((roomId: string) => {
    if (!user?.id) return;
    const now = Date.now();
    setRoomMemberReadTimes(prev => ({
      ...prev,
      [roomId]: { ...(prev[roomId] || {}), [user.id]: now }
    }));
    fetch('/api/rooms/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, roomId })
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
  const { setIsOpen: setSettingsOpen, selectedProvider, loadSettings } = useSettingsStore();

  // 앱 최초 로드 시 로컬 스토리지의 AI 설정을 스토어에 즉시 동기화
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedAiModel, setSelectedAiModel] = useState<string>('');
  const [isAiModelDropdownOpen, setIsAiModelDropdownOpen] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(false);

  // AI 친구 생성 폼 상태
  const [addFriendTab, setAddFriendTab] = useState<'NORMAL' | 'AI'>('NORMAL');
  const [aiNameValue, setAiNameValue] = useState('');
  const [aiMbtiValue, setAiMbtiValue] = useState('ENFP');
  const [aiGenderValue, setAiGenderValue] = useState('여성');
  const [aiAgeValue, setAiAgeValue] = useState('20대 초반');
  const [aiToneValue, setAiToneValue] = useState('발랄하고 친근한 반말');
  const [aiHobbyValue, setAiHobbyValue] = useState('');
  const [isAiCreating, setIsAiCreating] = useState(false);

  useEffect(() => {
    setIsAiEnabled(false);
  }, [currentRoom?.id]);

  useEffect(() => {
    const list = AI_MODELS[selectedProvider || 'openai'] || [];
    if (selectedAiModel && !list.some(m => m.id === selectedAiModel)) {
      const defaultModel = list[0]?.id || 'gpt-5.4';
      setSelectedAiModel(defaultModel);
      localStorage.setItem('alo_ai_model', defaultModel);
    }
  }, [selectedProvider, selectedAiModel]);

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

    const providerValue = localStorage.getItem('alo_ai_provider') || 'openai';
    const savedModel = localStorage.getItem('alo_ai_model');
    if (savedModel && AI_MODELS[providerValue]?.some(m => m.id === savedModel)) {
      setSelectedAiModel(savedModel);
    } else {
      setSelectedAiModel(AI_MODELS[providerValue]?.[0]?.id || 'gpt-5.4');
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
            roomsData.forEach(r => {
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

      // 송금 메시지 수신 시 잔액 즉시 동기화
      if (msg.content && msg.content.includes('[송금 알림]')) {
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

          const now = Date.now();
          setRoomMemberReadTimes(prev => ({
            ...prev,
            [curr!.id]: { ...(prev[curr!.id] || {}), [parsedUser.id]: now }
          }));
          fetch('/api/rooms/read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: parsedUser.id, roomId: curr!.id })
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

    window.addEventListener('new_chat_message', handleNewMessage);
    window.addEventListener('room_read_update', handleReadUpdateEvent);
    window.addEventListener('room_name_updated', handleRoomNameUpdated);
    window.addEventListener('typing_start', handleHumanTypingStart);
    window.addEventListener('typing_end', handleHumanTypingEnd);

    return () => {
      window.removeEventListener('new_chat_message', handleNewMessage);
      window.removeEventListener('room_read_update', handleReadUpdateEvent);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
      window.removeEventListener('room_name_updated', handleRoomNameUpdated);
      window.removeEventListener('typing_start', handleHumanTypingStart);
      window.removeEventListener('typing_end', handleHumanTypingEnd);
      
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
      if (unreadDividerRef.current) {
        unreadDividerRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    } else {
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;

        const lastMsg = messages[messages.length - 1];
        const isMyMsg = lastMsg?.senderId === user?.id;

        if (isNearBottom || isMyMsg) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  useEffect(() => { inputTextRef.current = inputText; }, [inputText]);
  useEffect(() => { humanTypingRef.current = humanTyping; }, [humanTyping]);

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

  // 사용자가 타이핑 치기 시작하면 진행 중인 AI 대답을 모두 취소 (즉, 눈치채고 말 안 함)
  useEffect(() => {
    if (!currentRoom) return;
    const hasLocalText = inputText.trim().length > 0;
    const otherTypers = humanTyping[currentRoom.id] || [];
    
    if (hasLocalText || otherTypers.length > 0) {
       abortAiReplies();
    }
  }, [inputText, humanTyping, currentRoom, abortAiReplies]);

  useEffect(() => {
    if (!currentRoom || !messages || messages.length === 0 || !user) return;
    
    const lastMsg = messages[messages.length - 1];
    
    // 이미 처리한 메시지면 패스 (렌더링 사이클 방어)
    if (lastProcessedAiMsgIdRef.current === lastMsg.messageId) return;
    lastProcessedAiMsgIdRef.current = lastMsg.messageId;
    
    // 텍스트 메시지가 아니면 (사진/파일/시스템메시지) 무시
    if (lastMsg.messageType !== 'TEXT') return;

    // 내 환경의 AI 통합 설정 확인 (API 키가 있어야만 내 AI들이 작동)
    const selectedProvider = localStorage.getItem('alo_ai_provider') || 'openai';
    const keysStr = localStorage.getItem('alo_api_keys');
    const apiKeys = keysStr ? JSON.parse(keysStr) : {};
    const byokKey = apiKeys[selectedProvider];
    
    if (!byokKey) return; 
    
    // 현재 방 멤버 중, "내가 창조한(aiOwnerId === user.id) AI" 발라내기
    const myAIs = currentRoom.members.filter((m: any) => m.user?.isAi === true && m.user?.aiOwnerId === user.id);
    if (myAIs.length === 0) return;

    // 강력한 무한루프(혼잣말) 방지 락: 
    // 마지막 메시지가 "내가 창조한 AI" 중 한 명의 ID나 이름과 일치하면 무조건 스킵
    const lastMsgIsFromMyAI = myAIs.some((ai: any) => 
       ai.userId === lastMsg.senderId || 
       ai.user?.id === lastMsg.senderId || 
       ai.user?.username === lastMsg.senderName
    );

    if (lastMsgIsFromMyAI) {
       console.log(`[DEBUG] AI 핑퐁(혼잣말) 원천 차단됨! sender: ${lastMsg.senderName}`);
       return;
    }

    // 최근 메시지 5개 추출하여 문맥 조합 (누가 무슨 말을 했는지)
    const recentContext = messages.slice(-5).map(m => `[${m.senderName}]: ${m.content}`).join('\n');

    // 내가 가진 각각의 AI들에 대해 개입 여부 평가
    myAIs.forEach((aiMember: any) => {
      const aiUser = aiMember.user;
      
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
        // 직전에 누군가 타이핑을 시작했다면 중단
        const hasLocalText = inputTextRef.current.trim().length > 0;
        const otherTypers = humanTypingRef.current[currentRoom.id] || [];
        if (hasLocalText || otherTypers.length > 0) return;

        // 이미 답변을 준비 중(타이핑 중)이라면 중복 예약 방지
        if (pendingAiReplyRef.current[aiUser.id]) return;
        pendingAiReplyRef.current[aiUser.id] = true;

        // 채팅방에 타이핑 인디케이터 표시 켜기 (로컬 및 원격)
        setTypingAIs(prev => {
          const roomAIs = prev[currentRoom.id] || [];
          if (!roomAIs.find(a => a.aiId === aiUser.id)) {
             return { ...prev, [currentRoom.id]: [...roomAIs, { aiId: aiUser.id, aiName: aiUser.username }] };
          }
          return prev;
        });
        const { socket } = useChatStore.getState();
        if (socket) socket.emit('typing_start', { roomId: currentRoom.id, userId: aiUser.id, userName: aiUser.username });

        // AbortController 생성
        const controller = new AbortController();
        aiAbortControllersRef.current[aiUser.id] = controller;

        const timeoutId = setTimeout(async () => {
          try {
            // 시간이 지난 후 막상 fetch를 쏠 때, 또 누군가 타이핑 중이라면 멈춤
            if (inputTextRef.current.trim().length > 0 || (humanTypingRef.current[currentRoom.id]?.length > 0)) {
               pendingAiReplyRef.current[aiUser.id] = false;
               if (socket) socket.emit('typing_end', { roomId: currentRoom.id, userId: aiUser.id });
               
               setTypingAIs(prev => ({ ...prev, [currentRoom.id]: (prev[currentRoom.id] || []).filter(a => a.aiId !== aiUser.id) }));
               return;
            }

            // 최신 문맥을 다시 추출 (딜레이 동안 쌓인 메시지 반영)
            let currentContext = "";
            db.messages
               .where('receiverId').equals(currentRoom.id)
               .sortBy('createdAt')
               .then((allMsgs: any[]) => {
                 currentContext = allMsgs.slice(-5).map((m: any) => `[${m.senderName}]: ${m.content}`).join('\n');
                 return fetch('/api/chat/friend', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   signal: controller.signal,
                   body: JSON.stringify({
                     provider: selectedProvider,
                     byokKey,
                     aiModel: selectedAiModel || localStorage.getItem('alo_ai_model'),
                     systemPrompt: aiUser.aiPrompt,
                     content: `현재 채팅방 대화 문맥 (최근 5개):\n${currentContext}\n\n위 문맥을 참고하여 네 차례야. 혼잣말을 연속으로 하지 않게 주의하며 자연스럽게 사람처럼 1문장 내지 2문장으로 짧게 답장해줘.`
                   })
                 });
               })
               .then((aiResponse: any) => aiResponse.json())
               .then((resData: any) => {
                 if (resData && resData.reply) {
                    const aiReplyContent = resData.reply;
                    chatStore.sendMessage(currentRoom.id, aiReplyContent, aiUser.id, aiUser.username, 'TEXT');
                 }
               })
               .catch((e: any) => {
                 if (e.name === 'AbortError') {
                   console.log(`[DEBUG] AI ${aiUser.username} 응답이 사용자의 타이핑으로 인해 차단됨(Aborted)`);
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
         // 즉시 개입 처리 (단톡방 1.5~3.5초, 1:1 방은 1~2.5초)
         const delayMs = isOneOnOne ? Math.floor(Math.random() * 1500) + 1000 : Math.floor(Math.random() * 2000) + 1500;
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
        let aiAnalysisResult = undefined;
        if (data.type === 'IMAGE' && isAiEnabled) {
          try {
            const selectedProvider = localStorage.getItem('alo_ai_provider') || 'openai';
            const keysStr = localStorage.getItem('alo_api_keys');
            const apiKeys = keysStr ? JSON.parse(keysStr) : {};
            const byokKey = apiKeys[selectedProvider];
            const aiRes = await fetch('/api/chat', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: '', imageUrl: data.url, provider: selectedProvider, byokKey, aiModel: selectedAiModel })
            });
            if (aiRes.ok) aiAnalysisResult = await aiRes.json();
          } catch (err) {
            console.warn('AI Vision Analysis failed:', err);
          }
        }

        const { socket } = chatStore;
        if (!socket) return;

        const newMessage: ChatMessage = {
          messageId: uuidv4(),
          senderId: user.id,
          senderName: user.username,
          receiverId: currentRoom.id,
          content: data.type === 'IMAGE' ? '(사진이 전송되었습니다)' : data.type === 'VIDEO' ? '(동영상이 전송되었습니다)' : '(파일이 전송되었습니다)',
          messageType: data.type as 'IMAGE' | 'FILE' | 'VIDEO',
          fileUrl: data.url,
          fileName: data.name,
          aiAnalysis: aiAnalysisResult,
          createdAt: Date.now()
        };

        await db.messages.add(newMessage);
        socket.emit('send_message', { receiverId: currentRoom.id, message: newMessage });
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

        const msgStr = `💸 [송금 알림] ${user.username}님이 ${targetName}님에게 ${amount} 코인을 송금했습니다.`;
        await chatStore.sendMessage(currentRoom?.id || 'global', msgStr, user.id, user.username);
      } catch (err) {
        console.error('송금 중 오류 발생:', err);
      }
      return;
    }

    // --- 2. 일반 메시지 및 AI 팩트체크 처리 ---
    let aiAnalysisResult = undefined;

    // 비동기로 AI 백엔드에 팩트체크 요청
    if (isAiEnabled) {
      setIsAiProcessing(true);
      try {
        const selectedProvider = localStorage.getItem('alo_ai_provider') || 'openai';
        const keysStr = localStorage.getItem('alo_api_keys');
        const apiKeys = keysStr ? JSON.parse(keysStr) : {};
        const byokKey = apiKeys[selectedProvider];

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
          aiAnalysisResult = await aiRes.json();
        }
      } catch (err) {
        console.warn('AI 분석 실패 (건너뜀):', err);
      } finally {
        setIsAiProcessing(false);
      }
    }

    // 로컬 스토어에 추가 및 소켓 릴레이 호출 (aiAnalysis 포함)
    const { socket } = chatStore;
    if (!socket) return;

    const newMessage: ChatMessage = {
      messageId: uuidv4(),
      senderId: user.id,
      senderName: user.username,
      receiverId: currentRoom?.id || 'global',
      content: messageContent,
      messageType: 'TEXT',
      aiAnalysis: aiAnalysisResult,
      createdAt: Date.now(),
    };

    await db.messages.add(newMessage);
    setLatestMessageTimes(prev => ({ ...prev, [newMessage.receiverId]: newMessage.createdAt }));

    // 다시 방 단위(Room ID)로 발송하되, 로컬 고유 번호(id)는 제외해야 충돌 방지됨!
    const emitMessage = { ...newMessage } as any;
    delete emitMessage.id;
    socket.emit('send_message', { receiverId: currentRoom?.id || 'global', message: emitMessage });
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
          setCurrentRoom({ id: newRoom.id, name: newRoom.name, isHost: true, members: newRoom.members });
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

  const handleCreateAIFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiNameValue.trim() || !user) return;
    setIsAiCreating(true);
    try {
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
          hobby: aiHobbyValue
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
    } catch (err) {
      console.error(err);
      alert('AI 생성 중 오류가 발생했습니다.');
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
    const amountStr = window.prompt(`${receiverName}님에게 송금할 코인 금액을 입력하세요:`, '100');
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
            alert(`성공적으로 ${amount} 코인을 ${receiverName}님에게 송금했습니다. 잔액: ${data.balance} 코인`);

            // 송금 완료 후 채팅방(현재 룸)에 시스템 메시지 전송
            const msgStr = `💸 [송금 알림] ${user.username}님이 ${receiverName}님에게 ${amount} 코인을 송금했습니다.`;
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

  return (
    <div
      className="fixed top-0 left-0 w-full bg-zinc-950 flex justify-center items-center text-zinc-100 p-0 sm:p-4 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      style={{ height: 'var(--vh, 100%)' }}
    >
      <SettingsModal />

      {/* 모바일 뷰 컨테이너 (최대 너비 480px, 세로로 꽉 찬 형태) */}
      <div className="w-full h-full sm:h-[850px] sm:max-h-[90dvh] mx-auto max-w-md bg-[#0f0f13] sm:rounded-[2.5rem] sm:border-[8px] border-zinc-800 flex flex-col relative overflow-hidden shadow-2xl">

        {/* 상단 헤더 */}
        <header className="h-16 flex items-center justify-between px-5 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10 shrink-0 border-b border-zinc-800/50">
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
                <span className="text-purple-400 shrink-0">#</span>
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
                    <h2 className="truncate">{currentRoom ? getRoomName(currentRoom, user?.id) : '채팅 & 친구 목록'}</h2>
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
                      onClick={(e) => { e.stopPropagation(); setIsAiModelDropdownOpen(!isAiModelDropdownOpen); }}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-medium text-zinc-300 transition-colors border border-zinc-700/50 shrink-0 shadow-sm"
                    >
                      <span className="truncate max-w-[90px]">{AI_MODELS[selectedProvider]?.find(m => m.id === selectedAiModel)?.name || '기본 AI'}</span>
                      <ChevronDown size={10} className="opacity-70" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsAiEnabled(!isAiEnabled); }}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full shadow-sm border transition-all active:scale-95 shrink-0 ${isAiEnabled
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500 font-medium'
                        }`}
                    >
                      {isAiEnabled ? 'AI 🟢' : 'AI 🔘'}
                    </button>
                    {isAiModelDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1.5 w-40 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                        {AI_MODELS[selectedProvider]?.map(model => (
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
                    onClick={(e) => { e.stopPropagation(); setIsAiModelDropdownOpen(!isAiModelDropdownOpen); }}
                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold text-zinc-300 transition-colors border border-zinc-700/50 shrink-0 shadow-sm"
                  >
                    <span className="truncate max-w-[100px]">{AI_MODELS[selectedProvider]?.find(m => m.id === selectedAiModel)?.name || '기본 AI'}</span>
                    <ChevronDown size={12} className="opacity-70" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsAiEnabled(!isAiEnabled); }}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs shadow-sm border transition-all active:scale-95 shrink-0 ${isAiEnabled
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500 font-semibold'
                      }`}
                  >
                    {isAiEnabled ? 'AI 🟢' : 'AI 🔘'}
                  </button>
                  {isAiModelDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-44 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                      {AI_MODELS[selectedProvider]?.map(model => (
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
            <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 shrink-0 z-0 relative">
              <div className="flex flex-col gap-6 w-full items-center">
                {/* 탭 전환 상태 인디케이터 배지 (동적 위치) */}
                <div
                  className="absolute left-0 w-1 bg-purple-500 rounded-r-lg transition-all duration-300 ease-in-out"
                  style={{
                    height: '24px',
                    top: currentTab === 'chats' ? '32px' : '96px' // 6 * 4 (py-6) + 8 = 32px (첫번 요소 초기위치 얼추 매칭), 차이 64px 계산
                  }}
                />

                {/* 채팅 목록 탭 */}
                <button
                  onClick={() => setCurrentTab('chats')}
                  className={`relative p-3 rounded-2xl transition-all ${currentTab === 'chats' ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                  title="채팅 목록"
                >
                  <MessageSquare size={24} strokeWidth={currentTab === 'chats' ? 2.5 : 2} />
                  {/* 새 메시지 알림용 배지(Red Dot) */}
                  {Object.values(unreadCounts).some(count => count > 0) && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-900"></span>}
                </button>

                {/* 친구 목록 탭 */}
                <button
                  onClick={() => setCurrentTab('friends')}
                  className={`p-3 rounded-2xl transition-all ${currentTab === 'friends' ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                  title="친구 목록"
                >
                  <User size={24} strokeWidth={currentTab === 'friends' ? 2.5 : 2} />
                </button>
              </div>

              {/* LNB 하단 내 프로필 (설정/로그아웃 버튼 제거됨) */}
              <div className="flex flex-col items-center gap-3 mt-auto w-full pb-4">
                <div
                  className="w-10 h-10 rounded-full bg-zinc-800 shadow-sm border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold mt-2 cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all overflow-hidden"
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
            <div className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto">

              {currentTab === 'chats' && (
                <div className="p-4 space-y-4">
                  <div className="px-2 pt-2">
                    <h3 className="text-zinc-100 text-lg font-bold">채팅</h3>
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
                            setCurrentRoom({ id: room.id, name: room.name, isHost: !!myMemberInfo?.isHost, members: room.members });
                            chatStore.joinRoom(room.id);

                            // 방 입장 시 해당 방의 안읽은 메시지 수 초기화
                            setUnreadCounts(prev => ({ ...prev, [room.id]: 0 }));
                          }}
                          role="button"
                          tabIndex={0}
                          className="w-full flex items-center justify-between p-3.5 bg-zinc-900/50 hover:bg-zinc-900 rounded-2xl transition-colors text-left group border border-transparent hover:border-zinc-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="relative w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
                              <MessageSquare size={20} />
                              {unreadCounts[room.id] > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 border-2 border-zinc-500 text-white text-[10px] sm:text-xs font-bold leading-none min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full z-10 shadow-lg">
                                  {unreadCounts[room.id] > 99 ? '99+' : unreadCounts[room.id]}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="font-semibold text-[15px] text-zinc-100 truncate">
                                {getRoomName(room, user?.id)}
                              </div>
                              <div className="text-[13px] text-zinc-500 truncate mt-0.5 flex items-center gap-1.5 hidden sm:flex">
                                <Users size={12} /> 참여자 {room.members.length}명
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleLeaveRoom(room.id, e)}
                            className="text-xs font-semibold bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 px-3 py-1.5 rounded-xl transition-colors shrink-0"
                          >
                            나가기
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {currentTab === 'friends' && (
                <div className="p-4 space-y-4">
                  {/* 최상단 내 프로필 카드 영역 */}
                  <div
                    onClick={() => setIsProfileModalOpen(true)}
                    className="p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl cursor-pointer transition-colors flex items-center gap-4 group"
                  >
                    <div className="w-14 h-14 rounded-full bg-zinc-800 border-2 border-zinc-700 group-hover:border-indigo-500/50 flex items-center justify-center text-zinc-300 font-bold overflow-hidden shadow-sm text-xl shrink-0 transition-colors">
                      {myProfile?.avatar_url ? (
                        <img src={myProfile.avatar_url} alt="My Profile" className="w-full h-full object-cover" />
                      ) : (
                        myProfile?.username?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-bold text-zinc-100 text-lg truncate whitespace-nowrap">{myProfile?.username || user.username}</h3>
                      <p className="text-sm text-zinc-400 truncate mt-0.5">
                        {myProfile?.statusMessage || '상태메시지를 입력해주세요.'}
                      </p>
                    </div>
                  </div>

                  {/* 친구 리스트 헤더 */}
                  <div className="px-2 pt-4 flex items-center justify-between">
                    <h3 className="text-zinc-100 text-lg font-bold">친구 <span className="text-sm font-medium text-zinc-500 ml-1">{friends.length}</span></h3>
                    <button
                      onClick={() => setIsAddFriendModalOpen(true)}
                      className="text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
                    >
                      <UserPlus size={14} /> 추가
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
                        <div key={friend.id} className="relative flex items-center justify-between p-3 hover:bg-zinc-900/50 rounded-2xl transition-colors group">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-medium shadow-sm overflow-hidden text-[15px]">
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt={friend.username} className="w-full h-full object-cover" />
                              ) : (
                                friend.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-medium text-[15px] text-zinc-200">{friend.username}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleCreateRoom(friend.id)}
                              className="text-xs font-semibold bg-purple-600/90 hover:bg-purple-500 text-white px-3 py-1.5 rounded-xl transition-colors shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                            >
                              <MessageSquare size={14} className="shrink-0" /> 대화
                            </button>

                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFriendMenuId(activeFriendMenuId === friend.id ? null : friend.id);
                                }}
                                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeFriendMenuId === friend.id && (
                                <div className="absolute right-0 top-full mt-1.5 w-28 bg-zinc-800 border border-zinc-700/50 rounded-xl overflow-hidden shadow-lg z-10 animate-in fade-in zoom-in duration-100">
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

            </div>
          </div>
        ) : (
          // 선택된 채팅방 뷰
          <>
            <div
              className="flex-1 overflow-y-auto p-4 space-y-5 flex flex-col relative"
              ref={messagesContainerRef}
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                setShowScrollBottomBtn(scrollHeight - scrollTop - clientHeight > 150);
              }}
              onClick={() => { setSelectedMemberId(null); setIsAiModelDropdownOpen(false); }}
            >
              <div className="flex justify-center mb-4 mt-2">
                <div className="bg-zinc-800/60 px-4 py-1.5 rounded-full text-xs text-zinc-400 border border-zinc-700/50 text-center">
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
                    <div className="flex justify-center my-4 w-full">
                      <div className="bg-zinc-800/60 px-4 py-1.5 rounded-full text-[12px] text-zinc-400 border border-zinc-700/50 shadow-sm flex items-center gap-1.5 backdrop-blur-sm z-10 font-medium tracking-wide">
                        <Calendar size={13} className="opacity-70" />
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

                    // 일반 텍스트의 NORMAL은 배지를 숨기지만, 이미지 첨부의 NORMAL은 안전하다는 뜻으로 표시!
                    if (cat === 'NORMAL' && msg.messageType !== 'IMAGE') {
                      // 아무것도 표시하지 않음
                    } else if (cat || isFakeOld !== undefined) {
                      let config = { icon: '🤖', color: 'text-zinc-400', bg: 'bg-zinc-800' };
                      if (cat === 'FAKE' || isFakeOld === true) config = { icon: '🚨', color: 'text-rose-400', bg: 'bg-rose-500/20' };
                      else if (cat === 'AI_GENERATED') config = { icon: '🤖', color: 'text-purple-400', bg: 'bg-purple-500/20' };
                      else if (cat === 'SUSPICIOUS') config = { icon: '⚠️', color: 'text-amber-400', bg: 'bg-amber-500/20' };
                      else if (cat === 'VERIFIED' || isFakeOld === false || cat === 'NORMAL') config = { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };

                      const reasonText = msg.aiAnalysis.reason || (cat === 'NORMAL' && msg.messageType === 'IMAGE' ? '안전한 이미지 (조작 흔적/위험요소 없음)' : '특이사항 없음');

                      aiTag = (
                        <div
                          className={`mt-1.5 flex items-center justify-center gap-0.5 text-[12px] font-medium px-2 py-0.5 rounded-full cursor-pointer w-fit transition-colors hover:brightness-110 shadow-sm ${config.color} ${config.bg} border border-white/5 active:scale-95`}
                          title={`${reasonText} (${Math.round(msg.aiAnalysis.confidence * 100)}%)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            alert(`[AI 팩트체크 실시간 분석]\n\n판정 이유: ${reasonText}\nAI 확신도: ${Math.round(msg.aiAnalysis.confidence * 100)}%`);
                          }}
                        >
                          <span className="-ml-0.5 drop-shadow-md">{config.icon}</span>
                          <span className="opacity-80 flex items-center justify-center w-3.5 h-3.5 text-[10px] rounded-full bg-black/30 font-bold ml-1 font-mono">(?)</span>
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
                        <div className="flex justify-end gap-2 w-full">
                          <div className="flex flex-col items-end max-w-[75%]">
                            <div className="bg-purple-600 text-white p-3.5 rounded-2xl rounded-tr-sm text-[15px] shadow-md shadow-purple-900/20 leading-relaxed font-normal break-words whitespace-pre-wrap">
                              {msg.content}
                              {attachmentBlock}
                            </div>
                            {aiTag && <div className="mt-1 flex justify-end">{aiTag}</div>}
                            <div className="flex items-end justify-end mt-1 mr-1.5 gap-0.5">
                              {readBadge}
                              <span className="text-[10px] text-zinc-500">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 w-full">
                          <div className="w-9 h-9 rounded-2xl bg-amber-600 flex items-center justify-center text-sm font-medium shrink-0 shadow-sm">
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col max-w-[75%]">
                            <span className="text-[11px] text-zinc-400 mb-1 ml-1.5 font-medium">{msg.senderName}</span>
                            <div className="bg-zinc-800 text-zinc-100 p-3.5 rounded-2xl rounded-tl-sm text-[15px] border border-zinc-700/50 shadow-sm leading-relaxed break-words whitespace-pre-wrap">
                              {msg.content}
                              {attachmentBlock}
                            </div>
                            {aiTag && <div className="mt-1 flex justify-start">{aiTag}</div>}
                            <div className="flex items-end justify-start mt-1 ml-1.5 gap-0.5">
                              <span className="text-[10px] text-zinc-500">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
            <div className="p-3 bg-zinc-900 border-t border-zinc-800/80 shrink-0 pb-safe relative z-20">
              {isUploading && (
                <div className="absolute inset-x-0 -top-12 z-10 flex justify-center pointer-events-none">
                  <div className="flex items-center gap-2 bg-zinc-800/90 py-1.5 px-4 rounded-full border border-zinc-700/50 text-emerald-400 font-medium text-sm shadow-xl animate-in slide-in-from-bottom-2 fade-in">
                    <Loader2 size={16} className="animate-spin" /> 사진/파일 전송 및 분석 중...
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAiProcessing}
                  className="w-[46px] h-[46px] rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Paperclip size={20} />
                </button>
                <div className={`flex-1 bg-zinc-800 border ${isAiProcessing ? 'border-purple-500/50' : 'border-zinc-700'} rounded-2xl overflow-hidden focus-within:ring-1 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all shadow-inner`}>
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
                    disabled={isAiProcessing}
                    placeholder={isAiProcessing ? "AI 분석 중..." : "메시지 입력..."}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    className="w-full bg-transparent text-zinc-100 px-4 py-3 outline-none resize-none max-h-24 placeholder-zinc-500 text-[15px] disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputText.trim() || isAiProcessing}
                  className={`w-[46px] h-[46px] rounded-full flex items-center justify-center transition-colors shrink-0 shadow-lg active:scale-95 disabled:cursor-not-allowed
                    ${inputText.trim() && !isAiProcessing ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30' : 'bg-zinc-800 text-zinc-600 shadow-none'}`}
                >
                  {isAiProcessing ? <Loader2 size={18} className="animate-spin text-purple-400" /> : <Send size={18} className="ml-0.5" />}
                </button>
              </form>
            </div>

            {/* 참가자 목록 사이드서랍 (Drawer) */}
            {isDrawerOpen && (
              <div className="absolute inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => { setIsDrawerOpen(false); setSelectedMemberId(null); }}>
                <div
                  className="w-64 h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col p-4 animate-in slide-in-from-right-full duration-300"
                  onClick={(e) => { e.stopPropagation(); setSelectedMemberId(null); }} // 드로어 내부 클릭 시 열린 메뉴 닫기
                >
                  <div className="flex justify-between items-start pb-4 border-b border-zinc-800/80 mb-4">
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
                              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200">
                                {member.user.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-zinc-200">
                                {member.user.username} {isMe && <span className="text-xs text-zinc-500 ml-1">(나)</span>}
                              </span>
                              {member.isHost && <Crown size={14} className="text-yellow-500 ml-0.5" />}
                            </div>
                          </div>

                          {/* 사용자를 클릭했을 때 펼쳐지는 메뉴 영역 (자신 제외) */}
                          {isSelected && !isMe && (
                            <div className="flex justify-end gap-2 px-3 pb-2 pt-1 border-t border-zinc-800/50 mt-1 bg-zinc-800/40">
                              {/* 공통 메뉴: 송금하기 */}
                              <button
                                onClick={(e) => { e.stopPropagation(); promptTransfer(member.userId, member.user.username); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors"
                              >
                                <Coins size={14} /> 송금
                              </button>

                              {/* 방장 전용 메뉴: 권한 인계, 강퇴 */}
                              {currentRoom.isHost && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelegateHost(member.userId); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-md transition-colors"
                                  >
                                    <Crown size={14} /> 방장 양도
                                  </button>
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
        {/* 최상단 친구 추가 모달 (전역 탭뷰 위 표시) */}
        {isAddFriendModalOpen && !currentRoom && (
          <div className="absolute inset-x-0 bottom-0 top-auto h-[85%] bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 z-50 flex flex-col animate-in slide-in-from-bottom shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-zinc-100 text-lg flex items-center gap-2">
                <UserPlus className="text-purple-400" size={20} /> 새로운 친구 추가
              </h4>
              <button 
                onClick={() => {
                  setIsAddFriendModalOpen(false);
                  setAddFriendTab('NORMAL');
                }} 
                className="text-zinc-400 hover:text-white p-1 bg-zinc-800/50 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* 탭 헤더 */}
            <div className="flex bg-zinc-800/50 p-1 rounded-xl mb-6 shrink-0">
              <button 
                onClick={() => setAddFriendTab('NORMAL')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${addFriendTab === 'NORMAL' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-300'}`}
              >
                👤 사람 추가
              </button>
              <button 
                onClick={() => setAddFriendTab('AI')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${addFriendTab === 'AI' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-300'}`}
              >
                🤖 AI 생성
              </button>
            </div>

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
                <form onSubmit={handleCreateAIFriend} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">AI 이름 (표시될 닉네임) <span className="text-red-400">*</span></label>
                    <input type="text" required value={aiNameValue} onChange={e => setAiNameValue(e.target.value)} placeholder="예: 챗봇 매니저" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">MBTI 성격 <span className="text-red-400">*</span></label>
                      <select value={aiMbtiValue} onChange={e => setAiMbtiValue(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors">
                        {['ESTJ','ESTP','ESFJ','ESFP','ENTJ','ENTP','ENFJ','ENFP','ISTJ','ISTP','ISFJ','ISFP','INTJ','INTP','INFJ','INFP'].map(m => <option key={m} value={m}>{m}</option>)}
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
                        <option value="40대 이상">40대 이상</option>
                        <option value="연령 미상">연령 미상</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">말투/성격 <span className="text-red-400">*</span></label>
                      <select value={aiToneValue} onChange={e => setAiToneValue(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors">
                        <option value="발랄하고 친근한 반말">발랄하고 친근한 반말</option>
                        <option value="정중하고 다정한 존댓말">정중하고 다정한 존댓말</option>
                        <option value="시니컬하고 팩트폭력 반말">시니컬하고 팩트폭력 반말</option>
                        <option value="애교 섞인 귀여운 말투">애교 섞인 귀여운 말투</option>
                        <option value="군대식 다나까 말투">군대식 다나까 말투</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5 ml-1">주요 관심사 (선택)</label>
                    <input type="text" value={aiHobbyValue} onChange={e => setAiHobbyValue(e.target.value)} placeholder="예: 게임, IT, 음악, 아이돌 등" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-purple-500 transition-colors" />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!aiNameValue.trim() || isAiCreating}
                    className="w-full mt-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isAiCreating ? <span className="animate-pulse">생성 중...</span> : 'AI 친구 생성 및 등록'}
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
