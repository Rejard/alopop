import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { content, imageUrl, byokKey, provider, aiModel } = await request.json();

    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'Content or image is required' }, { status: 400 });
    }

    const apiKey = byokKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: `No API Key provided for ${provider || 'openai'}` }, { status: 400 });
    }

    let modelInstance;
    const currentProvider = provider || 'openai';

    switch (currentProvider) {
      case 'gemini':
        const customGoogle = createGoogleGenerativeAI({ apiKey });
        modelInstance = customGoogle(aiModel || 'gemini-3.1-pro-preview');
        break;
      case 'anthropic':
        const customAnthropic = createAnthropic({ apiKey });
        modelInstance = customAnthropic(aiModel || 'claude-3-haiku-20240307');
        break;
      case 'openai':
      default:
        const customOpenAI = createOpenAI({ apiKey });
        modelInstance = customOpenAI(aiModel || 'gpt-5.4');
        break;
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

    const result = await generateObject({
      model: modelInstance,
      system: `당신은 최고 수준의 디지털 포렌식 및 팩트체크 AI입니다. 사용자가 전송한 텍스트 또는 사진 이미지를 정밀 분석하세요.
      
      [이미지 분석 특별 지침]
      1. 사진이 업로드된 경우, 육안으로 보기에 AI가 생성한 그림(Midjourney, DALL-E, Stable Diffusion 등) 특유의 질감, 비현실적인 광원, 매끄러운 피부, 형태 왜곡 등이 조금이라도 의심된다면 무조건 'AI_GENERATED'로 분류하세요.
      2. 인물이나 상황이 악의적으로 합성된 딥페이크나 가짜 뉴스용 조작 사진이라면 'FAKE' 또는 'SUSPICIOUS'로 분류하세요.
      3. 사람이 직접 카메라로 촬영한 실제 현실의 무보정 사진임이 100% 확실할 때만 'NORMAL'을 부여하세요.
      
      분석 내용을 바탕으로 다음 JSON 객체를 반환하세요.
      - category: NORMAL, SUSPICIOUS, FAKE, VERIFIED, AI_GENERATED 중 하나
      - confidence: 0에서 1사이의 실수 (확신도)
      - reason: 분석 결과에 대한 타당한 이유 (한국어로 짧게 1~2문장. NORMAL일 때도 이유 작성)`,
      messages: promptMessages,
      schema: z.object({
        category: z.enum(['FAKE', 'AI_GENERATED', 'SUSPICIOUS', 'VERIFIED', 'NORMAL']),
        confidence: z.number().min(0).max(1),
        reason: z.string()
      }),
      temperature: 0.1,
    });

    return NextResponse.json(result.object);

  } catch (error: any) {
    console.error('AI check error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process AI analysis' },
      { status: 500 }
    );
  }
}

