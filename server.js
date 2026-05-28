// Copyright (c) 2026 Alonics Inc. (二쇱떇?뚯궗 ?뚮줈?됱뒪). All rights reserved.
// Licensed under the AGPL-3.0 License. 
// For commercial use, investment, or partnerships, please contact the author.
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');
const { loadEnvConfig } = require('@next/env');


loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3099;
const internalApiSecret = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || (dev ? 'ALO_POP_INTERNAL_SECRET_DEFAULT' : '');
if (!internalApiSecret) {
  console.error('INTERNAL_API_SECRET, SESSION_SECRET, or ENCRYPTION_KEY must be set for sponsor background checks.');
}
const SESSION_COOKIE_NAME = 'alo_session';

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET or ENCRYPTION_KEY must be set in production');
  }
  return secret || 'ALO_POP_SESSION_SECRET_DEFAULT';
}

function parseCookieHeader(cookieHeader) {
  const cookies = new Map();
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const [rawName, ...rawValue] = pair.trim().split('=');
    if (!rawName || rawValue.length === 0) return;
    cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
  });
  return cookies;
}

function signSessionPayload(encodedPayload) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
}

function verifySessionToken(token) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signSessionPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.userId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Next.js ??珥덇린??
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ?ㅽ봽?쇱씤 硫붿떆吏 ?곹깭 愿由? 硫붾え由?RAM) ?섏〈 ?쒓굅
// ?댁젣遺??offlineQueue(Map) ???Prisma DB(OfflineMessage)瑜??ъ슜?섏뿬 OOM(硫붾え由??꾩닔)瑜??꾨꼍??諛⑹??⑸땲??
const roomPresence = new Map();
const OFFLINE_NOTICE_TTL_MS = Number(process.env.OFFLINE_NOTICE_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;
const WEB_PUSH_TTL_SECONDS = Number(process.env.WEB_PUSH_TTL_SECONDS || 24 * 60 * 60);

app.prepare().then(() => {
  const expressApp = express();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  function createOfflineNotice(message) {
    return JSON.stringify({
      messageId: `offline_notice_${message?.messageId || Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      receiverId: message?.receiverId || null,
      messageType: 'SYSTEM',
      content: '새 메시지가 도착했습니다. 다시 접속해 확인해 주세요.',
      createdAt: message?.createdAt || Date.now(),
      offlineNotice: true,
    });
  }

  function parseOfflineNotice(payload) {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  let offlineQueueColumns = null;

  async function hasEnhancedOfflineQueue() {
    if (offlineQueueColumns) return offlineQueueColumns.has('expiresAt') && offlineQueueColumns.has('status');
    const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info('OfflineMessage')`);
    offlineQueueColumns = new Set(columns.map(column => column.name));
    return offlineQueueColumns.has('expiresAt') && offlineQueueColumns.has('status');
  }

  async function deleteExpiredOfflineMessages() {
    if (await hasEnhancedOfflineQueue()) {
      await prisma.$executeRawUnsafe(
        'DELETE FROM OfflineMessage WHERE expiresAt <= ?',
        new Date().toISOString()
      );
      return;
    }

    await prisma.offlineMessage.deleteMany({
      where: { createdAt: { lte: new Date(Date.now() - OFFLINE_NOTICE_TTL_MS) } }
    });
  }

  async function saveOfflineNotice(receiverId, message) {
    if (!receiverId || !message) return null;
    if (!(await hasEnhancedOfflineQueue())) {
      return prisma.offlineMessage.create({
        data: { receiverId, payload: createOfflineNotice(message) }
      }).catch(e => console.error('Offline notice save err:', e));
    }

    return prisma.$executeRawUnsafe(
      `INSERT INTO OfflineMessage (id, receiverId, kind, status, payload, createdAt, expiresAt, attemptCount)
       VALUES (?, ?, 'NOTICE', 'PENDING', ?, ?, ?, 0)`,
      crypto.randomUUID(),
      receiverId,
      createOfflineNotice(message),
      new Date().toISOString(),
      new Date(Date.now() + OFFLINE_NOTICE_TTL_MS).toISOString()
    ).catch(e => console.error('Offline notice save err:', e));
  }

  async function getAuthenticatedSocketUser(socket) {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const payload = verifySessionToken(cookies.get(SESSION_COOKIE_NAME));
    if (!payload) return null;
    return prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, isAdmin: true }
    });
  }

  async function getRoomWithMembers(roomId) {
    return prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true }
    });
  }

  function isRoomMember(room, userId) {
    return !!room?.members?.some((member) => member.userId === userId && !member.isHidden);
  }

  function isRoomHost(room, userId) {
    return !!room?.members?.some((member) => member.userId === userId && member.isHost);
  }

  function isCurrentDelegate(room, userId) {
    const hostMember = room?.members?.find((member) => member.isHost);
    if (!hostMember) return false;
    const activeUsers = Array.from(roomPresence.get(room.id) || []).sort();
    if (activeUsers.includes(hostMember.userId)) return false;
    return activeUsers[0] === userId;
  }

  async function canSendAs(room, socketUserId, requestedSenderId) {
    if (requestedSenderId === socketUserId) return true;

    const senderUser = await prisma.user.findUnique({
      where: { id: requestedSenderId },
      select: { id: true, isAi: true, aiOwnerId: true }
    });
    if (!senderUser?.isAi) return false;
    if (senderUser.aiOwnerId === socketUserId) return true;

    return !!room?.sponsorMode && isRoomMember(room, requestedSenderId) && (
      isRoomHost(room, socketUserId) || isCurrentDelegate(room, socketUserId)
    );
  }

  async function deliverOfflineMessages(socket) {
    const userId = socket.userId;
    if (!userId) return;
    try {
      await deleteExpiredOfflineMessages();
      const enhancedOfflineQueue = await hasEnhancedOfflineQueue();
      const records = enhancedOfflineQueue
        ? await prisma.$queryRawUnsafe(
          `SELECT id, payload, createdAt
           FROM OfflineMessage
           WHERE receiverId = ? AND status = 'PENDING' AND expiresAt > ?
           ORDER BY createdAt ASC`,
          userId,
          new Date().toISOString()
        )
        : await prisma.offlineMessage.findMany({
          where: {
            receiverId: userId,
            createdAt: { gt: new Date(Date.now() - OFFLINE_NOTICE_TTL_MS) },
          },
          orderBy: { createdAt: 'asc' },
        });
      if (records.length > 0) {
        const rooms = new Map();
        for (const record of records) {
          const notice = parseOfflineNotice(record.payload);
          if (!notice?.receiverId) continue;
          const room = rooms.get(notice.receiverId) || { roomId: notice.receiverId, count: 0, latestAt: 0 };
          room.count += 1;
          room.latestAt = Math.max(room.latestAt, notice.createdAt || new Date(record.createdAt).getTime());
          rooms.set(notice.receiverId, room);
        }

        const summary = Array.from(rooms.values());
        if (summary.length > 0) {
          socket.emit('offline_activity_summary', { rooms: summary });
          console.log(`Emitted offline activity summary for ${summary.length} rooms to ${userId}`);
        }
        
        const ids = records.map(r => r.id);
        if (ids.length > 0 && enhancedOfflineQueue) {
          const placeholders = ids.map(() => '?').join(',');
          await prisma.$executeRawUnsafe(
            `UPDATE OfflineMessage
             SET status = 'DELIVERED', deliveredAt = ?, attemptCount = attemptCount + 1
             WHERE id IN (${placeholders})`,
            new Date().toISOString(),
            ...ids
          );
        } else if (ids.length > 0) {
          await prisma.offlineMessage.deleteMany({
            where: { id: { in: ids } }
          });
        }
      }
    } catch (e) {
      console.error('deliverOfflineMessages error:', e);
    }
  }

  // Web Push 珥덇린??
  const webpush = require('web-push');
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
  if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails('mailto:support@alonics.com', publicVapidKey, privateVapidKey);
  }

  // ?몄떆 諛쒖넚???ы띁 ?⑥닔
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
        title: '?뚮줈??- 새 메시지',
        body: '새 메시지가 도착했습니다.',
        url: `/`
      });

      const pushPromises = subscriptions.map(async (sub) => {
        const pushConf = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        try {
          await webpush.sendNotification(pushConf, payload, {
            TTL: WEB_PUSH_TTL_SECONDS,
            urgency: 'normal',
            topic: `alopop-${targetUserId}`.slice(0, 32),
          });
          console.log(`?벒 Successfully sent Web Push to ${targetUserId}`);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log(`?뿊截?Subscription expired for ${targetUserId}, deleting from DB`);
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

  // ?고????뚯씪(?꾨줈???ъ쭊 ?? 利됱떆 ?쒓났???꾪빐 public/uploads 寃쎈줈瑜?express static?쇰줈 留ㅽ븨
  expressApp.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

  const httpServer = createServer(expressApp);
  
  // Socket.io ?몄뒪?댁뒪 ?앹꽦
  const io = new Server(httpServer, {
    cors: {
      origin: ['https://alopop.alonics.com', 'http://127.0.0.1:3099'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const SERVER_START_TIME = Date.now().toString();

  // Socket.io ?듭떊 泥섎━
  io.on('connection', async (socket) => {
    console.log('?뵕 User connected:', socket.id);
    let socketUser = null;
    const agentToken = socket.handshake.auth?.token;
    
    if (agentToken) {
      socketUser = await prisma.user.findUnique({
        where: { agentToken: agentToken },
        select: { id: true, username: true, isAdmin: true, isAgent: true }
      });
      if (socketUser && socketUser.isAgent) {
        console.log(`?쨼 OpenAlo Agent connected: ${socketUser.id} (${socketUser.username})`);
        socket.isAgent = true;
      } else {
        socketUser = null;
      }
    } else {
      socketUser = await getAuthenticatedSocketUser(socket);
    }

    if (!socketUser) {
      socket.emit('auth_error', { error: 'Unauthorized' });
      socket.disconnect(true);
      return;
    }
    socket.userId = socketUser.id;
    socket.emit('server_version', SERVER_START_TIME);
    
    // 1. ?좎? ?몄쬆 ?꾨즺 ?? ?먯떊??ID濡???諛?room)??議곗씤 (媛쒖씤 DM ?먮뒗 ?뚮┝ ?섏떊??
    socket.on('register', () => {
      socket.userId = socketUser.id;
      socket.join(socket.userId);
      console.log(`User ${socket.userId} registered and joined their personal room`);

      // ?묒냽 ???ㅽ봽?쇱씤 ?먯뿉 蹂닿???硫붿떆吏媛 ?덈떎硫?利됱떆 ?잛븘??(洹몃━怨???젣)
      deliverOfflineMessages(socket);
    });

    // 2. ?ㅼ쨷 梨꾪똿諛?Room) ?낆옣 泥섎━
    socket.on('join_room', async (roomId) => {
      const room = await getRoomWithMembers(roomId);
      if (!isRoomMember(room, socket.userId)) {
        socket.emit('room_join_denied', { roomId, error: 'Forbidden' });
        return;
      }
      socket.join(roomId);
      socket.currentRoom = roomId;
      
      if (!roomPresence.has(roomId)) {
        roomPresence.set(roomId, new Set());
      }
      if (socket.userId) {
        roomPresence.get(roomId).add(socket.userId);
        const activeUsers = Array.from(roomPresence.get(roomId));
        io.to(roomId).emit('room_presence_update', { roomId, activeUsers });
      }
      console.log(`?슞 Socket ${socket.id} (User: ${socket.userId}) joined room ${roomId}`);
    });

    socket.on('leave_room', async (roomId) => {
      socket.leave(roomId);
      socket.currentRoom = null;
      
      if (socket.userId && roomPresence.has(roomId)) {
        try {
          const socketsInRoom = await io.in(roomId).fetchSockets();
          const stillInRoom = socketsInRoom.some(s => {
            const localSocket = io.sockets.sockets.get(s.id);
            return localSocket && localSocket.userId === socket.userId && localSocket.id !== socket.id;
          });
          
          if (!stillInRoom) {
            roomPresence.get(roomId).delete(socket.userId);
            const activeUsers = Array.from(roomPresence.get(roomId));
            io.to(roomId).emit('room_presence_update', { roomId, activeUsers });
          }
        } catch(e) {
          console.error('Presence update error on leave_room', e);
        }
      }
      console.log(`?슞 Socket ${socket.id} (User: ${socket.userId}) left room ${roomId}`);
    });

    // 3. 梨꾪똿諛??대쫫 ?ㅼ떆媛?蹂寃?釉뚮줈?쒖틦?ㅽ듃
    socket.on('update_room_name', async (payload) => {
      const room = await getRoomWithMembers(payload.roomId);
      if (!isRoomMember(room, socket.userId)) return;
      console.log(`[DEBUG] ?뤇截?Room name updated:`, payload);
      // ?먯떊???ы븿?섏뿬 諛⑹뿉 ?덈뒗 紐⑤뱺 ?щ엺?먭쾶 諛쒖넚 (send_message???먯떊 ?쒖쇅吏留??대쫫 蹂寃쎌? 紐⑤몢媛 遊먯빞??
      io.to(payload.roomId).emit('room_name_updated', payload);
    });

    // 3.1. [?좉퇋] 硫붿떆吏 ?ы썑 ?낅뜲?댄듃 (AI ?⑺듃泥댄겕 寃곌낵 ?쒕쾭 以묎퀎?? 釉뚮줈?쒖틦?ㅽ듃
    socket.on('update_message', async (payload) => {
      console.log(`[DEBUG] ?봽 Message updated by sponsor (Fact-check):`, payload.messageId);
      try {
        const room = await getRoomWithMembers(payload.roomId);
        if (!isRoomMember(room, socket.userId)) return;

        if (room && room.members) {
          room.members.forEach((member) => {
            const targetId = member.userId;
            // ?대떦 硫ㅻ쾭媛 ?묒냽 以묒씤吏 ?뺤씤 ?? 猷?ID媛 ?꾨땶 ?ъ슜??媛쒖씤 怨좎쑀 梨꾨꼸濡??ㅼ씠?됲듃 ?꾩넚!
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

    // 3.5. ?대㉫ ?좎? ??댄븨 ?곹깭 由대젅??(?먯떊???쒖쇅??諛?硫ㅻ쾭?먭쾶 釉뚮줈?쒖틦?ㅽ듃)
    socket.on('typing_start', async (payload) => {
      const room = await getRoomWithMembers(payload.roomId);
      if (!isRoomMember(room, socket.userId)) return;
      socket.to(payload.roomId).emit('typing_start', { ...payload, userId: socket.userId });
    });
    socket.on('typing_end', async (payload) => {
      const room = await getRoomWithMembers(payload.roomId);
      if (!isRoomMember(room, socket.userId)) return;
      socket.to(payload.roomId).emit('typing_end', { ...payload, userId: socket.userId });
    });

    socket.on('sponsor_settings_changed', async (payload) => {
      // payload: { roomId: string, sponsorId: string, sponsorPrice: number, sponsorMode: boolean, sponsorModel: string }
      const room = await getRoomWithMembers(payload.roomId);
      if (!isRoomHost(room, socket.userId)) return;
      socket.to(payload.roomId).emit('sponsor_settings_changed', { ...payload, sponsorId: socket.userId });
    });

    // ---- OpenClaw Bridge ?대깽??泥섎━ ----
    socket.on('claw_canvas', (payload) => {
      socket.broadcast.emit('claw_canvas_update', { aiId: socket.userId, data: payload.data });
    });

    socket.on('claw_message', (payload) => {
      socket.broadcast.emit('claw_message_update', { aiId: socket.userId, content: payload.content });
    });

    socket.on('claw_log', (payload) => {
      socket.broadcast.emit('claw_log_update', { aiId: socket.userId, log: payload.log });
    });

    socket.on('claw_task_complete', async (payload) => {
      const { roomId, finalOutput } = payload;
      if (!roomId || !finalOutput) return;
      const aiUserId = socket.userId;
      
      const message = {
        messageId: 'claw_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        senderId: aiUserId,
        receiverId: roomId,
        messageType: 'TEXT',
        content: finalOutput.trim() || "[?묒뾽 ?꾨즺]",
        createdAt: Date.now(),
        unreadCount: 0
      };

      // Turn off the typing indicator now that the response is ready
      io.to(roomId).emit('typing_end', { roomId, userId: aiUserId });

      const room = await getRoomWithMembers(roomId);
      if (room && room.members) {
        room.members.forEach((member) => {
          const targetId = member.userId;
          if (targetId === aiUserId) return;
          const roomSet = io.sockets.adapter.rooms.get(targetId);
          if (roomSet && roomSet.size > 0) {
            io.to(targetId).timeout(3000).emit('receive_message', message, async (err, responses) => {
              if (err || !responses || Object.keys(responses).length === 0) {
                await saveOfflineNotice(targetId, message);
              }
            });
          } else {
            saveOfflineNotice(targetId, message);
          }
        });
      }
    });

    // 4. No-Log Relay 硫붿떆吏 ?꾩넚 濡쒖쭅 (諛?媛쒖씤 怨듯넻)
    // 3. No-Log Relay 硫붿떆吏 ?꾩넚 濡쒖쭅 (諛?媛쒖씤 怨듯넻)
    socket.on('send_message', async (payload) => {
      const { receiverId, message } = payload;
      
      try {
        // ?쒕쾭 痢≪뿉??Prisma DB瑜?議고쉶???대떦 諛⑹뿉 ?랁븳 硫ㅻ쾭?ㅼ쓣 媛?몄샃?덈떎.
        const room = await getRoomWithMembers(receiverId);

        // 1. 諛⑹쓣 李얠븯?쇰㈃ (諛⑺뼢 硫붿떆吏) -> 硫ㅻ쾭 媛쒓컻?몄쓽 ID瑜??寃잛쑝濡?諛쒖넚
        if (room && room.members) {
          if (!isRoomMember(room, socket.userId)) {
            socket.emit('message_denied', { receiverId, error: 'Forbidden' });
            return;
          }

          const requestedSenderId = message?.senderId;
          if (!requestedSenderId || !(await canSendAs(room, socket.userId, requestedSenderId))) {
            socket.emit('message_denied', { receiverId, error: 'Invalid sender' });
            return;
          }
          message.senderId = requestedSenderId;

          if (!room.isGroup) {
            // 1:1 諛⑹씪 寃쎌슦 ?섍컮???④? 泥섎━?? ?좎? ?먮룞 遺??Re-join) 濡쒖쭅 泥섎━
            const hiddenMembers = room.members.filter(m => m.isHidden && m.userId !== message.senderId);
            for (const hm of hiddenMembers) {
              await prisma.roomMember.update({
                where: { userId_roomId: { userId: hm.userId, roomId: receiverId } },
                data: { isHidden: false }
              });
              console.log(`?뫛 Unhid member ${hm.userId} in room ${receiverId} (Kakao auto-rejoin)`);
              hm.isHidden = false; // 硫붾え由???媛앹껜??媛깆떊?섏뿬 諛붾줈 諛쒖넚 ??곸뿉 ?ы븿
            }
          }

          room.members.forEach((member) => {
            const targetId = member.userId;
            
            // 蹂몄씤??蹂대궦 硫붿떆吏??濡쒖뺄?먯꽌 ?대? 泥섎━?덉쑝誘濡??뚯폆 以묐났 諛쒖넚 ?쒖쇅
            if (targetId === message.senderId) return;

            // ?대떦 ?좎?媛 ?꾩옱 ?⑤씪?몄씤吏(蹂몄씤 ID濡???Personal Room???묒냽 以묒씤吏) ?뺤씤
            // v4?먯꽌??in(room).fetchSockets()?대굹 adapter.rooms.get() ?ъ슜
            const roomSet = io.sockets.adapter.rooms.get(targetId);
            
            if (roomSet && roomSet.size > 0) {
              // ?⑤씪?몄씠硫??대떦 硫ㅻ쾭??媛쒖씤 Room?쇰줈 利됱떆 諛쒖넚?섎릺, ??꾩븘??ACK ?곸슜
              io.to(targetId).timeout(3000).emit('receive_message', message, async (err, responses) => {
                if (err || !responses || Object.keys(responses).length === 0) {
                  console.log(`?좑툘 ACK Timeout/Error for ${targetId}, saving to OfflineMessage DB`);
                  await saveOfflineNotice(targetId, message);
                  
                  sendWebPush(targetId, message).catch(console.error); // 鍮꾨룞湲?Fire-and-forget
                } else {
                  console.log(`??ACK Received from ${targetId} (in room ${receiverId})`);
                }
              });
            } else {
              // ?ㅽ봽?쇱씤?대㈃ DB???곴뎄 蹂닿? (?쒕쾭 ?ъ떆???κ린 誘몄젒????硫붾え由??꾩닔 諛⑹?)
              saveOfflineNotice(targetId, message).then(() => {
                console.log(`?뱿 Paused message for offline member ${targetId} into DB`);
              });
              
              // ?깆씠 ?꾩쟾??醫낅즺?섏뿀嫄곕굹 諛깃렇?쇱슫?쒖씤 寃쎌슦 ?몄떆 ?뚮┝ ?몃━嫄?(鍮꾨룞湲?泥섎━濡??쒕쾭 釉붾줈???쒓굅)
              sendWebPush(targetId, message).catch(console.error);
            }
          });

          // [?좉퇋] 100% ?쒕쾭?ъ씠??諛깃렇?쇱슫??AI ?⑺듃泥댄겕 ?由??곗궛 (諛⑹옣??爰쇱졇?덉뼱???숈옉)
          if (room.sponsorMode && message.messageType !== 'SYSTEM') {
            const hostMember = room.members.find(m => m.isHost);
            // 諛쒖넚?먭? 諛⑹옣 蹂몄씤???꾨땲硫??ㅽ룿???곗궛 ?몃━嫄?
            if (hostMember && hostMember.userId !== message.senderId) {
              console.log(`[DEBUG] ?쭬 Triggering Background Server AI check for msg ${message.messageId}`);
              
              fetch(`http://127.0.0.1:${port}/api/chat/sponsor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-alopop-internal': internalApiSecret },
                body: JSON.stringify({ roomId: receiverId, message })
              })
              .then(res => res.json())
              .then(data => {
                if (data.success && data.aiAnalysis) {
                  const updatePayload = {
                    roomId: receiverId,
                    messageId: message.messageId,
                    aiAnalysis: data.aiAnalysis
                  };
                  // AI 泥섎━ 寃곌낵 釉뚮줈?쒖틦?ㅽ듃
                  room.members.forEach((member) => {
                    const targetId = member.userId;
                    const rSet = io.sockets.adapter.rooms.get(targetId);
                    if (rSet && rSet.size > 0 && targetId !== message.senderId) {
                      io.to(targetId).emit('message_updated', updatePayload);
                    }
                  });
                  // 諛쒖떊 ?뱀궗?먯뿉寃뚮룄 寃곌낵 由ы꽩
                  const senderRoom = io.sockets.adapter.rooms.get(message.senderId);
                  if (senderRoom && senderRoom.size > 0) {
                    io.to(message.senderId).emit('message_updated', updatePayload);
                  }
                } else if (data.skipped) {
                  console.log(`[DEBUG] AI check skipped: ${data.reason}`);
                } else {
                  console.error('[DEBUG] AI check failed:', data.error);
                }
              })
              .catch(err => console.error('Background AI POST Error:', err));
            }
          }
        } else {
          // 2. 諛⑹씠 ?꾨땲?쇰㈃ (1:1 媛쒖씤???⑥씪 ?寃잜똿??寃쎌슦)
          if (!message?.senderId || !(await canSendAs(null, socket.userId, message.senderId))) {
            socket.emit('message_denied', { receiverId, error: 'Invalid sender' });
            return;
          }
          if (receiverId === message.senderId) return;

          const roomSet = io.sockets.adapter.rooms.get(receiverId);
          if (roomSet && roomSet.size > 0) {
            io.to(receiverId).timeout(3000).emit('receive_message', message, async (err, responses) => {
              if (err || !responses || Object.keys(responses).length === 0) {
                console.log(`?좑툘 ACK Timeout/Error for ${receiverId}, saving to OfflineMessage DB`);
                await saveOfflineNotice(receiverId, message);
                
                sendWebPush(receiverId, message).catch(console.error);
              } else {
                console.log(`??ACK Received directly from ${receiverId}`);
              }
            });
          } else {
            saveOfflineNotice(receiverId, message).then(() => {
              console.log(`?뱿 Paused message for offline destination ${receiverId} into DB`);
            });
            
            sendWebPush(receiverId, message).catch(console.error);
          }
        }
      } catch (err) {
        console.error('Error handling send_message routing:', err);
      }
    });

    socket.on('read_receipt', async (payload) => {
      const { roomId, timestamp } = payload;
      const userId = socket.userId;
      try {
        const room = await getRoomWithMembers(roomId);
        if (!isRoomMember(room, socket.userId)) return;
        
        if (room && room.members) {
           room.members.forEach(member => {
             const targetId = member.userId;
             if (targetId === userId) return; // ???먯떊 ?쒖쇅
             const roomSet = io.sockets.adapter.rooms.get(targetId);
             if (roomSet && roomSet.size > 0) {
               socket.to(targetId).emit('room_read_update', { roomId, userId, timestamp });
               console.log(`?몓截?Relayed read_receipt to ${targetId} for room ${roomId}`);
             }
           });
        }
      } catch (err) {
        console.error('read_receipt error:', err);
      }
    });

    socket.on('disconnect', async () => {
      console.log('?뵶 User disconnected:', socket.id, socket.userId);
      if (socket.currentRoom && socket.userId && roomPresence.has(socket.currentRoom)) {
        const rId = socket.currentRoom;
        try {
          const socketsInRoom = await io.in(rId).fetchSockets();
          const stillInRoom = socketsInRoom.some(s => {
            const localSocket = io.sockets.sockets.get(s.id);
            return localSocket && localSocket.userId === socket.userId && localSocket.id !== socket.id;
          });
          
          if (!stillInRoom) {
            roomPresence.get(rId).delete(socket.userId);
            const activeUsers = Array.from(roomPresence.get(rId));
            io.to(rId).emit('room_presence_update', { roomId: rId, activeUsers });
          }
        } catch(e) {
          console.error('Presence update error on disconnect', e);
        }
      }
    });

    // =============================================
    // [AI 스튜디오 통합] Socket.io 실시간 이벤트 연동
    // =============================================
    socket.on('join_studio_room', async (studioId) => {
      try {
        const studio = await prisma.studio.findUnique({
          where: { id: studioId },
          include: { owner: true }
        });
        if (!studio) return;
        
        // 권한 검증: 공용 스튜디오 방이거나, 본인 소유의 스튜디오 방인 경우만 진입 가능
        if (!studio.isSystem && studio.ownerId !== socket.userId) {
          socket.emit('studio_access_denied', { studioId, error: 'Forbidden' });
          return;
        }

        socket.join(studioId);
        socket.currentStudioId = studioId;
        console.log(`[AI Studio Socket] User ${socket.userId} joined studio room ${studioId}`);

        // 해당 스튜디오의 터미널 로그 목록 조회
        const logs = await prisma.studioLog.findMany({
          where: { studioId },
          orderBy: { createdAt: 'asc' }
        });

        const currentProject = JSON.parse(studio.currentProjectJson || '{}');
        const agentState = JSON.parse(studio.agentStateJson || '{}');

        socket.emit('syncStudioState', {
          studioId,
          isWorking: studio.isWorking,
          currentProject,
          agentState,
          logs: logs.map(l => ({ agent: l.agent, msg: l.msg, error: l.error, createdAt: l.createdAt }))
        });
      } catch (err) {
        console.error('[AI Studio Socket] join_studio_room error:', err);
      }
    });

    socket.on('leave_studio_room', (studioId) => {
      socket.leave(studioId);
      if (socket.currentStudioId === studioId) {
        socket.currentStudioId = null;
      }
      console.log(`[AI Studio Socket] User ${socket.userId} left studio room ${studioId}`);
    });

    socket.on('reset_studio_state', async (studioId) => {
      try {
        const studio = await prisma.studio.findUnique({ where: { id: studioId } });
        if (!studio || studio.ownerId !== socket.userId) return;

        // 해당 스튜디오의 로그 일괄 삭제
        await prisma.studioLog.deleteMany({ where: { studioId } });

        // 프로젝트 컨텍스트 초기화
        await prisma.studio.update({
          where: { id: studioId },
          data: {
            isWorking: false,
            currentProjectJson: JSON.stringify({ active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
            agentStateJson: '{}'
          }
        });

        // 첫 시작 알림 로그 생성
        const systemLog = await prisma.studioLog.create({
          data: {
            studioId,
            agent: '대표님',
            msg: '🔥 일할 준비가 되어 있습니다. 새 프로젝트를 지시해주세요.',
            error: true
          }
        });

        const syncData = {
          studioId,
          isWorking: false,
          currentProject: { active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' },
          agentState: {},
          logs: [{ agent: systemLog.agent, msg: systemLog.msg, error: systemLog.error, createdAt: systemLog.createdAt }]
        };

        io.to(studioId).emit('syncStudioState', syncData);
      } catch (err) {
        console.error('[AI Studio Socket] reset_studio_state error:', err);
      }
    });

    socket.on('start_studio_task', async (payload) => {
      const { studioId, task, isRevision, files = [] } = payload;
      try {
        const studio = await prisma.studio.findUnique({ where: { id: studioId } });
        if (!studio || studio.ownerId !== socket.userId || studio.isWorking) return;

        // 오케스트레이션 비동기 백그라운드 호출
        runStudioOrchestration(studioId, socket.userId, task, isRevision, files);
      } catch (err) {
        console.error('[AI Studio Socket] start_studio_task start err:', err);
      }
    });

    socket.on('run_studio_manual_qa', async (payload) => {
      const { studioId, url, label } = payload;
      try {
        const studio = await prisma.studio.findUnique({ where: { id: studioId } });
        if (!studio || studio.ownerId !== socket.userId || studio.isWorking) return;

        // 수동 QA 비동기 백그라운드 호출
        runStudioManualQA(studioId, socket.userId, url, label);
      } catch (err) {
        console.error('[AI Studio Socket] run_studio_manual_qa err:', err);
      }
    });
  });

  // =============================================
  // [AI 스튜디오 통합] 물리 서빙 디렉토리 및 에이전트 코어 로직
  // =============================================
  const outputDir = path.join(__dirname, 'public', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  expressApp.use('/output', express.static(outputDir));

  // AI 스튜디오 전용 Gemini API Key 결정 헬퍼 함수
  async function getStudioGeminiKey(userId) {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    
    // 1순위: 활성화된 무료 AI 이벤트 확인
    try {
      const activeEvents = await prisma.event.findMany({
        where: { isActive: true, eventType: 'FREE_AI' }
      });
      for (const event of activeEvents) {
        if (event.eventApiKey) {
          const usage = await prisma.userEventUsage.findUnique({
            where: { userId_eventId_usageDate: { userId, eventId: event.id, usageDate: todayStr } }
          });
          const currentCount = usage ? usage.count : 0;
          const limit = event.dailyLimit || 30;
          if (currentCount < limit) {
            await prisma.userEventUsage.upsert({
              where: { userId_eventId_usageDate: { userId, eventId: event.id, usageDate: todayStr } },
              create: { userId, eventId: event.id, usageDate: todayStr, count: 1 },
              update: { count: { increment: 1 } }
            });
            console.log(`[AI Studio Key] 1순위 적용: 무료 AI 이벤트 (${currentCount + 1}/${limit}회)`);
            return event.eventApiKey;
          }
        }
      }
    } catch (e) {
      console.error('[AI Studio Key] 1순위 무료 이벤트 조회 실패:', e);
    }

    // 2순위: 유저 개인 설정 API Key 확인
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { geminiKey: true, walletBalance: true }
      });
      if (user && user.geminiKey) {
        console.log(`[AI Studio Key] 2순위 적용: 유저 개인 API Key 사용`);
        return user.geminiKey;
      }

      // 3순위: 시스템 글로벌 Fallback Key 및 코인 차감
      const systemGeminiKey = process.env.GEMINI_API_KEY;
      if (systemGeminiKey) {
        const COST = 10;
        if (user && user.walletBalance >= COST) {
          await prisma.user.update({
            where: { id: userId },
            data: { walletBalance: { decrement: COST } }
          });
          await prisma.transaction.create({
            data: {
              senderId: userId,
              receiverId: 'system',
              amount: COST,
              reason: 'AI 스튜디오 에이전트 구동 요금 차감'
            }
          });
          console.log(`[AI Studio Key] 3순위 적용: 시스템 글로벌 Key 사용 및 10코인 차감`);
          return systemGeminiKey;
        }
      }
    } catch (e) {
      console.error('[AI Studio Key] 2,3순위 유저 조회 실패:', e);
    }

    return null;
  }

  // AI 스튜디오 비동기 에이전트 협업 체인 구동 함수
  async function runStudioOrchestration(studioId, userId, task, isRevision, files = []) {
    const { GoogleGenAI } = require('@google/genai');
    
    const broadcastStudioLog = async (logObj) => {
      try {
        const createdLog = await prisma.studioLog.create({
          data: {
            studioId,
            agent: logObj.agent,
            msg: logObj.msg,
            error: !!logObj.error
          }
        });
        io.to(studioId).emit('logStudio', {
          agent: createdLog.agent,
          msg: createdLog.msg,
          error: createdLog.error,
          createdAt: createdLog.createdAt
        });
      } catch (e) {
        console.error('broadcastStudioLog error:', e);
      }
    };

    const emitAgentStatus = (agent, status) => {
      io.to(studioId).emit('agentStudioStatus', { agent, status });
    };

    try {
      // 1. API Key 검사 및 유효성 체킹
      const geminiKey = await getStudioGeminiKey(userId);
      if (!geminiKey) {
        await prisma.studio.update({ where: { id: studioId }, data: { isWorking: false } });
        await broadcastStudioLog({
          agent: '대표님',
          msg: '❌ 이용 가능한 API Key가 없거나 코인이 부족합니다. [설정]에서 개인 Gemini API Key를 등록하거나 코인을 충전해 주세요!',
          error: true
        });
        io.to(studioId).emit('studioTaskFinished', { studioId, success: false });
        return;
      }

      // 2. 템플릿 정보 로딩
      const studio = await prisma.studio.findUnique({ where: { id: studioId } });
      const TEMPLATES_PATH = path.join(__dirname, 'config', 'studio_templates.json');
      if (!fs.existsSync(TEMPLATES_PATH)) {
        throw new Error('스튜디오 템플릿 설정 파일이 존재하지 않습니다.');
      }
      const templates = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
      const template = templates[studio.type];
      if (!template) throw new Error('올바르지 않은 스튜디오 타입입니다.');

      // AI 스튜디오 작업 중 락 활성화 및 초기 로깅
      await prisma.studio.update({ where: { id: studioId }, data: { isWorking: true } });
      io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: true });

      const fileLogs = files.length > 0 ? ` (첨부파일 ${files.length}개 포함)` : '';
      if (!isRevision) {
        await prisma.studio.update({
          where: { id: studioId },
          data: {
            currentProjectJson: JSON.stringify({ active: true, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
            agentStateJson: '{}'
          }
        });
        await broadcastStudioLog({ agent: '대표님', msg: `[신규 업무 발주] "${task}"${fileLogs}` });
      } else {
        await broadcastStudioLog({ agent: '대표님', msg: `[피드백 반영 지시] "${task}"${fileLogs}` });
      }

      // 첨부파일 준비 (Gemini API 파트 바인딩)
      const fileParts = files.map(file => ({
        inlineData: { mimeType: file.mimeType, data: file.base64 }
      }));

      // Google GenAI 인스턴스 동적 생성 (요금 소유권 분배)
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      // 프로젝트 임시 객체 로드
      const freshStudio = await prisma.studio.findUnique({ where: { id: studioId } });
      let currentProject = JSON.parse(freshStudio.currentProjectJson || '{}');
      let dbAgentState = JSON.parse(freshStudio.agentStateJson || '{}');
      let agentState = {};
      
      // DB에 이미 셋업된 에이전트 고유 설정(역할, 전문성)을 안전하게 보존하며 상태 초기화
      for (const [name, state] of Object.entries(dbAgentState)) {
        agentState[name] = {
          ...(state || {}),
          status: 'idle',
          log: ''
        };
      }

      if (studio.type === 'game') {
        // ==========================================
        // 🎮 [게임 분야] Alice -> Carol -> Bob -> Dave 체인
        // ==========================================
        
        // [1] Alice (기획자) 동작
        emitAgentStatus('Alice', 'thinking');
        agentState['Alice'] = { ...(agentState['Alice'] || {}), status: 'thinking', room: 'DevRoom', log: '기획서 구성 중...' };
        await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
        io.to(studioId).emit('syncStudioAgentState', agentState);

        const aliceRole = agentState['Alice']?.role || '기획';
        const aliceExpertise = agentState['Alice']?.expertise || '10년차 수석 게임 기획자';
        let alicePrompt = `[역할: ${aliceRole} | 전문성 및 페르소나: ${aliceExpertise}] 당신은 이 전문성과 역할을 바탕으로 이번 개발 업무 중 본인의 분야를 담당해 주어야 합니다.
당신은 'Alice'입니다. 대표님의 지시사항은 다음과 같습니다: "${task}".
이 지시사항뿐만 아니라 함께 첨부된 문서(PDF 등) 및 이미지 파일이 있다면 그 내용을 최우선으로 철저히 분석하세요. 
첨부 파일의 분석 내용과 대표님의 지시를 완벽히 결합하여 웹 게임을 만들기 위한 핵심 룰, 권장 색상 테마, 그리고 구현해야할 주요 함수 3가지를 짧고 명확한 기획서로 작성해주세요.
[Alopop Game 표준 기획 정책]:
- 첫 줄에 반드시 게임의 제목을 "[게임명: 000]" 형식으로 명확하고 센스있게 지어서 기입할 것. (예: [게임명: 스페이스 어드벤처])
- 장르(액션, 퍼즐 등)를 불문하고 모바일 프레임 드랍 버그 방지를 위해 모든 인게임 렌더링은 반드시 단일 HTML5 Canvas API 방식만 사용할 것 (무거운 DOM Grid/Flexbox 렌더링 절대 금지).
- 인게임 사운드(Web Audio API 기반) 기획과 결과창(모달), 설정창 흐름을 반드시 기획안에 포함할 것.
동료 프로그래머인 Bob에게 전달할 실무용 스펙입니다.`;

        if (isRevision) {
          alicePrompt = `[역할: ${aliceRole} | 전문성 및 페르소나: ${aliceExpertise}] 당신은 이 전문성과 역할을 바탕으로 이전에 작성된 기획서에 대표님의 피드백을 반영하여 보완해 주어야 합니다.
당신은 'Alice'입니다. 이전에 작성된 기획서가 있습니다:
=== 이전 기획서 ===
${currentProject.specDoc}
=================
대표님의 피드백(추가 지시)은 다음과 같습니다: "${task}". 함께 첨부된 문서 또는 이미지 파일이 있다면 이를 분석하여 반영하세요.
[주의사항(CRITICAL)]: 완전히 새로운 게임으로 규칙을 갈아엎지 마십시오. 반드시 이전 기획서에 명시된 기본 게임 규칙과 테마(뼈대)를 유지한 채로, 지시받은 추가/수정 사항만 부분적으로 반영하여 문서를 보완해야 합니다.
첫 줄에는 이전 기획서와 동일하게 "[게임명: 게임이름]" 형식을 반드시 포함하세요.`;
          await broadcastStudioLog({ agent: 'Alice', msg: '대표님의 수정 피드백 확인! 이전 기획서를 바탕으로 내용을 보완 중입니다...' });
        } else {
          await broadcastStudioLog({ agent: 'Alice', msg: '대표님 지시 확인! 첨부 문서 등을 꼼꼼히 분석하여 최적의 개발 스펙을 구상 중입니다...' });
        }

        const aliceResponse = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ text: alicePrompt }, ...fileParts],
        });
        const specDoc = aliceResponse.text;
        currentProject.specDoc = specDoc;

        const nameMatch = specDoc.match(/\[게임명:\s*(.+?)\]/);
        if (nameMatch) {
          currentProject.gameName = nameMatch[1].replace(/\]/g, '').trim();
        } else if (!currentProject.gameName) {
          currentProject.gameName = '알로팝 게임';
        }

        emitAgentStatus('Alice', 'idle');
        agentState['Alice'] = { ...(agentState['Alice'] || {}), status: 'idle', room: 'DevRoom', log: '기획안 도출 완료!' };
        await prisma.studio.update({
          where: { id: studioId },
          data: {
            currentProjectJson: JSON.stringify(currentProject),
            agentStateJson: JSON.stringify(agentState)
          }
        });
        io.to(studioId).emit('syncStudioAgentState', agentState);
        await broadcastStudioLog({ agent: 'Alice', msg: `기획서 작성이 완료되었습니다. Carol 수석에게 전달합니다.\n[기획 요약]\n${specDoc.substring(0, 50)}...` });

        // [Eve - 마케팅 요원 기용 시 기획서 바이럴 보강 보완 단계 삽입]
        if (agentState['Eve']) {
          emitAgentStatus('Eve', 'thinking');
          agentState['Eve'] = { ...(agentState['Eve'] || {}), status: 'thinking', room: 'DevRoom', log: '마케팅 기획 보완 중...' };
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);
          await broadcastStudioLog({ agent: 'Eve', msg: 'Alice의 기획서를 검토하여 마케팅 관점에서 흥행 및 홍보 요소를 추가 기획하고 있습니다...' });
          
          const eveRole = agentState['Eve']?.role || '마케팅';
          const eveExpertise = agentState['Eve']?.expertise || '트렌디한 바이럴 카피라이팅 마케팅 스페셜리스트';
          const evePrompt = `[역할: ${eveRole} | 전문성 및 페르소나: ${eveExpertise}] 당신은 이 전문성과 역할을 바탕으로 이번 개발 업무 중 본인의 분야를 담당해 주어야 합니다.
당신은 마케팅 담당 요원 'Eve'입니다. 동료 기획자 Alice가 작성한 아래 기획서를 수령했습니다.
기획서:
${currentProject.specDoc}

이 게임이 흥행할 수 있도록 바이럴 요소를 추가하고, 타겟 유저층의 시선을 사로잡을 독창적인 홍보 문구(슬로건)를 설계해 주세요.
기존 기획서의 내용을 훼손하지 않는 한도 내에서 기획서 하단에 "=== [Eve의 바이럴 마케팅 스펙] ===" 섹션을 우아한 한글 마크다운 형태로 덧붙여 기획서 전문을 최종 반환하세요.`;

          const eveResponse = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ text: evePrompt }],
          });
          currentProject.specDoc = eveResponse.text;

          emitAgentStatus('Eve', 'idle');
          agentState['Eve'] = { ...(agentState['Eve'] || {}), status: 'idle', room: 'DevRoom', log: '기획서 보완 성공!' };
          await prisma.studio.update({
            where: { id: studioId },
            data: {
              currentProjectJson: JSON.stringify(currentProject),
              agentStateJson: JSON.stringify(agentState)
            }
          });
          io.to(studioId).emit('syncStudioAgentState', agentState);
          await broadcastStudioLog({ agent: 'Eve', msg: '마케팅 타겟팅과 카피라이팅 기획안을 결합하여 스펙을 한층 더 업그레이드했습니다!' });
        }

        // [2] Carol (디자이너) 동작
        emitAgentStatus('Carol', 'thinking');
        agentState['Carol'] = { ...(agentState['Carol'] || {}), status: 'thinking', room: 'DevRoom', log: '디자인 가이드 짜는 중...' };
        await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
        io.to(studioId).emit('syncStudioAgentState', agentState);

        const carolRole = agentState['Carol']?.role || '디자인';
        const carolExpertise = agentState['Carol']?.expertise || '웹 게임 UI/UX 수석 디자이너';
        let carolPrompt = `[역할: ${carolRole} | 전문성 및 페르소나: ${carolExpertise}] 당신은 이 전문성과 역할을 바탕으로 이번 개발 업무 중 본인의 분야를 담당해 주어야 합니다.
당신은 'Carol'입니다. 동료 기획자가 다음 기획서를 건넸습니다:

${currentProject.specDoc}

위 기획을 바탕으로 화면 배색(CSS Hex Color 3가지 이상), 인터페이스 배치 구조, 글꼴 느낌 등을 명확하게 정의한 단일 Markdown 디자인 가이드를 작성하세요. 만약 이미지나 문서가 첨부되었다면 이를 핵심 디자인 레퍼런스로 적극 반영하세요.
[Alopop Game 표준 디자인 정책]:
- 게임 화면이 잘리지 않도록 철저한 반응형(Responsive) CSS 적용.
- 게임 오버 스크린과 설정창(볼륨조절 폼)은 반드시 팝업 형태의 모달로 깔끔하게 디자인할 것.`;

        const carolResponse = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ text: carolPrompt }, ...fileParts],
        });
        const designDoc = carolResponse.text;
        currentProject.designDoc = designDoc;

        emitAgentStatus('Carol', 'idle');
        agentState['Carol'] = { ...(agentState['Carol'] || {}), status: 'idle', room: 'DevRoom', log: '디자인 가이드 완성!' };
        await prisma.studio.update({
          where: { id: studioId },
          data: {
            currentProjectJson: JSON.stringify(currentProject),
            agentStateJson: JSON.stringify(agentState)
          }
        });
        io.to(studioId).emit('syncStudioAgentState', agentState);
        await broadcastStudioLog({ agent: 'Carol', msg: `디자인 원형이 나왔습니다! Bob 수석에게 전달합니다.\n[디자인 요약]\n${designDoc.substring(0, 50)}...` });
// [3] Bob (개발자) 동작
        emitAgentStatus('Bob', 'coding');
        agentState['Bob'] = { ...(agentState['Bob'] || {}), status: 'coding', room: 'DevRoom', log: '열혈 코딩 중...' };
        await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
        io.to(studioId).emit('syncStudioAgentState', agentState);

        const bobRole = agentState['Bob']?.role || '개발';
        const bobExpertise = agentState['Bob']?.expertise || 'HTML5 기반 물리 엔진 특화 풀스택 엔지니어';
        let bobPrompt = `[역할: ${bobRole} | 전문성 및 페르소나: ${bobExpertise}] 당신은 이 전문성과 역할을 바탕으로 이번 개발 업무 중 본인의 분야를 담당해 주어야 합니다.
당신은 'Bob'입니다. 
Alice 기획서:
${currentProject.specDoc}

Carol 디자인 가이드:
${currentProject.designDoc}

위 내용을 완벽하게 구현할 수 있는 단일 HTML (CSS와 바닐라스크립트가 포함된 형태) 코드를 작성하세요. 당신의 결과물은 완벽하게 작동하는 게임이어야 합니다. 코드만 반환하세요.
[Alopop Game 표준 프로그래밍 정책 (game_creator 스킬 강제)]:
- 외부 에셋 의존도를 없애고 Web Audio API of Oscillator를 활용한 독립적인 'SoundManager' 클래스를 반드시 코드 안에 내장하여 동작시킬 것 (볼륨 조절/효과음/BGM 기능 포함).
- [모바일 화면 밀림 방지 핵심]: 디바이스/웹뷰 상단 상태바에 의해 캔버스가 아래로 밀리면서 잘리는 버그를 방지하기 위해, CSS 컨테이너나 바디 높이에 절대로 '100vh'를 쓰지 말고 "position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;" 를 사용하여 동적 남은 영역에 정확히 피팅되도록 하세요.
- SVG나 CSS 도형으로 그래픽을 구현하고, 게임 오버 창과 설정 창은 반응형 모달로 작동하게 할 것.`;

        if (isRevision) {
          bobPrompt = `[역할: ${bobRole} | 전문성 및 페르소나: ${bobExpertise}] 당신은 이 전문성과 역할을 바탕으로 갱신된 기획서와 디자인에 따라 기존 게임 코드를 디버깅하고 패치해 주어야 합니다.
당신은 'Bob'입니다.
갱신된 기획서:
${currentProject.specDoc}
갱신된 디자인 가이드:
${currentProject.designDoc}
이전에 당신이 짠 코드:
${currentProject.codeDoc}
대표님의 피드백 지시: "${task}"
위 수정된 기획과 디자인, 피드백을 바탕으로 기존 코드를 기초하여 새로운 기능을 패치하세요. 반드시 완전하게 동작하는 단일 HTML 소스코드 전문을 반환하세요.
[주의사항(CRITICAL)]: 절대로 새로운 게임을 처음부터 다시 코딩하거나 테마를 새로 설계하지 마십시오. 반드시 '이전에 당신이 짠 코드'의 핵심 뼈대와 작동 방식을 그대로 유지한 채로 지시된 수정 사항만 국소적으로 반영(Patch)해야 합니다.
[Alopop Game 표준 정책 유지]: 코드 내부에 Web Audio API 기반의 SoundManager 메커니즘과 반응형 모달 시스템이 소실되지 않도록 엄격히 지킬 것! CSS 크기에 100vh 사용 금지(100% 및 position:fixed 사용).`;
          await broadcastStudioLog({ agent: 'Bob', msg: '오케이, 기존에 만든 게임 구조를 그대로 살리면서 요구된 부분만 안전하게 패치 코딩합니다...' });
        } else {
          await broadcastStudioLog({ agent: 'Bob', msg: '기획서와 디자인 가이드 수령 완료. 즉시 코딩(로직 구현)을 시작합니다...' });
        }

        const bobResponse = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ text: bobPrompt }],
        });
        const codeDoc = bobResponse.text;
        
        let cleanHTML = codeDoc;
        const htmlMatch = codeDoc.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i);
        if (htmlMatch) {
          cleanHTML = htmlMatch[1].trim();
        } else {
          cleanHTML = codeDoc.replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/i, '').trim();
        }
        let finalHTML = cleanHTML;
        currentProject.codeDoc = finalHTML;

        // [4] Dave (QA 테스터) 자가 결함 테스트
        emitAgentStatus('Dave', 'thinking');
        agentState['Dave'] = { ...(agentState['Dave'] || {}), status: 'thinking', room: 'DevRoom', log: '정밀 QA 검수 중...' };
        await prisma.studio.update({
          where: { id: studioId },
          data: {
            currentProjectJson: JSON.stringify(currentProject),
            agentStateJson: JSON.stringify(agentState)
          }
        });
        io.to(studioId).emit('syncStudioAgentState', agentState);
        await broadcastStudioLog({ agent: 'Dave', msg: 'Bob의 최종 산출물을 분석하고 자가 문법(Javascript) 테스팅을 진행합니다...' });

        const daveRole = agentState['Dave']?.role || 'QA';
        const daveExpertise = agentState['Dave']?.expertise || '칼 같은 엄격함을 가진 버그 헌터 QA 마스터';
        
        const davePrompt = `[역할: ${daveRole} | 전문성 및 페르소나: ${daveExpertise}] 당신은 이 전문성과 역할을 바탕으로 동료 프로그래머 Bob이 작성한 아래 코드를 면밀히 검수해 주어야 합니다.
당신은 'Dave'입니다. 프로그래머 Bob이 작성한 아래 HTML 코드를 바탕으로 HTML/CSS/JS 문법 오류, 누락된 스크립트, 게임 구동 시 뻑나는 치명적 결함을 분석하세요. 결과는 반드시 JSON 객체로 반환하세요.
코드:
\`\`\`html
\${finalHTML}
\`\`\`
응답 포맷 예시 (JSON Only):
{"status":"PASS","feedback":"문제 없습니다. 완벽합니다."}
{"status":"FAIL","feedback":"줄번호 xx에서 Canvas API 호출 시 오타가 있습니다. gameLoop() 함수가 누락되었습니다."}`;

        const daveResponse = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ text: davePrompt }],
        });

        let qaStatus = "PASS";
        let qaFeedback = "";
        try {
          const daveText = daveResponse.text.replace(/```(?:json)?\s*\n/i, '').replace(/\n```/g, '').trim();
          const daveObj = JSON.parse(daveText);
          qaStatus = daveObj.status;
          qaFeedback = daveObj.feedback;
        } catch (e) {
          console.error("Dave QA Parse Error:", e);
          qaStatus = "PASS";
        }

        if (qaStatus === "FAIL") {
          await broadcastStudioLog({ agent: 'Dave', msg: `[오류 발견] \${qaFeedback} Bob 수석, 치명적 결함입니다. 즉시 리팩토링하세요.` });
          emitAgentStatus('Bob', 'coding');
          agentState['Bob'] = { ...(agentState['Bob'] || {}), status: 'coding', room: 'DevRoom', log: 'V2 핫픽스 코딩 중...' };
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);

          const bobRetryPrompt = `[역할: ${bobRole} | 전문성 및 페르소나: ${bobExpertise}] 당신은 이 전문성과 역할을 바탕으로 당신의 코드 결함을 수정해 주어야 합니다.
당신은 'Bob'입니다. 당신이 방금 짠 코드에 치명적 결함이 있어 QA 봇 Dave가 반려했습니다.
Dave의 피드백: "\${qaFeedback}"
 
기존 코드:
\`\`\`html
\${finalHTML}
\`\`\`
 
Dave의 피드백을 반영하여 완벽하게 디버깅된 새로운 HTML 소스코드 전문을 제출하세요. (추가 메모 금지, 오직 HTML 코드만 출력)
[주의사항(CRITICAL)]: 절대로 완전히 새로운 게임 코드를 작성하지 마십시오. 로직의 핵심 뼈대를 유지하고 오류만 국소적으로 패치(수정)하십시오.`;

          const bobRetryResponse = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ text: bobRetryPrompt }],
          });

          let retryHTML = bobRetryResponse.text;
          const matchRetry = retryHTML.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i);
          if (matchRetry) { finalHTML = matchRetry[1].trim(); }
          else { finalHTML = retryHTML.replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/i, '').trim(); }

          currentProject.codeDoc = finalHTML;
          await broadcastStudioLog({ agent: 'Bob', msg: `Dave 팀장 지적 수용! 오류를 수정한 V2 핫픽스를 적용했습니다.` });
        } else {
          await broadcastStudioLog({ agent: 'Dave', msg: '무결함 테스트 결과 PASS. 릴리즈를 승인합니다.' });
        }
        emitAgentStatus('Dave', 'idle');
        agentState['Dave'] = { ...(agentState['Dave'] || {}), status: 'idle', room: 'DevRoom', log: '검수 PASS 완료!' };
        await prisma.studio.update({
          where: { id: studioId },
          data: {
            currentProjectJson: JSON.stringify(currentProject),
            agentStateJson: JSON.stringify(agentState)
          }
        });
        io.to(studioId).emit('syncStudioAgentState', agentState);

        // [Frank - 보안 요원 기용 시 보안 검증 틱 프로세스 삽입]
        if (agentState['Frank']) {
          emitAgentStatus('Frank', 'thinking');
          agentState['Frank'] = { ...(agentState['Frank'] || {}), status: 'thinking', room: 'DevRoom', log: '보안 검수 중...' };
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);
          await broadcastStudioLog({ agent: 'Frank', msg: '코딩 및 QA 완료 확인! 최종 보안/인프라 취약점 검수를 수행합니다...' });

          const frankRole = agentState['Frank']?.role || '보안';
          const frankExpertise = agentState['Frank']?.expertise || '서버 보안 및 철통 인프라 가드 아키텍트';
          const frankPrompt = `[역할: \${frankRole} | 전문성 및 페르소나: \${frankExpertise}] 당신은 이 전문성과 역할을 바탕으로 이번 개발 업무 중 본인의 분야를 담당해 주어야 합니다.
당신은 보안 담당 요원 'Frank'입니다. Bob과 Dave를 통과한 최종 게임 소스코드 전문을 분석하여 크로스 사이트 스크립팅(XSS), 로컬 변수 오염, 메모리 누수 등의 관점에서 보안 우려 사항이 없는지 정밀 검수하세요.
결과는 3줄 이내의 매끄럽고 든든한 한국어 문장으로 작성해 주세요.`;

          const frankResponse = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ text: frankPrompt }],
          });

          emitAgentStatus('Frank', 'idle');
          agentState['Frank'] = { ...(agentState['Frank'] || {}), status: 'idle', room: 'DevRoom', log: '보안 검증 완료!' };
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);
          await broadcastStudioLog({ agent: 'Frank', msg: `[보안 검증 결과] \${frankResponse.text.trim()}` });
        }

        // 3.5초 후 사후 피드백 회의(미팅) 세션 기동
        setTimeout(async () => {
          await broadcastStudioLog({ agent: '대표님', msg: '전원 회의실로 집합! 산출물 피드백 회의를 시작합시다.' });
          
          // 기용된 모든 요원들을 회의실로 정렬시키기
          for (const name of Object.keys(agentState)) {
            emitAgentStatus(name, 'meeting');
            agentState[name] = { 
              ...(agentState[name] || {}), 
              status: 'meeting', 
              room: 'Conference', 
              log: name === 'Alice' ? '게임성 검토 중...' : (name === 'Carol' ? 'UI 디자인 확인 중...' : (name === 'Bob' ? '피드백 수렴 중...' : '회의 참석 중...')) 
            };
          }
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);

          try {
            const qaPrompt = `당신은 까다롭지만 유쾌한 기획팀장 'Alice'입니다. 아래는 프로그래머 Bob이 방금 완성한 HTML 웹 게임 소스코드입니다.
코드 전문:
\${finalHTML}

위 결과물을 보고, 1) 게임성/재미, 2) Carol이 구성한 UI 배색이나 레이아웃이 잘 반영되었는지를 평가해주세요. 대표님과 팀원들(Carol, Bob) 앞에서 이야기하듯 대화체로, 3~4문장 이내의 신랄하고 재치있는 평가(QA 피드백)를 한국어로 남기세요.`;

            const qaResponse = await ai.models.generateContent({
              model: 'gemini-3.1-pro-preview',
              contents: [{ text: qaPrompt }],
            });
            await broadcastStudioLog({ agent: 'Alice', msg: qaResponse.text.trim() });

            setTimeout(async () => {
              const dialogues = [
                { carol: 'Bob 수석님, 애니메이션 처리가 살짝 아쉽지만 정말 수고 많으셨어요!', bob: '다음 버전에서는 프레임부터 싹 다 최적화해오겠습니다!' },
                { carol: '컬러는 제가 가이드해드린 대로 깔끔하게 뽑혔네요. 레이아웃이 맘에 들어요.', bob: '역시 디자인이 좋으니 코딩할 맛이 나더라고요. 다들 고생하셨습니다!' }
              ];
              const dialogue = dialogues[Math.floor(Math.random() * dialogues.length)];
              await broadcastStudioLog({ agent: 'Carol', msg: dialogue.carol });
              await broadcastStudioLog({ agent: 'Bob', msg: dialogue.bob });

              // Carol과 Bob의 실제 회의 다이얼로그 내용을 에이전트 상태의 말풍선 값으로 세팅 및 실시간 DB 저장 세이브 브로드캐스트
              agentState['Carol'].log = dialogue.carol;
              agentState['Bob'].log = dialogue.bob;
              await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
              io.to(studioId).emit('syncStudioAgentState', agentState);

              // [Grace - CS 요원이 기용된 경우 피드백 다이얼로그 추가]
              if (agentState['Grace']) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const graceRole = agentState['Grace']?.role || 'CS';
                const graceExpertise = agentState['Grace']?.expertise || '친절하고 활발한 유저 소통 CS 매니저';
                const gracePrompt = `[역할: \${graceRole} | 전문성 및 페르소나: \${graceExpertise}] 당신은 이 전문성과 역할을 바탕으로 CS 매니저 입장의 멘트를 기재해 주어야 합니다.
당신은 CS 담당 요원 'Grace'입니다. Bob이 코딩하고 Dave가 검수한 최종 게임의 UI/UX 완성본을 확인했습니다.
유저 관점에서의 친근함, 플레이 가이드 유도, 유저 지원 등에 관한 귀여운 피드백을 밝고 쾌활한 성격의 대화체로 1~2문장 이내로 한국어로 작성하세요.`;
                const graceResponse = await ai.models.generateContent({
                  model: 'gemini-3.1-pro-preview',
                  contents: [{ text: gracePrompt }],
                });
                const msg = graceResponse.text.trim();
                await broadcastStudioLog({ agent: 'Grace', msg });
                agentState['Grace'].log = msg;
                await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
                io.to(studioId).emit('syncStudioAgentState', agentState);
              }

              // [Hank - 테스터 요원이 기용된 경우 피드백 다이얼로그 추가]
              if (agentState['Hank']) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const hankRole = agentState['Hank']?.role || '테스터';
                const hankExpertise = agentState['Hank']?.expertise || '일반 유저 관점 예외처리 검증 베타 테스터';
                const hankPrompt = `[역할: \${hankRole} | 전문성 및 페르소나: \${hankExpertise}] 당신은 이 전문성과 역할을 바탕으로 베타 테스터 입장의 멘트를 기재해 주어야 합니다.
당신은 베타 테스터 요원 'Hank'입니다. 일반 플레이어 입장에서 이 게임을 직접 마우스나 터치로 테스트해보며 느낀 소감이나 아주 가벼운 버그성 우려사항을 재치 있고 유쾌하게 1~2문장 이내로 한국어로 작성하세요.`;
                const hankResponse = await ai.models.generateContent({
                  model: 'gemini-3.1-pro-preview',
                  contents: [{ text: hankPrompt }],
                });
                const msg = hankResponse.text.trim();
                await broadcastStudioLog({ agent: 'Hank', msg });
                agentState['Hank'].log = msg;
                await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
                io.to(studioId).emit('syncStudioAgentState', agentState);
              }

              setTimeout(async () => {
                // 회의 종료 후 전원 제자리 복귀 및 idle 전환
                for (const name of Object.keys(agentState)) {
                  emitAgentStatus(name, 'idle');
                  agentState[name] = { 
                    ...(agentState[name] || {}), 
                    status: 'idle', 
                    room: 'DevRoom', 
                    log: '' 
                  };
                }
                
                await broadcastStudioLog({ agent: '대표님', msg: '자, 이번 작업은 여기까지 다들 정말 고생 많았어요! 각자 자리에서 개인 정비 가집시다.' });
                
                await prisma.studio.update({
                  where: { id: studioId },
                  data: {
                    isWorking: false,
                    agentStateJson: JSON.stringify(agentState)
                  }
                });
                io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
                io.to(studioId).emit('syncStudioAgentState', agentState);
                io.to(studioId).emit('studioTaskFinished', { studioId, success: true });
              }, 4500); 
            }, 3500);

          } catch (e) {
            console.error('QA meeting err:', e);
            await prisma.studio.update({ where: { id: studioId }, data: { isWorking: false } });
            io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
          }
        }, 3500);


      } else {
        // ==========================================
        // ✍️ [문서 분야] (법률, 공연) 체인
        // ==========================================
        const pipeline = template.pipeline; // ['Solomon', 'Justice', 'Scribe'] 등
        const agents = template.agents;

        let accumulatedDoc = `[대표님의 지시사항]\n"${task}"\n\n`;

        for (let i = 0; i < pipeline.length; i++) {
          const agentName = pipeline[i];
          const agentInfo = agents[agentName];

          emitAgentStatus(agentName, 'thinking');
          agentState[agentName] = { status: 'thinking', room: 'DevRoom', log: '업무 문서 작성 중...' };
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);

          await broadcastStudioLog({ agent: agentName, msg: `${agentInfo.role} 업무 처리를 시작합니다...` });

          let prompt = `당신은 ${template.name} 소속의 ${agentInfo.role} '${agentName}'입니다. 
대표님의 핵심 지시: "${task}".
이전 단계의 에이전트들이 작성하고 분석한 문서 내역은 다음과 같습니다:
=== 누적 작성 문서 ===
${accumulatedDoc}
======================

위 자료와 함께 첨부된 문서(PDF) 및 이미지 파일이 있다면 그 내용을 적극적으로 분석하여, 당신의 전문 역할(${agentInfo.role})에 맞는 새로운 분석 결과, 제안, 혹은 구체적인 계약서/기획서 단락을 마크다운(Markdown) 포맷으로 추가 및 확장해 최종 문서를 빌드해 주세요.
당신의 역할에 맞추어 오직 한국어(Korean)로 실무 마크다운 결과물만 완벽하게 출력하세요 (사담 금지, 불필요한 마크다운 코드 블록 백틱은 씌우지 마세요).`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ text: prompt }, ...fileParts],
          });
          
          const resultText = response.text;
          accumulatedDoc += `\n### [${agentName} - ${agentInfo.role}의 자문/기획]\n${resultText}\n`;

          emitAgentStatus(agentName, 'idle');
          agentState[agentName] = { status: 'idle', room: 'DevRoom', log: '완료!' };
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);
          await broadcastStudioLog({ agent: agentName, msg: `작업이 끝났습니다. 다음 에이전트에게 인계합니다.` });
        }

        // 문서형 스튜디오 최종 마무리
        const versionNum = await prisma.studioArtifact.count({ where: { studioId } }) + 1;
        const docTitle = `${template.name} 보고서 V${versionNum}`;

        // 마크다운 문서 DB에 텍스트 영구 보관 (fileUrl은 없고 content에 직접 텍스트 보관)
        await prisma.studioArtifact.create({
          data: {
            studioId,
            name: docTitle,
            content: accumulatedDoc,
            isDeployed: false
          }
        });

        await broadcastStudioLog({ agent: '대표님', msg: `🎉 스튜디오 자문 및 기획 문서 작성이 완료되었습니다! 최종 결과물 [${docTitle}]이 아카이브에 안전하게 등록되었습니다.` });

        await prisma.studio.update({
          where: { id: studioId },
          data: {
            isWorking: false,
            agentStateJson: JSON.stringify(agentState)
          }
        });
        io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
        io.to(studioId).emit('syncStudioAgentState', agentState);
        io.to(studioId).emit('studioTaskFinished', { studioId, success: true });
      }

    } catch (error) {
      console.error('[AI Studio Orchestration Fail]:', error);
      await prisma.studio.update({ where: { id: studioId }, data: { isWorking: false } });
      await broadcastStudioLog({ agent: '대표님', msg: `에러가 발생하여 연산이 중단되었습니다: ${error.message}`, error: true });
      io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
      io.to(studioId).emit('studioTaskFinished', { studioId, success: false });
    }
  }

  // AI 스튜디오 수동 QA 디버깅 함수 (Bob 코딩 핫픽스)
  async function runStudioManualQA(studioId, userId, url, label) {
    const { GoogleGenAI } = require('@google/genai');

    const broadcastStudioLog = async (logObj) => {
      try {
        const createdLog = await prisma.studioLog.create({
          data: {
            studioId,
            agent: logObj.agent,
            msg: logObj.msg,
            error: !!logObj.error
          }
        });
        io.to(studioId).emit('logStudio', {
          agent: createdLog.agent,
          msg: createdLog.msg,
          error: createdLog.error,
          createdAt: createdLog.createdAt
        });
      } catch (e) {
        console.error('broadcastStudioLog error:', e);
      }
    };

    try {
      const geminiKey = await getStudioGeminiKey(userId);
      if (!geminiKey) {
        await broadcastStudioLog({ agent: '대표님', msg: '❌ 수동 QA 구동 실패: 유효한 API Key 또는 코인이 부족합니다.', error: true });
        return;
      }

      await prisma.studio.update({ where: { id: studioId }, data: { isWorking: true } });
      io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: true });

      const filename = path.basename(url);
      const filePath = path.join(outputDir, filename);
      if (!fs.existsSync(filePath)) throw new Error('결과물 파일이 존재하지 않습니다.');

      const currentHTML = fs.readFileSync(filePath, 'utf8');

      await broadcastStudioLog({ agent: '대표님', msg: `[수동 품질 검수 지시] ${label} 게임의 문법/동작 정밀 검사를 수행해!` });
      const freshStudioQA = await prisma.studio.findUnique({ where: { id: studioId } });
      let agentStateQA = JSON.parse(freshStudioQA.agentStateJson || '{}');
      agentStateQA['Dave'] = { status: 'thinking', room: 'DevRoom', log: '정밀 QA 검수 중...' };
      await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentStateQA) } });
      io.to(studioId).emit('syncStudioAgentState', agentStateQA);

      await broadcastStudioLog({ agent: 'Dave', msg: '호출에 의해 해당 게임 소스 코드를 한 줄씩 디버깅 분석 중입니다...' });

      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      const davePrompt = `당신은 엄격한 수석 QA 봇 'Dave'입니다. 프로그래머 Bob이 작성한 아래 HTML 코드를 바탕으로 HTML/CSS/JS 문법 오류, 누락된 스크립트, 치명적 결함을 분석하세요. 결과는 반드시 JSON 객체로 반환하세요.
코드:
\`\`\`html
${currentHTML}
\`\`\`
응답 포맷 예시 (JSON Only):
{"status":"PASS","feedback":"문제 없습니다. 완벽합니다."}
{"status":"FAIL","feedback":"줄번호 xx에서 Canvas API 오타가 있습니다."}`;

      const daveResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ text: davePrompt }],
      });

      let qaStatus = "PASS";
      let qaFeedback = "";
      try {
        const daveText = daveResponse.text.replace(/```(?:json)?\s*\n/i, '').replace(/\n```/g, '').trim();
        const daveObj = JSON.parse(daveText);
        qaStatus = daveObj.status;
        qaFeedback = daveObj.feedback;
      } catch (e) {
        console.error("QA parse error in manual QA", e);
        qaStatus = "PASS";
      }

      if (qaStatus === "FAIL") {
        await broadcastStudioLog({ agent: 'Dave', msg: `[오류 발견] ${qaFeedback} Bob 수석, 즉시 소스 패치하세요.` });
        agentStateQA['Bob'] = { status: 'coding', room: 'DevRoom', log: '핫픽스 코딩 중...' };
        await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentStateQA) } });
        io.to(studioId).emit('syncStudioAgentState', agentStateQA);

        const bobRetryPrompt = `당신은 천재 프로그래머 Bob입니다. 당신이 예전에 짠 위 코드에 치명적 결함이 있어 Dave가 다시 반려했습니다.
Dave의 피드백: "${qaFeedback}"

기존 코드:
\`\`\`html
${currentHTML}
\`\`\`

Dave의 피드백을 반영하여 디버깅된 새로운 HTML 소스코드 전문을 제출하세요. (오직 코딩 결과물 HTML만 출력)
[주의사항(CRITICAL)]: 절대로 완전히 새로운 게임 코드를 작성하지 마십시오. 오직 발견된 에러를 수정하기 위해 기존 코드를 최소한으로만 변경(패치)하십시오.`;

        const bobRetryResponse = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ text: bobRetryPrompt }],
        });

        let retryHTML = bobRetryResponse.text;
        let finalHTML = retryHTML;
        const matchRetry = retryHTML.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i);
        if (matchRetry) { finalHTML = matchRetry[1].trim(); }
        else { finalHTML = retryHTML.replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/i, '').trim(); }

        fs.writeFileSync(filePath, finalHTML, 'utf8');
        await broadcastStudioLog({ agent: 'Bob', msg: `Dave의 지적에 따라 파일 오류를 핫픽스하여 강제 패치하였습니다!` });
      } else {
        await broadcastStudioLog({ agent: 'Dave', msg: '수동 정밀 검사 결과 PASS. 완벽하게 무결합니다.' });
      }

      const freshStudioQA2 = await prisma.studio.findUnique({ where: { id: studioId } });
      let agentStateQA2 = JSON.parse(freshStudioQA2.agentStateJson || '{}');
      agentStateQA2['Dave'] = { status: 'idle', room: 'DevRoom', log: '검수 PASS 완료!' };
      agentStateQA2['Bob'] = { status: 'idle', room: 'DevRoom', log: '패치 완료!' };
      
      await prisma.studio.update({ 
        where: { id: studioId }, 
        data: { 
          isWorking: false, 
          agentStateJson: JSON.stringify(agentStateQA2) 
        } 
      });
      
      io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
      io.to(studioId).emit('syncStudioAgentState', agentStateQA2);
      io.to(studioId).emit('studioTaskFinished', { studioId, success: true });
    } catch (err) {
      console.error('runStudioManualQA err:', err);
      await prisma.studio.update({ where: { id: studioId }, data: { isWorking: false } });
      await broadcastStudioLog({ agent: 'Dave', msg: `수동 검사 오류 발생: ${err.message}`, error: true });
      io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
      io.to(studioId).emit('studioTaskFinished', { studioId, success: false });
    }
  }

  // =============================================
  // AI 스튜디오 Express REST API 라우터 정의
  // =============================================
  const aistudioRouter = express.Router();
  aistudioRouter.use(express.json());

  // 1. 상태 조회 API
  aistudioRouter.get('/status', (req, res) => {
    res.json({
      status: 'Alopop Integrated AI Studio Backend is running',
      hasSystemApiKey: !!process.env.GEMINI_API_KEY
    });
  });

  // 시스템 스튜디오 3종 자동 생성 (시딩) 함수
  async function seedSystemStudios(userId) {
    try {
      // 기존 '게임 개발 스튜디오' 명칭이 DB에 있다면 자동 보정 마이그레이션
      await prisma.studio.updateMany({
        where: { name: '게임 개발 스튜디오', isSystem: true },
        data: { name: '게임 개발 스튜디오' }
      });

      const systemStudios = [
        {
          name: '게임 개발 스튜디오',
          type: 'game',
          isSystem: true,
          ownerId: String(userId),
          isWorking: false,
          currentProjectJson: JSON.stringify({ active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
          agentStateJson: '{}',
          welcomeMsg: '🎮 게임 개발 스튜디오에 오신 것을 환영합니다! 대표님, 어떤 재미있는 게임을 만들어볼까요?'
        },
        {
          name: '공연 및 행사 기획사',
          type: 'concert',
          isSystem: true,
          ownerId: String(userId),
          isWorking: false,
          currentProjectJson: JSON.stringify({ active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
          agentStateJson: '{}',
          welcomeMsg: '✨ 공연 및 행사 기획사에 오신 것을 환영합니다! 대표님, 오늘 기획할 멋진 페스티벌이나 이벤트를 말씀해주세요.'
        },
        {
          name: '법무법인 알로팝',
          type: 'law',
          isSystem: true,
          ownerId: String(userId),
          isWorking: false,
          currentProjectJson: JSON.stringify({ active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
          agentStateJson: '{}',
          welcomeMsg: '⚖️ 법무법인 알로팝에 오신 것을 환영합니다! 대표님, 자문이나 작성이 필요하신 법률 사안에 대해 알려주십시오.'
        }
      ];

      for (const studioData of systemStudios) {
        const { welcomeMsg, ...dbData } = studioData;
        // 이미 해당 타입의 시스템 스튜디오가 존재하는지 검사
        const exist = await prisma.studio.findFirst({
          where: { type: dbData.type, isSystem: true }
        });

        if (!exist) {
          console.log(`[System Studio Seeding] Creating system studio: ${dbData.name} for user ${userId}`);
          const newStudio = await prisma.studio.create({
            data: dbData
          });

          // 환영 첫 로그 생성
          await prisma.studioLog.create({
            data: {
              studioId: newStudio.id,
              agent: '대표님',
              msg: welcomeMsg,
              error: true
            }
          });
        }
      }
    } catch (err) {
      console.error('[System Studio Seeding] Error:', err);
    }
  }

  // 1.5 런칭 게임 목록 조회 API (아케이드 AI LAB 연동용)
  aistudioRouter.get('/games_status', async (req, res) => {
    try {
      const deployedArtifacts = await prisma.studioArtifact.findMany({
        where: {
          isDeployed: true,
          studio: {
            type: 'game'
          }
        },
        include: {
          studio: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const games = deployedArtifacts.map(artifact => {
        let gamePath = '';
        if (artifact.fileUrl) {
          const match = artifact.fileUrl.match(/output\/([^/]+)\.html/);
          if (match) {
            gamePath = match[1];
          } else {
            gamePath = path.basename(artifact.fileUrl, '.html');
          }
        }
        
        return {
          id: artifact.id,
          name: artifact.name.replace(/\(V\d+\)/g, '').trim(),
          icon: '🎮',
          path: gamePath,
          isAlopopStudio: true,
          serverBest: null
        };
      });

      res.json(games);
    } catch (err) {
      console.error('[aistudioRouter.get(/games_status)] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. 유저별 스튜디오 목록 조회 API (isSystem === true 인 시스템 공용 방 포함)
  aistudioRouter.get('/studios', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });

      // 목록 조회 진입 시점에 3대 시스템 스튜디오 자동 시딩 보장
      await seedSystemStudios(userId);

      const studios = await prisma.studio.findMany({
        where: {
          OR: [
            { ownerId: String(userId) },
            { isSystem: true }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });
      res.json(studios);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. 새 스튜디오 개설 API
  aistudioRouter.post('/create', async (req, res) => {
    console.log('[/api/aistudio/create] req.body:', req.body);
    try {
      const { userId, name, type } = req.body;
      if (!userId || !name || !type) {
        console.warn('[/api/aistudio/create] Missing parameters:', { userId, name, type });
        return res.status(400).json({ error: 'Missing parameters' });
      }

      // ownerId(User.id)가 데이터베이스에 존재하는지 먼저 검증 (Prisma 외래키 제약조건 SQLite 에러 방어)
      const userExists = await prisma.user.findUnique({
        where: { id: String(userId) }
      });

      let finalOwnerId = String(userId);
      if (!userExists) {
        console.warn(`[/api/aistudio/create] User ${userId} not found in DB. Falling back to admin or first user.`);
        
        // 1. 관리자(이명학 님) ID가 존재하는지 체크
        const adminUser = await prisma.user.findFirst({
          where: { isAdmin: true }
        });
        
        if (adminUser) {
          finalOwnerId = adminUser.id;
          console.log(`[/api/aistudio/create] Fallback to admin: ${adminUser.username} (${adminUser.id})`);
        } else {
          // 2. 존재하는 아무 유저로 폴백
          const fallbackUser = await prisma.user.findFirst();
          if (fallbackUser) {
            finalOwnerId = fallbackUser.id;
            console.log(`[/api/aistudio/create] Fallback to first user: ${fallbackUser.username} (${fallbackUser.id})`);
          } else {
            return res.status(400).json({ error: '유효한 사용자 계정이 존재하지 않습니다. 스튜디오를 개설할 수 없습니다.' });
          }
        }
      }

      const newStudio = await prisma.studio.create({
        data: {
          name,
          type,
          isSystem: false,
          ownerId: finalOwnerId,
          isWorking: false,
          currentProjectJson: JSON.stringify({ active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
          agentStateJson: '{}'
        }
      });

      // 개설 환영 첫 시스템 로그 생성
      await prisma.studioLog.create({
        data: {
          studioId: newStudio.id,
          agent: '대표님',
          msg: '🔥 일할 준비가 되어 있습니다. 새 프로젝트를 지시해주세요.',
          error: true
        }
      });

      console.log('[/api/aistudio/create] Studio created successfully:', newStudio.id);
      res.json(newStudio);
    } catch (err) {
      console.error('[/api/aistudio/create] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. 스튜디오 삭제 API (개인 소유만)
  aistudioRouter.delete('/delete/:studioId', async (req, res) => {
    try {
      const { studioId } = req.params;
      const { userId } = req.query;
      
      const studio = await prisma.studio.findUnique({ where: { id: studioId } });
      if (!studio) return res.status(404).json({ error: '스튜디오를 찾을 수 없습니다.' });
      if (studio.isSystem || studio.ownerId !== String(userId)) {
        return res.status(403).json({ error: '삭제 권한이 없습니다.' });
      }

      await prisma.studio.delete({ where: { id: studioId } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. 스튜디오별 산출물 이력 조회 API
  aistudioRouter.get('/history/:studioId', async (req, res) => {
    try {
      const { studioId } = req.params;
      const artifacts = await prisma.studioArtifact.findMany({
        where: { studioId },
        orderBy: { createdAt: 'desc' }
      });
      res.json(artifacts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. 산출물 단건 삭제 API
  aistudioRouter.delete('/history/delete/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

      // HTML 게임 물리 파일인 경우 삭제 시도
      if (artifact.fileUrl && artifact.fileUrl.startsWith('/output/')) {
        const filename = path.basename(artifact.fileUrl);
        const filePath = path.join(outputDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await prisma.studioArtifact.delete({ where: { id: artifactId } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. 문서 텍스트 조회 API
  aistudioRouter.get('/history/content/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

      if (artifact.content) {
        res.send(artifact.content);
      } else if (artifact.fileUrl) {
        // HTML 파일 조회 폴백
        const filename = path.basename(artifact.fileUrl);
        const filePath = path.join(outputDir, filename);
        if (fs.existsSync(filePath)) {
          res.send(fs.readFileSync(filePath, 'utf8'));
        } else {
          res.status(404).send('HTML File not found on disk');
        }
      } else {
        res.status(400).send('No content found');
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. 텍스트 소스코드 직접 덮어쓰기 API (에디터/문서보정용)
  aistudioRouter.post('/history/content/:artifactId', express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
      const { artifactId } = req.params;
      const newText = req.body;
      
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

      if (artifact.content !== null) {
        // 마크다운 문서 텍스트 DB 업데이트
        await prisma.studioArtifact.update({
          where: { id: artifactId },
          data: { content: newText }
        });
        res.json({ success: true });
      } else if (artifact.fileUrl) {
        // HTML 게임 소스 덮어쓰기
        const filename = path.basename(artifact.fileUrl);
        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, newText, 'utf8');
        res.json({ success: true });
      } else {
        res.status(400).json({ error: '잘못된 산출물 형식입니다.' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. 포트제로 정식 게임 배포 API (PM2 연동)
  aistudioRouter.post('/deploy/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact || !artifact.fileUrl) return res.status(404).json({ error: '배포할 HTML 파일을 찾을 수 없습니다.' });

      const fileName = path.basename(artifact.fileUrl);
      const safeGameName = artifact.name.replace(/\(V\d+\)/g, '').replace(/[^a-zA-Z0-9가-힣_\-]/g, '').trim().replace(/\s+/g, '_');
      const gameTitle = safeGameName || 'AloGame';

      const sourceHtmlPath = path.join(outputDir, fileName);
      if (!fs.existsSync(sourceHtmlPath)) return res.status(404).json({ error: '물리 게임 파일이 서버 디스크에 존재하지 않습니다.' });

      const htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

      // 윈도우 PM2 ecosystem.config.js 분석 및 포트 3070~3089 자동 검출
      const ecoPath = 'c:/seoha/ecosystem.config.js';
      if (!fs.existsSync(ecoPath)) throw new Error('c:/seoha/ecosystem.config.js 경로를 찾을 수 없습니다.');
      
      let ecoContent = fs.readFileSync(ecoPath, 'utf8');
      const nameRegex = /name:\s*["'](\d{2})-/g;
      let match;
      const usedIds = new Set();
      while ((match = nameRegex.exec(ecoContent)) !== null) {
        usedIds.add(parseInt(match[1]));
      }

      let nextId = -1;
      for (let i = 70; i <= 89; i++) {
        if (!usedIds.has(i)) {
          nextId = i;
          break;
        }
      }
      if (nextId === -1) {
        throw new Error('게임 배포 포트(3070~3089)가 모두 가득 찼습니다.');
      }

      const port = 3000 + nextId;
      const appName = `${nextId}-${gameTitle.replace(/[^a-zA-Z0-9-]/g, '')}`;

      const targetDir = `c:/seoha/${appName}`;
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const publicDir = path.join(targetDir, 'public');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

      fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent, 'utf8');

      const packageJson = {
        name: appName,
        version: '1.0.0',
        scripts: { start: 'node server.js' },
        dependencies: { express: '^4.18.2' }
      };
      fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');

      const serverJsContent = `const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || ${port};

app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log('Game server listening on port ' + PORT);
});`;
      fs.writeFileSync(path.join(targetDir, 'server.js'), serverJsContent, 'utf8');

      // ecosystem.config.js 자동 추가 기입
      const newAppString = `    { name: "${appName}", script: "server.js", cwd: "c:/seoha/${appName}", env: { PORT: ${port} } },\n`;
      ecoContent = ecoContent.replace('{ name: "90-ai-studio"', newAppString + '    { name: "90-ai-studio"');
      fs.writeFileSync(ecoPath, ecoContent, 'utf8');

      // 라이브 윈도우 환경 쉘 기동 (windowsHide: true 적용하여 도스창 방지)
      execSync('npm install', { cwd: targetDir, stdio: 'ignore', windowsHide: true });
      
      const cleanEnv = Object.assign({}, process.env);
      delete cleanEnv.PORT;
      execSync(`pm2 start ecosystem.config.js --only "${appName}"`, { cwd: 'c:/seoha', env: cleanEnv, stdio: 'ignore', windowsHide: true });
      execSync('pm2 save', { stdio: 'ignore', windowsHide: true });

      // DB 상태 업데이트
      await prisma.studioArtifact.update({
        where: { id: artifactId },
        data: { isDeployed: true }
      });

      // 소켓 알림
      io.to(artifact.studioId).emit('logStudio', {
        agent: 'Bob',
        msg: `🚀 배포가 끝났습니다! 접속 주소: http://www.alonics.com:${port}`,
        error: false,
        createdAt: new Date()
      });

      res.json({ success: true, port });
    } catch (err) {
      console.error('[AI Studio Deploy Err]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 10. 배포 해제 API
  aistudioRouter.post('/undeploy/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact || !artifact.fileUrl) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

      const safeGameName = artifact.name.replace(/\(V\d+\)/g, '').replace(/[^a-zA-Z0-9가-힣_\-]/g, '').trim().replace(/\s+/g, '_');
      const gameTitle = safeGameName || 'AloGame';

      const ecoPath = 'c:/seoha/ecosystem.config.js';
      if (fs.existsSync(ecoPath)) {
        let ecoContent = fs.readFileSync(ecoPath, 'utf8');
        
        // 정규식으로 ecosystem.config.js에서 해당 app 제거
        const appRegex = new RegExp(`\\s*\\{\\s*name:\\s*["'](\\d{2})-${gameTitle.replace(/[^a-zA-Z0-9-]/g, '')}["'][\\s\\S]*?\\},`, 'i');
        const match = ecoContent.match(appRegex);
        if (match) {
          const matchedBlock = match[0];
          const appName = matchedBlock.match(/name:\s*["']([^"']+)["']/)[1];
          
          ecoContent = ecoContent.replace(matchedBlock, '');
          fs.writeFileSync(ecoPath, ecoContent, 'utf8');

          // PM2 제거 쉘 가동 (windowsHide: true 적용하여 도스창 방지)
          execSync(`pm2 delete "${appName}"`, { cwd: 'c:/seoha', stdio: 'ignore', windowsHide: true });
          execSync('pm2 save', { stdio: 'ignore', windowsHide: true });

          // 로컬 node 디렉토리 제거
          const targetDir = `c:/seoha/${appName}`;
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
        }
      }

      await prisma.studioArtifact.update({
        where: { id: artifactId },
        data: { isDeployed: false }
      });

      io.to(artifact.studioId).emit('logStudio', {
        agent: 'Bob',
        msg: `🛑 정식 배포가 중단 및 회수되었습니다.`,
        error: true,
        createdAt: new Date()
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[AI Studio Undeploy Err]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // REST API 라우터 expressApp에 연동
  expressApp.use('/api/aistudio', aistudioRouter);

  // ---- 寃뚯엫 ?먯닔 API ?꾨줉??(game-portal:3000 ?쇰줈 ?ъ썙?? ----
  // next.config.ts??rewrite??鍮뚮뱶 ?꾩뿉留??곸슜?섎?濡? Express ?덈꺼?먯꽌 吏곸젒 泥섎━
  expressApp.use('/api/highscore', express.json(), (req, res) => {
    const http = require('http');
    const qs = req.query && Object.keys(req.query).length > 0
      ? '?' + new URLSearchParams(req.query).toString()
      : '';
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/highscore${req.path === '/' ? '' : req.path}${qs}`,
      method: req.method,
      headers: { 'Content-Type': 'application/json' }
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => res.status(502).json({ error: 'game-portal unavailable' }));
    if (req.method === 'POST' && req.body) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  });

  // ---- Pet365Care ?대? ?뚯폆 由대젅??濡쒖쭅 ----
  expressApp.use('/api/internal/pet365-relay', express.json(), async (req, res) => {
    const internalHeader = req.headers['x-alopop-internal'];
    if (internalHeader !== internalApiSecret) return res.status(403).json({ error: 'Forbidden' });

    const { targetUserId, message } = req.body;
    if (!targetUserId || !message) return res.status(400).json({ error: 'Missing parameters' });

    const roomSet = io.sockets.adapter.rooms.get(targetUserId);

    if (roomSet && roomSet.size > 0) {
      // ?좎?媛 ?⑤씪?????뚯폆?쇰줈 吏곸젒 ?꾩넚 (ACK ?湲?
      try {
        io.to(targetUserId).timeout(3000).emit('receive_message', message, async (err, responses) => {
          if (err || !responses || Object.keys(responses).length === 0) {
            console.log(`[Pet365-Relay] ?좑툘 ACK timeout for ${targetUserId}, treating as offline`);
            await saveOfflineNotice(targetUserId, message);
            sendWebPush(targetUserId, message).catch(console.error);
            return res.json({ delivered: false });
          }
          console.log(`[Pet365-Relay] ??Delivered to ${targetUserId} via socket`);
          return res.json({ delivered: true });
        });
      } catch (e) {
        console.error('[Pet365-Relay] Socket emit error:', e);
        return res.json({ delivered: false });
      }
    } else {
      // ?좎?媛 ?ㅽ봽?쇱씤 ??OfflineMessage DB?????+ ?몄떆 ?뚮┝
      console.log(`[Pet365-Relay] ?뱿 User ${targetUserId} is offline`);
      await saveOfflineNotice(targetUserId, message);
      sendWebPush(targetUserId, message).catch(console.error);
      return res.json({ delivered: false });
    }
  });

  // ---- OpenClaw ?대? API 由대젅??濡쒖쭅 ----
  expressApp.use('/api/internal/claw-message', express.json(), async (req, res) => {
    const internalHeader = req.headers['x-alopop-internal'];
    if (internalHeader !== internalApiSecret) return res.status(403).json({ error: 'Forbidden' });

    const { aiUserId, message, roomId, aiUserName } = req.body;
    if (!aiUserId || !message) return res.status(400).json({ error: 'Missing parameters' });
    
    // Find the socket connected by this agent
    let targetSocket = null;
    for (const [id, socket] of io.sockets.sockets.entries()) {
      if (socket.isAgent && socket.userId === aiUserId) {
        targetSocket = socket;
        break;
      }
    }
    
    if (!targetSocket) {
      return res.status(404).json({ error: 'OpenClaw Agent is not currently connected' });
    }
    
    try {
      // Emit the message to the bridge
      console.log(`[DEBUG] Emitting agent_task to socket ${targetSocket.id} for AI ${aiUserId}`);
      targetSocket.emit('agent_task', { message, roomId });
      
      // Tell everyone in the room that the AI is typing!
      if (roomId && aiUserId) {
        io.to(roomId).emit('typing_start', { roomId, userId: aiUserId, userName: aiUserName || 'AI' });
      }

      return res.status(200).json({ success: true, message: "Task sent to OpenClaw" });
    } catch (e) {
      console.error('OpenClaw Bridge execution error:', e);
      return res.status(504).json({ error: 'OpenClaw Gateway did not respond in time or an error occurred', details: String(e) });
    }
  });

  expressApp.use('/api/internal/agent-tool', express.json(), async (req, res) => {
    const internalHeader = req.headers['x-alopop-internal'];
    if (internalHeader !== internalApiSecret) return res.status(403).json({ error: 'Forbidden' });

    const { aiUserId, tool, args } = req.body;
    if (!aiUserId || !tool) return res.status(400).json({ error: 'Missing parameters' });

    let targetSocket = null;
    for (const [id, socket] of io.sockets.sockets.entries()) {
      if (socket.isAgent && socket.userId === aiUserId) {
        targetSocket = socket;
        break;
      }
    }

    if (!targetSocket) {
      return res.status(404).json({ error: 'OpenClaw Agent is not currently connected' });
    }

    targetSocket.timeout(30000).emit('execute_tool', { tool, args: args || {} }, (err, responses) => {
      if (err) return res.status(504).json({ error: 'OpenClaw Agent tool timed out' });
      return res.json(responses?.[0] || {});
    });
  });

  // ---- OpenClaw AI ?먯씠?꾪듃 ?뚮┝ 諛?硫붿떆吏 釉뚮줈?쒖틦?ㅽ듃 濡쒖쭅 ----
  expressApp.use('/api/internal/vibe-notify', express.json(), async (req, res) => {
    const internalHeader = req.headers['x-alopop-internal'];
    if (internalHeader !== internalApiSecret) return res.status(403).json({ error: 'Forbidden' });

    const { action, roomId, aiUserId, aiUserName, message } = req.body;
    if (!action || !roomId || !aiUserId) return res.status(400).json({ error: 'Missing parameters' });
    
    try {
      if (action === 'start') {
        io.to(roomId).emit('vibe_coding_start', { roomId, aiId: aiUserId, aiName: aiUserName || 'OpenAlo' });
      } else if (action === 'message') {
        io.to(roomId).emit('vibe_coding_end', { roomId, aiId: aiUserId });
        
        // Construct standard message object
        if (message) {
          const room = await getRoomWithMembers(roomId);
          if (room && room.members) {
            room.members.forEach((member) => {
              const targetId = member.userId;
              if (targetId === message.senderId) return; // Skip sending to the AI itself (not that it has a local DB)

              const roomSet = io.sockets.adapter.rooms.get(targetId);
              if (roomSet && roomSet.size > 0) {
                // Online
                io.to(targetId).timeout(3000).emit('receive_message', message, async (err, responses) => {
                  if (err || !responses || Object.keys(responses).length === 0) {
                    await saveOfflineNotice(targetId, message);
                    sendWebPush(targetId, message).catch(console.error);
                  }
                });
              } else {
                // Offline
                saveOfflineNotice(targetId, message);
                sendWebPush(targetId, message).catch(console.error);
              }
            });
          }
        }
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('Vibe notify error:', e);
      return res.status(500).json({ error: String(e) });
    }
  });

  // Next.js 濡쒖슦?덈꺼 ?쇱슦??泥섎━ (Express v5 ?댁긽 ?명솚)
  expressApp.use((req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> ?? Ready on http://${hostname}:${port}`);
    console.log('> ?썳截?Custom Express Server with Socket.io running (No-Log Mode)');
    
    // ?붾젅洹몃옩 遊?珥덇린??

  });
});
