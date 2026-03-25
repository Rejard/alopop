import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { roomId, userId } = await request.json();

    if (!roomId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 현재 떠나는 사람의 멤버십 정보 조회
    const leavingMember = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          roomId,
          userId
        }
      }
    });

    if (!leavingMember) {
      return NextResponse.json({ error: '참여 중이지 않은 방입니다.' }, { status: 400 });
    }

    // 통상적인 방 퇴장 삭제 처리
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return NextResponse.json({ error: '방이 존재하지 않습니다.' }, { status: 404 });
    }

    if (room.isGroup) {
      // 그룹방은 멤버에서 완전히 삭제
      await prisma.roomMember.delete({
        where: {
          userId_roomId: {
            roomId,
            userId
          }
        }
      });

      // 남은 사람 조회
      const remainMembers = await prisma.roomMember.findMany({
        where: { roomId },
        orderBy: { joinedAt: 'asc' }
      });

      if (remainMembers.length === 0) {
        // 아무도 안 남았으면 방 자체 삭제
        await prisma.room.delete({
          where: { id: roomId }
        });
      } else {
        // 남은 사람이 있고, 떠난 사람이 방장이었다면
        if (leavingMember.isHost) {
          // 남은 멤버 중 가장 먼저 들어온 사람 1명에게 방장 권한 승계
          await prisma.roomMember.update({
            where: {
              userId_roomId: {
                roomId: roomId,
                userId: remainMembers[0].userId
              }
            },
            data: {
              isHost: true
            }
          });
        }
      }
    } else {
      // 1:1 방은 숨김 처리 (isHidden: true)
      await prisma.roomMember.update({
        where: {
          userId_roomId: {
            roomId,
            userId
          }
        },
        data: {
          isHidden: true
        }
      });

      // 두 명 모두 숨김 상태라면, 아무도 방을 보지 않으므로 방 자체 삭제
      const members = await prisma.roomMember.findMany({ where: { roomId } });
      if (members.every(m => m.isHidden)) {
        await prisma.room.delete({ where: { id: roomId } });
      }
    }



    return NextResponse.json({ success: true, message: '방을 나갔습니다.' });
  } catch (error) {
    console.error('Leave Room Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
