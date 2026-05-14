import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

const BOT_USERNAME = 'Pet365Care 🐾';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_INTERNAL_SECRET_DEFAULT';
const SERVER_PORT = process.env.PORT || 3099;

/**
 * postMessage 기반 Pet365Care 알림 처리 API
 * 클라이언트(iframe postMessage)에서 호출되며, 인증된 유저의 세션 쿠키로 자동 인증됩니다.
 * 기존 /api/integrations/pet365care/notify (시크릿 키 방식)의 postMessage 대응 버전입니다.
 */
export async function POST(request: Request) {
  try {
    // 세션 쿠키 기반 인증 (postMessage → 클라이언트 → 이 API)
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { type, petName, species, roomName, message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Bot 유저 찾기
    const bot = await prisma.user.findFirst({ where: { username: BOT_USERNAME, isAi: true } });
    if (!bot) {
      return NextResponse.json({ error: 'Pet365Care bot not found' }, { status: 500 });
    }

    // 펫별 채팅방 찾기 또는 생성
    let room;
    if (roomName) {
      // roomName이 있으면 해당 이름의 방을 찾기
      const existingRooms = await prisma.room.findMany({
        where: {
          name: roomName,
          members: {
            some: { userId: user.id },
          },
        },
        include: { members: true },
      });
      // bot도 멤버인 방 찾기
      room = existingRooms.find(r => r.members.some(m => m.userId === bot.id)) || null;
    } else {
      // roomName 없으면 기존 1:1 방 찾기
      const existingRooms = await prisma.room.findMany({
        where: {
          isGroup: false,
          members: {
            every: { userId: { in: [bot.id, user.id] } },
          },
        },
        include: { members: true },
      });
      room = existingRooms.find(r => r.members.length === 2 && !r.name) || null;
    }

    if (!room) {
      room = await prisma.room.create({
        data: {
          name: roomName || null,
          isGroup: false,
          members: {
            create: [
              { userId: bot.id, isHost: true },
              { userId: user.id, isHost: false },
            ],
          },
        },
        include: { members: true },
      });
    } else {
      // 숨김 해제 (유저가 방을 나간 경우)
      await prisma.roomMember.updateMany({
        where: { roomId: room.id, isHidden: true },
        data: { isHidden: false },
      });
    }

    // ChatMessage 인터페이스에 맞는 payload 구성
    const chatMessage = {
      messageId: `pet365-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: bot.id,
      senderName: roomName || BOT_USERNAME,
      receiverId: room.id,
      content: message,
      messageType: 'TEXT' as const,
      createdAt: Date.now(),
    };

    // 소켓 직접 relay 시도 (온라인 유저에게 즉시 전달)
    let delivered = false;
    try {
      const relayRes = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/internal/pet365-relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-alopop-internal': INTERNAL_API_SECRET,
        },
        body: JSON.stringify({ targetUserId: user.id, message: chatMessage }),
      });
      const relayResult = await relayRes.json();
      delivered = relayResult.delivered === true;
      console.log(`[Pet365Care PostMessage] Socket relay result: delivered=${delivered}`);
    } catch (relayErr) {
      console.error('[Pet365Care PostMessage] Socket relay failed, falling back to OfflineMessage:', relayErr);
    }

    // 소켓 전달 실패(오프라인)인 경우에만 OfflineMessage DB에 저장
    if (!delivered) {
      await prisma.offlineMessage.create({
        data: {
          receiverId: user.id,
          payload: JSON.stringify(chatMessage),
        },
      });
      console.log(`[Pet365Care PostMessage] Saved to OfflineMessage DB for user ${user.id}`);
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      botId: bot.id,
      delivered,
      chatMessage,
    });
  } catch (error) {
    console.error('[Pet365Care PostMessage] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
