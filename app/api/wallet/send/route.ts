import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { logUserActivity } from '@/lib/auditLogger';

const SendCoinsSchema = z.object({
  senderId: z.string().min(1).optional(),
  receiverId: z.string().min(1, 'receiverId is required'),
  amount: z.number().int().positive('amount must be a positive integer').max(1_000_000_000),
  reason: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  let currentUsr: any = null;
  let recvId: string | null = null;
  let sendAmt: number | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const body = await request.json();
    const parseResult = SendCoinsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { senderId, receiverId, amount, reason } = parseResult.data;
    recvId = receiverId;
    sendAmt = amount;
    if (senderId && senderId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (currentUser.id === receiverId) {
      return NextResponse.json({ error: 'Cannot send coins to yourself' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const receiver = await tx.user.findUnique({
        where: { id: receiverId },
        select: { id: true },
      });
      if (!receiver) {
        return { error: 'Receiver not found' as const, status: 404 };
      }

      const debit = await tx.user.updateMany({
        where: {
          id: currentUser.id,
          walletBalance: { gte: amount },
        },
        data: {
          walletBalance: { decrement: amount },
        },
      });

      if (debit.count !== 1) {
        const sender = await tx.user.findUnique({
          where: { id: currentUser.id },
          select: { walletBalance: true },
        });
        return {
          error: `Insufficient balance. Current balance: ${sender?.walletBalance ?? 0}`,
          status: 400,
        };
      }

      await tx.user.update({
        where: { id: receiverId },
        data: {
          walletBalance: { increment: amount },
        },
      });

      await tx.transaction.create({
        data: {
          senderId: currentUser.id,
          receiverId,
          amount,
          reason: reason?.trim() || null,
        },
      });

      const updatedSender = await tx.user.findUnique({
        where: { id: currentUser.id },
        select: { walletBalance: true },
      });

      return { balance: updatedSender?.walletBalance ?? 0 };
    });

    if ('error' in result) {
      await logUserActivity({
        userId: currentUser.id,
        targetUserId: receiverId,
        activityType: 'WALLET_TRANSFER',
        status: 'FAILED',
        metadata: { amount, error: result.error },
      });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await logUserActivity({
      userId: currentUser.id,
      targetUserId: receiverId,
      activityType: 'WALLET_TRANSFER',
      status: 'SUCCESS',
      metadata: { amount, reason },
    });

    return NextResponse.json({ success: true, balance: result.balance });
  } catch (error) {
    console.error('Wallet error:', error);
    await logUserActivity({
      userId: currentUsr?.id,
      targetUserId: recvId,
      activityType: 'WALLET_TRANSFER',
      status: 'FAILED',
      metadata: { amount: sendAmt, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
  }
}
