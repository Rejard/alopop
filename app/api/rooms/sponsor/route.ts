import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
  try {
    const { userId, roomId, sponsorMode, sponsorModel, sponsorPrice } = await request.json();
    
    if (!userId || !roomId) {
      return NextResponse.json({ error: 'userId and roomId are required' }, { status: 400 });
    }

    // 요청자가 해당 방의 멤버이자 '방장'인지 확인
    const member = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: userId,
          roomId: roomId,
        }
      }
    });

    if (!member || !member.isHost) {
      return NextResponse.json({ error: 'Only the host can modify the sponsor settings' }, { status: 403 });
    }

    // 방의 스폰서 설정(방장 스폰서 연산 기능) 업데이트
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { 
        sponsorMode, 
        sponsorModel,
        sponsorPrice: sponsorPrice !== undefined ? Number(sponsorPrice) : undefined
      }
    });

    return NextResponse.json(updatedRoom, { status: 200 });
  } catch (error: any) {
    console.error('Failed to update room sponsor settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
