import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const LeaveRoomSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const parseResult = LeaveRoomSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { roomId, userId } = parseResult.data;
    if (userId && userId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leavingMember = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          roomId,
          userId: currentUser.id,
        },
      },
    });

    if (!leavingMember) {
      return NextResponse.json({ error: 'You are not a member of this room' }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.isGroup) {
      await prisma.roomMember.delete({
        where: {
          userId_roomId: {
            roomId,
            userId: currentUser.id,
          },
        },
      });

      const remainMembers = await prisma.roomMember.findMany({
        where: { roomId },
        orderBy: { joinedAt: 'asc' },
      });

      if (remainMembers.length === 0) {
        await prisma.room.delete({
          where: { id: roomId },
        });
      } else if (leavingMember.isHost) {
        await prisma.roomMember.update({
          where: {
            userId_roomId: {
              roomId,
              userId: remainMembers[0].userId,
            },
          },
          data: {
            isHost: true,
          },
        });
      }
    } else {
      await prisma.roomMember.update({
        where: {
          userId_roomId: {
            roomId,
            userId: currentUser.id,
          },
        },
        data: {
          isHidden: true,
        },
      });

      const members = await prisma.roomMember.findMany({ where: { roomId } });
      if (members.every((member) => member.isHidden)) {
        await prisma.room.delete({ where: { id: roomId } });
      }
    }

    return NextResponse.json({ success: true, message: 'Left the room' });
  } catch (error) {
    console.error('Leave Room Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
