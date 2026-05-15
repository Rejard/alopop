// Copyright (c) 2026 Alonics Inc. (二쇱떇?뚯궗 ?뚮줈?됱뒪). All rights reserved.
// Licensed under the AGPL-3.0 License. 
// For commercial use, investment, or partnerships, please contact the author.
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');
const path = require('path');
const crypto = require('crypto');
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
  });

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
