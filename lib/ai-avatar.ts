type AvatarProvider = 'openai' | 'gemini' | 'gemini-free' | 'pollinations' | 'dicebear' | 'robohash';

export function resolveAvatarProvider(
  mode: 'system' | 'pollinations' | 'dicebear' | 'robohash',
  selectedProvider: string,
  providerAvailable: boolean,
): AvatarProvider {
  if (mode !== 'system') return mode;
  if ((selectedProvider === 'openai' || selectedProvider === 'gemini' || selectedProvider === 'gemini-free') && providerAvailable) {
    return selectedProvider;
  }
  return 'pollinations';
}

export function findInlineImageData(parts: Array<{ inlineData?: { data?: string } }> | undefined) {
  return parts?.find((part) => part.inlineData?.data)?.inlineData?.data || null;
}

export function isSafeGeneratedSvg(svg: string) {
  if (svg.length < 20 || svg.length > 500_000) return false;
  if (!/^<svg(?:\s|>)/i.test(svg) || !/<\/svg>$/i.test(svg)) return false;
  return !/<(?:script|foreignObject|iframe|object|embed|image|use|a)(?:\s|>)/i.test(svg)
    && !/\son[a-z]+\s*=/i.test(svg)
    && !/(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:)/i.test(svg);
}
