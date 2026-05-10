import { NextResponse } from 'next/server';
import { generateText, tool } from 'ai';
import { z } from 'zod';
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
      isAutonomous,
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
      if (isAutonomous) {
        return NextResponse.json({ error: 'API 키 또는 Vibe 코딩을 지원하는 유료 모델이 설정되어 있지 않아 자율 작업을 시작할 수 없습니다.' }, { status: 400 });
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
      
      const p = doSpawn(cp, process.cwd(), currentUser.id, roomId || '', aiUserId || '', currentProvider, apiKey, finalAiModel, content);
      p.unref();

      return NextResponse.json({ reply: '🚀 바이브 워킹 작업을 백그라운드에서 시작했습니다. 완료되면 전체 알림을 드립니다!' });
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

    let agentTools: any = undefined;
    let isAgent = false;
    let agentPath = '';
    if (aiUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: aiUserId },
        select: { isAgent: true, agentPath: true }
      });
      isAgent = !!targetUser?.isAgent;
      agentPath = targetUser?.agentPath || process.cwd();
    }

    if (isAgent) {
      // OpenClaw Agent: Bypass Alopop AI SDK and send directly to OpenClaw via internal socket API.
      const port = process.env.PORT || 3099;
      const aiUser = await prisma.user.findUnique({ where: { id: aiUserId }, select: { username: true } });
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/internal/claw-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiUserId, aiUserName: aiUser?.username, message: content, roomId })
        });
        
        if (!res.ok) {
          try {
            const errJson = await res.json();
            return NextResponse.json({ reply: `[시스템 오류] OpenClaw Agent 통신 실패: ${errJson.error || '알 수 없는 오류'}` });
          } catch(e) {
            return NextResponse.json({ reply: "[시스템 오류] OpenClaw Gateway 연결에 실패했습니다." });
          }
        } else {
          // Success. We return empty string directly so no system message is created, and rely on typing indicator synchronization.
          return NextResponse.json({ reply: '' });
        }
      } catch (e) {
        return NextResponse.json({ reply: `[시스템 안내] 내부 통신 오류: ${String(e)}` });
      }
    } else {
      const executeAgentTool = async (toolName: string, args: any) => {
        const port = process.env.PORT || 3099;
        const res = await fetch(`http://127.0.0.1:${port}/api/internal/agent-tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiUserId, tool: toolName, args })
        });
        if (!res.ok) {
          const errText = await res.text();
          return { error: `[Agent Disconnected] 해당 PC가 오프라인 상태이거나 명령을 수행할 수 없습니다: ${errText}` };
        }
        return res.json();
      };

      agentTools = {
        run_command: tool({
          description: 'Run a shell command on the remote PC. Provide the command string.',
          parameters: z.object({ command: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('run_command', args)
        }),
        read_file: tool({
          description: 'Read the contents of a file on the remote PC. Provide the absolute or relative path.',
          parameters: z.object({ path: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('read_file', args)
        }),
        write_file: tool({
          description: 'Write contents to a file on the remote PC. Provide the path and content.',
          parameters: z.object({ path: z.string(), content: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('write_file', args)
        }),
        list_dir: tool({
          description: 'List contents of a directory on the remote PC.',
          parameters: z.object({ path: z.string() }),
          // @ts-ignore
          execute: async (args: any) => executeAgentTool('list_dir', args)
        })
      };
    }

    const finalSystemPrompt = isAgent
      ? (systemPrompt || '당신은 사용자의 원격 PC를 제어하고 관리하는 전문적인 개발자용 OpenAlo 에이전트 터미널입니다.') + injectedSearchContext + 
        `\n\n[기본 작업 디렉토리] ${agentPath}\n- 사용자가 파일이나 폴더를 탐색/수정할 때 반드시 이 디렉토리를 절대 경로로 명시하여 작업하세요.` +
        '\n\n[중요] 사용자가 시스템 정보, 폴더 리스트, 터미널 명령어 등을 요청하면 반드시 제공된 도구를 사용하여 실제 PC의 상태를 확인한 후 대답하세요.\n[규칙 1] 도구 실행 결과는 절대로 대충 요약하거나 생략하지 마세요. 개발자가 꼼꼼히 확인할 수 있도록 터미널 출력 결과나 파일 리스트를 가감 없이 원본 그대로 모두 출력하세요.\n[규칙 2] 친근한 말투나 불필요한 대화(~있네요, ~할까요? 등)는 절대 사용하지 말고, 시스템 콘솔처럼 건조하고 정확하게 결괏값만 전문적으로 전달하세요.'
      : (systemPrompt || '당신은 알로팝 메신저의 친근한 AI 친구입니다.') + injectedSearchContext;

    let finalReply = '';
    const messages: any[] = [{ role: 'user', content }];

    for (let step = 0; step < (isAgent ? 3 : 1); step++) {
      const { text, toolCalls } = await generateText({
        model: modelInstance,
        system: finalSystemPrompt,
        messages: messages,
        temperature: 0.85,
        tools: isAgent ? agentTools : undefined,
      });

      if (toolCalls && toolCalls.length > 0) {
        const manualToolResults = [];
        for (const call of toolCalls) {
           const toolFunc = agentTools[call.toolName];
           if (toolFunc && toolFunc.execute) {
               try {
                   const callArgs = (call as any).args || (call as any).arguments || {};
                   const res = await toolFunc.execute(callArgs);
                   manualToolResults.push({ tool: call.toolName, result: res });
               } catch (e: any) {
                   manualToolResults.push({ tool: call.toolName, error: String(e) });
               }
           }
        }
        messages.push({
          role: 'assistant',
          content: text || '도구를 실행했습니다.',
        });
        messages.push({
          role: 'user',
          content: `[시스템 알림: 도구 실행 결과]\n${JSON.stringify(manualToolResults, null, 2)}\n\n이 도구 실행 결과를 바탕으로 이전 질문에 대한 답변을 제공하세요.`
        });
      } else {
        finalReply = text;
        break;
      }
    }

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

    return NextResponse.json({ reply: finalReply || '응답을 생성할 수 없습니다.' });
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
