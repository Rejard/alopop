import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`wallet-tx:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { senderId: currentUser.id },
          { receiverId: currentUser.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        sender: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } },
      },
    });

    let nextCursor: string | null = null;
    if (transactions.length > limit) {
      const extra = transactions.pop()!;
      nextCursor = extra.id;
    }

    const mapped = transactions.map((tx) => {
      const isSent = tx.senderId === currentUser.id;
      const counterparty = isSent ? tx.receiver : tx.sender;
      return {
        id: tx.id,
        amount: tx.amount,
        reason: tx.reason,
        createdAt: tx.createdAt,
        type: isSent ? 'SENT' : 'RECEIVED',
        counterpartyId: counterparty.id,
        counterpartyName: counterparty.username,
      };
    });

    return NextResponse.json({ transactions: mapped, nextCursor });
  } catch (error) {
    console.error('Wallet transactions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
