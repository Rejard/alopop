import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateProfileSchema = z.object({
  userId: z.string().min(1, 'userId is required').optional(),
  statusMessage: z.string().max(280, 'statusMessage is too long').nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    if (requestedUserId && requestedUserId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        statusMessage: true,
        walletBalance: true,
        isAdmin: true,
        openaiKey: true,
        geminiKey: true,
        anthropicKey: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      statusMessage: user.statusMessage,
      walletBalance: user.walletBalance,
      isAdmin: user.isAdmin,
      hasOpenAiKey: !!user.openaiKey,
      hasGeminiKey: !!user.geminiKey,
      hasAnthropicKey: !!user.anthropicKey,
    };

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const body = await request.json();
    const parseResult = UpdateProfileSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId, statusMessage } = parseResult.data;
    if (userId && userId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        statusMessage: statusMessage?.trim() || null,
      },
      select: {
        id: true,
        username: true,
        statusMessage: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
