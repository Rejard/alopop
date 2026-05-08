import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const ReadRoomSchema = z.object({
  userId: z.string().min(1).optional(),
  roomId: z.string().min(1, 'roomId is required'),
  localTimestamp: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(req);
    if (!currentUser) return response;

    const parseResult = ReadRoomSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId, roomId, localTimestamp } = parseResult.data;
    if (userId && userId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const readAtDate = localTimestamp ? new Date(localTimestamp) : new Date();
    if (Number.isNaN(readAtDate.getTime())) {
      return NextResponse.json({ error: 'Invalid localTimestamp' }, { status: 400 });
    }

    const roomMember = await prisma.roomMember.update({
      where: {
        userId_roomId: {
          userId: currentUser.id,
          roomId,
        },
      },
      data: {
        lastReadAt: readAtDate,
      },
    });

    return NextResponse.json({ success: true, lastReadAt: roomMember.lastReadAt });
  } catch (err) {
    console.error('Room read error:', err);
    return NextResponse.json({ error: 'Failed to update read timestamp' }, { status: 500 });
  }
}
