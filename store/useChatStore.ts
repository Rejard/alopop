import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface ChatStore {
  socket: Socket | null;
  isConnected: boolean;
  roomMessages: Record<string, ChatMessage[]>;
  fetchRoomMessages: (roomId: string) => Promise<void>;
  addLocalMessage: (roomId: string, msg: ChatMessage) => void;
  updateMessageAnalysis: (messageId: string, aiAnalysis: any) => void;
  clearRoomMessages: (roomId: string) => void;
  connectSocket: (userId: string) => void;
  disconnectSocket: () => void;
  sendMessage: (receiverId: string, content: string, senderId: string, senderName: string, messageType?: 'TEXT' | 'SYSTEM' | 'IMAGE' | 'FILE' | 'VIDEO', aiAnalysis?: any) => Promise<void>;
  joinRoom: (roomId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  socket: null,
  isConnected: false,
  roomMessages: {},

  fetchRoomMessages: async (roomId) => {
    try {
      const res = await fetch(`/api/messages?roomId=${roomId}&limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      set(state => ({
        roomMessages: { ...state.roomMessages, [roomId]: data.messages }
      }));
    } catch (err) {
      console.warn('[Chat] Failed to fetch messages:', err);
    }
  },

  addLocalMessage: (roomId, msg) => {
    set(state => {
      const existing = state.roomMessages[roomId] || [];
      if (existing.some(m => m.messageId === msg.messageId)) return state;
      return { roomMessages: { ...state.roomMessages, [roomId]: [...existing, msg] } };
    });
  },

  updateMessageAnalysis: (messageId, aiAnalysis) => {
    set(state => {
      const updated = { ...state.roomMessages };
      for (const roomId of Object.keys(updated)) {
        updated[roomId] = updated[roomId].map(m =>
          m.messageId === messageId ? { ...m, aiAnalysis } : m
        );
      }
      return { roomMessages: updated };
    });
  },

  clearRoomMessages: (roomId) => {
    set(state => {
      const updated = { ...state.roomMessages };
      delete updated[roomId];
      return { roomMessages: updated };
    });
  },

  connectSocket: (userId: string) => {
    const existingSocket = get().socket;
    if (existingSocket) {
      if (existingSocket.disconnected) {
        console.log('[DEBUG] Socket instance exists but disconnected, connecting...');
        existingSocket.connect();
      }
      return;
    }

    // 서버와 같은 Origin으로 소켓 연결 (현재 window.location)
    const socket = io(undefined, {
      path: '/socket.io/',
      // transports: ['websocket'], // 모바일 환경(LTE/5G)에서 접속 끊김(Disconnected) 후 PWA에서 영구적으로 소켓 릴레이 큐가 막히는 증상을 막기 위해 기본값(polling -> websocket 승격)으로 원복
    });

    socket.on('connect', () => {
      console.log('[DEBUG] ✅ Socket.io connected! ID:', socket.id);
      set({ isConnected: true });
      
      // 내 ID로 등록(Register)하여 고유 방(room) 생성 및 오프라인 메시지 수신
      socket.emit('register', userId);
    });

    socket.on('disconnect', (reason) => {
      console.log('[DEBUG] ❌ Socket.io disconnected! Reason:', reason);
      set({ isConnected: false });
    });
    
    socket.on('connect_error', (error) => {
      console.error('[DEBUG] ⚠️ Socket.io connect_error:', error);
    });

    socket.on('server_version', async (version: string) => {
      const currentVersion = sessionStorage.getItem('alo_server_version');
      if (currentVersion && currentVersion !== version) {
        console.log('[DEBUG] 🔄 Server version changed! Clearing caches and auto-refreshing...');
        // 무한루프 방지를 위해 새로고침 전 미리 버전 갱신
        sessionStorage.setItem('alo_server_version', version);
        // PWA 브라우저 캐시를 모두 비워서 강력한 새로고침 보장
        if ('caches' in window) {
          try {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));
          } catch (e) {
            console.error('Cache clear error:', e);
          }
        }
        window.location.reload();
      } else {
        sessionStorage.setItem('alo_server_version', version);
      }
    });

    // 일반 메시지 실시간 수신 이벤트
    socket.on('receive_message', async (message: ChatMessage, callback?: (res: any) => void) => {
      console.log('[DEBUG] 🔵 Socket.io received message:', message);
      if (callback) callback({ status: 'ok' }); // 즉시 서버로 수신(ACK) 응답
      
      try {
        const msgToSave = { ...message } as any;
        delete msgToSave.id; // PK 충돌 방지

        const roomId = msgToSave.receiverId || 'global';
        get().addLocalMessage(roomId, msgToSave);
        console.log('[DEBUG] 🟢 Message stored in Zustand state');
        
        window.dispatchEvent(new CustomEvent('new_chat_message', { detail: msgToSave }));
      } catch (err) {
        console.error('[DEBUG] 🔴 Message save error:', err);
      }
    });

    socket.on('room_read_update', (payload) => {
      window.dispatchEvent(new CustomEvent('room_read_update', { detail: payload }));
    });

    socket.on('room_presence_update', (payload) => {
      window.dispatchEvent(new CustomEvent('room_presence_update', { detail: payload }));
    });

    socket.on('room_name_updated', (payload) => {
      window.dispatchEvent(new CustomEvent('room_name_updated', { detail: payload }));
    });

    // [신규] 사후 메시지 업데이트 정보 수신부 (방장이 대리 연산해준 팩트체크 결과 수신)
    socket.on('message_updated', async (payload) => {
      const { messageId, aiAnalysis } = payload;
      try {
        get().updateMessageAnalysis(messageId, aiAnalysis);
        window.dispatchEvent(new CustomEvent('message_updated', { detail: payload }));
      } catch (e) {
        console.error('[DEBUG] Failed to sync message update:', e);
      }
    });

    socket.on('typing_start', (payload) => {
      window.dispatchEvent(new CustomEvent('typing_start', { detail: payload }));
    });

    socket.on('typing_end', (payload) => {
      window.dispatchEvent(new CustomEvent('typing_end', { detail: payload }));
    });

    socket.on('vibe_coding_start', (payload) => {
      window.dispatchEvent(new CustomEvent('vibe_coding_start', { detail: payload }));
    });

    socket.on('vibe_coding_end', (payload) => {
      window.dispatchEvent(new CustomEvent('vibe_coding_end', { detail: payload }));
    });

    socket.on('sponsor_settings_changed', (payload) => {
      window.dispatchEvent(new CustomEvent('sponsor_settings_changed', { detail: payload }));
    });

    // ---- OpenClaw Bridge Events ----
    socket.on('claw_canvas_update', (payload) => {
      window.dispatchEvent(new CustomEvent('claw_canvas_update', { detail: payload }));
    });

    socket.on('claw_message_update', (payload) => {
      window.dispatchEvent(new CustomEvent('claw_message_update', { detail: payload }));
    });

    socket.on('claw_log_update', (payload) => {
      window.dispatchEvent(new CustomEvent('claw_log_update', { detail: payload }));
    });

    // 7일(TTL) 메시지 동기화 수신 (방 접속 시)
    socket.on('sync_messages_result', async (payload: { roomId: string, messages: any[] }) => {
      const { roomId, messages } = payload;
      if (!messages || messages.length === 0) return;
      try {
        const msgsToSave = messages.map(msg => ({
          messageId: msg.messageId,
          senderId: msg.senderId,
          senderName: 'Unknown', // UI에서 ID 기반으로 매핑
          receiverId: msg.roomId, // receiverId는 방 ID 역할
          content: msg.content,
          messageType: msg.messageType,
          createdAt: msg.createdAt,
        }));

        const existing = get().roomMessages[roomId] || [];
        const existingIds = new Set(existing.map(m => m.messageId));
        const newMsgs = msgsToSave.filter(m => !existingIds.has(m.messageId));

        if (newMsgs.length > 0) {
          set(state => ({
            roomMessages: {
              ...state.roomMessages,
              [roomId]: [...(state.roomMessages[roomId] || []), ...newMsgs].sort((a, b) => a.createdAt - b.createdAt)
            }
          }));
          console.log(`[DEBUG] 🟢 Synced TTL messages (${newMsgs.length}) for room ${roomId}`);
          // 기존 오프라인 복구 이벤트를 재활용하여 UI 업데이트 트리거
          window.dispatchEvent(new CustomEvent('offline_messages_restored', { detail: newMsgs }));
        }
      } catch (err) {
        console.error('[DEBUG] 🔴 Sync save error:', err);
      }
    });

    // 오프라인 상태에서 밀린 큐 메시지 뭉치 수신 이벤트
    socket.on('offline_activity_summary', (summary: { rooms: Array<{ roomId: string; count: number; latestAt: number }> }) => {
      window.dispatchEvent(new CustomEvent('offline_activity_summary', { detail: summary }));
    });

    socket.on('receive_offline_messages', async ({ messages }: { messages: ChatMessage[] }) => {
      console.log(`[DEBUG] 🔵 Socket.io received offline messages: ${messages.length}`);
      if (!messages || messages.length === 0) return;

      try {
        const msgsToSave = messages.map(msg => {
          const newMsg = { ...msg } as any;
          delete newMsg.id;
          return newMsg;
        });

        const roomGroups: Record<string, ChatMessage[]> = {};
        msgsToSave.forEach(m => {
          const rid = m.receiverId || 'global';
          if (!roomGroups[rid]) roomGroups[rid] = [];
          roomGroups[rid].push(m);
        });

        let totalNew = 0;
        const allNewMsgs: ChatMessage[] = [];
        set(state => {
          const updated = { ...state.roomMessages };
          for (const [rid, msgs] of Object.entries(roomGroups)) {
            const existing = updated[rid] || [];
            const existingIds = new Set(existing.map(m => m.messageId));
            const newOnes = msgs.filter(m => !existingIds.has(m.messageId));
            if (newOnes.length > 0) {
              updated[rid] = [...existing, ...newOnes].sort((a, b) => a.createdAt - b.createdAt);
              totalNew += newOnes.length;
              allNewMsgs.push(...newOnes);
            }
          }
          return { roomMessages: updated };
        });

        if (totalNew > 0) {
          console.log(`[DEBUG] 🟢 Bulk offline messages stored successfully (${totalNew})`);
          window.dispatchEvent(new CustomEvent('offline_messages_restored', { detail: allNewMsgs }));
        } else {
          console.log('[DEBUG] ⚠️ Offline messages already exist, skipping');
        }
      } catch (err) {
        console.error('[DEBUG] 🔴 Bulk save error:', err);
      }
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  sendMessage: async (receiverId, content, senderId, senderName, messageType = 'TEXT', aiAnalysis?: any) => {
    const { socket } = get();
    if (!socket) return;

    const newMessage: ChatMessage = {
      messageId: uuidv4(),
      senderId,
      senderName,
      receiverId,
      content,
      messageType,
      createdAt: Date.now(),
      ...(aiAnalysis && { aiAnalysis })
    };

    // Optimistic UI: Zustand 상태에 즉시 추가
    get().addLocalMessage(receiverId, newMessage);

    // 서버로 릴레이 요청 (No-Log 방식)
    // receiverId가 "global"일 경우, 커스텀 서버 로직 확장을 통해 브로드캐스트 가능성을 열어둠
    socket.emit('send_message', {
      receiverId,
      message: newMessage
    });
  },

  joinRoom: async (roomId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('join_room', roomId);

      // 방 접속 시 서버 API에서 메시지 히스토리 fetch
      await get().fetchRoomMessages(roomId);

      // 서버에 7일 보관된 최신 메시지 동기화 요청
      const msgs = get().roomMessages[roomId] || [];
      const lastSyncTime = msgs.length > 0 ? Math.max(...msgs.map(m => m.createdAt)) : 0;
      socket.emit('sync_messages', { roomId, lastSyncTime });
    }
  }
}));
