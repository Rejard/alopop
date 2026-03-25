import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
  try {
    const { roomId, name, requesterId } = await request.json();

    if (!roomId || !requesterId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 요청자가 해당 방의 멤버인지 확인
    const member = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: requesterId,
          roomId: roomId,
        }
      }
    });

    if (!member) {
      return NextResponse.json({ error: '권한이 없습니다 (방 멤버만 이름 수정 가능)' }, { status: 403 });
    }

    // 방 이름 업데이트
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { name: name || null },
    });

    return NextResponse.json(updatedRoom);
  } catch (error) {
    console.error('Update Room Name Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
