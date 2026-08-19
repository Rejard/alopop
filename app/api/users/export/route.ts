import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`export:${ip}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many export requests. Try again later.' },
        { status: 429 }
      );
    }

    const [user, messages, transactions, friendships, pushSubscriptions, pet365Backup, studios, activityLogs] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: currentUser.id },
          select: {
            id: true,
            inviteCode: true,
            email: true,
            username: true,
            avatar_url: true,
            statusMessage: true,
            walletBalance: true,
            isAi: true,
            aiOwnerId: true,
            aiPrompt: true,
            isAdmin: true,
            isAgent: true,
            agentPath: true,
            createdAt: true,
          },
        }),
        prisma.message.findMany({
          where: { senderId: currentUser.id },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.transaction.findMany({
          where: {
            OR: [{ senderId: currentUser.id }, { receiverId: currentUser.id }],
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.friendship.findMany({
          where: {
            OR: [{ userId: currentUser.id }, { friendId: currentUser.id }],
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.pushSubscription.findMany({
          where: { userId: currentUser.id },
        }),
        prisma.pet365Backup.findUnique({
          where: { userId: currentUser.id },
        }),
        prisma.studio.findMany({
          where: { ownerId: currentUser.id },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.userActivityLog.findMany({
          where: { userId: currentUser.id },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ]);

    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kst = new Date(now.getTime() + kstOffset);
    const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, '');

    const exportData = {
      exportedAt: now.toISOString(),
      user,
      messages,
      transactions,
      friendships,
      pushSubscriptions,
      pet365Backup,
      studios,
      activityLogs,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="alopop_export_${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error('Failed to export user data:', error);
    return NextResponse.json({ error: 'Failed to export user data' }, { status: 500 });
  }
}
