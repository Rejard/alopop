import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function getSessionSecret() {
  return 'INi2CKTnizs9MBG3fUFC9LWuYZKlZTctAZ7E_My6QKs';
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('base64url');
}

function createSessionToken(userId) {
  const payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

async function runSocketTest() {
  const userId = 'socket_tester_' + Date.now();
  const roomId = 'test_room_' + Date.now();
  
  await prisma.user.create({
    data: { id: userId, username: 'SocketTester', email: userId + '@test.com' }
  });
  await prisma.room.create({
    data: { id: roomId, name: 'Socket Test Room', isGroup: true, members: { create: [{ userId }] } }
  });

  const sessionToken = createSessionToken(userId);

  const socketOptions = {
    extraHeaders: {
      Cookie: `alo_session=${sessionToken}`
    }
  };

  console.log('Connecting Tab A...');
  const socketA = io('http://127.0.0.1:3099', socketOptions);
  
  await new Promise(r => socketA.on('connect', r));
  socketA.emit('join_room', roomId);
  
  await new Promise(r => setTimeout(r, 500));

  console.log('Connecting Tab B...');
  const socketB = io('http://127.0.0.1:3099', socketOptions);
  
  await new Promise(r => socketB.on('connect', r));
  socketB.emit('join_room', roomId);
  
  await new Promise(r => setTimeout(r, 500));

  console.log('Disconnecting Tab B...');
  
  // Tab A listens for presence updates
  let lastPresence = null;
  socketA.on('room_presence_update', (data) => {
    lastPresence = data;
    console.log('Presence update received on Tab A:', data);
  });

  socketB.disconnect();

  await new Promise(r => setTimeout(r, 1000));

  console.log('Final presence on Tab A:', lastPresence);

  if (lastPresence === null || lastPresence.activeUsers.includes(userId)) {
    console.log('✅ PRESENCE FIX VERIFIED! User is still present in the room.');
  } else {
    console.error('❌ BUG DETECTED! User was removed from presence when Tab B disconnected.');
  }

  socketA.disconnect();
  await prisma.roomMember.deleteMany({ where: { userId } });
  await prisma.room.delete({ where: { id: roomId } });
  await prisma.user.delete({ where: { id: userId } });
}

runSocketTest().catch(console.error).finally(() => prisma.$disconnect());
