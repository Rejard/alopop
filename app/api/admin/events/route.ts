import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error('Fetch events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, title, description, rewardCoins, startsAt, endsAt, rewardFrequency } = await request.json();

    if (!userId || !title) {
      return NextResponse.json({ error: 'userId and title are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        reward: rewardCoins || 0,
        rewardFrequency: rewardFrequency || "ONCE",
        startDate: startsAt ? new Date(startsAt) : new Date(),
        endDate: endsAt ? new Date(endsAt) : null,
      }
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 이벤트 활성화 토글 및 보상 지급
export async function PUT(request: Request) {
  try {
    const { userId, eventId, action } = await request.json();

    if (!userId || !eventId || !action) {
      return NextResponse.json({ error: 'userId, eventId, and action are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (action === 'TOGGLE_ACTIVE') {
      const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: { isActive: !event.isActive }
      });
      return NextResponse.json({ success: true, event: updatedEvent });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const eventId = searchParams.get('eventId');

    if (!userId || !eventId) {
      return NextResponse.json({ error: 'userId and eventId are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.event.delete({
      where: { id: eventId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
