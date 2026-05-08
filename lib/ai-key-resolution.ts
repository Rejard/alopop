import { prisma } from '@/lib/prisma';
import { decryptKey } from '@/lib/crypto';

type Provider = 'openai' | 'gemini' | 'anthropic';

type UserApiKeys = {
  id: string;
  openaiKey?: string | null;
  geminiKey?: string | null;
  anthropicKey?: string | null;
};

type FreeAiEvent = {
  id: string;
  aiProvider: string | null;
  aiModel: string | null;
  eventApiKey: string | null;
  dailyLimit: number | null;
};

type ResolvedAiKey = {
  provider: Provider;
  aiModel: string | null;
  apiKey: string | null;
  freeEvent: FreeAiEvent | null;
  limitExceeded: boolean;
};

function normalizeProvider(provider: string | undefined | null): Provider {
  if (provider === 'gemini' || provider === 'gemini-free') return 'gemini';
  if (provider === 'anthropic') return 'anthropic';
  return 'openai';
}

function getEncryptedKeyForProvider(user: UserApiKeys, provider: Provider) {
  if (provider === 'gemini') return user.geminiKey;
  if (provider === 'anthropic') return user.anthropicKey;
  return user.openaiKey;
}

function getEnvKeyForProvider(provider: Provider) {
  if (provider === 'gemini') return process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || null;
  return process.env.OPENAI_API_KEY || null;
}

function getPersonalKey(user: UserApiKeys, provider: Provider, byokKey?: string | null) {
  if (byokKey?.trim()) return byokKey.trim();
  return decryptKey(getEncryptedKeyForProvider(user, provider) || null);
}

async function getUsageCount(userId: string, eventId: string) {
  const usageDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const usage = await prisma.userEventUsage.findUnique({
    where: { userId_eventId_usageDate: { userId, eventId, usageDate } },
    select: { count: true },
  });
  return usage?.count || 0;
}

async function isEventAllowed(userId: string, event: FreeAiEvent) {
  if (!event.dailyLimit || event.dailyLimit <= 0) return true;
  return (await getUsageCount(userId, event.id)) < event.dailyLimit;
}

async function findActiveFreeEvents() {
  const now = new Date();
  return prisma.event.findMany({
    where: {
      eventType: 'FREE_AI',
      isActive: true,
      eventApiKey: { not: null },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      aiProvider: true,
      aiModel: true,
      eventApiKey: true,
      dailyLimit: true,
    },
  });
}

function eventMatches(event: FreeAiEvent, provider: Provider, aiModel: string | null | undefined) {
  return event.aiProvider === provider && !!aiModel && event.aiModel === aiModel;
}

export async function resolveAiKeyForRequest({
  user,
  provider,
  aiModel,
  byokKey,
  allowFreeEventFallback = true,
  allowEnvFallback = true,
}: {
  user: UserApiKeys;
  provider?: string | null;
  aiModel?: string | null;
  byokKey?: string | null;
  allowFreeEventFallback?: boolean;
  allowEnvFallback?: boolean;
}): Promise<ResolvedAiKey> {
  const requestedProvider = normalizeProvider(provider);
  const requestedModel = aiModel || null;
  const activeEvents = await findActiveFreeEvents();
  const matchingEvent = activeEvents.find((event) => eventMatches(event, requestedProvider, requestedModel));

  const personalKey = getPersonalKey(user, requestedProvider, byokKey);

  if (matchingEvent) {
    if (await isEventAllowed(user.id, matchingEvent)) {
      return {
        provider: requestedProvider,
        aiModel: requestedModel,
        apiKey: matchingEvent.eventApiKey,
        freeEvent: matchingEvent,
        limitExceeded: false,
      };
    } else if (!personalKey) {
      return {
        provider: requestedProvider,
        aiModel: requestedModel,
        apiKey: null,
        freeEvent: matchingEvent,
        limitExceeded: true,
      };
    }
  }

  if (personalKey) {
    return {
      provider: requestedProvider,
      aiModel: requestedModel,
      apiKey: personalKey,
      freeEvent: null,
      limitExceeded: false,
    };
  }

  if (allowFreeEventFallback) {
    for (const event of activeEvents) {
      const eventProvider = normalizeProvider(event.aiProvider);
      if (!event.aiModel || !(await isEventAllowed(user.id, event))) continue;
      return {
        provider: eventProvider,
        aiModel: event.aiModel,
        apiKey: event.eventApiKey,
        freeEvent: event,
        limitExceeded: false,
      };
    }

    if (activeEvents.length > 0) {
      return {
        provider: requestedProvider,
        aiModel: requestedModel,
        apiKey: null,
        freeEvent: activeEvents[0],
        limitExceeded: true,
      };
    }
  }

  return {
    provider: requestedProvider,
    aiModel: requestedModel,
    apiKey: allowEnvFallback ? getEnvKeyForProvider(requestedProvider) : null,
    freeEvent: null,
    limitExceeded: false,
  };
}

export async function recordFreeEventUsage(userId: string, event: FreeAiEvent | null) {
  if (!event) return;
  const usageDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  await prisma.userEventUsage.upsert({
    where: { userId_eventId_usageDate: { userId, eventId: event.id, usageDate } },
    update: { count: { increment: 1 } },
    create: { userId, eventId: event.id, usageDate, count: 1 },
  });
}
