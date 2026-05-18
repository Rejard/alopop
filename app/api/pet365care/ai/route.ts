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
    const { action, provider, aiModel } = body;

    // Alopop AI 키 해결 (이벤트 무료 → 개인키 → 환경변수)
    const resolvedAi = await resolveAiKeyForRequest({
      user: currentUser,
      provider: provider || 'gemini',
      aiModel: aiModel || 'gemini-2.5-flash',
      allowEnvFallback: false,
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

    // ======= 기록 요약 생성 =======
    if (action === 'generateHistorySummary') {
      const { petName, recordsText } = body;
      
      const prompt = `당신은 반려동물 전문 AI 주치의입니다. 다음은 '${petName}'의 최근 AI 건강 분석 기록들입니다.\n\n${recordsText}\n\n이 기록들을 바탕으로 현재 건강 상태의 트렌드(호전/악화/유지)와 보호자가 주의해야 할 점을 2~3줄로 매우 짧고 친절하게 한국어로 요약해주세요. JSON 형식으로 응답: {"summary": "요약 내용..."}`;

      const result = await generateText({
        model: modelInstance,
        prompt,
      });

      await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ summary: parsed.summary || result.text });
        }
      } catch { /* fallback */ }

      return NextResponse.json({ summary: result.text });
    }

    // ======= 데일리 케어 코칭 생성 =======
    if (action === 'generateDailyCoaching') {
      const { petName, checksText } = body;
      
      const prompt = `당신은 반려동물 전문 AI 주치의입니다. 다음은 '${petName}'의 오늘 하루 케어 기록(체크리스트)입니다.\n\n${checksText}\n\n이 기록들을 바탕으로 보호자에게 아주 짧고(2줄 이내) 따뜻한 조언이나 칭찬을 한국어로 해주세요. 예: "산책을 다녀왔네요! 수분 보충을 위해 물을 꼭 챙겨주세요." JSON 형식으로 응답: {"coaching": "조언 내용..."}`;

      const result = await generateText({
        model: modelInstance,
        prompt,
      });

      await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ coaching: parsed.coaching || result.text });
        }
      } catch { /* fallback */ }

      return NextResponse.json({ coaching: result.text });
    }

    if (action === 'generateWeeklyRoutineCoaching') {
      const { petName, weeklyStatsText, userName } = body;
      const targetName = userName ? `${userName}님` : "보호자님";
      
      const prompt = `당신은 반려동물 전문 AI 주치의입니다. 다음은 '${petName}'의 최근 7일간의 루틴 수행 데이터입니다.\n\n${weeklyStatsText}\n\n이 데이터를 분석하여 ${targetName}에게 앞으로의 방향성이나 가장 부족한 부분에 대한 아주 짧고(3줄 이내) 따뜻한 격려 및 조언을 한국어로 해주세요. 반드시 대화 상대를 '${targetName}'이라고 호칭해야 합니다. 예: "${targetName}! 밥과 간식은 완벽하게 챙겨주셨네요! 다만 양치 횟수가 조금 부족합니다. 치아 건강을 위해 양치 습관을 조금 더 들여볼까요?" JSON 형식으로 응답: {"coaching": "분석 내용..."}`;

      const result = await generateText({
        model: modelInstance,
        prompt,
      });

      await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ coaching: parsed.coaching || result.text });
        }
      } catch { /* fallback */ }

      return NextResponse.json({ coaching: result.text });
    }

    if (action === 'generateDailyOverallDiagnosis') {
      const { petsInfoText, recordsText, userName } = body;
      const targetName = userName ? `${userName}님` : "보호자님";
      
      const prompt = `당신은 따뜻한 반려동물 전문 AI 주치의입니다. 다음은 ${targetName}이(가) 키우는 전체 반려동물의 최근 7일 평균 루틴 달성률과 오늘의 루틴 달성률 비교 데이터입니다.

비교 데이터:
${recordsText}

이 데이터를 바탕으로, 오늘 아이들의 루틴 수행 상태(컨디션)가 최근 7일 평균과 비교해서 어떤지 평가하고, 2~3문장 이내로 다정하고 활기차게 한국어로 칭찬이나 조언을 해주세요.
JSON 형식으로 응답: {"diagnosis": "요약 내용..."}`;

      const result = await generateText({
        model: modelInstance,
        prompt,
      });

      await recordFreeEventUsage(currentUser.id, resolvedAi.freeEvent);

      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ diagnosis: parsed.diagnosis || result.text });
        }
      } catch { /* fallback */ }

      return NextResponse.json({ diagnosis: result.text });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Pet365Care AI] Error:', error);
    return NextResponse.json({ error: 'AI 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
