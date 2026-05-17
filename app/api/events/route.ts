import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        reward: true,
        isActive: true,
        eventType: true,
        rewardFrequency: true,
        aiProvider: true,
        aiModel: true,
        dailyLimit: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error('Fetch public events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
