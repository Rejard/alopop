import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { search } from 'duck-duck-scrape';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { prisma } from '@/lib/prisma';
import { decryptKey } from '@/lib/crypto';
import { requireCurrentUser } from '@/lib/auth';
import { recordFreeEventUsage, resolveAiKeyForRequest } from '@/lib/ai-key-resolution';
import { checkRateLimit } from '@/lib/rate-limit';

type Provider = 'openai' | 'gemini' | 'anthropic';

function defaultModelForProvider(provider: Provider) {
  if (provider === 'gemini') return 'gemini-1.5-pro-latest';
  if (provider === 'anthropic') return 'claude-3-haiku-20240307';
  return 'gpt-4o';
}

function hostKeyForProvider(
  hostUser: { openaiKey: string | null; geminiKey: string | null; anthropicKey: string | null },
  provider: Provider
) {
  if (provider === 'gemini') return hostUser.geminiKey;
  if (provider === 'anthropic') return hostUser.anthropicKey;
  return hostUser.openaiKey;
}

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    // Rate Limiter 적용 (초당 3회 초과 시 어뷰징 차단)
    if (!checkRateLimit(`chat_friend_${currentUser.id}`, 3, 1000)) {
      return NextResponse.json({ error: 'Too Many Requests (Rate Limit Exceeded)' }, { status: 429 });
    }

    const {
      provider,
      byokKey,
      aiModel,
      systemPrompt,
      content,
      isDelegate,
      sponsorId,
      roomId,
      aiUserId,
      aiOwnerId,
    } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const sponsorRoom = roomId ? await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    }) : null;

    let resolvedAi = await resolveAiKeyForRequest({
      user: currentUser,
      provider,
      aiModel,
      byokKey,
      allowFreeEventFallback: false,
      allowEnvFallback: false,
    });

    let apiKey = resolvedAi.apiKey;
    let currentProvider = resolvedAi.provider;
    let finalAiModel = resolvedAi.aiModel || defaultModelForProvider(currentProvider);
    let limitExceededFlag = resolvedAi.limitExceeded;

    if (!apiKey && isDelegate && sponsorId && sponsorRoom?.sponsorMode) {
      const isCurrentRoomMember = sponsorRoom.members.some(member => member.userId === currentUser.id && !member.isHidden);
      const sponsorMember = sponsorRoom.members.find(member => member.isHost && member.userId === sponsorId);
      const aiMember = sponsorRoom.members.find(member => member.userId === aiUserId);
      if (!isCurrentRoomMember || !sponsorMember || !aiMember) {
        return NextResponse.json({ error: 'Forbidden sponsor room access' }, { status: 403 });
      }

      const hostUser = await prisma.user.findUnique({
        where: { id: sponsorId },
        select: { openaiKey: true, geminiKey: true, anthropicKey: true },
      });
      apiKey = hostUser ? decryptKey(hostKeyForProvider(hostUser, currentProvider)) : null;
      if (apiKey) limitExceededFlag = false;
    }

    if (!apiKey) {
      resolvedAi = await resolveAiKeyForRequest({
        user: currentUser,
        provider,
        aiModel,
        byokKey,
      });

      apiKey = resolvedAi.apiKey;
      currentProvider = resolvedAi.provider;
      finalAiModel = resolvedAi.aiModel || defaultModelForProvider(currentProvider);
      if (!limitExceededFlag) limitExceededFlag = resolvedAi.limitExceeded;
    }

    if (!apiKey) {
      if (limitExceededFlag) {
        return NextResponse.json({ error: 'Daily free AI usage limit exceeded.' }, { status: 429 });
      }
      return NextResponse.json({ error: `No API Key provided for ${provider || 'openai'}` }, { status: 400 });
    }

    let modelInstance;
    switch (currentProvider) {
      case 'gemini': {
        const customGoogle = createGoogleGenerativeAI({ apiKey });
        modelInstance = customGoogle(finalAiModel);
        break;
      }
      case 'anthropic': {
        const customAnthropic = createAnthropic({ apiKey });
        modelInstance = customAnthropic(finalAiModel);
        break;
      }
      case 'openai':
      default: {
        const customOpenAI = createOpenAI({ apiKey });
        modelInstance = customOpenAI(finalAiModel);
        break;
      }
    }

    let injectedSearchContext = '';
    const searchKeywords = ['뉴스', '최신', '검색', '오늘', '알려줘', '언제', '주식', '야구', '며칠', '시간'];
    const needsSearch = searchKeywords.some(keyword => content.includes(keyword));

    if (needsSearch) {
      try {
        const searchResults = await search(content);
        if (searchResults?.results?.length) {
          const summary = searchResults.results
            .slice(0, 3)
            .map((r) => `제목: ${r.title}\n내용: ${r.description}`)
            .join('\n\n');
          injectedSearchContext = `\n\n[최신 웹 검색 결과]\n현재 시각: ${new Date().toLocaleString('ko-KR')}\n${summary}`;
        }
      } catch (e) {
        console.error('Manual Pre-search failed:', e);
      }
    }

    const { text } = await generateText({
      model: modelInstance,
      system: (systemPrompt || '당신은 알로팝 메신저의 친근한 AI 친구입니다.') + injectedSearchContext,
      prompt: content,
      temperature: 0.85,
    });

    if (sponsorRoom?.sponsorMode && sponsorId && aiUserId && aiOwnerId && aiOwnerId !== sponsorId && sponsorRoom.sponsorPrice > 0) {
      const aiUser = await prisma.user.findUnique({
        where: { id: aiUserId },
        select: { id: true, isAi: true, aiOwnerId: true },
      });
      const aiMember = sponsorRoom.members.find(member => member.userId === aiUserId);
      if (!aiUser?.isAi || aiUser.aiOwnerId !== aiOwnerId || !aiMember) {
        return NextResponse.json({ error: 'Invalid AI ownership' }, { status: 403 });
      }

      const paymentResult = await prisma.$transaction(async (tx) => {
        const debit = await tx.user.updateMany({
          where: { id: aiOwnerId, walletBalance: { gte: sponsorRoom.sponsorPrice } },
          data: { walletBalance: { decrement: sponsorRoom.sponsorPrice } },
        });
        if (debit.count !== 1) return false;

        await tx.user.update({
          where: { id: sponsorId },
          data: { walletBalance: { increment: sponsorRoom.sponsorPrice } },
        });
        await tx.transaction.create({
          data: {
            senderId: aiOwnerId,
            receiverId: sponsorId,
            amount: sponsorRoom.sponsorPrice,
            reason: `[AI response sponsor fee] Room ${roomId}`,
          },
        });
        return true;
      });

      if (!paymentResult) {
        return NextResponse.json({ error: 'INSUFFICIENT_FUNDS' }, { status: 402 });
      }
    }

    await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error('AI chat friend error:', error);
    const messageStr = error instanceof Error ? error.message : '';
    const isQuotaError = messageStr.includes('429') || messageStr.toLowerCase().includes('exhausted') || messageStr.toLowerCase().includes('quota');
    const status = isQuotaError ? 429 : 500;

    return NextResponse.json(
      { error: messageStr || 'Failed to process conversational AI chat', status },
      { status }
    );
  }
}
