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
export async function PUT(request: Request) {
  try {
    const { userId, statusMessage } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        statusMessage: statusMessage || null // 빈 문자열인 경우 null 처리
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
