import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { db, ChatMessage } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface ChatStore {
  socket: Socket | null;
  isConnected: boolean;
  connectSocket: (userId: string) => void;
  disconnectSocket: () => void;
  sendMessage: (receiverId: string, content: string, senderId: string, senderName: string, messageType?: 'TEXT' | 'SYSTEM' | 'IMAGE' | 'FILE' | 'VIDEO', aiAnalysis?: any) => Promise<void>;
  joinRoom: (roomId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  socket: null,
  isConnected: false,

  connectSocket: (userId: string) => {
    if (get().socket) return; // 이미 연결되어 있으면 무시

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
        delete msgToSave.id; // 매우 중요! 로컬 DB PK 충돌 방지
        
        const exists = await db.messages.where('messageId').equals(msgToSave.messageId).first();
        if (exists) {
          console.log('[DEBUG] ⚠️ Message already exists, skipping duplicate:', msgToSave.messageId);
          return;
        }

        await db.messages.add(msgToSave);
        console.log('[DEBUG] 🟢 IndexedDB message stored successfully');
        
        window.dispatchEvent(new CustomEvent('new_chat_message', { detail: msgToSave }));
      } catch (err) {
        console.error('[DEBUG] 🔴 IndexedDB save error:', err);
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
        // [중대 버그 수정] Dexie update()는 PK(++id)를 인자로 받으므로 messageId(UUID)를 넣으면 실패함! where.modify()를 써야함!
        await db.messages.where('messageId').equals(messageId).modify({ aiAnalysis });
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
          receiverId: msg.roomId, // 로컬 DB에서 receiverId는 방 ID 역할
          content: msg.content,
          messageType: msg.messageType,
          createdAt: msg.createdAt,
        }));

        const messageIds = msgsToSave.map(m => m.messageId);
        const existingMessages = await db.messages.where('messageId').anyOf(messageIds).toArray();
        const existingMessageIds = new Set(existingMessages.map(m => m.messageId));
        
        const newMsgs = msgsToSave.filter(m => !existingMessageIds.has(m.messageId));

        if (newMsgs.length > 0) {
          await db.messages.bulkAdd(newMsgs);
          console.log(`[DEBUG] 🟢 IndexedDB synced TTL messages (${newMsgs.length}) for room ${roomId}`);
          // 기존 오프라인 복구 이벤트를 재활용하여 UI 업데이트 트리거
          window.dispatchEvent(new CustomEvent('offline_messages_restored', { detail: newMsgs }));
        }
      } catch (err) {
        console.error('[DEBUG] 🔴 IndexedDB sync save error:', err);
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
        
        const messageIds = msgsToSave.map(m => m.messageId);
        const existingMessages = await db.messages.where('messageId').anyOf(messageIds).toArray();
        const existingMessageIds = new Set(existingMessages.map(m => m.messageId));
        
        const newMsgs = msgsToSave.filter(m => !existingMessageIds.has(m.messageId));

        if (newMsgs.length > 0) {
          await db.messages.bulkAdd(newMsgs);
          console.log(`[DEBUG] 🟢 IndexedDB bulk offline messages stored successfully (${newMsgs.length})`);
          window.dispatchEvent(new CustomEvent('offline_messages_restored', { detail: newMsgs }));
        } else {
          console.log('[DEBUG] ⚠️ Offline messages already exist in DB, skipping');
        }
      } catch (err) {
        console.error('[DEBUG] 🔴 IndexedDB bulk save error:', err);
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

    // 1. 내가 보낸 메시지: 내 로컬 IndexedDB에 즉시 저장 (Optimistic UI)
    await db.messages.add(newMessage);

    // 2. 서버로 릴레이 요청 (No-Log 방식)
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
      
      // 방 접속 시 서버에 7일 보관된 최신 메시지 동기화 요청
      try {
        const msgs = await db.messages.where('receiverId').equals(roomId).toArray();
        const lastSyncTime = msgs.length > 0 ? Math.max(...msgs.map(m => m.createdAt)) : 0;
        socket.emit('sync_messages', { roomId, lastSyncTime });
      } catch (e) {
        socket.emit('sync_messages', { roomId, lastSyncTime: 0 });
      }
    }
  }
}));
