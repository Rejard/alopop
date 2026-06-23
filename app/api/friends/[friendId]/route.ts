import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';

export async function PUT(request: Request, context: { params: Promise<{ friendId: string }> }) {
  let currentUsr: any = null;
  let fId: string | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const { status } = await request.json();
    const { friendId } = await context.params;
    fId = friendId;

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

    await logUserActivity({
      userId: currentUser.id,
      targetUserId: friendId,
      activityType: `FRIEND_${status}`,
      status: 'SUCCESS',
    });

    return NextResponse.json({ success: true, friendship: updated });
  } catch (error) {
    console.error('Update friendship error:', error);
    await logUserActivity({
      userId: currentUsr?.id,
      targetUserId: fId || null,
      activityType: `FRIEND_STATUS_UPDATE`,
      status: 'FAILED',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ friendId: string }> }) {
  let currentUsr: any = null;
  let fId: string | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const { friendId } = await context.params;
    fId = friendId;
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

    await logUserActivity({
      userId: currentUser.id,
      targetUserId: friendId,
      activityType: 'FRIEND_DELETE',
      status: 'SUCCESS',
    });

    return NextResponse.json({ success: true, message: 'Friend deleted' });
  } catch (error) {
    console.error('Delete friendship error:', error);
    await logUserActivity({
      userId: currentUsr?.id,
      targetUserId: fId || null,
      activityType: 'FRIEND_DELETE',
      status: 'FAILED',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
