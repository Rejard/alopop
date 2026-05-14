import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// Species 이모지 매핑 (클라이언트 utils.ts와 동기화)
const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐶', cat: '🐱', rabbit: '🐰', hamster: '🐹',
  bird: '🐦', turtle: '🐢', duck: '🦆', hedgehog: '🦔',
  fish: '🐟', other: '🐾',
};

/**
 * 이모지를 SVG data URI로 변환 (img 태그에서 바로 사용 가능)
 */
function emojiToAvatarUrl(emoji: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="80" text-anchor="start">${emoji}</text></svg>`
  )}`;
}

/**
 * Pet365Care 알림 API
 *
 * 1. 펫별 봇 유저를 찾거나 생성 (이모지 아바타 포함)
 * 2. 봇 ↔ 유저 간 1:1 채팅방을 찾거나 생성
 * 3. 채팅 메시지를 내부 릴레이로 전송
 */
export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { type, petName, species, roomName, message } = await request.json();
    if (!message || !roomName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emoji = SPECIES_EMOJI[species] || '🐾';
    // 펫별 고유 봇 유저명: "초코 🐾" 형태 (유저별 고유하게)
    const botUsername = `${petName} 🐾`;

    // 1. 펫별 봇 유저 찾기 또는 생성
    let botUser = await prisma.user.findFirst({
      where: {
        username: botUsername,
        isAi: true,
        aiOwnerId: currentUser.id,
      },
    });

    if (!botUser) {
      botUser = await prisma.user.create({
        data: {
          username: botUsername,
          avatar_url: emojiToAvatarUrl(emoji),
          isAi: true,
          aiOwnerId: currentUser.id,
          aiPrompt: `Pet365Care - ${petName}(${species}) 건강 관리 봇`,
        },
      });
      console.log(`[Pet365Care Notify] Created bot user: ${botUsername} (${botUser.id})`);
    } else if (!botUser.avatar_url) {
      // 기존 봇인데 avatar가 없으면 업데이트
      await prisma.user.update({
        where: { id: botUser.id },
        data: { avatar_url: emojiToAvatarUrl(emoji) },
      });
    }

    // 2. 봇 ↔ 현재 유저 간 1:1 채팅방 찾기
    let room = await prisma.room.findFirst({
      where: {
        isGroup: false,
        members: {
          every: {
            userId: { in: [botUser.id, currentUser.id] },
          },
        },
      },
      include: { members: true },
    });

    // 멤버 2명이 정확히 맞는지 확인
    if (room && room.members.length !== 2) {
      room = null;
    }

    if (!room) {
      // 채팅방 생성 — 방 이름은 순수 펫 이름 (이모지 없음)
      room = await prisma.room.create({
        data: {
          name: roomName,
          isGroup: false,
          members: {
            create: [
              { userId: botUser.id, isHost: true },
              { userId: currentUser.id },
            ],
          },
        },
        include: { members: true },
      });
      console.log(`[Pet365Care Notify] Created room: ${room.id} "${roomName}"`);
    }

    // 3. 채팅 메시지 포맷 생성
    const chatMessage = {
      messageId: uuidv4(),
      senderId: botUser.id,
      senderName: botUsername,
      receiverId: room.id,
      content: message,
      messageType: 'TEXT' as const,
      createdAt: Date.now(),
    };

    // 4. 내부 릴레이로 유저에게 실시간 전송
    const port = process.env.PORT || 3099;
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_INTERNAL_SECRET_DEFAULT';

    try {
      await fetch(`http://127.0.0.1:${port}/api/internal/pet365-relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-alopop-internal': internalSecret,
        },
        body: JSON.stringify({
          targetUserId: currentUser.id,
          message: chatMessage,
        }),
      });
    } catch (relayErr) {
      console.error('[Pet365Care Notify] Relay error:', relayErr);
      await prisma.offlineMessage.create({
        data: {
          receiverId: currentUser.id,
          payload: JSON.stringify(chatMessage),
        },
      });
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      chatMessage,
    });
  } catch (error) {
    console.error('[Pet365Care Notify] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
