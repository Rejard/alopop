import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

import { z } from 'zod';

const GetRoomsSchema = z.object({
  userId: z.string().min(1, 'userId parameter is required'),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = GetRoomsSchema.safeParse({ userId: searchParams.get('userId') });

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId } = parseResult.data;

    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: {
            userId: userId,
            isHidden: false
          }
        }
      },
      select: {
        id: true,
        name: true,
        isGroup: true,
        sponsorMode: true,
        sponsorModel: true,
        sponsorPrice: true,
        members: {
          select: {
            id: true,
            isHost: true,
            lastReadAt: true,
            user: {
              select: { id: true, username: true, avatar_url: true, isAi: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}
