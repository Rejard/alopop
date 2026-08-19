import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptMessageContent } from '@/lib/message-crypto';
import { buildChatMessageHistoryPage } from '@/lib/chat-message-history';

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`messages:${ip}`, 30, 60000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: currentUser.id, roomId } },
      include: {
        room: {
          select: {
            members: {
              select: {
                userId: true,
                user: { select: { username: true } },
              },
            },
          },
        },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const senderNames = new Map(
      membership.room.members.map((member) => [member.userId, member.user.username]),
    );
    const historyPage = buildChatMessageHistoryPage(
      messages,
      limit,
      decryptMessageContent,
      senderNames,
    );

    return NextResponse.json(historyPage);
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
