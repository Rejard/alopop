import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptKey } from '@/lib/crypto';
import { requireCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const SaveKeySchema = z.object({
  userId: z.string().min(1).optional(),
  provider: z.enum(['openai', 'gemini', 'anthropic']),
  apiKey: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const body = await request.json();
    const parseResult = SaveKeySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId, provider, apiKey } = parseResult.data;
    if (userId && userId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const encryptedApiKey = apiKey ? encryptKey(apiKey) : null;
    const updateData =
      provider === 'openai'
        ? { openaiKey: encryptedApiKey }
        : provider === 'gemini'
          ? { geminiKey: encryptedApiKey }
          : { anthropicKey: encryptedApiKey };

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        id: true,
        openaiKey: true,
        geminiKey: true,
        anthropicKey: true,
      },
    });

    return NextResponse.json({
      success: true,
      flags: {
        hasOpenAiKey: !!updatedUser.openaiKey,
        hasGeminiKey: !!updatedUser.geminiKey,
        hasAnthropicKey: !!updatedUser.anthropicKey,
      },
    });
  } catch (error) {
    console.error('Save API key error:', error);
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}
