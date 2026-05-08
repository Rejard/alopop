import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const UpdateRoomSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().max(80).nullable().optional(),
  requesterId: z.string().min(1).optional(),
});

export async function PUT(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const parseResult = UpdateRoomSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { roomId, name, requesterId } = parseResult.data;
    if (requesterId && requesterId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: currentUser.id,
          roomId,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Only room members can rename this room' }, { status: 403 });
    }

    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { name: name?.trim() || null },
    });

    return NextResponse.json(updatedRoom);
  } catch (error) {
    console.error('Update Room Name Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
