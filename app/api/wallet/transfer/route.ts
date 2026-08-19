import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { senderId, receiverId, amount } = await request.json();

    if (!senderId || !receiverId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    if (senderId === receiverId) {
      return NextResponse.json({ error: 'Self-transactions are not allowed' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const sender = await tx.user.findUnique({
        where: { id: senderId },
      });

      if (!sender || sender.walletBalance < amount) {
        throw new Error('Insufficient funds or sender not found');
      }

      const receiver = await tx.user.findUnique({
        where: { id: receiverId },
      });

      if (!receiver) {
        throw new Error('Receiver not found');
      }

      await tx.user.update({
        where: { id: senderId },
        data: { walletBalance: { decrement: amount } },
      });

      await tx.user.update({
        where: { id: receiverId },
        data: { walletBalance: { increment: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          senderId,
          receiverId,
          amount,
        },
      });

      return transaction;
    });

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Transfer failed' }, { status: 400 });
  }
}
