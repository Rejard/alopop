import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Fetch active events that are within the valid date range
    const now = new Date();
    const activeEvents = await prisma.event.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      }
    });

    if (activeEvents.length === 0) {
      return NextResponse.json({ success: true, claimedEvents: [] });
    }

    const claimedEvents: { eventId: string; title: string; reward: number }[] = [];

    // 2. Process each active event
    for (const event of activeEvents) {
      if (event.reward <= 0) continue;

      let eligibleToClaim = false;

      if (event.rewardFrequency === 'ONCE') {
        // Check if user has EVER claimed this event
        const existingReward = await prisma.userEventReward.findFirst({
          where: { userId, eventId: event.id }
        });
        if (!existingReward) {
          eligibleToClaim = true;
        }
      } else if (event.rewardFrequency === 'DAILY') {
        // Check if user has claimed this event TODAY (KST Base)
        const nowServer = new Date();
        const kstDate = new Date(nowServer.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        
        const kstYear = kstDate.getFullYear();
        const kstMonth = kstDate.getMonth();
        const kstDay = kstDate.getDate();
        
        // KST 00:00:00 = UTC 기준 이전 날짜 15:00:00
        const startOfTodayKST = new Date(Date.UTC(kstYear, kstMonth, kstDay, -9, 0, 0, 0));
        // KST 23:59:59 = UTC 기준 당일 14:59:59.999
        const endOfTodayKST = new Date(Date.UTC(kstYear, kstMonth, kstDay, 14, 59, 59, 999));

        const existingRewardToday = await prisma.userEventReward.findFirst({
          where: {
            userId,
            eventId: event.id,
            createdAt: {
              gte: startOfTodayKST,
              lte: endOfTodayKST
            }
          }
        });

        if (!existingRewardToday) {
          eligibleToClaim = true;
        }
      }

      // 3. Give reward
      if (eligibleToClaim) {
        // Use a transaction to ensure atomic execution
        await prisma.$transaction([
          prisma.userEventReward.create({
            data: {
              userId,
              eventId: event.id
            }
          }),
          prisma.user.update({
            where: { id: userId },
            data: { walletBalance: { increment: event.reward } }
          }),
          prisma.transaction.create({
            data: {
              amount: event.reward,
              reason: `🎁 이벤트 보상: ${event.title}`,
              senderId: userId, // Self-sent or systemic
              receiverId: userId
            }
          })
        ]);

        claimedEvents.push({
          eventId: event.id,
          title: event.title,
          reward: event.reward
        });
      }
    }

    return NextResponse.json({ success: true, claimedEvents });
  } catch (error) {
    console.error('Claim events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
