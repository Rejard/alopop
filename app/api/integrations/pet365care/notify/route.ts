import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PET365_SECRET = process.env.PET365CARE_NOTIFY_SECRET || 'pet365care-notify-secret-key';
const BOT_USERNAME = 'Pet365Care 🐾';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_INTERNAL_SECRET_DEFAULT';
const SERVER_PORT = process.env.PORT || 3099;

export async function POST(request: Request) {
  try {
    // 시크릿 키 인증
    const authHeader = request.headers.get('x-pet365-secret');
    if (authHeader !== PET365_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, message, petName, type } = await request.json();

    if (!userId || !message) {
      return NextResponse.json({ error: 'userId and message are required' }, { status: 400 });
    }

    // Bot 유저 찾기
    const bot = await prisma.user.findFirst({ where: { username: BOT_USERNAME, isAi: true } });
    if (!bot) {
      return NextResponse.json({ error: 'Pet365Care bot not found' }, { status: 500 });
    }

    // 대상 유저 확인
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1:1 채팅방 찾기 또는 생성
    let room = await prisma.room.findFirst({
      where: {
        isGroup: false,
        members: {
          every: { userId: { in: [bot.id, userId] } },
        },
      },
      include: { members: true },
    });

    // 정확히 2명인 방만 매칭
    if (room && room.members.length !== 2) room = null;

    if (!room) {
      room = await prisma.room.create({
        data: {
          isGroup: false,
          members: {
            create: [
              { userId: bot.id, isHost: true },
              { userId: userId, isHost: false },
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
      senderName: BOT_USERNAME,
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
        body: JSON.stringify({ targetUserId: userId, message: chatMessage }),
      });
      const relayResult = await relayRes.json();
      delivered = relayResult.delivered === true;
      console.log(`[Pet365Care Notify] Socket relay result: delivered=${delivered}`);
    } catch (relayErr) {
      console.error('[Pet365Care Notify] Socket relay failed, falling back to OfflineMessage:', relayErr);
    }

    // 소켓 전달 실패(오프라인)인 경우에만 OfflineMessage DB에 저장
    if (!delivered) {
      await prisma.offlineMessage.create({
        data: {
          receiverId: userId,
          payload: JSON.stringify(chatMessage),
        },
      });
      console.log(`[Pet365Care Notify] Saved to OfflineMessage DB for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      botId: bot.id,
      delivered,
    });
  } catch (error) {
    console.error('[Pet365Care Notify] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
