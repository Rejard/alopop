import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';
import { z } from 'zod';
import { logUserActivity } from '@/lib/auditLogger';

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

export async function GET(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

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
  let currentUser: any = null;
  let eventTitle: string = '';
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;
    currentUser = adminUser;

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
    eventTitle = title;

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

    await logUserActivity({
      userId: adminUser.id,
      activityType: 'ADMIN_EVENT_CREATE',
      status: 'SUCCESS',
      metadata: { eventId: event.id },
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Create event error:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'ADMIN_EVENT_CREATE',
      status: 'FAILED',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let currentUser: any = null;
  let targetId: string = '';
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;
    currentUser = adminUser;

    const parseResult = UpdateEventSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { eventId } = parseResult.data;
    targetId = eventId;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: { isActive: !event.isActive },
    });

    await logUserActivity({
      userId: adminUser.id,
      activityType: 'ADMIN_EVENT_TOGGLE',
      status: 'SUCCESS',
      metadata: { eventId, isActive: updatedEvent.isActive },
    });

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'ADMIN_EVENT_TOGGLE',
      status: 'FAILED',
      metadata: { eventId: targetId, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let currentUser: any = null;
  let targetId: string = '';
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;
    currentUser = adminUser;

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    targetId = eventId || '';
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    await prisma.event.delete({
      where: { id: eventId },
    });

    await logUserActivity({
      userId: adminUser.id,
      activityType: 'ADMIN_EVENT_DELETE',
      status: 'SUCCESS',
      metadata: { eventId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'ADMIN_EVENT_DELETE',
      status: 'FAILED',
      metadata: { eventId: targetId, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
