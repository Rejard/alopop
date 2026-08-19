import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptKey, decryptKey, isKeyEncryptionConfigured } from '@/lib/crypto';
import { requireCurrentUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { logUserActivity } from '@/lib/auditLogger';
import { hasProviderAccess, providerAccessSource } from '@/lib/ai-key-availability';

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

    const keys = {
      openai: decryptKey(user.openaiKey) || '',
      gemini: decryptKey(user.geminiKey) || '',
      anthropic: decryptKey(user.anthropicKey) || '',
    };

    return NextResponse.json({
      keys: {
        openai: keys.openai,
        gemini: keys.gemini,
        anthropic: keys.anthropic,
      },
      flags: {
        hasOpenAiKey: hasProviderAccess('openai', currentUser.isAdmin, keys.openai),
        hasGeminiKey: hasProviderAccess('gemini', currentUser.isAdmin, keys.gemini),
        hasAnthropicKey: hasProviderAccess('anthropic', currentUser.isAdmin, keys.anthropic),
      },
      sources: {
        openai: providerAccessSource('openai', currentUser.isAdmin, keys.openai),
        gemini: providerAccessSource('gemini', currentUser.isAdmin, keys.gemini),
        anthropic: providerAccessSource('anthropic', currentUser.isAdmin, keys.anthropic),
      },
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    return NextResponse.json({ error: 'Failed to get API keys' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let currentUsr: { id: string } | null = null;
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
    if (apiKey && process.env.NODE_ENV === 'production' && !isKeyEncryptionConfigured()) {
      return NextResponse.json({ error: 'API key encryption is not configured' }, { status: 503 });
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
        hasOpenAiKey: hasProviderAccess('openai', currentUser.isAdmin, decryptKey(updatedUser.openaiKey)),
        hasGeminiKey: hasProviderAccess('gemini', currentUser.isAdmin, decryptKey(updatedUser.geminiKey)),
        hasAnthropicKey: hasProviderAccess('anthropic', currentUser.isAdmin, decryptKey(updatedUser.anthropicKey)),
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
