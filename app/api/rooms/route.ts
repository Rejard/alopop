import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const CreateRoomSchema = z.object({
  name: z.string().max(80).nullable().optional(),
  creatorId: z.string().min(1).optional(),
  memberIds: z.array(z.string().min(1)).min(1),
});

const roomInclude = {
  members: {
    include: {
      user: {
        select: {
          username: true,
          avatar_url: true,
          isAi: true,
          isAgent: true,
          aiOwnerId: true,
          aiPrompt: true,
        },
      },
    },
  },
};

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const parseResult = CreateRoomSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { name, creatorId, memberIds } = parseResult.data;
    if (creatorId && creatorId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allMemberIds = Array.from(new Set([currentUser.id, ...memberIds]));

    if (allMemberIds.length === 2 && !name) {
      const existingRooms = await prisma.room.findMany({
        where: {
          isGroup: false,
          members: {
            every: {
              userId: { in: allMemberIds },
            },
          },
        },
        include: roomInclude,
      });

      const matchedRoom = existingRooms.find((room) => room.members.length === 2);

      if (matchedRoom) {
        await prisma.roomMember.update({
          where: { userId_roomId: { userId: currentUser.id, roomId: matchedRoom.id } },
          data: { isHidden: false },
        });

        const myMember = matchedRoom.members.find((member) => member.userId === currentUser.id);
        if (myMember) myMember.isHidden = false;

        return NextResponse.json(matchedRoom);
      }
    }

    const newRoom = await prisma.room.create({
      data: {
        name: name?.trim() || null,
        isGroup: allMemberIds.length > 2,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            isHost: userId === currentUser.id,
          })),
        },
      },
      include: roomInclude,
    });

    return NextResponse.json(newRoom);
  } catch (error) {
    console.error('Failed to create room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
