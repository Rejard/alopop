import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

export async function PUT(request: Request, context: { params: Promise<{ friendId: string }> }) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { status } = await request.json();
    const { friendId } = await context.params;

    if (!friendId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['ACTIVE', 'HIDDEN', 'BLOCKED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const updated = await prisma.friendship.update({
      where: {
        userId_friendId: {
          userId: currentUser.id,
          friendId,
        },
      },
      data: { status },
    });

    return NextResponse.json({ success: true, friendship: updated });
  } catch (error) {
    console.error('Update friendship error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ friendId: string }> }) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { friendId } = await context.params;
    if (!friendId) {
      return NextResponse.json({ error: 'Missing friendId' }, { status: 400 });
    }

    await prisma.friendship.delete({
      where: {
        userId_friendId: {
          userId: currentUser.id,
          friendId,
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Friend deleted' });
  } catch (error) {
    console.error('Delete friendship error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
