import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const GetRoomsSchema = z.object({
  userId: z.string().min(1, 'userId parameter is required').optional(),
});

export async function GET(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { searchParams } = new URL(request.url);
    const parseResult = GetRoomsSchema.safeParse({ userId: searchParams.get('userId') || undefined });
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const requestedUserId = parseResult.data.userId;
    if (requestedUserId && requestedUserId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: {
            userId: currentUser.id,
            isHidden: false,
          },
        },
      },
      select: {
        id: true,
        name: true,
        isGroup: true,
        createdAt: true,
        sponsorMode: true,
        sponsorModel: true,
        sponsorPrice: true,
        members: {
          select: {
            id: true,
            userId: true,
            joinedAt: true,
            isHost: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                username: true,
                avatar_url: true,
                isAi: true,
                isAgent: true,
                aiOwnerId: true,
                aiPrompt: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}
