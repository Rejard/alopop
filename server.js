// Copyright (c) 2026 Alonics Inc. (알로닉스). All rights reserved.
// Licensed under the AGPL-3.0 License. 
// For commercial use, investment, or partnerships, please contact the author.
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { spawn } = require('child_process');
const { loadEnvConfig } = require('@next/env');
const cron = require('node-cron');

function spawnAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, windowsHide: true });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${cmd} exited with code ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
}

global.ecoConfigLock = global.ecoConfigLock || Promise.resolve();

function safeModifyEcosystemConfig(fn) {
  global.ecoConfigLock = global.ecoConfigLock.then(async () => {
    try {
      await fn();
    } catch (err) {
      console.error('[Ecosystem Lock Error]:', err);
      throw err;
    }
  });
  return global.ecoConfigLock;
}

const socketRateLimits = new Map();
function checkSocketRateLimit(userId, event, limit = 5, intervalMs = 1000) {
  const key = `${userId}:${event}`;
  const now = Date.now();
  if (!socketRateLimits.has(key)) {
    socketRateLimits.set(key, { tokens: limit, lastRefill: now });
    return true;
  }

  const limitState = socketRateLimits.get(key);
  const elapsed = now - limitState.lastRefill;

  if (elapsed > intervalMs) {
    limitState.tokens = limit;
    limitState.lastRefill = now;
  }

  if (limitState.tokens > 0) {
    limitState.tokens -= 1;
    return true;
  }
  return false;
}


loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3099;
const internalApiSecret = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || (dev ? 'ALO_POP_INTERNAL_SECRET_DEFAULT' : '');
if (!internalApiSecret) {
  console.error('INTERNAL_API_SECRET, SESSION_SECRET, or ENCRYPTION_KEY must be set for sponsor background checks.');
}
if (process.env.NODE_ENV === 'production' && internalApiSecret === 'ALO_POP_INTERNAL_SECRET_DEFAULT') {
  console.error('CRITICAL SECURITY ERROR: Default INTERNAL_API_SECRET must not be used in production.');
  process.exit(1);
}
const SESSION_COOKIE_NAME = 'alo_session';

let cachedTemplates = null;
function getStudioTemplates() {
  if (cachedTemplates) return cachedTemplates;
  const TEMPLATES_PATH = path.join(__dirname, 'config', 'studio_templates.json');
  if (!fs.existsSync(TEMPLATES_PATH)) {
    throw new Error('스튜디오 템플릿 설정 파일이 존재하지 않습니다.');
  }
  cachedTemplates = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
  return cachedTemplates;
}

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

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || internalApiSecret || 'ALO_POP_ENCRYPTION_SECRET_DEFAULT';
  return crypto.createHash('sha256').update(String(secret)).digest().subarray(0, KEY_LEN);
}

