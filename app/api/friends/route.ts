import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

function safeFriendship(friendship: {
  friend: {
    aiOwnerId: string | null;
    aiPrompt: string | null;
    agentToken?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}, currentUserId: string) {
  return {
    ...friendship,
    friend: {
      ...friendship.friend,
      aiPrompt: friendship.friend.aiOwnerId === currentUserId ? friendship.friend.aiPrompt : null,
      agentToken: friendship.friend.aiOwnerId === currentUserId ? friendship.friend.agentToken : null,
    },
  };
}

export async function GET(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    if (requestedUserId && requestedUserId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const friendships = await prisma.friendship.findMany({
      where: { userId: currentUser.id },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
            isAi: true,
            isAgent: true,
            agentToken: true,
            agentPath: true,
            aiOwnerId: true,
            aiPrompt: true,
            statusMessage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      friendships: friendships.map((friendship) => safeFriendship(friendship, currentUser.id)),
    });
  } catch (error) {
    console.error('Fetch friends error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { targetFriendId } = await request.json();
    if (!targetFriendId) {
      return NextResponse.json({ error: 'Missing targetFriendId' }, { status: 400 });
    }

    const searchTarget = targetFriendId.trim().toUpperCase();
    const targetUser = await prisma.user.findUnique({
      where: { inviteCode: searchTarget },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (currentUser.id === targetUser.id) {
      return NextResponse.json({ error: 'Cannot add yourself as a friend' }, { status: 400 });
    }

    const existingFriendship = await prisma.friendship.findUnique({
      where: {
        userId_friendId: {
          userId: currentUser.id,
          friendId: targetUser.id,
        },
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: `Friendship already exists with status ${existingFriendship.status}` },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: 'Friend already exists' }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newFriend = await tx.friendship.create({
        data: {
          userId: currentUser.id,
          friendId: targetUser.id,
          status: 'ACTIVE',
        },
        include: {
          friend: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
              isAi: true,
              isAgent: true,
              agentToken: true,
              agentPath: true,
              aiOwnerId: true,
              aiPrompt: true,
              statusMessage: true,
            },
          },
        },
      });

      await tx.friendship.create({
        data: {
          userId: targetUser.id,
          friendId: currentUser.id,
          status: 'ACTIVE',
        },
      });

      return newFriend;
    });

    return NextResponse.json({
      success: true,
      friendship: safeFriendship(result, currentUser.id),
    });
  } catch (error) {
    console.error('Add friend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
