import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptKey } from '@/lib/crypto';
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
    const { roomId, message } = await request.json();

    if (!roomId || !message || !message.content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (message.messageType === 'SYSTEM') {
      return NextResponse.json({ skipped: true, reason: 'System message' });
    }

    // 방 모드, 호스트 확인
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true }
    });

    if (!room || !room.sponsorMode) {
      return NextResponse.json({ skipped: true, reason: 'Sponsor mode disabled' });
    }

    const hostMember = room.members.find(m => m.isHost);
    if (!hostMember) {
      return NextResponse.json({ skipped: true, reason: 'No host found' });
    }

    // 팩트체크 대상이 방장이 보낸 메시지라면 스킵 (방장 무한과금 방지)
    if (message.senderId === hostMember.userId) {
      return NextResponse.json({ skipped: true, reason: 'Host is sender' });
    }

    const hostUser = await prisma.user.findUnique({
      where: { id: hostMember.userId }
    });

    if (!hostUser) {
      return NextResponse.json({ skipped: true, reason: 'Host user not found' });
    }

    // 벤더 판별
    const sponsorModel = room.sponsorModel || 'openai';
    let rawEncryptedKey = null;

    if (sponsorModel.startsWith('gpt') || sponsorModel === 'openai') {
      rawEncryptedKey = hostUser.openaiKey;
    } else if (sponsorModel.includes('gemini')) {
      rawEncryptedKey = hostUser.geminiKey;
    } else if (sponsorModel.includes('claude') || sponsorModel === 'anthropic') {
      rawEncryptedKey = hostUser.anthropicKey;
    }

    let apiKey = rawEncryptedKey ? decryptKey(rawEncryptedKey) : null;

    // 만약 방장의 Key가 없다면 글로벌 서버환경변수 폴백 시도 (MVP용 편의기능)
    if (!apiKey) {
      if (sponsorModel.includes('gemini')) apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
      else if (sponsorModel.includes('claude')) apiKey = process.env.ANTHROPIC_API_KEY || null;
      else apiKey = process.env.OPENAI_API_KEY || null;
    }

    if (!apiKey) {
      return NextResponse.json({ skipped: true, reason: 'Host API Key missing' });
    }

    // 과금 체크 및 차감
    const sponsorPrice = room.sponsorPrice || 0;
    if (sponsorPrice > 0) {
      const guestUser = await prisma.user.findUnique({ where: { id: message.senderId } });
      if (!guestUser || guestUser.walletBalance < sponsorPrice) {
        return NextResponse.json({ 
          success: false, 
          error: 'INSUFFICIENT_FUNDS',
          aiAnalysis: { category: 'FAILED', reason: '코인 잔액 부족 (팩트체크 취소됨)' } 
        });
      }

      // Guest 돈 차감
      await prisma.user.update({
        where: { id: guestUser.id },
        data: { walletBalance: guestUser.walletBalance - sponsorPrice }
      });

      // Host 돈 증가
      await prisma.user.update({
        where: { id: hostUser.id },
        data: { walletBalance: hostUser.walletBalance + sponsorPrice }
      });

      // 거래 기록 (Guest 입장에서 지출)
      await prisma.transaction.create({
        data: {
          senderId: guestUser.id,
          receiverId: hostUser.id,
          amount: sponsorPrice,
          reason: `[AI 팩트체크 요금] 방: ${room.name}`
        }
      });
    }

    // AI 호출 로직 (기존 /api/chat 복각)
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    if (message.fileUrl) {
      const basename = message.fileUrl.split('/').pop();
      if (basename) {
        const filepath = path.join(process.cwd(), 'public', 'uploads', basename);
        try {
          imageBuffer = await fs.readFile(filepath);
          if (basename.toLowerCase().endsWith('.png')) mimeType = 'image/png';
          else if (basename.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
        } catch(e) {
          console.error("Failed to read image for background fact check", e);
        }
      }
    }

    let finalAiModel = sponsorModel;
    if (imageBuffer && (sponsorModel === 'openai' || sponsorModel === 'gpt-5.4-pro')) {
      finalAiModel = 'gpt-5.4'; // Vision fallback
    }

    let modelInstance;
    if (sponsorModel.includes('gemini')) {
      const customGoogle = createGoogleGenerativeAI({ apiKey });
      modelInstance = customGoogle(sponsorModel === 'gemini' ? 'gemini-1.5-pro-latest' : finalAiModel);
    } else if (sponsorModel.includes('anthropic')) {
      const customAnthropic = createAnthropic({ apiKey });
      modelInstance = customAnthropic(sponsorModel === 'anthropic' ? 'claude-3-haiku-20240307' : finalAiModel);
    } else {
      const customOpenAI = createOpenAI({ apiKey });
      modelInstance = customOpenAI(sponsorModel === 'openai' ? 'gpt-5.4' : finalAiModel);
    }

    const promptMessages: any[] = [];
    const textContent = message.content || "(사용자가 이미지만 업로드했습니다.)";
    
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
    if (textContent.length > 5 && !imageBuffer) {
      try {
        const searchResults = await search(textContent);
        if (searchResults && searchResults.results && searchResults.results.length > 0) {
          const summary = searchResults.results.slice(0, 3).map((r: any) => `제목: ${r.title}\n내용: ${r.description}`).join('\n\n');
          injectedSearchContext = `\n\n[💡 최신 웹 포렌식 검색 결과 (현재 시각: ${new Date().toLocaleString('ko-KR')})]\n분석 대상이 최신 사실과 부합하는지 검색 결과를 교차 검증의 근거로 우선 활용하세요:\n${summary}`;
        }
      } catch (e) {
        console.error('Background Web Search failed:', e);
      }
    }

    const result = await generateObject({
      model: modelInstance,
      system: `당신은 최고 수준의 디지털 포렌식 및 팩트체크 AI입니다.${injectedSearchContext}
      [특별 지침]
      1. 단순한 인사말("안녕", "뭐해")이나 평범한 잡담은 **반드시 'PASS'**로 분류하세요.
      2. 사진이 업로드된 경우, AI가 생성한 그림이 의심된다면 'AI_GENERATED'로 분류하세요.
      3. 인물/상황의 합성 딥페이크나 허위 주장이면 'FAKE' 또는 'SUSPICIOUS'로 분류.
      4. 현실 사진이거나 객관적 진실일 때만 'VERIFIED' 또는 'NORMAL' 분류.
      - category: PASS, NORMAL, SUSPICIOUS, FAKE, VERIFIED, AI_GENERATED 중 하나 
      - confidence: 0에서 1사이 실수
      - reason: 분석 결과에 대한 타당한 이유 (한국어로 짧게)`,
      messages: promptMessages,
      schema: z.object({
        category: z.enum(['PASS', 'FAKE', 'AI_GENERATED', 'SUSPICIOUS', 'VERIFIED', 'NORMAL']),
        confidence: z.number().min(0).max(1),
        reason: z.string()
      }),
      temperature: finalAiModel === 'gpt-5.4-pro' ? undefined : 0.1,
    });

    const aiRes = result.object;
    // 방장 스폰서 식별용 표식 삽입
    (aiRes as any).isSponsored = true;
    (aiRes as any).sponsorModel = finalAiModel;
    (aiRes as any).sponsorPrice = sponsorPrice;

    return NextResponse.json({ success: true, aiAnalysis: aiRes });

  } catch (error: any) {
    console.error('Sponsor background AI check error:', error);
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
