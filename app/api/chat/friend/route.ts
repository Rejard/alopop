import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { search } from 'duck-duck-scrape';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { recordFreeEventUsage, resolveAiKeyForRequest } from '@/lib/ai-key-resolution';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptHostSponsorKey, resolveSponsorDelegateAccess, resolveSponsorModel } from '@/lib/sponsor-policy';
import { canAccessAiFriend, canStartAutonomousAiWork } from '@/lib/ai-friend-access';

type Provider = 'openai' | 'gemini' | 'anthropic';

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || '';

function defaultModelForProvider(provider: Provider) {
  if (provider === 'gemini') return 'gemini-3.6-flash';
  if (provider === 'anthropic') return 'claude-3-haiku-20240307';
  return 'gpt-4o';
}

function buildModel(provider: Provider, apiKey: string, model: string) {
  if (provider === 'gemini') return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  return createOpenAI({ apiKey })(model);
}

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    if (!checkRateLimit(`chat_friend_${currentUser.id}`, 3, 1000)) {
      return NextResponse.json({ error: 'Too Many Requests (Rate Limit Exceeded)' }, { status: 429 });
    }

    const {
      provider,
      aiModel,
      content,
      isDelegate,
      sponsorId,
      roomId,
      aiUserId,
      isAutonomous,
    } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const sponsorRoom = roomId ? await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    }) : null;

    const aiUser = aiUserId ? await prisma.user.findUnique({
      where: { id: aiUserId },
      select: {
        id: true,
        username: true,
        isAi: true,
        isAgent: true,
        aiOwnerId: true,
        aiPrompt: true,
        agentPath: true,
      },
    }) : null;

    if (aiUserId && (!aiUser || (!aiUser.isAi && !aiUser.isAgent))) {
      return NextResponse.json({ error: 'Invalid AI user' }, { status: 403 });
    }

    const aiOwner = aiUser?.aiOwnerId ? await prisma.user.findUnique({
      where: { id: aiUser.aiOwnerId },
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
    }) : null;

    const activeFriendship = aiUser ? await prisma.friendship.findFirst({
      where: {
        userId: currentUser.id,
        friendId: aiUser.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    }) : null;
    const currentUserInRoom = Boolean(sponsorRoom?.members.some(
      (member) => member.userId === currentUser.id && !member.isHidden,
    ));
    const aiUserInRoom = Boolean(aiUser && sponsorRoom?.members.some(
      (member) => member.userId === aiUser.id && !member.isHidden,
    ));

    if (aiUser && !canAccessAiFriend({
      currentUserId: currentUser.id,
      aiOwnerId: aiUser.aiOwnerId,
      hasActiveFriendship: Boolean(activeFriendship),
      currentUserInRoom,
      aiUserInRoom,
    })) {
      return NextResponse.json({ error: 'AI friend access denied' }, { status: 403 });
    }

    if (isAutonomous) {
      if (!aiUser || !canStartAutonomousAiWork(currentUser.id, aiUser.aiOwnerId, aiUser.isAgent)) {
        return NextResponse.json({ error: 'Autonomous AI work access denied' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Autonomous AI worker is unavailable' }, { status: 503 });
    }

    const effectiveAiUser = aiOwner || currentUser;
    const personaPrompt = aiUser?.aiPrompt || 'You are a friendly AI companion in Alopop Messenger. Reply naturally and stay in character.';

    let resolvedAi = await resolveAiKeyForRequest({
      user: effectiveAiUser,
      provider,
      aiModel,
      allowFreeEventFallback: false,
      allowEnvFallback: effectiveAiUser.isAdmin,
    });

    let apiKey = resolvedAi.apiKey;
    let currentProvider = resolvedAi.provider;
    let finalAiModel = resolvedAi.aiModel || defaultModelForProvider(currentProvider);
    let limitExceededFlag = resolvedAi.limitExceeded;
    let sponsorBilling: { payerId: string; receiverId: string; amount: number } | null = null;

    if (!apiKey && isDelegate && resolveSponsorDelegateAccess({
      currentUserId: currentUser.id,
      room: sponsorRoom,
      sponsorId,
      aiUserId,
    })) {
      const sponsorConfig = resolveSponsorModel(sponsorRoom?.sponsorModel);
      const hostUser = sponsorId ? await prisma.user.findUnique({
        where: { id: sponsorId },
        select: { id: true, openaiKey: true, geminiKey: true, anthropicKey: true },
      }) : null;

      apiKey = hostUser && sponsorConfig ? decryptHostSponsorKey(hostUser, sponsorConfig.provider) : null;
      if (apiKey && sponsorConfig && hostUser) {
        currentProvider = sponsorConfig.provider;
        finalAiModel = sponsorConfig.model;
        limitExceededFlag = false;

        const sponsorPrice = sponsorRoom?.sponsorPrice || 0;
        if (sponsorPrice > 0 && effectiveAiUser.id !== hostUser.id) {
          if (effectiveAiUser.walletBalance < sponsorPrice) {
            return NextResponse.json({ error: 'INSUFFICIENT_FUNDS' }, { status: 402 });
          }
          sponsorBilling = {
            payerId: effectiveAiUser.id,
            receiverId: hostUser.id,
            amount: sponsorPrice,
          };
        }
      }
    }

    if (!apiKey) {
      resolvedAi = await resolveAiKeyForRequest({
        user: effectiveAiUser,
        provider,
        aiModel,
        allowEnvFallback: effectiveAiUser.isAdmin,
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

    const modelInstance = buildModel(currentProvider, apiKey, finalAiModel);
    let injectedSearchContext = '';
    const searchKeywords = ['뉴스', '최신', '검색', '오늘', '알려줘', '언제', '주식', '야구', '매치', '시간'];
    const needsSearch = searchKeywords.some((keyword) => content.includes(keyword));

    if (needsSearch) {
      try {
        const searchResults = await search(content);
        if (searchResults?.results?.length) {
          const summary = searchResults.results
            .slice(0, 3)
            .map((result) => `Title: ${result.title || ''}\nDescription: ${result.description || ''}`)
            .join('\n\n');
          injectedSearchContext = `\n\n[Recent web search context at ${new Date().toLocaleString('ko-KR')}]\n${summary}`;
        }
      } catch (error) {
        console.error('Manual pre-search failed:', error);
      }
    }

    const isAgent = !!aiUser?.isAgent;

    if (isAgent) {
      const port = process.env.PORT || 3099;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/internal/claw-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-alopop-internal': INTERNAL_API_SECRET },
          body: JSON.stringify({ aiUserId, aiUserName: aiUser?.username, message: content, roomId }),
        });

        if (!res.ok) {
          try {
            const errJson = await res.json();
            return NextResponse.json({ reply: `[System error] OpenClaw agent failed: ${errJson.error || 'unknown error'}` });
          } catch {
            return NextResponse.json({ reply: '[System error] OpenClaw gateway connection failed.' });
          }
        }

        return NextResponse.json({ reply: '' });
      } catch (error) {
        return NextResponse.json({ reply: `[System notice] Internal connection error: ${String(error)}` });
      }
    }

    const { text: finalReply } = await generateText({
      model: modelInstance,
      system: `${personaPrompt}${injectedSearchContext}`,
      prompt: content,
      temperature: currentProvider === 'gemini' ? undefined : 0.85,
    });

    if (sponsorBilling) {
      const paymentResult = await prisma.$transaction(async (tx) => {
        const debit = await tx.user.updateMany({
          where: { id: sponsorBilling.payerId, walletBalance: { gte: sponsorBilling.amount } },
          data: { walletBalance: { decrement: sponsorBilling.amount } },
        });
        if (debit.count !== 1) return false;

        await tx.user.update({
          where: { id: sponsorBilling.receiverId },
          data: { walletBalance: { increment: sponsorBilling.amount } },
        });

        await tx.transaction.create({
          data: {
            senderId: sponsorBilling.payerId,
            receiverId: sponsorBilling.receiverId,
            amount: sponsorBilling.amount,
            reason: `[AI response sponsor fee] Room ${roomId}`,
          },
        });

        return true;
      });

      if (!paymentResult) {
        return NextResponse.json({ error: 'INSUFFICIENT_FUNDS' }, { status: 402 });
      }
    }

    await recordFreeEventUsage(effectiveAiUser.id, resolvedAi.freeEvent);

    return NextResponse.json({ reply: finalReply || '응답을 생성할 수 없습니다.' });
  } catch (error) {
    console.error('AI chat friend error:', error);
    const messageStr = error instanceof Error ? error.message : '';
    const isQuotaError = messageStr.includes('429') || messageStr.toLowerCase().includes('exhausted') || messageStr.toLowerCase().includes('quota');
    const status = isQuotaError ? 429 : 500;

    return NextResponse.json(
      { error: messageStr || 'Failed to process conversational AI chat', status },
      { status },
    );
  }
}
