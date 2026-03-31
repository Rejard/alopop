import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { userId, roomId, localTimestamp } = await req.json();

    if (!userId || !roomId) {
      return NextResponse.json({ error: 'Missing userId or roomId' }, { status: 400 });
    }

    const readAtDate = localTimestamp ? new Date(localTimestamp) : new Date();

    const roomMember = await prisma.roomMember.update({
      where: {
        userId_roomId: {
          userId,
          roomId
        }
      },
      data: {
        lastReadAt: readAtDate
      }
    });

    return NextResponse.json({ success: true, lastReadAt: roomMember.lastReadAt });
  } catch (err) {
    console.error('Room read error:', err);
    return NextResponse.json({ error: 'Failed to update read timestamp' }, { status: 500 });
  }
}
