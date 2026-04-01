import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
    }

    // 내가 참여 중인 방이면서 숨김 처리되지 않은 목록과 각 방의 멤버 정보를 가져옴
    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: {
            userId: userId,
            isHidden: false
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatar_url: true, isAi: true, aiOwnerId: true, aiPrompt: true, sponsorMode: true, sponsorModel: true, sponsorPrice: true }
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
