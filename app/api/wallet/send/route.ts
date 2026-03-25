import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { senderId, receiverId, amount, reason } = await request.json();

    if (!senderId || !receiverId || !amount) {
      return NextResponse.json({ error: 'senderId, receiverId and amount are required' }, { status: 400 });
    }

    if (senderId === receiverId) {
      return NextResponse.json({ error: '자신에게 송금할 수 없습니다.' }, { status: 400 });
    }

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) {
       return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    if (sender.walletBalance < amount) {
       return NextResponse.json({ error: `잔액이 부족합니다. (현재: ${sender.walletBalance} 코인)` }, { status: 400 });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
       return NextResponse.json({ error: 'Receiver not found' }, { status: 404 });
    }

    // 트랜잭션 기록 및 잔고 증감
    await prisma.$transaction([
      prisma.user.update({
        where: { id: senderId },
        data: { walletBalance: sender.walletBalance - amount }
      }),
      prisma.user.update({
        where: { id: receiverId },
        data: { walletBalance: receiver.walletBalance + amount }
      }),
      prisma.transaction.create({
        data: {
          amount,
          reason: reason || '송금',
          senderId,
          receiverId, 
        }
      })
    ]);

    // 잔고 업데이트를 클라이언트에 반환
    const updatedUser = await prisma.user.findUnique({ where: { id: senderId } });

    return NextResponse.json({ success: true, balance: updatedUser?.walletBalance });

  } catch (error: any) {
    console.error('Wallet error:', error);
    return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
  }
}
