import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { name, creatorId, memberIds } = await request.json();

    if (!creatorId || !memberIds || !Array.isArray(memberIds)) {
      return NextResponse.json({ error: 'creatorId and memberIds array are required' }, { status: 400 });
    }

    // 작성자를 포함한 전체 멤버 ID 고유 배열 생성
    const allMemberIds = Array.from(new Set([creatorId, ...memberIds]));

    // 1:1 채팅방 중복 생성 방지 및 재활용 로직 (방 제목이 없는 2명만의 방)
    if (allMemberIds.length === 2 && !name) {
      // 나(creatorId)와 상대방 둘 다 모두 포함되어 있는 1:1 방을 DB에서 검색
      const existingRooms = await prisma.room.findMany({
        where: {
          isGroup: false,
          members: {
            every: {
              userId: { in: allMemberIds }
            }
          }
        },
        include: {
          members: {
            include: {
              user: { select: { username: true, avatar_url: true, isAi: true, aiOwnerId: true, aiPrompt: true, sponsorMode: true, sponsorModel: true, sponsorPrice: true } }
            }
          }
        }
      });

      // 멤버 수가 정확히 2명인 방 추출
      const matchedRoom = existingRooms.find(r => r.members.length === 2);
      
      if (matchedRoom) {
        // 기존 1:1 방이 이미 존재한다면 새로 생성하지 않고 재활용함!
        // 단, 나(방 생성자)가 방을 나간 상태(isHidden: true)일 수 있으므로 다시 false로 소환
        await prisma.roomMember.update({
          where: { userId_roomId: { userId: creatorId, roomId: matchedRoom.id } },
          data: { isHidden: false }
        });
        
        // 클라이언트에 반환할 객체의 메모리 값 갱신
        const myMember = matchedRoom.members.find(m => m.userId === creatorId);
        if (myMember) myMember.isHidden = false;

        return NextResponse.json(matchedRoom);
      }
    }

    // Transaction 단위로 방과 참가자 목록을 한 번에 생성
    const newRoom = await prisma.room.create({
      data: {
        name: name || null,
        isGroup: allMemberIds.length > 2,
        members: {
          create: allMemberIds.map(userId => ({
            userId,
            isHost: userId === creatorId // 요청한 사람이 방장(Host) 권한 획득
          }))
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { username: true, avatar_url: true, isAi: true, aiOwnerId: true, aiPrompt: true, sponsorMode: true, sponsorModel: true, sponsorPrice: true }
            }
          }
        }
      }
    });

    return NextResponse.json(newRoom);
  } catch (error) {
    console.error('Failed to create room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
