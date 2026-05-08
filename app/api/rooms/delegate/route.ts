import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const DelegateHostSchema = z.object({
  roomId: z.string().min(1),
  targetUserId: z.string().min(1),
  requesterId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const parseResult = DelegateHostSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { roomId, targetUserId, requesterId } = parseResult.data;
    if (requesterId && requesterId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requester = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: currentUser.id,
          roomId,
        },
      },
    });

    if (!requester || !requester.isHost) {
      return NextResponse.json({ error: 'Permission denied: Not a host' }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.roomMember.update({
        where: {
          userId_roomId: { userId: currentUser.id, roomId },
        },
        data: { isHost: false },
      }),
      prisma.roomMember.update({
        where: {
          userId_roomId: { userId: targetUserId, roomId },
        },
        data: { isHost: true },
      }),
    ]);

    return NextResponse.json({ success: true, newHostId: targetUserId });
  } catch (error) {
    console.error('Failed to delegate host:', error);
    return NextResponse.json({ error: 'Failed to delegate host' }, { status: 500 });
  }
}
