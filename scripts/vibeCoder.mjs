import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';

const prisma = new PrismaClient();

// Get arguments from spawn
// node vibeCoder.mjs <userId> <roomId> <aiUserId> <provider> <apiKey> <aiModel> <taskContent>
const args = process.argv.slice(2);
const userId = args[0];
const roomId = args[1];
const aiUserId = args[2];
const provider = args[3];
const apiKey = args[4];
const aiModel = args[5];
const taskContent = args.slice(6).join(' ');

async function main() {
  console.log(`[VibeCoder] Starting autonomous background task...`);
  console.log(`[VibeCoder] Target Room: ${roomId}, AI: ${aiUserId}, Model: ${aiModel}`);

  const port = process.env.PORT || 3099;
  
  // Notify start
  try {
    await fetch(`http://127.0.0.1:${port}/api/internal/vibe-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', roomId, aiUserId })
    });
  } catch(e) { console.error('Failed to notify vibe start', e); }

  try {
    let modelInstance;
    switch (provider) {
      case 'gemini':
        modelInstance = createGoogleGenerativeAI({ apiKey })(aiModel);
        break;
      case 'anthropic':
        modelInstance = createAnthropic({ apiKey })(aiModel);
        break;
      case 'openai':
      default:
        modelInstance = createOpenAI({ apiKey })(aiModel);
        break;
    }

    const aiUser = await prisma.user.findUnique({
      where: { id: aiUserId },
      select: { username: true, aiPrompt: true, agentPath: true }
    });

    if (!aiUser) {
      throw new Error(`AI User not found: ${aiUserId}`);
    }

    const executeAgentTool = async (toolName, args) => {
      const port = process.env.PORT || 3099;
      const res = await fetch(`http://127.0.0.1:${port}/api/internal/agent-tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiUserId, tool: toolName, args })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    };

    const agentTools = {
      run_command: tool({
        description: 'Run a shell command on the remote PC. Provide the command string.',
        parameters: z.object({ command: z.string() }),
        execute: async (args) => executeAgentTool('run_command', args)
      }),
      read_file: tool({
        description: 'Read the contents of a file on the remote PC. Provide the absolute or relative path.',
        parameters: z.object({ path: z.string() }),
        execute: async (args) => executeAgentTool('read_file', args)
      }),
      write_file: tool({
        description: 'Write contents to a file on the remote PC. Provide the path and content.',
        parameters: z.object({ path: z.string(), content: z.string() }),
        execute: async (args) => executeAgentTool('write_file', args)
      }),
      list_dir: tool({
        description: 'List contents of a directory on the remote PC.',
        parameters: z.object({ path: z.string() }),
        execute: async (args) => executeAgentTool('list_dir', args)
      })
    };

    const systemPrompt = `당신은 사용자의 원격 PC를 자율적으로 제어하여 개발 업무를 수행하는 OpenAlo 바이브 워킹 에이전트입니다.
[기본 작업 디렉토리] ${aiUser.agentPath || process.cwd()}
- 반드시 위 작업 디렉토리를 기준으로 절대 경로를 사용하여 도구를 실행하세요.
- 파일 탐색이나 읽기는 다른 경로에서 할 수 있지만, **새로운 파일을 생성하거나 결과물을 저장할 때는 무조건 [기본 작업 디렉토리] 내부에 저장해야 합니다.** (예외 없음)
사용자의 지시를 완수하기 위해 제공된 도구들을 최대한 활용하세요.
작업 진행 중에 필요한 경우 코드를 읽고, 작성하고, 명령어를 실행하여 테스트하세요.
작업이 완전히 끝났다고 판단되면, 최종 보고서를 작성하여 반환하세요.`;

    const messages = [{ role: 'user', content: `[자율 주행 작업 시작]\n${taskContent}` }];
    let finalReply = '';

    const MAX_STEPS = 50;
    
    for (let step = 0; step < MAX_STEPS; step++) {
      console.log(`[VibeCoder] Step ${step + 1}/${MAX_STEPS} generating...`);
      
      const { text, toolCalls, toolResults } = await generateText({
        model: modelInstance,
        system: systemPrompt,
        messages: messages,
        temperature: 0.7,
        tools: agentTools,
      });

      if (toolResults && toolResults.length > 0) {
        messages.push({
          role: 'assistant',
          content: text || '도구를 실행했습니다.',
        });
        messages.push({
          role: 'user',
          content: `[시스템 알림: 도구 실행 결과]\n${JSON.stringify(toolResults, null, 2)}\n\n다음 작업을 계속하거나, 작업이 끝났다면 완료 보고를 해주세요.`
        });
      } else {
        finalReply = text;
        break; // No more tools to run, task is considered complete
      }
    }

    if (!finalReply) {
      finalReply = '작업 중 에러가 발생했거나, 최대 턴(Turn)을 초과하여 중단되었습니다. (결과 보고서 없음)';
    }

    // Save final completion message to DB via vibe-notify
    console.log(`[VibeCoder] Task finished. Sending message to room...`);
    const messageId = uuidv4();
    const finalMsgContent = `🚀 [바이브 워킹 완료 보고서]\n\n${finalReply}`;
    
    const messageObj = {
      messageId,
      senderId: aiUserId,
      senderName: aiUser.username,
      receiverId: roomId,
      messageType: 'TEXT',
      content: finalMsgContent,
      createdAt: Date.now()
    };

    try {
      await fetch(`http://127.0.0.1:${port}/api/internal/vibe-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'message', 
          roomId, 
          aiUserId,
          message: messageObj
        })
      });
    } catch(e) { console.error('Failed to notify vibe message', e); }
    
    // Check for user push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    if (subscriptions.length > 0 && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:admin@alonics.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );

      const payload = JSON.stringify({
        title: '🚀 바이브 워킹 작업 완료',
        body: 'OpenAlo가 요청하신 백그라운드 자율 작업을 완료했습니다!',
        icon: '/icon.png',
        url: '/'
      });

      for (const sub of subscriptions) {
        try {
          const pushConfig = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };
          await webpush.sendNotification(pushConfig, payload);
        } catch (e) {
          console.error('[VibeCoder] Failed to send push notification to an endpoint', e);
        }
      }
      console.log(`[VibeCoder] Sent push notifications to ${subscriptions.length} endpoints.`);
    }

  } catch (err) {
    console.error(`[VibeCoder] Fatal Error:`, err);
  } finally {
    await prisma.$disconnect();
    console.log(`[VibeCoder] Background process exited.`);
    process.exit(0);
  }
}

main();
