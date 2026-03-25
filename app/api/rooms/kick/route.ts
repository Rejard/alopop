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

    // 2. 강퇴할 타겟 멤버 삭제
    await prisma.roomMember.delete({
      where: {
        userId_roomId: {
          userId: targetUserId,
          roomId: roomId
        }
      }
    });

    return NextResponse.json({ success: true, kickedUserId: targetUserId });
  } catch (error) {
    console.error('Failed to kick member:', error);
    return NextResponse.json({ error: 'Failed to kick member' }, { status: 500 });
  }
}
