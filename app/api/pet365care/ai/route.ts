import { NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { requireCurrentUser } from '@/lib/auth';
import { resolveAiKeyForRequest, recordFreeEventUsage } from '@/lib/ai-key-resolution';

function defaultModelForProvider(provider: string) {
  if (provider === 'gemini') return 'gemini-2.5-flash';
  if (provider === 'anthropic') return 'claude-3-haiku-20240307';
  return 'gpt-4o-mini';
}

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const body = await request.json();
    const { action } = body;

    // Alopop AI 키 해결 (이벤트 무료 → 개인키 → 환경변수)
    const resolvedAi = await resolveAiKeyForRequest({
      user: currentUser,
      provider: 'gemini',
      aiModel: 'gemini-2.5-flash',
    });

    if (!resolvedAi.apiKey) {
      return NextResponse.json({ error: 'AI API 키를 사용할 수 없습니다.' }, { status: 400 });
    }

    const finalModel = resolvedAi.aiModel || defaultModelForProvider(resolvedAi.provider);

    let modelInstance;
    switch (resolvedAi.provider) {
      case 'gemini': {
        const g = createGoogleGenerativeAI({ apiKey: resolvedAi.apiKey });
        modelInstance = g(finalModel);
        break;
      }
      case 'anthropic': {
        const a = createAnthropic({ apiKey: resolvedAi.apiKey });
        modelInstance = a(finalModel);
        break;
      }
      default: {
        const o = createOpenAI({ apiKey: resolvedAi.apiKey });
        modelInstance = o(finalModel);
        break;
      }
    }

    // ======= 이미지 분석 =======
    if (action === 'analyzeImage') {
      const { imageBase64 } = body;
      if (!imageBase64) {
        return NextResponse.json({ error: '이미지가 필요합니다.' }, { status: 400 });
      }

      const prompt = "당신은 전문 수의사 AI입니다. 이 반려동물의 사진을 분석하고, 눈꼽, 피부 상태, 피모 윤기 등을 종합하여 건강 및 영양 상태를 진단해 주세요. 발견된 특이사항과 100점 만점의 건강 점수를 포함하여 한국어로 짧고 친절하게 작성해 주세요. JSON 형식으로 응답: {\"diagnosis\": \"...\", \"confidence\": 85, \"mood\": \"행복하고 활기참\"}";

      const result = await generateText({
        model: modelInstance,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: Buffer.from(imageBase64, 'base64') },
          ],
        }],
      });

      await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({
            diagnosis: parsed.diagnosis || result.text,
            confidence: parsed.confidence || 75,
            mood: parsed.mood || "분석 완료",
          });
        }
      } catch { /* fallback */ }

      return NextResponse.json({ diagnosis: result.text, confidence: 75, mood: "분석 완료" });
    }

    // ======= 케어 팁 생성 =======
    if (action === 'generateCareTip') {
      const { petName, species, breed, age } = body;
      const today = new Date();
      const month = today.getMonth() + 1;
      const season = month <= 2 || month === 12 ? "겨울" : month <= 5 ? "봄" : month <= 8 ? "여름" : "가을";
      const speciesName = species === "dog" ? "강아지" : species === "cat" ? "고양이" : "반려동물";

      const prompt = `당신은 반려동물 케어 전문가입니다. ${speciesName} ${petName}(${breed}, ${age}살)에게 맞는 오늘의 케어 팁을 알려주세요. 현재 계절은 ${season}입니다. JSON 형식으로 응답: {"title": "짧은 제목", "content": "구체적인 팁 내용 2-3줄", "iconType": "Sun|Moon|Heart|Activity|Apple 중 하나"}`;

      const result = await generateText({
        model: modelInstance,
        prompt,
      });

      await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({
            title: parsed.title || "오늘의 케어 팁",
            content: parsed.content || result.text,
            iconType: parsed.iconType || "Apple",
          });
        }
      } catch { /* fallback */ }

      return NextResponse.json({ title: "오늘의 케어 팁", content: result.text || "반려동물과 함께하는 하루를 즐겨보세요!", iconType: "Apple" });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Pet365Care AI] Error:', error);
    return NextResponse.json({ error: 'AI 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
