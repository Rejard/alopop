import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { search } from 'duck-duck-scrape';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { prisma } from '@/lib/prisma';
import { decryptKey } from '@/lib/crypto';

export async function POST(request: Request) {
  try {
    const { provider, byokKey, aiModel, systemPrompt, content, isDelegate, sponsorId, userId, useFreeEvent } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const currentProvider = provider || 'openai';
    let apiKey = byokKey;

    if (useFreeEvent && userId) {
      const now = new Date();
      const activeEvent = await prisma.event.findFirst({
        where: {
          eventType: 'FREE_AI',
          isActive: true,
          aiProvider: currentProvider,
          aiModel: aiModel,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }]
        }
      });

      if (activeEvent && activeEvent.eventApiKey) {
        let isAllowed = true;
        if (activeEvent.dailyLimit && activeEvent.dailyLimit > 0) {
           const kstDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
           const usage = await prisma.userEventUsage.findUnique({
             where: { userId_eventId_usageDate: { userId, eventId: activeEvent.id, usageDate: kstDate } }
           });
           
           if (usage && usage.count >= activeEvent.dailyLimit) {
              isAllowed = false;
           } else {
              await prisma.userEventUsage.upsert({
                where: { userId_eventId_usageDate: { userId, eventId: activeEvent.id, usageDate: kstDate } },
                update: { count: { increment: 1 } },
                create: { userId, eventId: activeEvent.id, usageDate: kstDate, count: 1 }
              });
           }
        }
        
        if (isAllowed) {
          apiKey = activeEvent.eventApiKey;
        } else {
          return NextResponse.json({ error: '오늘 할당된 무료 AI 사용 횟수를 초과했습니다.' }, { status: 429 });
        }
      }
    }

    // [신규] 고스트 임시 방장이 대리 연산 중인 경우, 방장의 API Key를 DB에서 꺼내 씁니다.
    // (단, 무료 이벤트 키가 존재할 경우 아래 로직보다 무료 키가 우선 적용되어 있습니다! apiKey가 채워져 있다면 유지)
    if (!apiKey && isDelegate && sponsorId) {
      const hostUser = await prisma.user.findUnique({ where: { id: sponsorId } });
      if (hostUser) {
        let rawEncryptedKey = null;
        if (currentProvider.startsWith('gpt') || currentProvider === 'openai') {
          rawEncryptedKey = hostUser.openaiKey;
        } else if (currentProvider.includes('gemini')) {
          rawEncryptedKey = hostUser.geminiKey;
        } else if (currentProvider.includes('claude') || currentProvider === 'anthropic') {
          rawEncryptedKey = hostUser.anthropicKey;
        }
        if (rawEncryptedKey) {
           apiKey = decryptKey(rawEncryptedKey);
        }
      }
    }

    if (!apiKey) {
      if (currentProvider === 'gemini' || currentProvider === 'gemini-free') apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      else if (currentProvider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
      else apiKey = process.env.OPENAI_API_KEY;
    }

    if (!apiKey) {
      return NextResponse.json({ error: `No API Key provided for ${provider || 'openai'}` }, { status: 400 });
    }

    let modelInstance;

    switch (currentProvider) {
      case 'gemini-free':
      case 'gemini':
        const customGoogle = createGoogleGenerativeAI({ apiKey });
        modelInstance = customGoogle(currentProvider === 'gemini-free' ? 'gemini-1.5-pro-latest' : (aiModel || 'gemini-1.5-pro-latest'));
        break;
      case 'anthropic':
        const customAnthropic = createAnthropic({ apiKey });
        modelInstance = customAnthropic(aiModel || 'claude-3-opus-20240229');
        break;
      case 'openai':
      default:
        const customOpenAI = createOpenAI({ apiKey });
        modelInstance = customOpenAI(aiModel || 'gpt-4o');
        break;
    }

    // EdenAI 등 구형 프록시 파서가 JSON Schema Tool 규격을 지원하지 못하는(type: None 크래시) 치명적 호환성 이슈 해결
    // 어절을 판단하여 사용자가 최신 정보를 요구하는 질문일 경우 API 자체 판단을 거치지 않고 서버가 먼저 강제로 DuckDuckGo 인터넷 검색 수행
    let injectedSearchContext = "";
    const searchKeywords = ['뉴스', '날씨', '검색', '오늘', '알려줘', '어때', '주식', '누구야', '며칠', '시간'];
    const needsSearch = searchKeywords.some(keyword => content.includes(keyword));

    if (needsSearch) {
      try {
        const searchResults = await search(content);
        if (searchResults && searchResults.results && searchResults.results.length > 0) {
          const summary = searchResults.results.slice(0, 3).map(r => `제목: ${r.title}\n내용: ${r.description}`).join('\n\n');
          injectedSearchContext = `\n\n[💡 최신 웹 검색 결과 배경지식 (현재 시각: ${new Date().toLocaleString('ko-KR')})]\n사용자의 질문에 대답할 때 아래 최신 인터넷 정보를 바탕으로 아는 척하며 자연스럽게 대답해주세요:\n${summary}`;
        }
      } catch (e) {
        console.error('Manual Pre-search failed:', e);
      }
    }

    // AI 자율 응답 (텍스트 생성) 모델 호출
    const { text } = await generateText({
      model: modelInstance,
      system: (systemPrompt || "당신은 알로팝 메신저의 다정하고 친근한 AI 친구입니다.") + injectedSearchContext,
      prompt: content,
      temperature: 0.85, // 약간 창의적이고 사람같은 성질 부여
    });

    return NextResponse.json({ reply: text });

  } catch (error: any) {
    console.error('AI chat friend error:', error);
    const messageStr = error?.message || '';
    const isQuotaError = messageStr.includes('429') || messageStr.toLowerCase().includes('exhausted') || messageStr.toLowerCase().includes('quota');
    const status = isQuotaError ? 429 : 500;
    
    return NextResponse.json(
      { error: messageStr || 'Failed to process conversational AI chat', status },
      { status }
    );
  }
}
