import http from 'http';

// 송금 API 엔드포인트
const TARGET_URL = 'http://127.0.0.1:3099/api/wallet/send';

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

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
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

async function runLoadTest() {
  // 1. 테스트 유저 생성
  const senderId = 'test_sender_' + Date.now();
  const receiverId = 'test_receiver_' + Date.now();
  
  await prisma.user.create({
    data: { id: senderId, username: 'Sender', email: senderId + '@test.com', walletBalance: 100 }
  });
  await prisma.user.create({
    data: { id: receiverId, username: 'Receiver', email: receiverId + '@test.com', walletBalance: 0 }
  });

  const sessionToken = createSessionToken(senderId);

  console.log(`Starting load test: Sender(${senderId}) has 100 coins.`);
  console.log(`Attempting to send 10 coins 20 times concurrently (Should only succeed 10 times)`);

  const requests = Array.from({ length: 20 }).map((_, i) => {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        receiverId,
        amount: 10,
        reason: 'Load Test'
      });

      const options = {
        hostname: '127.0.0.1',
        port: 3099,
        path: '/api/wallet/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Cookie': `alo_session=${sessionToken}`
        }
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: responseBody });
        });
      });

      req.on('error', (e) => {
        resolve({ error: e.message });
      });

      req.write(data);
      req.end();
    });
  });

  const results = await Promise.all(requests);
  
  const successes = results.filter(r => r.status === 200).length;
  const failures = results.filter(r => r.status !== 200).length;

  console.log(`Results: ${successes} Success, ${failures} Failures`);
  if (failures > 0) {
    console.log('First failure body:', results.find(r => r.status !== 200).body);
  }

  // 최종 잔고 확인
  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });

  console.log(`Final Balances - Sender: ${sender.walletBalance}, Receiver: ${receiver.walletBalance}`);
  
  if (sender.walletBalance < 0) {
    console.error('❌ RACE CONDITION DETECTED! Negative balance.');
  } else if (sender.walletBalance === 0 && receiver.walletBalance === 100) {
    console.log('✅ TRANSACTION SAFE! No race conditions.');
  } else {
    console.log('⚠️ UNEXPECTED RESULT');
  }

  // 정리
  await prisma.transaction.deleteMany({ where: { senderId } });
  await prisma.user.delete({ where: { id: senderId } });
  await prisma.user.delete({ where: { id: receiverId } });
}

runLoadTest().catch(console.error).finally(() => prisma.$disconnect());
