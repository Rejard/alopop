import { NextResponse } from 'next/server';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/auth';
import { resolveAiKeyForRequest } from '@/lib/ai-key-resolution';
import { checkRateLimit } from '@/lib/rate-limit';

const RequestSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'anthropic']),
  model: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(100_000),
  temperature: z.number().min(0).max(2).default(0.7),
});

function buildModel(provider: 'openai' | 'gemini' | 'anthropic', apiKey: string, model: string) {
  if (provider === 'gemini') return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  return createOpenAI({ apiKey })(model);
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    if (!checkRateLimit(`aistudio-generate:${user.id}`, 20, 60000)) {
      return NextResponse.json({ error: 'AI Studio request limit exceeded' }, { status: 429 });
    }

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid AI Studio request' }, { status: 400 });
    }

    const { provider, model, prompt, temperature } = parsed.data;
    const resolved = await resolveAiKeyForRequest({
      user,
      provider,
      aiModel: model,
      allowFreeEventFallback: false,
      allowEnvFallback: user.isAdmin,
    });
    if (!resolved.apiKey) {
      return NextResponse.json({ error: `No usable API key for ${provider}` }, { status: 400 });
    }

    const result = await generateText({
      model: buildModel(provider, resolved.apiKey, model),
      prompt,
      temperature: provider === 'gemini' ? undefined : temperature,
    });
    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error('AI Studio generation error:', error);
    const message = error instanceof Error ? error.message : 'AI Studio generation failed';
    const quota = /quota|exhausted|429/i.test(message);
    return NextResponse.json({ error: message }, { status: quota ? 429 : 500 });
  }
}
