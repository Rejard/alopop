import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { roomId, targetUserId } = await request.json();

    if (!roomId || !targetUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 이미 방에 있는지 확인
    const exists = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: targetUserId,
          roomId: roomId
        }
      }
    });

    if (exists) {
      return NextResponse.json({ error: '이미 방에 참가 중인 친구입니다.' }, { status: 400 });
    }

    // 새 친구 초대 멤버십 생성
    const newMember = await prisma.roomMember.create({
      data: {
        roomId,
        userId: targetUserId,
        isHost: false // 초대된 멤버는 일반 유저
      },
      include: {
        user: true
      }
    });

    return NextResponse.json(newMember);
  } catch (error) {
    console.error('Invite Room Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
