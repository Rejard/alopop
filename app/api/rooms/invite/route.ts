import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const InviteRoomSchema = z.object({
  roomId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const parseResult = InviteRoomSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { roomId, targetUserId } = parseResult.data;
    const inviterMember = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: currentUser.id,
          roomId,
        },
      },
    });

    if (!inviterMember) {
      return NextResponse.json({ error: 'Only room members can invite users' }, { status: 403 });
    }

    const exists = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: targetUserId,
          roomId,
        },
      },
    });

    if (exists) {
      return NextResponse.json({ error: 'User is already in this room' }, { status: 400 });
    }

    const newMember = await prisma.roomMember.create({
      data: {
        roomId,
        userId: targetUserId,
        isHost: false,
      },
      include: {
        user: true,
      },
    });

    return NextResponse.json(newMember);
  } catch (error) {
    console.error('Invite Room Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
