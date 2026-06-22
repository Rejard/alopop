import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { MAX_SPONSOR_PRICE, parseSponsorPrice, resolveSponsorModel } from '@/lib/sponsor-policy';
import { z } from 'zod';
import { logUserActivity } from '@/lib/auditLogger';

const UpdateSponsorSchema = z.object({
  userId: z.string().min(1).optional(),
  roomId: z.string().min(1, 'roomId is required'),
  sponsorMode: z.boolean().optional(),
  sponsorModel: z.string().nullable().optional(),
  sponsorPrice: z.union([z.number(), z.string()]).optional(),
});

export async function PUT(request: Request) {
  let currentUsr: any = null;
  let rId: string | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const parseResult = UpdateSponsorSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId, roomId, sponsorMode, sponsorModel, sponsorPrice } = parseResult.data;
    rId = roomId;
    if (userId && userId !== currentUser.id) {
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

    if (!member || !member.isHost) {
      return NextResponse.json({ error: 'Only the host can modify the sponsor settings' }, { status: 403 });
    }

    const parsedSponsorPrice = sponsorPrice === undefined ? undefined : parseSponsorPrice(sponsorPrice);
    if (sponsorPrice !== undefined && parsedSponsorPrice === null) {
      return NextResponse.json({ error: `sponsorPrice must be an integer from 0 to ${MAX_SPONSOR_PRICE}` }, { status: 400 });
    }

    const parsedSponsorModel = sponsorModel === undefined ? undefined : resolveSponsorModel(sponsorModel);
    if (sponsorModel !== undefined && sponsorMode !== false && !parsedSponsorModel) {
      return NextResponse.json({ error: 'Unsupported sponsor model' }, { status: 400 });
    }
    const sponsorPriceUpdate = parsedSponsorPrice === null ? undefined : parsedSponsorPrice;

    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        sponsorMode,
        sponsorModel: sponsorMode === false ? null : parsedSponsorModel?.model,
        sponsorPrice: sponsorPriceUpdate,
      },
    });

    await logUserActivity({
      userId: currentUser.id,
      activityType: 'ROOM_SPONSOR_UPDATE',
      status: 'SUCCESS',
      metadata: { roomId, sponsorMode, sponsorModel, sponsorPrice },
    });

    return NextResponse.json(updatedRoom, { status: 200 });
  } catch (error) {
    console.error('Failed to update room sponsor settings:', error);
    await logUserActivity({
      userId: currentUsr?.id,
      activityType: 'ROOM_SPONSOR_UPDATE',
      status: 'FAILED',
      metadata: { roomId: rId, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
