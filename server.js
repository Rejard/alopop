// Copyright (c) 2026 Alonics Inc. (주식회사 알로닉스). All rights reserved.
// Licensed under the AGPL-3.0 License. 
// For commercial use, investment, or partnerships, please contact the author.
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3099;

// Next.js 앱 초기화
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 오프라인 메시지 큐 (메모리(RAM)에 임시 저장, 서버가 꺼지면 증발)
// 구조: Map<receiverId, Array<Message>>
const offlineQueue = new Map();

app.prepare().then(() => {
  const expressApp = express();

  // Web Push 초기화
  const webpush = require('web-push');
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
  if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails('mailto:support@alonics.com', publicVapidKey, privateVapidKey);
  }

  // 푸시 발송용 헬퍼 함수
  async function sendWebPush(targetUserId, messageData) {
    if (!publicVapidKey || !privateVapidKey) return;
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: targetUserId }
      });
      if (!subscriptions || subscriptions.length === 0) return;
      
      const payload = JSON.stringify({
        title: `알로팝 - ${messageData.senderName}님의 새 메시지`,
        body: messageData.content,
        url: `/`
      });

      const pushPromises = subscriptions.map(async (sub) => {
        const pushConf = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        try {
          await webpush.sendNotification(pushConf, payload);
          console.log(`📲 Successfully sent Web Push to ${targetUserId}`);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log(`🗑️ Subscription expired for ${targetUserId}, deleting from DB`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          } else {
            console.error('Web Push Send Error:', err);
          }
        }
      });
      await Promise.all(pushPromises);
    } catch (e) {
      console.error('Failed to send push completely:', e);
    }
  }

  // 런타임 파일(프로필 사진 등) 즉시 제공을 위해 public/uploads 경로를 express static으로 매핑
  expressApp.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

  const httpServer = createServer(expressApp);
  
  // Socket.io 인스턴스 생성
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // 개발용 편의 설정
      methods: ['GET', 'POST']
    }
  });

  const SERVER_START_TIME = Date.now().toString();

  // Socket.io 통신 처리
  io.on('connection', (socket) => {
    console.log('🔗 User connected:', socket.id);
    socket.emit('server_version', SERVER_START_TIME);
    
    // 1. 유저 인증 완료 시, 자신의 ID로 된 방(room)에 조인 (개인 DM 또는 알림 수신용)
    socket.on('register', (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} registered and joined their personal room`);

      // 접속 시 오프라인 큐에 보관된 메시지가 있다면 즉시 쏟아냄 (그리고 삭제)
      if (offlineQueue.has(userId)) {
        const messages = offlineQueue.get(userId);
        if (messages.length > 0) {
          socket.emit('receive_offline_messages', messages);
          console.log(`📬 Emitted ${messages.length} offline messages to ${userId}`);
        }
        offlineQueue.delete(userId);
      }
    });

    // 2. 다중 채팅방(Room) 입장 처리
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`🚪 Socket ${socket.id} joined room ${roomId}`);
    });

    // 3. 채팅방 이름 실시간 변경 브로드캐스트
    socket.on('update_room_name', (payload) => {
      console.log(`[DEBUG] 🏷️ Room name updated:`, payload);
      // 자신을 포함하여 방에 있는 모든 사람에게 발송 (send_message는 자신 제외지만 이름 변경은 모두가 봐야함)
      io.to(payload.roomId).emit('room_name_updated', payload);
    });

    // 3.1. [신규] 메시지 사후 업데이트 (AI 팩트체크 결과 서버 중계용) 브로드캐스트
    socket.on('update_message', async (payload) => {
      console.log(`[DEBUG] 🔄 Message updated by sponsor (Fact-check):`, payload.messageId);
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        const room = await prisma.room.findUnique({
          where: { id: payload.roomId },
          include: { members: true }
        });

        if (room && room.members) {
          room.members.forEach((member) => {
            const targetId = member.userId;
            // 해당 멤버가 접속 중인지 확인 후, 룸 ID가 아닌 사용자 개인 고유 채널로 다이렉트 전송!
            const roomSet = io.sockets.adapter.rooms.get(targetId);
            if (roomSet && roomSet.size > 0 && targetId !== socket.userId) {
              io.to(targetId).emit('message_updated', payload);
            }
          });
        }
      } catch (err) {
        console.error('[DEBUG] Failed to relay update_message:', err);
      }
    });

    // 3.5. 휴먼 유저 타이핑 상태 릴레이 (자신을 제외한 방 멤버에게 브로드캐스트)
    socket.on('typing_start', (payload) => {
      socket.to(payload.roomId).emit('typing_start', payload);
    });
    socket.on('typing_end', (payload) => {
      socket.to(payload.roomId).emit('typing_end', payload);
    });

    // 4. No-Log Relay 메시지 전송 로직 (방/개인 공통)
    // 3. No-Log Relay 메시지 전송 로직 (방/개인 공통)
    socket.on('send_message', async (payload) => {
      console.log('[DEBUG] 📥 Server received send_message:', payload);
      const { receiverId, message } = payload;
      
      try {
        // 서버 측에서 Prisma DB를 조회해 해당 방에 속한 멤버들을 가져옵니다.
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        const room = await prisma.room.findUnique({
          where: { id: receiverId },
          include: { members: true }
        });

        // 1. 방을 찾았으면 (방향 메시지) -> 멤버 개개인의 ID를 타겟으로 발송
        if (room && room.members) {
          if (!room.isGroup) {
            // 1:1 방일 경우 나갔던(숨김 처리된) 유저 자동 부활(Re-join) 로직 처리
            const hiddenMembers = room.members.filter(m => m.isHidden && m.userId !== message.senderId);
            for (const hm of hiddenMembers) {
              await prisma.roomMember.update({
                where: { userId_roomId: { userId: hm.userId, roomId: receiverId } },
                data: { isHidden: false }
              });
              console.log(`👻 Unhid member ${hm.userId} in room ${receiverId} (Kakao auto-rejoin)`);
              hm.isHidden = false; // 메모리 상 객체도 갱신하여 바로 발송 대상에 포함
            }
          }

          room.members.forEach((member) => {
            const targetId = member.userId;
            
            // 본인이 보낸 메시지는 로컬에서 이미 처리했으므로 소켓 중복 발송 제외
            if (targetId === message.senderId) return;

            // 해당 유저가 현재 온라인인지(본인 ID로 된 Personal Room에 접속 중인지) 확인
            // v4에서는 in(room).fetchSockets()이나 adapter.rooms.get() 사용
            const roomSet = io.sockets.adapter.rooms.get(targetId);
            
            if (roomSet && roomSet.size > 0) {
              // 온라인이면 해당 멤버의 개인 Room으로 즉시 발송하되, 타임아웃/ACK 적용
              io.to(targetId).timeout(3000).emit('receive_message', message, (err, responses) => {
                if (err || !responses || Object.keys(responses).length === 0) {
                  console.log(`⚠️ ACK Timeout/Error for ${targetId}, pushing to offlineQueue`);
                  if (!offlineQueue.has(targetId)) {
                    offlineQueue.set(targetId, []);
                  }
                  offlineQueue.get(targetId).push(message);
                  sendWebPush(targetId, message);
                } else {
                  console.log(`✅ ACK Received from ${targetId} (in room ${receiverId})`);
                }
              });
            } else {
              // 오프라인이면 큐에 저장
              if (!offlineQueue.has(targetId)) {
                offlineQueue.set(targetId, []);
              }
              offlineQueue.get(targetId).push(message);
              console.log(`📥 Paused message for offline member ${targetId} (Queue size: ${offlineQueue.get(targetId).length})`);
              
              // 앱이 완전히 종료되었거나 백그라운드인 경우 푸시 알림 트리거
              sendWebPush(targetId, message);
            }
          });
        } else {
          // 2. 방이 아니라면 (1:1 개인톡 단일 타겟팅인 경우)
          if (receiverId === message.senderId) return;

          const roomSet = io.sockets.adapter.rooms.get(receiverId);
          if (roomSet && roomSet.size > 0) {
            io.to(receiverId).timeout(3000).emit('receive_message', message, (err, responses) => {
              if (err || !responses || Object.keys(responses).length === 0) {
                console.log(`⚠️ ACK Timeout/Error for ${receiverId}, pushing to offlineQueue`);
                if (!offlineQueue.has(receiverId)) {
                  offlineQueue.set(receiverId, []);
                }
                offlineQueue.get(receiverId).push(message);
                sendWebPush(receiverId, message);
              } else {
                console.log(`✅ ACK Received directly from ${receiverId}`);
              }
            });
          } else {
            if (!offlineQueue.has(receiverId)) {
              offlineQueue.set(receiverId, []);
            }
            offlineQueue.get(receiverId).push(message);
            console.log(`📥 Paused message for offline destination ${receiverId} (Queue size: ${offlineQueue.get(receiverId).length})`);
            sendWebPush(receiverId, message);
          }
        }
      } catch (err) {
        console.error('Error handling send_message routing:', err);
      }
    });

    socket.on('read_receipt', async (payload) => {
      const { roomId, userId, timestamp } = payload;
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          include: { members: true }
        });
        
        if (room && room.members) {
           room.members.forEach(member => {
             const targetId = member.userId;
             if (targetId === userId) return; // 나 자신 제외
             const roomSet = io.sockets.adapter.rooms.get(targetId);
             if (roomSet && roomSet.size > 0) {
               socket.to(targetId).emit('room_read_update', { roomId, userId, timestamp });
               console.log(`👁️ Relayed read_receipt to ${targetId} for room ${roomId}`);
             }
           });
        }
      } catch (err) {
        console.error('read_receipt error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔴 User disconnected:', socket.id);
    });
  });

  // Next.js 로우레벨 라우팅 처리 (Express v5 이상 호환)
  expressApp.use((req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 🚀 Ready on http://${hostname}:${port}`);
    console.log('> 🛡️ Custom Express Server with Socket.io running (No-Log Mode)');
  });
});
