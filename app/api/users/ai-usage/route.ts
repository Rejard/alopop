import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`ai-usage:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const today = getTodayKST();

    const usages = await prisma.userEventUsage.findMany({
      where: { userId: currentUser.id },
      select: {
        eventId: true,
        usageDate: true,
        count: true,
      },
    });

    const todayUsages = usages.filter((u) => u.usageDate === today);
    const totalToday = todayUsages.reduce((sum, u) => sum + u.count, 0);

    const usage = todayUsages.map((u) => ({
      eventId: u.eventId,
      usedToday: u.count,
      lastUsedDate: u.usageDate,
    }));

    return NextResponse.json({ usage, totalToday });
  } catch (error) {
    console.error('AI usage GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`ai-usage:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const body = await request.json();
    const { eventId } = body;
    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const today = getTodayKST();

    const record = await prisma.userEventUsage.upsert({
      where: {
        userId_eventId_usageDate: {
          userId: currentUser.id,
          eventId,
          usageDate: today,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        userId: currentUser.id,
        eventId,
        usageDate: today,
        count: 1,
      },
    });

    return NextResponse.json({ success: true, usedToday: record.count });
  } catch (error) {
    console.error('AI usage POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