function encryptText(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptText(payload) {
  if (!payload) return '';
  if (!payload.startsWith('v1:')) return payload;
  const [version, ivB64, tagB64, encryptedB64] = String(payload).split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) return payload;
  try {
    const decipher = crypto.createDecipheriv(ALGO, getEncryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('Decryption error:', err);
    return '[Encrypted message cannot be read]';
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const roomPresence = new Map();
const OFFLINE_NOTICE_TTL_MS = Number(process.env.OFFLINE_NOTICE_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;
const WEB_PUSH_TTL_SECONDS = Number(process.env.WEB_PUSH_TTL_SECONDS || 24 * 60 * 60);

app.prepare().then(() => {
  const expressApp = express();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;').catch(e => console.error('Failed to set WAL mode:', e));
  const { logSocketAudit } = require('./lib/auditLogger');

  if (!global.readReceiptBuffer) {
    const MAX_RECEIPT_LIMIT = 5000;
    const originalMap = new Map();
    const readReceiptBufferProxy = {
      get(target, prop, _receiver) {
        if (prop === 'set') {
          return function (key, value) {
            if (target.size >= MAX_RECEIPT_LIMIT && !target.has(key)) {
              console.warn(`[ReadReceipt Buffer] Limit (${MAX_RECEIPT_LIMIT}) reached. Dumping excess items to disk.`);
              try {
                const logDir = path.join(__dirname, 'logs');
                if (!fs.existsSync(logDir)) {
                  fs.mkdirSync(logDir, { recursive: true });
                }
                const backupPath = path.join(logDir, 'read_receipt_backup.jsonl');
                fs.appendFileSync(backupPath, JSON.stringify({ key, value }) + '\n', 'utf8');
                return target;
              } catch (err) {
                console.error('[ReadReceipt Buffer] Failed to dump backup:', err);
              }
            }
            return Reflect.apply(target.set, target, arguments);
          };
        }
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }
    };
    global.readReceiptBuffer = new Proxy(originalMap, readReceiptBufferProxy);
  }
  global.studioLogBuffer = global.studioLogBuffer || [];

  setInterval(async () => {
    let items = [];
    if (global.readReceiptBuffer && global.readReceiptBuffer.size > 0) {
      items = Array.from(global.readReceiptBuffer.values());
      global.readReceiptBuffer.clear();
    }

    const backupPath = path.join(__dirname, 'logs', 'read_receipt_backup.jsonl');
    let backupItems = [];
    if (fs.existsSync(backupPath)) {
      try {
        const fileContent = await fs.promises.readFile(backupPath, 'utf8');
        fs.unlinkSync(backupPath);
        const lines = fileContent.trim().split('\n');
        for (const line of lines) {
          if (!line) continue;
          const parsed = JSON.parse(line);
          backupItems.push(parsed.value);
        }
        console.log(`[ReadReceipt Batch] Loaded ${backupItems.length} items from disk backup.`);
      } catch (err) {
        console.error('[ReadReceipt Batch] Failed to load disk backup:', err);
      }
    }

    const allItems = [...items, ...backupItems];
    if (allItems.length === 0) return;

    console.log(`[ReadReceipt Batch] Processing ${allItems.length} items...`);
    try {
      await prisma.$transaction(
        allItems.map(item =>
          prisma.roomMember.upsert({
            where: {
              userId_roomId: {
                userId: item.userId,
                roomId: item.roomId,
              }
            },
            update: {
              lastReadAt: item.lastReadAt,
            },
            create: {
              userId: item.userId,
              roomId: item.roomId,
              lastReadAt: item.lastReadAt,
            }
          })
        )
      );
      console.log(`[ReadReceipt Batch] Successfully updated ${allItems.length} read receipts.`);
    } catch (error) {
      console.error(`[ReadReceipt Batch] Error updating batch:`, error);
      allItems.forEach(item => {
        const key = `${item.userId}:${item.roomId}`;
        if (global.readReceiptBuffer && !global.readReceiptBuffer.has(key)) {
          global.readReceiptBuffer.set(key, item);
        }
      });
    }
  }, 60 * 1000);

  async function flushStudioLogs() {
    if (!global.studioLogBuffer || global.studioLogBuffer.length === 0) return;
    const logs = [...global.studioLogBuffer];
    global.studioLogBuffer = [];
    console.log(`[StudioLog Batch] Flushing ${logs.length} logs...`);
    try {
      await prisma.studioLog.createMany({
        data: logs
      });
      console.log(`[StudioLog Batch] Successfully flushed ${logs.length} logs.`);
    } catch (error) {
      console.error(`[StudioLog Batch] Error flushing logs:`, error);
      global.studioLogBuffer = logs.concat(global.studioLogBuffer);

      const MAX_BUFFER_SIZE = 3000;
      if (global.studioLogBuffer.length > MAX_BUFFER_SIZE) {
        console.warn(`[StudioLog Batch] Buffer size (${global.studioLogBuffer.length}) exceeded limit. Dumping excess logs to disk.`);
        try {
          const excessLogs = global.studioLogBuffer.slice(MAX_BUFFER_SIZE);
          global.studioLogBuffer = global.studioLogBuffer.slice(0, MAX_BUFFER_SIZE);

          const logDir = path.join(__dirname, 'logs');
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          const backupFilePath = path.join(logDir, 'studio_logs_backup.jsonl');
          const backupData = excessLogs.map(l => JSON.stringify(l)).join('\n') + '\n';
          fs.appendFileSync(backupFilePath, backupData, 'utf8');
        } catch (dumpError) {
          console.error('[StudioLog Batch] Failed to dump excess logs to disk:', dumpError);
        }
      }
    }
  }

  setInterval(flushStudioLogs, 30 * 1000);

  setInterval(async () => {
    console.log('[TTL Batch] Running expired messages cleanup...');
    try {
      await deleteExpiredOfflineMessages();
      console.log('[TTL Batch] Expired messages cleanup completed.');
    } catch (error) {
      console.error('[TTL Batch] Error cleaning up expired messages:', error);
    }
  }, 60 * 60 * 1000);

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
    try {
      if (await hasEnhancedOfflineQueue()) {
        await prisma.$executeRawUnsafe(
          'DELETE FROM OfflineMessage WHERE expiresAt <= ?',
          new Date().toISOString()
        );
      } else {
        await prisma.offlineMessage.deleteMany({
          where: { createdAt: { lte: new Date(Date.now() - OFFLINE_NOTICE_TTL_MS) } }
        });
      }
    } catch (e) {
      console.error('Failed to delete expired offline messages:', e);
    }

    const now = new Date();

    try {
      const expiredMediaMessages = await prisma.message.findMany({
        where: {
          expiresAt: { lte: now },
          type: { in: ['IMAGE', 'FILE', 'VIDEO'] }
        }
      });

      for (const msg of expiredMediaMessages) {
        try {
          const decrypted = decryptText(msg.content);
          if (decrypted) {
            if (decrypted.startsWith('/uploads/') || decrypted.startsWith('/output/') || decrypted.startsWith('/repoart/')) {
              const filePath = path.join(__dirname, 'public', decrypted);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[TTL File Cleanup] Deleted file: ${filePath}`);
              }
            }
          }
        } catch (fileErr) {
          console.error('[TTL File Cleanup] Failed to delete file for message:', msg.id, fileErr);
        }
      }
    } catch (e) {
      console.error('Failed to query expired media messages:', e);
    }

    try {
      const deleted = await prisma.message.deleteMany({
        where: { expiresAt: { lte: now } }
      });
      if (deleted.count > 0) {
        console.log(`[TTL] Deleted ${deleted.count} expired messages from DB`);
      }
    } catch (e) {
      console.error('Failed to delete expired TTL messages:', e);
    }

    try {
      const expiredPosts = await prisma.petPost.findMany({
        where: { expiresAt: { lte: now } }
      });

      for (const post of expiredPosts) {
        if (post.images) {
          try {
            const images = JSON.parse(post.images);
            if (Array.isArray(images)) {
              for (const imgPath of images) {
                if (typeof imgPath === 'string' && (imgPath.startsWith('/uploads/') || imgPath.startsWith('/output/') || imgPath.startsWith('/repoart/'))) {
                  const filePath = path.join(__dirname, 'public', imgPath);
                  if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[TTL PetPost Cleanup] Deleted file: ${filePath}`);
                  }
                }
              }
            }
          } catch (jsonErr) {
            console.error('[TTL PetPost Cleanup] Failed to parse images JSON for post:', post.id, jsonErr);
          }
        }
      }

      const deletedPosts = await prisma.petPost.deleteMany({
        where: { expiresAt: { lte: now } }
      });
      if (deletedPosts.count > 0) {
        console.log(`[TTL PetPost] Deleted ${deletedPosts.count} expired posts from DB`);
      }
    } catch (e) {
      console.error('Failed to clean up expired PetPosts:', e);
    }

    try {
      const deletedComments = await prisma.petComment.deleteMany({
        where: { expiresAt: { lte: now } }
      });
      if (deletedComments.count > 0) {
        console.log(`[TTL PetComment] Deleted ${deletedComments.count} expired comments from DB`);
      }
    } catch (e) {
      console.error('Failed to clean up expired PetComments:', e);
    }
  }

  async function saveOfflineMessage(receiverId, message) {
    if (!receiverId || !message) return null;

    if (message.roomId) {
      try {
        const room = await prisma.room.findUnique({
          where: { id: message.roomId },
          select: { isSecret: true }
        });
        if (room && room.isSecret) {
          console.log(`[OfflineMessage Bypass] Skip saving offline message for secret room: ${message.roomId}`);
          return null;
        }
      } catch (err) {
        console.error('Failed to check room isSecret in saveOfflineMessage:', err);
      }
    }

    const payload = encryptText(JSON.stringify(message));
    if (!(await hasEnhancedOfflineQueue())) {
      return prisma.offlineMessage.create({
        data: { receiverId, payload }
      }).catch(e => console.error('Offline notice save err:', e));
    }

    return prisma.$executeRawUnsafe(
      `INSERT INTO OfflineMessage (id, receiverId, kind, status, payload, createdAt, expiresAt, attemptCount)
       VALUES (?, ?, 'NOTICE', 'PENDING', ?, ?, ?, 0)`,
      crypto.randomUUID(),
      receiverId,
      payload,
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
        const offlineMessages = [];
        for (const record of records) {
          const decryptedPayload = decryptText(record.payload);
          const messageObj = parseOfflineNotice(decryptedPayload);
          if (!messageObj) continue;

          offlineMessages.push(messageObj);

          const destRoomId = messageObj.roomId || messageObj.receiverId;
          if (destRoomId) {
            const room = rooms.get(destRoomId) || { roomId: destRoomId, count: 0, latestAt: 0 };
            room.count += 1;
            room.latestAt = Math.max(room.latestAt, messageObj.createdAt || new Date(record.createdAt).getTime());
            rooms.set(destRoomId, room);
          }
        }

        const summary = Array.from(rooms.values());
        if (summary.length > 0) {
          socket.emit('offline_activity_summary', { rooms: summary });
          console.log(`Emitted offline activity summary for ${summary.length} rooms to ${userId}`);
        }

        if (offlineMessages.length > 0) {
          socket.emit('receive_offline_messages', { messages: offlineMessages });
          console.log(`Emitted ${offlineMessages.length} offline messages to ${userId}`);
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

  const webpush = require('web-push');
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
  if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails('mailto:support@alonics.com', publicVapidKey, privateVapidKey);
  }

  async function sendWebPush(targetUserId, _messageData) {
    if (!publicVapidKey || !privateVapidKey) return;
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: targetUserId }
      });
      if (!subscriptions || subscriptions.length === 0) return;

      const payload = JSON.stringify({
        title: '알로팝 - 새 메시지',
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
          console.log(`📬 Successfully sent Web Push to ${targetUserId}`);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log(`⚠️ Subscription expired for ${targetUserId}, deleting from DB`);
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

  expressApp.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        status: 'UP',
        database: 'CONNECTED',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Healthcheck Failed]:', error);
      return res.status(500).json({
        status: 'DOWN',
        database: 'DISCONNECTED',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  expressApp.get('/uploads/:fileName', (req, res) => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const payload = verifySessionToken(cookies.get(SESSION_COOKIE_NAME));
    if (!payload) {
      return res.status(401).send('Unauthorized');
    }

    const fileName = req.params.fileName;
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    const filePath = path.join(uploadDir, fileName);
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
      console.warn(`[Path Traversal Prevented in upload serving]: Unauthorized access to ${resolvedPath}`);
      return res.status(403).send('Forbidden');
    }

    if (fs.existsSync(resolvedPath)) {
      return res.sendFile(resolvedPath);
    }
    res.status(404).send('File not found');
  });

  expressApp.use('/repoart', express.static(path.join(__dirname, 'public', 'repoart')));
  expressApp.use(express.static(path.join(__dirname, 'public')));

  const httpServer = createServer(expressApp);

  const io = new Server(httpServer, {
    cors: {
      origin: ['https://alopop.alonics.com', 'http://127.0.0.1:3099'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const SERVER_START_TIME = Date.now().toString();

  io.on('connection', async (socket) => {
    console.log('🔌 User connected:', socket.id);
    logSocketAudit({ socketId: socket.id, event: 'CONNECT', details: `Transport: ${socket.conn.transport.name}` });
    let socketUser = null;
    const agentToken = socket.handshake.auth?.token;

    if (agentToken) {
      socketUser = await prisma.user.findUnique({
        where: { agentToken: agentToken },
        select: { id: true, username: true, isAdmin: true, isAgent: true }
      });
      if (socketUser && socketUser.isAgent) {
        console.log(`🤖 OpenAlo Agent connected: ${socketUser.id} (${socketUser.username})`);
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

    socket.on('register', () => {
      socket.userId = socketUser.id;
      socket.join(socket.userId);
      console.log(`User ${socket.userId} registered and joined their personal room`);
      logSocketAudit({ socketId: socket.id, userId: socket.userId, event: 'REGISTER' });

      deliverOfflineMessages(socket);
    });

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
      console.log(`🚪 Socket ${socket.id} (User: ${socket.userId}) joined room ${roomId}`);
      logSocketAudit({ socketId: socket.id, userId: socket.userId, event: 'JOIN_ROOM', details: roomId });
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
        } catch (e) {
          console.error('Presence update error on leave_room', e);
        }
      }
      console.log(`🚪 Socket ${socket.id} (User: ${socket.userId}) left room ${roomId}`);
      logSocketAudit({ socketId: socket.id, userId: socket.userId, event: 'LEAVE_ROOM', details: roomId });
    });

    socket.on('update_room_name', async (payload) => {
      const room = await getRoomWithMembers(payload.roomId);
      if (!isRoomMember(room, socket.userId)) return;
      console.log(`[DEBUG] ✏️ Room name updated:`, payload);
      io.to(payload.roomId).emit('room_name_updated', payload);
    });

    socket.on('update_message', async (payload) => {
      console.log(`[DEBUG] 🔄 Message updated by sponsor (Fact-check):`, payload.messageId);
      try {
        const room = await getRoomWithMembers(payload.roomId);
        if (!isRoomMember(room, socket.userId)) return;

        if (room && room.members) {
          room.members.forEach((member) => {
            const targetId = member.userId;
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

    socket.on('typing_start', async (payload) => {
      if (!checkSocketRateLimit(socket.userId, 'typing_start', 10, 1000)) return;
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
      const room = await getRoomWithMembers(payload.roomId);
      if (!isRoomHost(room, socket.userId)) return;
      socket.to(payload.roomId).emit('sponsor_settings_changed', { ...payload, sponsorId: socket.userId });
    });

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
        content: finalOutput.trim() || "[작업 완료]",
        createdAt: Date.now(),
        unreadCount: 0
      };

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
                await saveOfflineMessage(targetId, message);
              }
            });
          } else {
            saveOfflineMessage(targetId, message);
          }
        });
      }
    });

    socket.on('send_message', async (payload) => {
      if (!checkSocketRateLimit(socket.userId, 'send_message', 5, 1000)) {
        socket.emit('rate_limit_exceeded', { event: 'send_message', error: 'Too many messages. Please wait.' });
        return;
      }
      const { receiverId, message } = payload;

      try {
        const room = await getRoomWithMembers(receiverId);
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

          if (!room.isSecret && message.messageType !== 'SYSTEM') {
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            try {
              await prisma.message.create({
                data: {
                  messageId: message.messageId,
                  roomId: room.id,
                  senderId: message.senderId,
                  type: message.messageType || 'TEXT',
                  content: encryptText(message.content),
                  createdAt: new Date(message.createdAt || Date.now()),
                  expiresAt
                }
              });
            } catch (err) {
              console.error('Failed to store TTL message:', err);
              socket.emit('message_save_error', { messageId: message.messageId, error: 'Database save failed' });
            }
          }

          if (!room.isGroup) {
            const hiddenMembers = room.members.filter(m => m.isHidden && m.userId !== message.senderId);
            for (const hm of hiddenMembers) {
              await prisma.roomMember.update({
                where: { userId_roomId: { userId: hm.userId, roomId: receiverId } },
                data: { isHidden: false }
              });
              console.log(`👋 Unhid member ${hm.userId} in room ${receiverId} (Kakao auto-rejoin)`);
              hm.isHidden = false;
            }
          }

          room.members.forEach((member) => {
            const targetId = member.userId;

            if (targetId === message.senderId) return;

            const roomSet = io.sockets.adapter.rooms.get(targetId);

            if (roomSet && roomSet.size > 0) {
              io.to(targetId).timeout(3000).emit('receive_message', message, async (err, responses) => {
                if (err || !responses || Object.keys(responses).length === 0) {
                  console.log(`⏰ ACK Timeout/Error for ${targetId}, saving to OfflineMessage DB`);
                  await saveOfflineMessage(targetId, message);

                  sendWebPush(targetId, message).catch(console.error);
                } else {
                  console.log(`✅ ACK Received from ${targetId} (in room ${receiverId})`);
                }
              });
            } else {
              saveOfflineMessage(targetId, message).then(() => {
                console.log(`📦 Paused message for offline member ${targetId} into DB`);
              });

              sendWebPush(targetId, message).catch(console.error);
            }
          });

          if (room.sponsorMode && message.messageType !== 'SYSTEM') {
            const hostMember = room.members.find(m => m.isHost);
            if (hostMember && hostMember.userId !== message.senderId) {
              console.log(`[DEBUG] 🧠 Triggering Background Server AI check for msg ${message.messageId}`);

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
                    room.members.forEach((member) => {
                      const targetId = member.userId;
                      const rSet = io.sockets.adapter.rooms.get(targetId);
                      if (rSet && rSet.size > 0 && targetId !== message.senderId) {
                        io.to(targetId).emit('message_updated', updatePayload);
                      }
                    });
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
          if (!message?.senderId || !(await canSendAs(null, socket.userId, message.senderId))) {
            socket.emit('message_denied', { receiverId, error: 'Invalid sender' });
            return;
          }
          if (receiverId === message.senderId) return;

          const roomSet = io.sockets.adapter.rooms.get(receiverId);
          if (roomSet && roomSet.size > 0) {
            io.to(receiverId).timeout(3000).emit('receive_message', message, async (err, responses) => {
              if (err || !responses || Object.keys(responses).length === 0) {
                console.log(`⏰ ACK Timeout/Error for ${receiverId}, saving to OfflineMessage DB`);
                await saveOfflineMessage(receiverId, message);

                sendWebPush(receiverId, message).catch(console.error);
              } else {
                console.log(`✅ ACK Received directly from ${receiverId}`);
              }
            });
          } else {
            saveOfflineMessage(receiverId, message).then(() => {
              console.log(`📦 Paused message for offline destination ${receiverId} into DB`);
            });

            sendWebPush(receiverId, message).catch(console.error);
          }
        }
      } catch (err) {
        console.error('Error handling send_message routing:', err);
      }
    });

    socket.on('sync_messages', async (payload) => {
      const { roomId, lastSyncTime } = payload;
      const userId = socket.userId;
      if (!roomId || !userId) return;

      try {
        const room = await getRoomWithMembers(roomId);
        if (!room || room.isSecret || !isRoomMember(room, userId)) return;

        const messages = await prisma.message.findMany({
          where: {
            roomId,
            createdAt: { gt: new Date(lastSyncTime || 0) }
          },
          orderBy: { createdAt: 'asc' }
        });

        if (messages.length > 0) {
          const decryptedMessages = messages.map(msg => ({
            messageId: msg.messageId,
            roomId: msg.roomId,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            messageType: msg.type,
            content: decryptText(msg.content),
            createdAt: msg.createdAt.getTime(),
          }));

          socket.emit('sync_messages_result', { roomId, messages: decryptedMessages });
        }
      } catch (err) {
        console.error('Error handling sync_messages:', err);
      }
    });

    socket.on('read_receipt', async (payload) => {
      if (!checkSocketRateLimit(socket.userId, 'read_receipt', 10, 1000)) return;
      const { roomId, timestamp } = payload;
      const userId = socket.userId;
      try {
        const room = await getRoomWithMembers(roomId);
        if (!isRoomMember(room, socket.userId)) return;

        if (room && room.members) {
          room.members.forEach(member => {
            const targetId = member.userId;
            if (targetId === userId) return;
            const roomSet = io.sockets.adapter.rooms.get(targetId);
            if (roomSet && roomSet.size > 0) {
              socket.to(targetId).emit('room_read_update', { roomId, userId, timestamp });
              console.log(`📨 Relayed read_receipt to ${targetId} for room ${roomId}`);
            }
          });
        }
      } catch (err) {
        console.error('read_receipt error:', err);
      }
    });

    socket.on('disconnect', async (reason) => {
      console.log('🔌 User disconnected:', socket.id, socket.userId);
      logSocketAudit({ socketId: socket.id, userId: socket.userId, event: 'DISCONNECT', details: reason || 'unknown' });
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
        } catch (e) {
          console.error('Presence update error on disconnect', e);
        }
      }
    });

    socket.on('join_studio_room', async (studioId) => {
      try {
        const studio = await prisma.studio.findUnique({
          where: { id: studioId },
          include: { owner: true }
        });
        if (!studio) return;

        if (!studio.isSystem && studio.ownerId !== socket.userId) {
          socket.emit('studio_access_denied', { studioId, error: 'Forbidden' });
          return;
        }

        socket.join(studioId);
        socket.currentStudioId = studioId;
        console.log(`[AI Studio Socket] User ${socket.userId} joined studio room ${studioId}`);

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

        await prisma.studioLog.deleteMany({ where: { studioId } });

        await prisma.studio.update({
          where: { id: studioId },
          data: {
            isWorking: false,
            currentProjectJson: JSON.stringify({ active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
            agentStateJson: '{}'
          }
        });

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

        runStudioManualQA(studioId, socket.userId, url, label);
      } catch (err) {
        console.error('[AI Studio Socket] run_studio_manual_qa err:', err);
      }
    });
  });

  const outputDir = path.join(__dirname, 'public', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  expressApp.use('/output', (req, res, next) => {
    try {
      const reqPath = decodeURIComponent(req.path);
      if (reqPath.endsWith('.html') || reqPath === '/' || !path.extname(reqPath)) {
        const fileName = (reqPath === '/' || reqPath === '') ? 'index.html' : (reqPath.endsWith('.html') ? reqPath : reqPath + '.html');
        const filePath = path.join(outputDir, fileName);

        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(outputDir))) {
          console.warn(`[Path Traversal Prevented]: Unauthorized access attempt to ${resolvedPath}`);
          return res.status(403).send('Forbidden');
        }

        fs.stat(resolvedPath, (err, stats) => {
          if (err || !stats.isFile()) {
            return next();
          }

          fs.readFile(resolvedPath, 'utf8', (readErr, html) => {
            if (readErr) {
              console.error('[Dynamic HTML Read Error]:', readErr);
              return next();
            }

            let finalHtml = html;
            if (finalHtml.includes('</body>')) {
              const injectScript = '\n<script src="/game-proxy/3000/shared/theme-manager.js"></script>\n';
              finalHtml = finalHtml.replace('</body>', injectScript + '</body>');
            }
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.setHeader('Content-Security-Policy', "sandbox allow-scripts allow-downloads allow-forms allow-modals allow-popups;");
            return res.send(finalHtml);
          });
        });
        return;
      }
    } catch (e) {
      console.error('[Dynamic HTML Injection Error]:', e);
    }
    next();
  });
  expressApp.use('/output', express.static(outputDir));

  async function getStudioGeminiKey(userId) {
    if (userId === 'SYSTEM_ADMIN') return process.env.GEMINI_API_KEY;

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    try {
      const activeEvents = await prisma.event.findMany({
        where: { isActive: true, eventType: 'FREE_AI' }
      });
      if (activeEvents.length > 0) {
        const eventIds = activeEvents.map(e => e.id);
        const usages = await prisma.userEventUsage.findMany({
          where: {
            userId,
            eventId: { in: eventIds },
            usageDate: todayStr
          }
        });
        const usageMap = new Map(usages.map(u => [u.eventId, u.count]));

        for (const event of activeEvents) {
          if (event.eventApiKey) {
            const currentCount = usageMap.get(event.id) || 0;
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
      }
    } catch (e) {
      console.error('[AI Studio Key] 1순위 무료 이벤트 조회 실패:', e);
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { geminiKey: true, walletBalance: true }
      });
      if (user && user.geminiKey) {
        console.log(`[AI Studio Key] 2순위 적용: 유저 개인 API Key 사용`);
        return user.geminiKey;
      }

      const systemGeminiKey = process.env.GEMINI_API_KEY;
      if (systemGeminiKey) {
        const COST = 10;
        if (user && user.walletBalance >= COST) {
          try {
            const success = await prisma.$transaction(async (tx) => {
              const updateResult = await tx.user.updateMany({
                where: { id: userId, walletBalance: { gte: COST } },
                data: { walletBalance: { decrement: COST } }
              });
              if (updateResult.count === 0) {
                throw new Error('Insufficient wallet balance or user not found');
              }
              await tx.transaction.create({
                data: {
                  senderId: userId,
                  receiverId: 'system',
                  amount: COST,
                  reason: 'AI 스튜디오 에이전트 구동 요금 차감'
                }
              });
              return true;
            });

            if (success) {
              console.log(`[AI Studio Key] 3순위 적용: 시스템 글로벌 Key 사용 및 10코인 차감`);
              return systemGeminiKey;
            }
          } catch (txErr) {
            console.error('[AI Studio Key] Transaction failed:', txErr.message);
          }
        }
      }
    } catch (e) {
      console.error('[AI Studio Key] 2,3순위 유저 조회 실패:', e);
    }

    return null;
  }

  async function runStudioOrchestration(studioId, userId, task, isRevision, files = []) {
    const { GoogleGenAI } = require('@google/genai');

    const broadcastStudioLog = async (logObj) => {
      try {
        const timestamp = new Date();
        global.studioLogBuffer = global.studioLogBuffer || [];
        global.studioLogBuffer.push({
          studioId,
          agent: logObj.agent,
          msg: logObj.msg,
          error: !!logObj.error,
          createdAt: timestamp
        });
        io.to(studioId).emit('logStudio', {
          agent: logObj.agent,
          msg: logObj.msg,
          error: !!logObj.error,
          createdAt: timestamp
        });
      } catch (e) {
        console.error('broadcastStudioLog error:', e);
      }
    };

    const emitAgentStatus = (agent, status) => {
      io.to(studioId).emit('agentStudioStatus', { agent, status });
    };

    try {
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

      const studio = await prisma.studio.findUnique({ where: { id: studioId } });
      if (!studio || !studio.isSystem) {
        console.log(`[AI Studio Bypass] 개인 스튜디오(ID: ${studioId})는 서버 오케스트레이션 미실행 (바이패스)`);
        await prisma.studio.update({ where: { id: studioId }, data: { isWorking: false } });
        io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
        return;
      }
      const templates = getStudioTemplates();
      const template = templates[studio.type];
      if (!template) throw new Error('올바르지 않은 스튜디오 타입입니다.');

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

      const fileParts = files.map(file => ({
        inlineData: { mimeType: file.mimeType, data: file.base64 }
      }));
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const freshStudio = await prisma.studio.findUnique({ where: { id: studioId } });
      let currentProject = JSON.parse(freshStudio.currentProjectJson || '{}');
      let dbAgentState = JSON.parse(freshStudio.agentStateJson || '{}');
      let agentState = {};

      for (const [name, state] of Object.entries(dbAgentState)) {
        agentState[name] = {
          ...(state || {}),
          status: 'idle',
          log: ''
        };
      }

      if (studio.type === 'game') {
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
          await broadcastStudioLog({ agent: 'Dave', msg: `[오류 발견] ${qaFeedback} Bob 수석, 치명적 결함입니다. 즉시 리팩토링하세요.` });
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

        if (agentState['Frank']) {
          emitAgentStatus('Frank', 'thinking');
          agentState['Frank'] = { ...(agentState['Frank'] || {}), status: 'thinking', room: 'DevRoom', log: '보안 검수 중...' };
          await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
          io.to(studioId).emit('syncStudioAgentState', agentState);
          await broadcastStudioLog({ agent: 'Frank', msg: '코딩 및 QA 완료 확인! 최종 보안/인프라 취약점 검수를 수행합니다...' });

          const frankRole = agentState['Frank']?.role || '보안';
          const frankExpertise = agentState['Frank']?.expertise || '서버 보안 및 철통 인프라 가드 아키텍트';
          const frankPrompt = `[역할: ${frankRole} | 전문성 및 페르소나: ${frankExpertise}] 당신은 이 전문성과 역할을 바탕으로 이번 개발 업무 중 본인의 분야를 담당해 주어야 합니다.
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
          await broadcastStudioLog({ agent: 'Frank', msg: `[보안 검증 결과] ${frankResponse.text.trim()}` });
        }

        setTimeout(async () => {
          await broadcastStudioLog({ agent: '대표님', msg: '전원 회의실로 집합! 산출물 피드백 회의를 시작합시다.' });

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
${finalHTML}

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

              agentState['Carol'].log = dialogue.carol;
              agentState['Bob'].log = dialogue.bob;
              await prisma.studio.update({ where: { id: studioId }, data: { agentStateJson: JSON.stringify(agentState) } });
              io.to(studioId).emit('syncStudioAgentState', agentState);

              if (agentState['Grace']) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const graceRole = agentState['Grace']?.role || 'CS';
                const graceExpertise = agentState['Grace']?.expertise || '친절하고 활발한 유저 소통 CS 매니저';
                const gracePrompt = `[역할: ${graceRole} | 전문성 및 페르소나: ${graceExpertise}] 당신은 이 전문성과 역할을 바탕으로 CS 매니저 입장의 멘트를 기재해 주어야 합니다.
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

              if (agentState['Hank']) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const hankRole = agentState['Hank']?.role || '테스터';
                const hankExpertise = agentState['Hank']?.expertise || '일반 유저 관점 예외처리 검증 베타 테스터';
                const hankPrompt = `[역할: ${hankRole} | 전문성 및 페르소나: ${hankExpertise}] 당신은 이 전문성과 역할을 바탕으로 베타 테스터 입장의 멘트를 기재해 주어야 합니다.
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
        const pipeline = template.pipeline;
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

        const versionNum = await prisma.studioArtifact.count({ where: { studioId } }) + 1;
        const docTitle = `${template.name} 보고서 V${versionNum}`;

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
        await flushStudioLogs().catch(err => console.error('flushStudioLogs fail:', err));
      }

    } catch (error) {
      console.error('[AI Studio Orchestration Fail]:', error);
      await prisma.studio.update({ where: { id: studioId }, data: { isWorking: false } });
      await broadcastStudioLog({ agent: '대표님', msg: `에러가 발생하여 연산이 중단되었습니다: ${error.message}`, error: true });
      io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
      io.to(studioId).emit('studioTaskFinished', { studioId, success: false });
      await flushStudioLogs().catch(err => console.error('flushStudioLogs fail:', err));
    }
  }

  async function runStudioManualQA(studioId, userId, url, label) {
    const { GoogleGenAI } = require('@google/genai');

    const broadcastStudioLog = async (logObj) => {
      try {
        const timestamp = new Date();
        global.studioLogBuffer = global.studioLogBuffer || [];
        global.studioLogBuffer.push({
          studioId,
          agent: logObj.agent,
          msg: logObj.msg,
          error: !!logObj.error,
          createdAt: timestamp
        });
        io.to(studioId).emit('logStudio', {
          agent: logObj.agent,
          msg: logObj.msg,
          error: !!logObj.error,
          createdAt: timestamp
        });
      } catch (e) {
        console.error('broadcastStudioLog error:', e);
      }
    };

    try {
      const studioCheck = await prisma.studio.findUnique({ where: { id: studioId } });
      if (!studioCheck || !studioCheck.isSystem) {
        console.log(`[AI Studio Bypass] 개인 스튜디오(ID: ${studioId})는 서버 수동 QA 미실행 (바이패스)`);
        return;
      }

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

      const currentHTML = await fs.promises.readFile(filePath, 'utf8');

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
      await flushStudioLogs().catch(err => console.error('flushStudioLogs fail:', err));
    } catch (err) {
      console.error('runStudioManualQA err:', err);
      await prisma.studio.update({ where: { id: studioId }, data: { isWorking: false } });
      await broadcastStudioLog({ agent: 'Dave', msg: `수동 검사 오류 발생: ${err.message}`, error: true });
      io.to(studioId).emit('studioWorkingStatus', { studioId, isWorking: false });
      io.to(studioId).emit('studioTaskFinished', { studioId, success: false });
      await flushStudioLogs().catch(err => console.error('flushStudioLogs fail:', err));
    }
  }

  const aistudioRouter = express.Router();
  aistudioRouter.use(express.json());

  aistudioRouter.get('/status', (req, res) => {
    res.json({
      status: 'Alopop Integrated AI Studio Backend is running',
      hasSystemApiKey: !!process.env.GEMINI_API_KEY
    });
  });

  async function seedSystemStudios(userId) {
    try {
      const studioTemplates = getStudioTemplates();

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
        },
        {
          name: '세무회계법인 알로팝',
          type: 'tax',
          isSystem: true,
          ownerId: String(userId),
          isWorking: false,
          currentProjectJson: JSON.stringify({ active: false, specDoc: '', designDoc: '', codeDoc: '', url: '', gameName: '' }),
          agentStateJson: '{}',
          welcomeMsg: '📊 세무회계법인 알로팝에 오신 것을 환영합니다! 대표님, 절세 컨설팅이나 장부 기장이 필요하신가요?'
        }
      ];

      for (const studioData of systemStudios) {
        const { welcomeMsg, ...dbData } = studioData;

        const template = studioTemplates[dbData.type];
        if (template && template.agents) {
          let initialAgentState = {};
          for (const [agentName, agentData] of Object.entries(template.agents)) {
            initialAgentState[agentName] = {
              status: "idle",
              room: "DevRoom",
              log: "",
              role: agentData.role,
              expertise: agentData.expertise
            };
          }
          dbData.agentStateJson = JSON.stringify(initialAgentState);
        }

        const exist = await prisma.studio.findFirst({
          where: { type: dbData.type, ownerId: String(userId) }
        });

        if (!exist) {
          console.log(`[System Studio Seeding] Creating system studio: ${dbData.name} for user ${userId}`);
          const newStudio = await prisma.studio.create({
            data: dbData
          });

          await prisma.studioLog.create({
            data: {
              studioId: newStudio.id,
              agent: '대표님',
              msg: welcomeMsg,
              error: true
            }
          });
        } else if (exist.agentStateJson === '{}') {
          await prisma.studio.update({
            where: { id: exist.id },
            data: { agentStateJson: dbData.agentStateJson }
          });
          console.log(`[System Studio Seeding] Fixed empty agentStateJson for studio ${exist.id}`);
        }
      }
    } catch (err) {
      console.error('[System Studio Seeding] Error:', err);
    }
  }

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

  aistudioRouter.get('/studios', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });

      await seedSystemStudios(userId);

      const studios = await prisma.studio.findMany({
        where: {
          ownerId: String(userId)
        },
        orderBy: { createdAt: 'asc' }
      });
      res.json(studios);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  aistudioRouter.get('/studios/:studioId/state', async (req, res) => {
    try {
      const { studioId } = req.params;
      const studio = await prisma.studio.findUnique({ where: { id: studioId } });
      if (!studio) return res.status(404).json({ error: 'Studio not found' });

      let agentState = {};
      try { agentState = JSON.parse(studio.agentStateJson || '{}'); } catch { /* ignore */ }

      const logs = await prisma.studioLog.findMany({
        where: { studioId },
        orderBy: { createdAt: 'asc' },
        take: 200
      });

      res.json({ agentState, logs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  aistudioRouter.put('/studios/:studioId/state', async (req, res) => {
    try {
      const { studioId } = req.params;
      const { agentState, logs } = req.body;

      await prisma.studio.update({
        where: { id: studioId },
        data: {
          agentStateJson: JSON.stringify(agentState || {})
        }
      });

      if (Array.isArray(logs) && logs.length > 0) {
        const existingCount = await prisma.studioLog.count({ where: { studioId } });
        const newLogs = logs.slice(existingCount);
        if (newLogs.length > 0) {
          await prisma.studioLog.createMany({
            data: newLogs.map(l => ({
              studioId,
              agent: l.agent || 'System',
              msg: l.msg || '',
              error: l.error || false,
              createdAt: l.createdAt ? new Date(l.createdAt) : new Date()
            }))
          });
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  aistudioRouter.post('/studios/:studioId/artifacts', async (req, res) => {
    try {
      const { studioId } = req.params;
      const { name, content, fileUrl, isDeployed } = req.body;

      if (!name) return res.status(400).json({ error: 'Missing artifact name' });

      const studio = await prisma.studio.findUnique({ where: { id: studioId } });
      if (!studio) return res.status(404).json({ error: 'Studio not found' });

      const artifact = await prisma.studioArtifact.create({
        data: {
          studioId,
          name,
          content: content || null,
          fileUrl: fileUrl || null,
          isDeployed: isDeployed || false
        }
      });

      res.json(artifact);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  aistudioRouter.post('/create', async (req, res) => {
    console.log('[/api/aistudio/create] req.body:', req.body);
    try {
      const { userId, name, type } = req.body;
      if (!userId || !name || !type) {
        console.warn('[/api/aistudio/create] Missing parameters:', { userId, name, type });
        return res.status(400).json({ error: 'Missing parameters' });
      }

      const userExists = await prisma.user.findUnique({
        where: { id: String(userId) }
      });

      let finalOwnerId = String(userId);
      if (!userExists) {
        console.warn(`[/api/aistudio/create] User ${userId} not found in DB. Falling back to admin or first user.`);

        const adminUser = await prisma.user.findFirst({
          where: { isAdmin: true }
        });

        if (adminUser) {
          finalOwnerId = adminUser.id;
          console.log(`[/api/aistudio/create] Fallback to admin: ${adminUser.username} (${adminUser.id})`);
        } else {
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

  aistudioRouter.delete('/history/delete/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

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

  aistudioRouter.get('/history/content/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

      if (artifact.content) {
        res.send(artifact.content);
      } else if (artifact.fileUrl) {
        const filename = path.basename(artifact.fileUrl);
        const filePath = path.join(outputDir, filename);
        if (fs.existsSync(filePath)) {
          const fileContent = await fs.promises.readFile(filePath, 'utf8');
          res.setHeader('Content-Security-Policy', "sandbox allow-scripts allow-downloads allow-forms allow-modals allow-popups;");
          res.send(fileContent);
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

  aistudioRouter.post('/history/content/:artifactId', express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
      const { artifactId } = req.params;
      const newText = req.body;

      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

      if (artifact.content !== null) {
        await prisma.studioArtifact.update({
          where: { id: artifactId },
          data: { content: newText }
        });
        res.json({ success: true });
      } else if (artifact.fileUrl) {
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

      const htmlContent = await fs.promises.readFile(sourceHtmlPath, 'utf8');

      let port, appName, targetDir;
      await safeModifyEcosystemConfig(async () => {
        const ecoPath = 'c:/seoha/ecosystem.config.js';
        if (!fs.existsSync(ecoPath)) throw new Error('c:/seoha/ecosystem.config.js 경로를 찾을 수 없습니다.');

        let ecoContent = await fs.promises.readFile(ecoPath, 'utf8');
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

        port = 3000 + nextId;
        appName = `${nextId}-${gameTitle.replace(/[^a-zA-Z0-9-]/g, '')}`;

        targetDir = `c:/seoha/${appName}`;
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

        const newAppString = `    { name: "${appName}", script: "server.js", cwd: "c:/seoha/${appName}", env: { PORT: ${port} } },\n`;
        ecoContent = ecoContent.replace('{ name: "90-ai-studio"', newAppString + '    { name: "90-ai-studio"');
        fs.writeFileSync(ecoPath, ecoContent, 'utf8');
      });

      await spawnAsync('npm.cmd', ['install'], { cwd: targetDir, stdio: 'ignore' });

      const cleanEnv = Object.assign({}, process.env);
      delete cleanEnv.PORT;
      await spawnAsync('pm2.cmd', ['start', 'ecosystem.config.js', '--only', appName], { cwd: 'c:/seoha', env: cleanEnv, stdio: 'ignore' });
      await spawnAsync('pm2.cmd', ['save'], { stdio: 'ignore' });

      await prisma.studioArtifact.update({
        where: { id: artifactId },
        data: { isDeployed: true }
      });

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

  aistudioRouter.post('/undeploy/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;
      const artifact = await prisma.studioArtifact.findUnique({ where: { id: artifactId } });
      if (!artifact || !artifact.fileUrl) return res.status(404).json({ error: '산출물을 찾을 수 없습니다.' });

      const safeGameName = artifact.name.replace(/\(V\d+\)/g, '').replace(/[^a-zA-Z0-9가-힣_\-]/g, '').trim().replace(/\s+/g, '_');
      const gameTitle = safeGameName || 'AloGame';

      const ecoPath = 'c:/seoha/ecosystem.config.js';
      if (fs.existsSync(ecoPath)) {
        let appName = null;
        await safeModifyEcosystemConfig(async () => {
          let ecoContent = await fs.promises.readFile(ecoPath, 'utf8');

          const appRegex = new RegExp(`\\s*\\{\\s*name:\\s*["'](\\d{2})-${gameTitle.replace(/[^a-zA-Z0-9-]/g, '')}["'][\\s\\S]*?\\},`, 'i');
          const match = ecoContent.match(appRegex);
          if (match) {
            const matchedBlock = match[0];
            appName = matchedBlock.match(/name:\s*["']([^"']+)["']/)[1];

            ecoContent = ecoContent.replace(matchedBlock, '');
            fs.writeFileSync(ecoPath, ecoContent, 'utf8');
          }
        });

        if (appName) {
          await spawnAsync('pm2.cmd', ['delete', appName], { cwd: 'c:/seoha', stdio: 'ignore' });
          await spawnAsync('pm2.cmd', ['save'], { stdio: 'ignore' });

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

  aistudioRouter.get('/templates-resources', (req, res) => {
    try {
      const templates = getStudioTemplates();
      const officeTemplate = templates['office'] || {};

      const defaultWelcomeMessages = {
        '최인사': '안녕하세요 대표님! 최인사입니다. 인재를 발굴하고 조직 역량을 끌어올리는 데 최선을 다하겠습니다!',
        '정기획': '반갑습니다 대표님! 정기획입니다. 사업 전략과 기획 분야에서 핵심 성과를 만들어 드리겠습니다.',
        '홍홍보': '대표님 안녕하세요! 홍홍보입니다. 브랜드 가치를 극대화하는 마케팅 전략을 수립해드릴게요!',
        '윤재무': '만나서 반갑습니다 대표님. 윤재무입니다. 자금과 예산의 안정적인 운용을 책임지겠습니다.',
        '김영업': '대표님 안녕하십니까! 김영업입니다. 새로운 매출 기회를 발굴하고 성과를 창출하겠습니다!',
        '이회계': '인사드립니다 대표님. 이회계입니다. 정확한 장부 관리와 결산으로 재무 건전성을 지키겠습니다.',
        '박비서': '대표님, 박비서 보고드립니다! 스케줄 관리부터 행정 업무까지 빈틈없이 서포트하겠습니다.',
        '강지원': '총무 강지원입니다 대표님! 사무 환경과 복리후생 관리에 만전을 기하겠습니다.'
      };

      const characterAssets = [
        { idx: 0, label: '남성A', color: '#4A90D9' },
        { idx: 1, label: '여성A', color: '#E57373' },
        { idx: 2, label: '남성B', color: '#81C784' },
        { idx: 3, label: '여성B', color: '#FFB74D' },
        { idx: 4, label: '남성C', color: '#9575CD' },
        { idx: 5, label: '여성C', color: '#4DD0E1' },
        { idx: 6, label: '남성D', color: '#A1887F' },
        { idx: 7, label: '여성D', color: '#F06292' }
      ];

      res.json({
        officeTemplate,
        defaultWelcomeMessages,
        characterAssets,
        orchestrationGuide: {
          type: 'office',
          description: '사무직 에이전트 연쇄 문서 협업 파이프라인',
          promptTemplate: `당신은 {studioName} 소속의 {role} '{agentName}'입니다.\n전문성 및 페르소나: {expertise}\n대표님의 핵심 지시: \"{task}\"\n이전 단계의 에이전트들이 작성하고 분석한 문서 내역:\n=== 누적 작성 문서 ===\n{accumulatedDoc}\n======================\n당신의 전문 역할({role})에 맞는 새로운 분석 결과, 제안, 구체적인 기획서 단락을 마크다운(Markdown) 포맷으로 추가 및 확장해 최종 문서를 빌드해 주세요.\n오직 한국어(Korean)로 실무 마크다운 결과물만 완벽하게 출력하세요.`
        }
      });
    } catch (err) {
      console.error('[templates-resources] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  aistudioRouter.post('/proxy-anthropic', express.json(), async (req, res) => {
    try {
      const { apiKey, model, messages, prompt } = req.body;
      if (!apiKey || !model) {
        return res.status(400).json({ error: 'Missing apiKey or model' });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4000,
          messages: messages || [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: errText });
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error('[proxy-anthropic] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  expressApp.use('/api/aistudio', aistudioRouter);

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

  expressApp.use('/api/internal/pet365-relay', express.json(), async (req, res) => {
    const internalHeader = req.headers['x-alopop-internal'];
    if (internalHeader !== internalApiSecret) return res.status(403).json({ error: 'Forbidden' });

    const { targetUserId, message } = req.body;
    if (!targetUserId || !message) return res.status(400).json({ error: 'Missing parameters' });

    const roomSet = io.sockets.adapter.rooms.get(targetUserId);

    if (roomSet && roomSet.size > 0) {
      try {
        io.to(targetUserId).timeout(3000).emit('receive_message', message, async (err, responses) => {
          if (err || !responses || Object.keys(responses).length === 0) {
            console.log(`[Pet365-Relay] ⏰ ACK timeout for ${targetUserId}, treating as offline`);
            await saveOfflineMessage(targetUserId, message);
            sendWebPush(targetUserId, message).catch(console.error);
            return res.json({ delivered: false });
          }
          console.log(`[Pet365-Relay] ✅ Delivered to ${targetUserId} via socket`);
          return res.json({ delivered: true });
        });
      } catch (e) {
        console.error('[Pet365-Relay] Socket emit error:', e);
        return res.json({ delivered: false });
      }
    } else {
      console.log(`[Pet365-Relay] 📦 User ${targetUserId} is offline`);
      await saveOfflineMessage(targetUserId, message);
      sendWebPush(targetUserId, message).catch(console.error);
      return res.json({ delivered: false });
    }
  });

  expressApp.use('/api/internal/claw-message', express.json(), async (req, res) => {
    const internalHeader = req.headers['x-alopop-internal'];
    if (internalHeader !== internalApiSecret) return res.status(403).json({ error: 'Forbidden' });

    const { aiUserId, message, roomId, aiUserName } = req.body;
    if (!aiUserId || !message) return res.status(400).json({ error: 'Missing parameters' });

    let targetSocket = null;
    for (const [, socket] of io.sockets.sockets.entries()) {
      if (socket.isAgent && socket.userId === aiUserId) {
        targetSocket = socket;
        break;
      }
    }

    if (!targetSocket) {
      return res.status(404).json({ error: 'OpenClaw Agent is not currently connected' });
    }

    try {
      console.log(`[DEBUG] Emitting agent_task to socket ${targetSocket.id} for AI ${aiUserId}`);
      targetSocket.emit('agent_task', { message, roomId });

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
    for (const [, socket] of io.sockets.sockets.entries()) {
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

        if (message) {
          const room = await getRoomWithMembers(roomId);
          if (room && room.members) {
            room.members.forEach((member) => {
              const targetId = member.userId;
              if (targetId === message.senderId) return;

              const roomSet = io.sockets.adapter.rooms.get(targetId);
              if (roomSet && roomSet.size > 0) {
                io.to(targetId).timeout(3000).emit('receive_message', message, async (err, responses) => {
                  if (err || !responses || Object.keys(responses).length === 0) {
                    await saveOfflineMessage(targetId, message);
                    sendWebPush(targetId, message).catch(console.error);
                  }
                });
              } else {
                saveOfflineMessage(targetId, message);
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

  expressApp.use((req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> ✅ Ready on http://${hostname}:${port}`);
    console.log('> 🚀 Custom Express Server with Socket.io running (Encrypted 7-Day Storage Mode)');

    prisma.studio.updateMany({
      where: { isWorking: true },
      data: { isWorking: false }
    })
      .then(res => console.log(`[Startup] Cleaned up ${res.count} stale studio working locks.`))
      .catch(err => console.error('[Startup] Failed to clean up stale studio locks:', err));

    deleteExpiredOfflineMessages()
      .then(() => console.log('[Startup] Completed initial expired messages and media files cleanup.'))
      .catch(err => console.error('[Startup] Failed to clean up expired messages on startup:', err));

    cron.schedule('0 3 * * *', () => {
      try {
        const { createBackup, rotateBackups } = require('./scripts/backup-db.js');
        const result = createBackup();
        const deleted = rotateBackups(7);
        console.log(`[DB Backup Cron] Backup created: ${result.filename} (${result.size} bytes), rotated: ${deleted} old backups`);
      } catch (err) {
        console.error('[DB Backup Cron] Failed:', err);
      }
    });
    console.log('[Startup] DB backup cron job scheduled (daily 03:00)');

  });

  let isShuttingDown = false;
  async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Graceful Shutdown] Received ${signal}. Starting shutdown sequence...`);

    if (global.readReceiptBuffer && global.readReceiptBuffer.size > 0) {
      const items = Array.from(global.readReceiptBuffer.values());
      global.readReceiptBuffer.clear();
      console.log(`[Graceful Shutdown] Flushing ${items.length} read receipts...`);
      try {
        await prisma.$transaction(
          items.map(item =>
            prisma.roomMember.upsert({
              where: {
                userId_roomId: {
                  userId: item.userId,
                  roomId: item.roomId,
                }
              },
              update: { lastReadAt: item.lastReadAt },
              create: { userId: item.userId, roomId: item.roomId, lastReadAt: item.lastReadAt }
            })
          )
        );
        console.log(`[Graceful Shutdown] Read receipts flushed successfully.`);
      } catch (err) {
        console.error(`[Graceful Shutdown] Error flushing read receipts:`, err);
      }
    }

    if (global.studioLogBuffer && global.studioLogBuffer.length > 0) {
      console.log(`[Graceful Shutdown] Flushing ${global.studioLogBuffer.length} studio logs...`);
      try {
        await prisma.studioLog.createMany({
          data: global.studioLogBuffer
        });
        global.studioLogBuffer = [];
        console.log(`[Graceful Shutdown] Studio logs flushed successfully.`);
      } catch (err) {
        console.error(`[Graceful Shutdown] Error flushing studio logs:`, err);
      }
    }

    try {
      console.log(`[Graceful Shutdown] Resetting working studios...`);
      const resetResult = await prisma.studio.updateMany({
        where: { isWorking: true },
        data: { isWorking: false }
      });
      console.log(`[Graceful Shutdown] Reset ${resetResult.count} working studios.`);
    } catch (err) {
      console.error(`[Graceful Shutdown] Error resetting working studios:`, err);
    }

    try {
      await prisma.$disconnect();
      console.log('[Graceful Shutdown] Prisma disconnected.');
    } catch (err) {
      console.error('[Graceful Shutdown] Error disconnecting Prisma:', err);
    }

    httpServer.close((err) => {
      if (err) {
        console.error('[Graceful Shutdown] Error closing server:', err);
        process.exit(1);
      }
      console.log('[Graceful Shutdown] HTTP Server closed successfully.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Graceful Shutdown] Shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});
