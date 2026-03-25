import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 특정 친구 관계(status) 업데이트 (숨김, 차단, 해제 등)
export async function PUT(request: Request, context: { params: Promise<{ friendId: string }> }) {
  try {
    const { userId, status } = await request.json();
    const { friendId } = await context.params;
    const targetFriendId = friendId;

    if (!userId || !targetFriendId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 허용된 상태값만 받음
    if (!['ACTIVE', 'HIDDEN', 'BLOCKED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const updated = await prisma.friendship.update({
      where: {
        userId_friendId: {
          userId,
          friendId: targetFriendId
        }
      },
      data: {
        status
      }
    });

    return NextResponse.json({ success: true, friendship: updated });
  } catch (error) {
    console.error('Update friendship error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 친구 영구 삭제 (연락처에서 완전히 제거)
export async function DELETE(request: Request, context: { params: Promise<{ friendId: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { friendId } = await context.params;
    const targetFriendId = friendId;

    if (!userId || !targetFriendId) {
      return NextResponse.json({ error: 'Missing userId or friendId' }, { status: 400 });
    }

    await prisma.friendship.delete({
      where: {
        userId_friendId: {
          userId,
          friendId: targetFriendId
        }
      }
    });

    return NextResponse.json({ success: true, message: '친구가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete friendship error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
