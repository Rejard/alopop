import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const WalletAdjustSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
  amount: z.number().int().positive('amount must be a positive integer').max(1_000_000_000),
  direction: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().trim().min(6, 'reason must be at least 6 characters').max(240),
});

function buildMetadata(input: {
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  beforeBalance: number;
  afterBalance: number;
  transactionId: string;
}) {
  return JSON.stringify({
    direction: input.direction,
    amount: input.amount,
    beforeBalance: input.beforeBalance,
    afterBalance: input.afterBalance,
    transactionId: input.transactionId,
  });
}

export async function POST(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const parseResult = WalletAdjustSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { targetUserId, amount, direction, reason } = parseResult.data;
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          walletBalance: true,
        },
      });
      if (!target) {
        return { error: 'Target user not found' as const, status: 404 };
      }

      if (direction === 'DEBIT' && target.walletBalance < amount) {
        return {
          error: `Insufficient target balance. Current balance: ${target.walletBalance}` as const,
          status: 400,
        };
      }

      const beforeBalance = target.walletBalance;
      const updatedTarget = await tx.user.update({
        where: { id: targetUserId },
        data: {
          walletBalance: direction === 'CREDIT'
            ? { increment: amount }
            : { decrement: amount },
        },
        select: {
          id: true,
          username: true,
          walletBalance: true,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          senderId: direction === 'CREDIT' ? adminUser.id : targetUserId,
          receiverId: direction === 'CREDIT' ? targetUserId : adminUser.id,
          amount,
          reason: `ADMIN_${direction}: ${reason.trim()}`,
        },
      });

      const action = direction === 'CREDIT' ? 'WALLET_CREDIT' : 'WALLET_DEBIT';
      await tx.$executeRaw`
        INSERT INTO "AdminAuditLog" ("id", "adminId", "targetUserId", "action", "reason", "metadata", "createdAt")
        VALUES (
          ${crypto.randomUUID()},
          ${adminUser.id},
          ${targetUserId},
          ${action},
          ${reason.trim()},
          ${buildMetadata({
            direction,
            amount,
            beforeBalance,
            afterBalance: updatedTarget.walletBalance,
            transactionId: transaction.id,
          })},
          ${new Date()}
        )
      `;

      return {
        success: true as const,
        targetUser: updatedTarget,
        balance: updatedTarget.walletBalance,
        transactionId: transaction.id,
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin wallet adjust error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
