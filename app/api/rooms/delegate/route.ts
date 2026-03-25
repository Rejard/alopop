import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { roomId, targetUserId, requesterId } = await request.json();

    if (!roomId || !targetUserId || !requesterId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. 요청자가 해당 방의 방장(isHost: true)인지 확인
    const requester = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: requesterId,
          roomId: roomId
        }
      }
    });

    if (!requester || !requester.isHost) {
      return NextResponse.json({ error: 'Permission denied: Not a host' }, { status: 403 });
    }

    // 2. 방장 권한 변경 트랜잭션: 기존 방장의 권한 박탈, 타겟에게 권한 부여
    await prisma.$transaction([
      prisma.roomMember.update({
        where: {
          userId_roomId: { userId: requesterId, roomId: roomId }
        },
        data: { isHost: false }
      }),
      prisma.roomMember.update({
        where: {
          userId_roomId: { userId: targetUserId, roomId: roomId }
        },
        data: { isHost: true }
      })
    ]);

    return NextResponse.json({ success: true, newHostId: targetUserId });
  } catch (error) {
    console.error('Failed to delegate host:', error);
    return NextResponse.json({ error: 'Failed to delegate host' }, { status: 500 });
  }
}
