import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { search } from 'duck-duck-scrape';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptHostSponsorKey, resolveSponsorModel } from '@/lib/sponsor-policy';

const INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.ENCRYPTION_KEY ||
  (process.env.NODE_ENV === 'production' ? '' : 'ALO_POP_INTERNAL_SECRET_DEFAULT');

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

function buildModel(provider: 'openai' | 'gemini' | 'anthropic', apiKey: string, model: string) {
  if (provider === 'gemini') return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  return createOpenAI({ apiKey })(model);
}

export async function POST(request: Request) {
  try {
    if (!INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Internal API secret is not configured' }, { status: 500 });
    }

    if (request.headers.get('x-alopop-internal') !== INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId, message } = await request.json();
    if (!roomId || !message || !message.content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (message.messageType === 'SYSTEM') {
      return NextResponse.json({ skipped: true, reason: 'System message' });
    }

    if (!checkRateLimit(`chat_sponsor_${message.senderId}`, 3, 1000)) {
      return NextResponse.json({
        success: false,
        error: 'Too Many Requests',
        aiAnalysis: { category: 'FAILED', reason: '메시지 전송 속도가 너무 빠릅니다.' },
      }, { status: 429 });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    if (!room?.sponsorMode) {
      return NextResponse.json({ skipped: true, reason: 'Sponsor mode disabled' });
    }

    const hostMember = room.members.find((member) => member.isHost);
    if (!hostMember) {
      return NextResponse.json({ skipped: true, reason: 'No host found' });
    }

    if (message.senderId === hostMember.userId) {
      return NextResponse.json({ skipped: true, reason: 'Host is sender' });
    }

    const hostUser = await prisma.user.findUnique({
      where: { id: hostMember.userId },
      select: { id: true, openaiKey: true, geminiKey: true, anthropicKey: true },
    });
    if (!hostUser) {
      return NextResponse.json({ skipped: true, reason: 'Host user not found' });
    }

    const sponsorConfig = resolveSponsorModel(room.sponsorModel);
    if (!sponsorConfig) {
      return NextResponse.json({ skipped: true, reason: 'Unsupported sponsor model' });
    }

    const apiKey = decryptHostSponsorKey(hostUser, sponsorConfig.provider);
    if (!apiKey) {
      return NextResponse.json({ skipped: true, reason: 'Host API Key missing' });
    }

    const sponsorPrice = room.sponsorPrice || 0;
    if (sponsorPrice > 0) {
      const guestUser = await prisma.user.findUnique({
        where: { id: message.senderId },
        select: { walletBalance: true },
      });
      if (!guestUser || guestUser.walletBalance < sponsorPrice) {
        return NextResponse.json({
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          aiAnalysis: { category: 'FAILED', reason: '코인이 부족해 스폰서 AI 분석을 취소했습니다.' },
        }, { status: 402 });
      }
    }

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    if (message.fileUrl) {
      const basename = message.fileUrl.split('/').pop();
      if (basename) {
        try {
          imageBuffer = await fs.readFile(path.join(process.cwd(), 'public', 'uploads', basename));
          if (basename.toLowerCase().endsWith('.png')) mimeType = 'image/png';
          else if (basename.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
        } catch (error) {
          console.error('Failed to read image for background fact check', error);
        }
      }
    }

    let finalAiModel = sponsorConfig.model;
    if (imageBuffer && finalAiModel === 'gpt-5.4-pro') {
      finalAiModel = 'gpt-5.4';
    }

    const textContent = message.content || '(이미지만 업로드됨)';
    const promptMessages: PromptMessage[] = imageBuffer
      ? [{
          role: 'user',
          content: [
            { type: 'text', text: `Analyze this image and attached message: "${textContent}". Look closely at the image for deepfake artifacts, text in the image, or malicious context.` },
            { type: 'image', image: imageBuffer, mimeType },
          ],
        }]
      : [{ role: 'user', content: `Analyze this message: "${textContent}"` }];

    let injectedSearchContext = `\n\n[Current time: ${new Date().toLocaleString('ko-KR')}]`;
    if (textContent.length > 5 && !imageBuffer) {
      try {
        const searchResults = await search(textContent);
        if (searchResults?.results?.length) {
          const searchItems = searchResults.results.slice(0, 3) as SearchResultItem[];
          const summary = searchItems
            .map((result) => `Title: ${result.title || ''}\nDescription: ${result.description || ''}`)
            .join('\n\n');
          injectedSearchContext = `\n\n[Recent web search context at ${new Date().toLocaleString('ko-KR')}]\nUse this context only as supporting evidence.\n${summary}`;
        }
      } catch (error) {
        console.error('Background web search failed:', error);
      }
    }

    const result = await generateObject({
      model: buildModel(sponsorConfig.provider, apiKey, finalAiModel),
      system: `You are a concise Korean fact-checking and relevance analysis AI.${injectedSearchContext}
Classify trivial greetings or harmless chat as PASS.
For images, classify AI-generated looking images as AI_GENERATED.
For scams, manipulated media, or suspicious claims, use SUSPICIOUS or FAKE.
Return a short Korean reason.`,
      messages: promptMessages,
      schema: z.object({
        category: z.enum(['PASS', 'FAKE', 'AI_GENERATED', 'SUSPICIOUS', 'VERIFIED', 'NORMAL']),
        confidence: z.number().min(0).max(1),
        reason: z.string(),
      }),
      temperature: finalAiModel === 'gpt-5.4-pro' ? undefined : 0.1,
    });

    const aiAnalysis = {
      ...result.object,
      isSponsored: true,
      sponsorModel: finalAiModel,
      sponsorPrice,
    };

    if (sponsorPrice > 0) {
      const paymentResult = await prisma.$transaction(async (tx) => {
        const debit = await tx.user.updateMany({
          where: { id: message.senderId, walletBalance: { gte: sponsorPrice } },
          data: { walletBalance: { decrement: sponsorPrice } },
        });
        if (debit.count !== 1) return false;

        await tx.user.update({
          where: { id: hostUser.id },
          data: { walletBalance: { increment: sponsorPrice } },
        });

        await tx.transaction.create({
          data: {
            senderId: message.senderId,
            receiverId: hostUser.id,
            amount: sponsorPrice,
            reason: `[AI fact-check sponsor fee] Room ${roomId}`,
          },
        });

        return true;
      });

      if (!paymentResult) {
        return NextResponse.json({
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          aiAnalysis: { category: 'FAILED', reason: '코인이 부족해 스폰서 AI 분석을 취소했습니다.' },
        }, { status: 402 });
      }
    }

    return NextResponse.json({ success: true, aiAnalysis });
  } catch (error) {
    console.error('Sponsor background AI check error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
