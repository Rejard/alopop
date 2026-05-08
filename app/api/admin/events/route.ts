import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateEventSchema = z.object({
  userId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  rewardCoins: z.number().int().min(0).optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  rewardFrequency: z.string().optional(),
  eventType: z.string().optional(),
  aiProvider: z.string().nullable().optional(),
  aiModel: z.string().nullable().optional(),
  eventApiKey: z.string().nullable().optional(),
  dailyLimit: z.number().int().min(0).nullable().optional(),
});

const UpdateEventSchema = z.object({
  userId: z.string().optional(),
  eventId: z.string().min(1),
  action: z.enum(['TOGGLE_ACTIVE']),
});

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const safeEvents = events.map((event) => {
      const { eventApiKey, ...safeEvent } = event;
      void eventApiKey;
      return safeEvent;
    });
    return NextResponse.json(safeEvents);
  } catch (error) {
    console.error('Fetch events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const parseResult = CreateEventSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const {
      title,
      description,
      rewardCoins,
      startsAt,
      endsAt,
      rewardFrequency,
      eventType,
      aiProvider,
      aiModel,
      eventApiKey,
      dailyLimit,
    } = parseResult.data;

    const startDate = startsAt ? new Date(startsAt) : new Date();
    const endDate = endsAt ? new Date(endsAt) : null;
    if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
      return NextResponse.json({ error: 'Invalid event date' }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        eventType: eventType || 'REWARD',
        reward: rewardCoins || 0,
        rewardFrequency: rewardFrequency || 'ONCE',
        aiProvider: aiProvider || null,
        aiModel: aiModel || null,
        eventApiKey: eventApiKey || null,
        dailyLimit: dailyLimit ?? null,
        startDate,
        endDate,
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const parseResult = UpdateEventSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { eventId } = parseResult.data;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: { isActive: !event.isActive },
    });
    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    await prisma.event.delete({
      where: { id: eventId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
