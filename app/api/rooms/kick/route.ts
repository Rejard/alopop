import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const KickMemberSchema = z.object({
  roomId: z.string().min(1),
  targetUserId: z.string().min(1),
  requesterId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const parseResult = KickMemberSchema.safeParse(await request.json());
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
      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser || !targetUser.isAi || targetUser.aiOwnerId !== currentUser.id) {
        return NextResponse.json({ error: 'Permission denied: Not a host or AI owner' }, { status: 403 });
      }
    }

    await prisma.roomMember.delete({
      where: {
        userId_roomId: {
          userId: targetUserId,
          roomId,
        },
      },
    });

    return NextResponse.json({ success: true, kickedUserId: targetUserId });
  } catch (error) {
    console.error('Failed to kick member:', error);
    return NextResponse.json({ error: 'Failed to kick member' }, { status: 500 });
  }
}
