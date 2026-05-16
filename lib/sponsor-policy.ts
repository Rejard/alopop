import { decryptKey } from '@/lib/crypto';

export type SponsorProvider = 'openai' | 'gemini' | 'anthropic';

export const MAX_SPONSOR_PRICE = 10000;

const SPONSOR_MODELS: Record<string, { provider: SponsorProvider; model: string }> = {
  openai: { provider: 'openai', model: 'gpt-5.4' },
  'gpt-5.4': { provider: 'openai', model: 'gpt-5.4' },
  'gpt-5.4-pro': { provider: 'openai', model: 'gpt-5.4-pro' },
  gemini: { provider: 'gemini', model: 'gemini-1.5-pro-latest' },
  'gemini-1.5-pro-latest': { provider: 'gemini', model: 'gemini-1.5-pro-latest' },
  anthropic: { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
  'claude-3-haiku-20240307': { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
};

export function resolveSponsorModel(model: string | null | undefined) {
  return SPONSOR_MODELS[model || 'openai'] || null;
}

export function parseSponsorPrice(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_SPONSOR_PRICE) return null;
  return parsed;
}

export function decryptHostSponsorKey(
  hostUser: { openaiKey: string | null; geminiKey: string | null; anthropicKey: string | null },
  provider: SponsorProvider
) {
  const encrypted = provider === 'gemini'
    ? hostUser.geminiKey
    : provider === 'anthropic'
      ? hostUser.anthropicKey
      : hostUser.openaiKey;
  return decryptKey(encrypted);
}

export function resolveSponsorDelegateAccess({
  currentUserId,
  room,
  sponsorId,
  aiUserId,
}: {
  currentUserId: string;
  sponsorId?: string | null;
  aiUserId?: string | null;
  room: { sponsorMode: boolean; members: Array<{ userId: string; isHost: boolean; isHidden: boolean }> } | null;
}) {
  if (!room?.sponsorMode || !sponsorId || !aiUserId) return false;
  const isCurrentRoomMember = room.members.some((member) => member.userId === currentUserId && !member.isHidden);
  const sponsorMember = room.members.find((member) => member.isHost && member.userId === sponsorId);
  const aiMember = room.members.find((member) => member.userId === aiUserId && !member.isHidden);
  return Boolean(isCurrentRoomMember && sponsorMember && aiMember);
}
