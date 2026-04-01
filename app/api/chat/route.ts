import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { search } from 'duck-duck-scrape';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { content, imageUrl, byokKey, provider, aiModel } = await request.json();

    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'Content or image is required' }, { status: 400 });
    }

    let apiKey = byokKey;
    if (!apiKey) {
      if (provider === 'gemini' || provider === 'gemini-free') apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      else if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
      else apiKey = process.env.OPENAI_API_KEY;
    }

    if (!apiKey) {
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
        } catch(e) {
          console.error("Failed to read image for vision API:", e);
        }
      }
    }

    let finalAiModel = aiModel;
    const currentProvider = provider || 'openai';

    // GPT-5.4-Pro (OpenAI 추론 모델)는 Vision(멀티모달 이미지) 입력을 아직 지원하지 않으므로, 
    // 이미지가 포함된 팩트체크 시에는 범용 모델(gpt-5.4)로 강제 Fallback 처리하여 에러 방지
    if (imageBuffer && currentProvider === 'openai' && finalAiModel === 'gpt-5.4-pro') {
      finalAiModel = 'gpt-5.4';
    }

    let modelInstance;
    switch (currentProvider) {
      case 'gemini-free':
      case 'gemini':
        const customGoogle = createGoogleGenerativeAI({ apiKey });
        modelInstance = customGoogle(currentProvider === 'gemini-free' ? 'gemini-1.5-pro-latest' : (finalAiModel || 'gemini-1.5-pro-latest'));
        break;
      case 'anthropic':
        const customAnthropic = createAnthropic({ apiKey });
        modelInstance = customAnthropic(finalAiModel || 'claude-3-haiku-20240307');
        break;
      case 'openai':
      default:
        const customOpenAI = createOpenAI({ apiKey });
        modelInstance = customOpenAI(finalAiModel || 'gpt-5.4');
        break;
    }

    const promptMessages: any[] = [];
    const textContent = content || "(사용자가 이미지만 업로드했습니다.)";
    
    if (imageBuffer) {
      promptMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this image and attached message: "${textContent}". Look closely at the image for Deepfake artifacts, text in the image, or malicious context.` },
          { type: 'image', image: imageBuffer, mimeType: mimeType }
        ]
      });
    } else {
      promptMessages.push({
        role: 'user',
        content: `Analyze this message: "${textContent}"`
      });
    }

    let injectedSearchContext = `\n\n[현재 시스템 시각: ${new Date().toLocaleString('ko-KR')}]`;
    if (content && content.length > 5) {
      try {
        const searchResults = await search(content);
        if (searchResults && searchResults.results && searchResults.results.length > 0) {
          const summary = searchResults.results.slice(0, 3).map((r: any) => `제목: ${r.title}\n내용: ${r.description}`).join('\n\n');
          injectedSearchContext = `\n\n[💡 최신 웹 포렌식 검색 결과 (현재 시각: ${new Date().toLocaleString('ko-KR')})]\n분석 대상이 최신 사실과 부합하는지 아래 인터넷 검색 결과를 교차 검증의 근거로 우선 활용하세요:\n${summary}`;
        }
      } catch (e) {
        console.error('Fact-check Web Search failed:', e);
      }
    }

    const result = await generateObject({
      model: modelInstance,
      system: `당신은 최고 수준의 디지털 포렌식 및 팩트체크 AI입니다. 사용자가 전송한 텍스트 또는 사진 이미지를 정밀 분석하세요.${injectedSearchContext}
      
      [특별 지침]
      1. 단순한 인사말("안녕", "뭐해"), 일상적인 감정 표현("ㅋㅋ", "ㅠㅠ", "배고파"), 상대방과의 평범한 잡담 등 팩트체크가 전혀 무의미한 일상 대화라면 **반드시 'PASS'**로 분류하세요.
      2. 사진이 업로드된 경우, AI가 생성한 그림(특유의 질감, 비현실적인 광원, 매끄러운 피부, 형태 왜곡 등)이 의심된다면 'AI_GENERATED'로 분류하세요.
      3. 인물이나 상황이 악의적으로 합성된 딥페이크나 가짜 뉴스용 조작 사진이거나 허위 주장이면 'FAKE' 또는 'SUSPICIOUS'로 분류하세요.
      4. 실제 현실의 무보정 사진임이 확실하거나 주장하는 바가 명백한 객관적 진실일 때만 'VERIFIED' 또는 'NORMAL'을 부여하세요.
      
      분석 내용을 바탕으로 다음 JSON 객체를 반환하세요.
      - category: PASS, NORMAL, SUSPICIOUS, FAKE, VERIFIED, AI_GENERATED 중 하나 
      - confidence: 0에서 1사이의 실수 (확신도)
      - reason: 분석 결과에 대한 타당한 이유 (한국어로 짧게 1~2문장. PASS일 때는 '일상 대화입니다' 등으로 작성)`,
      messages: promptMessages,
      schema: z.object({
        category: z.enum(['PASS', 'FAKE', 'AI_GENERATED', 'SUSPICIOUS', 'VERIFIED', 'NORMAL']),
        confidence: z.number().min(0).max(1),
        reason: z.string()
      }),
      temperature: finalAiModel === 'gpt-5.4-pro' ? undefined : 0.1,
    });

    return NextResponse.json(result.object);

  } catch (error: any) {
    console.error('AI check error:', error);
    const messageStr = error?.message || '';
    const isQuotaError = messageStr.includes('429') || messageStr.toLowerCase().includes('exhausted') || messageStr.toLowerCase().includes('quota');
    const status = isQuotaError ? 429 : 500;
    
    return NextResponse.json(
      { error: messageStr || 'Failed to process AI analysis', status },
      { status }
    );
  }
}

