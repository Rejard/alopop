import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { search } from 'duck-duck-scrape';
import fs from 'fs/promises';
import path from 'path';
import { requireCurrentUser } from '@/lib/auth';
import { recordFreeEventUsage, resolveAiKeyForRequest } from '@/lib/ai-key-resolution';

type PromptMessage = {
  role: 'user';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image'; image: Buffer; mimeType: string }
      >;
};

type SearchResultItem = {
  title?: string;
  description?: string;
};

function defaultModelForProvider(provider: string) {
  if (provider === 'gemini') return 'gemini-1.5-pro-latest';
  if (provider === 'anthropic') return 'claude-3-haiku-20240307';
  return 'gpt-5.4';
}

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { content, imageUrl, byokKey, provider, aiModel } = await request.json();

    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'Content or image is required' }, { status: 400 });
    }

    const resolvedAi = await resolveAiKeyForRequest({
      user: currentUser,
      provider,
      aiModel,
      byokKey,
      allowEnvFallback: false,
    });

    if (resolvedAi.limitExceeded) {
      return NextResponse.json({ error: 'Daily free AI usage limit exceeded.' }, { status: 429 });
    }

    if (!resolvedAi.apiKey) {
      return NextResponse.json({ error: `No API Key provided for ${provider || 'openai'}` }, { status: 400 });
    }

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    if (imageUrl) {
      const basename = imageUrl.split('/').pop();
      if (basename) {
        const filepath = path.join(process.cwd(), 'public', 'uploads', basename);
        try {
          imageBuffer = await fs.readFile(filepath);
          if (basename.toLowerCase().endsWith('.png')) mimeType = 'image/png';
          else if (basename.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
        } catch (e) {
          console.error('Failed to read image for vision API:', e);
        }
      }
    }

    const currentProvider = resolvedAi.provider;
    let finalAiModel = resolvedAi.aiModel || defaultModelForProvider(currentProvider);
    if (imageBuffer && currentProvider === 'openai' && finalAiModel === 'gpt-5.4-pro') {
      finalAiModel = 'gpt-5.4';
    }

    let modelInstance;
    switch (currentProvider) {
      case 'gemini': {
        const customGoogle = createGoogleGenerativeAI({ apiKey: resolvedAi.apiKey });
        modelInstance = customGoogle(finalAiModel);
        break;
      }
      case 'anthropic': {
        const customAnthropic = createAnthropic({ apiKey: resolvedAi.apiKey });
        modelInstance = customAnthropic(finalAiModel);
        break;
      }
      case 'openai':
      default: {
        const customOpenAI = createOpenAI({ apiKey: resolvedAi.apiKey });
        modelInstance = customOpenAI(finalAiModel);
        break;
      }
    }

    const promptMessages: PromptMessage[] = [];
    const textContent = content || '(사용자가 이미지만 업로드했습니다.)';

    if (imageBuffer) {
      promptMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this image and attached message: "${textContent}". Look closely at the image for deepfake artifacts, text in the image, or malicious context.` },
          { type: 'image', image: imageBuffer, mimeType },
        ],
      });
    } else {
      promptMessages.push({
        role: 'user',
        content: `Analyze this message: "${textContent}"`,
      });
    }

    let injectedSearchContext = `\n\n[현재 시스템 시각: ${new Date().toLocaleString('ko-KR')}]`;
    if (content && content.length > 5) {
      try {
        const searchResults = await search(content);
        if (searchResults?.results?.length) {
          const searchItems = searchResults.results.slice(0, 3) as SearchResultItem[];
          const summary = searchItems.map((r) => `제목: ${r.title || ''}\n내용: ${r.description || ''}`).join('\n\n');
          injectedSearchContext = `\n\n[최신 웹 검색 결과]\n분석 대상이 최신 사실과 부합하는지 아래 검색 결과를 교차 검증의 근거로 우선 활용하세요.\n${summary}`;
        }
      } catch (e) {
        console.error('Fact-check Web Search failed:', e);
      }
    }

    const result = await generateObject({
      model: modelInstance,
      system: `당신은 메시지와 이미지를 분석하는 포렌식 및 팩트체크 AI입니다.${injectedSearchContext}

판정 기준:
1. 단순 인사, 일상 대화, 농담, 감정 표현처럼 검증이 필요 없는 내용은 PASS로 분류하세요.
2. 이미지가 AI 생성 그림처럼 보이면 AI_GENERATED로 분류하세요.
3. 조작, 허위 주장, 피싱, 사기, 악성 의도가 의심되면 SUSPICIOUS 또는 FAKE로 분류하세요.
4. 명확히 사실로 확인되는 정보는 VERIFIED 또는 NORMAL로 분류하세요.

반드시 다음 JSON 형식으로 응답하세요.`,
      messages: promptMessages,
      schema: z.object({
        category: z.enum(['PASS', 'FAKE', 'AI_GENERATED', 'SUSPICIOUS', 'VERIFIED', 'NORMAL']),
        confidence: z.number().min(0).max(1),
        reason: z.string(),
      }),
      temperature: finalAiModel === 'gpt-5.4-pro' ? undefined : 0.1,
    });

    await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

    return NextResponse.json(result.object);
  } catch (error) {
    console.error('AI check error:', error);
    const messageStr = error instanceof Error ? error.message : '';
    const isQuotaError = messageStr.includes('429') || messageStr.toLowerCase().includes('exhausted') || messageStr.toLowerCase().includes('quota');
    const status = isQuotaError ? 429 : 500;

    return NextResponse.json(
      { error: messageStr || 'Failed to process AI analysis', status },
      { status }
    );
  }
}
