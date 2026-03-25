import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 1. 내 친구 목록(상태 유지) 불러오기
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is missing' }, { status: 400 });
    }

    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
            isAi: true,
            aiOwnerId: true,
            aiPrompt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ friendships });
  } catch (error) {
    console.error('Fetch friends error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 2. 새로운 친구 추가하기 (ID 기반 검색 + 추가)
export async function POST(request: Request) {
  try {
    const { userId, targetFriendId } = await request.json();

    if (!userId || !targetFriendId) {
      return NextResponse.json({ error: 'Missing userId or targetFriendId' }, { status: 400 });
    }

    // 소문자 입력 방지: 강제로 대문자로 치환하여 찾도록 합니다.
    const searchTarget = targetFriendId.trim().toUpperCase();

    // 입력받은 단축 코드(inviteCode)를 기반으로 대상 유저가 존재하는지 확인
    const targetUser = await prisma.user.findUnique({
      where: { inviteCode: searchTarget }
    });

    if (!targetUser) {
      return NextResponse.json({ error: '존재하지 않는 사용자입니다.' }, { status: 404 });
    }

    if (userId === targetUser.id) {
      return NextResponse.json({ error: '자기 자신을 친구로 추가할 수 없습니다.' }, { status: 400 });
    }

    // 이미 친구로 등록되어 있는지 확인
    const existingFriendship = await prisma.friendship.findUnique({
      where: {
        userId_friendId: {
          userId,
          friendId: targetUser.id
        }
      }
    });

    if (existingFriendship) {
      // 만약 숨겨지거나 차단된 상태라면 상태 메세지 반환 (또는 복구 로직 제안)
      if (existingFriendship.status !== 'ACTIVE') {
        return NextResponse.json({ error: `이미 추가되어 있으며, 현재 상태는 [${existingFriendship.status}] 입니다. 설정의 친구 관리에서 복구할 수 있습니다.` }, { status: 409 });
      }
      return NextResponse.json({ error: '이미 친구로 등록된 사용자입니다.' }, { status: 409 });
    }
    // 양방향 새 친구 관계(Friendship) 일괄 추가 트랜잭션 (나 -> 친구, 친구 -> 나)
    const result = await prisma.$transaction(async (tx) => {
      const newFriend = await tx.friendship.create({
        data: {
          userId,
          friendId: targetUser.id,
          status: 'ACTIVE'
        },
        include: {
          friend: {
            select: { id: true, username: true, avatar_url: true, isAi: true, aiOwnerId: true, aiPrompt: true }
          }
        }
      });

      await tx.friendship.create({
        data: {
          userId: targetUser.id,
          friendId: userId,
          status: 'ACTIVE'
        }
      });

      return newFriend;
    });

    return NextResponse.json({ success: true, friendship: result });
  } catch (error) {
    console.error('Add friend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
