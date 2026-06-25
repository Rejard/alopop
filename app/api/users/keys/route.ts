import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptKey, decryptKey } from '@/lib/crypto';
import { requireCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { logUserActivity } from '@/lib/auditLogger';

const SaveKeySchema = z.object({
  userId: z.string().min(1).optional(),
  provider: z.enum(['openai', 'gemini', 'anthropic']),
  apiKey: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`keys-get:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { openaiKey: true, geminiKey: true, anthropicKey: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      keys: {
        openai: decryptKey(user.openaiKey) || '',
        gemini: decryptKey(user.geminiKey) || '',
        anthropic: decryptKey(user.anthropicKey) || '',
      },
      flags: {
        hasOpenAiKey: !!user.openaiKey,
        hasGeminiKey: !!user.geminiKey,
        hasAnthropicKey: !!user.anthropicKey,
      },
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    return NextResponse.json({ error: 'Failed to get API keys' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let currentUsr: any = null;
  let prov: string | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const body = await request.json();
    const parseResult = SaveKeySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId, provider, apiKey } = parseResult.data;
    prov = provider;
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

    await logUserActivity({
      userId: currentUser.id,
      activityType: 'USER_API_KEY_UPDATE',
      status: 'SUCCESS',
      metadata: { provider, hasKey: !!apiKey },
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
    await logUserActivity({
      userId: currentUsr?.id,
      activityType: 'USER_API_KEY_UPDATE',
      status: 'FAILED',
      metadata: { provider: prov, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}
