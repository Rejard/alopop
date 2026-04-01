import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptKey } from '@/lib/crypto';

export async function POST(request: Request) {
  try {
    const { userId, provider, apiKey } = await request.json();

    if (!userId || !provider) {
      return NextResponse.json({ error: 'userId and provider are required' }, { status: 400 });
    }

    if (!apiKey) {
      // 키를 지우려면 apiKey를 빈 문자열로 보냄
    }

    const encryptedApiKey = apiKey ? encryptKey(apiKey) : null;

    let updateData = {};
    if (provider === 'openai') {
      updateData = { openaiKey: encryptedApiKey };
    } else if (provider === 'gemini') {
      updateData = { geminiKey: encryptedApiKey };
    } else if (provider === 'anthropic') {
      updateData = { anthropicKey: encryptedApiKey };
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        // 보안상 플래그만 반환
        openaiKey: true,
        geminiKey: true,
        anthropicKey: true,
      }
    });

    return NextResponse.json({
      success: true,
      flags: {
        hasOpenAiKey: !!updatedUser.openaiKey,
        hasGeminiKey: !!updatedUser.geminiKey,
        hasAnthropicKey: !!updatedUser.anthropicKey,
      }
    });
  } catch (error) {
    console.error('Save API key error:', error);
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}
