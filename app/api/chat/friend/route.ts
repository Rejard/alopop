import { NextResponse } from 'next/server';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { search } from 'duck-duck-scrape';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { recordFreeEventUsage, resolveAiKeyForRequest } from '@/lib/ai-key-resolution';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptHostSponsorKey, resolveSponsorDelegateAccess, resolveSponsorModel } from '@/lib/sponsor-policy';

type Provider = 'openai' | 'gemini' | 'anthropic';

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || '';

function defaultModelForProvider(provider: Provider) {
  if (provider === 'gemini') return 'gemini-1.5-pro-latest';
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
      byokKey,
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

    const effectiveAiUser = aiOwner || currentUser;
    const requestByokKey = effectiveAiUser.id === currentUser.id ? byokKey : null;
    const personaPrompt = aiUser?.aiPrompt || 'You are a friendly AI companion in Alopop Messenger. Reply naturally and stay in character.';

    let resolvedAi = await resolveAiKeyForRequest({
      user: effectiveAiUser,
      provider,
      aiModel,
      byokKey: requestByokKey,
      allowFreeEventFallback: false,
      allowEnvFallback: false,
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
        byokKey: requestByokKey,
        allowEnvFallback: false,
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
      if (isAutonomous) {
        return NextResponse.json({ error: 'No API key or sponsored model is available for autonomous work.' }, { status: 400 });
      }
      return NextResponse.json({ error: `No API Key provided for ${provider || 'openai'}` }, { status: 400 });
    }

    if (isAutonomous) {
      const cp = require('child_process');
      const doSpawn = new Function('cp', 'cwd', 'userId', 'roomId', 'aiUserId', 'provider', 'apiKey', 'model', 'content', `
        return cp.spawn('node', [
          cwd + '/scripts/vibeCoder.mjs',
          userId, roomId, aiUserId, provider, apiKey, model, content
        ], { detached: true, stdio: 'ignore', cwd: cwd });
      `);

      const p = doSpawn(cp, process.cwd(), effectiveAiUser.id, roomId || '', aiUserId || '', currentProvider, apiKey, finalAiModel, content);
      p.unref();

      return NextResponse.json({ reply: 'AI autonomous work has started in the background. I will notify you when it finishes.' });
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
    const agentPath = aiUser?.agentPath || process.cwd();
    let agentTools: any = undefined;

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
    } else {
      const executeAgentTool = async (toolName: string, args: any) => {
        const port = process.env.PORT || 3099;
        const res = await fetch(`http://127.0.0.1:${port}/api/internal/agent-tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-alopop-internal': INTERNAL_API_SECRET },
          body: JSON.stringify({ aiUserId, tool: toolName, args }),
        });
        if (!res.ok) {
          const errText = await res.text();
          return { error: `[Agent disconnected] The target PC is offline or cannot execute the command: ${errText}` };
        }
        return res.json();
      };

      agentTools = {
        run_command: tool({
          description: 'Run a shell command on the remote PC. Provide the command string.',
          parameters: z.object({ command: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('run_command', args),
        }),
        read_file: tool({
          description: 'Read the contents of a file on the remote PC. Provide the absolute or relative path.',
          parameters: z.object({ path: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('read_file', args),
        }),
        write_file: tool({
          description: 'Write contents to a file on the remote PC. Provide the path and content.',
          parameters: z.object({ path: z.string(), content: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('write_file', args),
        }),
        list_dir: tool({
          description: 'List contents of a directory.',
          parameters: z.object({ path: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('list_dir', args),
        }),
      };
    }

    const finalSystemPrompt = isAgent
      ? `${personaPrompt}${injectedSearchContext}

[Default work directory] ${agentPath}
Use the available tools to inspect the actual PC state before answering system, file, or command questions. Report concrete tool output without inventing missing details.`
      : `${personaPrompt}${injectedSearchContext}`;

    let finalReply = '';
    const messages: any[] = [{ role: 'user', content }];

    for (let step = 0; step < (isAgent ? 3 : 1); step += 1) {
      const { text, toolCalls } = await generateText({
        model: modelInstance,
        system: finalSystemPrompt,
        messages,
        temperature: 0.85,
        tools: isAgent ? agentTools : undefined,
      });

      if (toolCalls && toolCalls.length > 0) {
        const manualToolResults = [];
        for (const call of toolCalls) {
          const toolFunc = agentTools[call.toolName];
          if (toolFunc?.execute) {
            try {
              const callArgs = (call as any).args || (call as any).arguments || {};
              const res = await toolFunc.execute(callArgs);
              manualToolResults.push({ tool: call.toolName, result: res });
            } catch (error) {
              manualToolResults.push({ tool: call.toolName, error: String(error) });
            }
          }
        }
        messages.push({ role: 'assistant', content: text || 'Tool calls executed.' });
        messages.push({
          role: 'user',
          content: `[System notice: tool results]\n${JSON.stringify(manualToolResults, null, 2)}\n\nUse these tool results to answer the previous user request.`,
        });
      } else {
        finalReply = text;
        break;
      }
    }

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
