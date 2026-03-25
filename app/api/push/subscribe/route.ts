import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, subscription } = await request.json();
    if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Missing subscription data' }, { status: 400 });
    }

    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId: userId
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId: userId
      }
    });

    return NextResponse.json({ success: true, subscription: saved });
  } catch (error) {
    console.error('Web Push Subscribe Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
