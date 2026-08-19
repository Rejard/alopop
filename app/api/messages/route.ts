import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptMessageContent } from '@/lib/message-crypto';

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

    let nextCursor: string | null = null;
    if (messages.length > limit) {
      const extra = messages.pop()!;
      nextCursor = extra.id;
    }

    const decrypted = messages.map((msg) => ({
      id: msg.id,
      messageId: msg.messageId,
      roomId: msg.roomId,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      type: msg.type,
      content: decryptMessageContent(msg.content),
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({ messages: decrypted, nextCursor });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
