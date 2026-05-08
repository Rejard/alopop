import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 내 프로필 정보 및 상태 메세지 조회 (GET)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 보안상 실제 키 문자열은 제거하고 존재 여부만 반환
    const safeUser = {
      ...user,
      hasOpenAiKey: !!user.openaiKey,
      hasGeminiKey: !!user.geminiKey,
      hasAnthropicKey: !!user.anthropicKey,
    };
    delete (safeUser as any).openaiKey;
    delete (safeUser as any).geminiKey;
    delete (safeUser as any).anthropicKey;

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 상태 메시지 및 기타 프로필 정보 업데이트 (PUT)
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  statusMessage: z.string().nullable().optional(),
});

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parseResult = UpdateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId, statusMessage } = parseResult.data;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        statusMessage: statusMessage || null
      },
      select: {
        id: true,
        username: true,
        statusMessage: true
      }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

