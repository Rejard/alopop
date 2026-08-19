type Provider = 'openai' | 'gemini' | 'anthropic';

type Environment = Readonly<Record<string, string | undefined>>;

const environmentNames: Record<Provider, keyof Environment> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

export function hasProviderAccess(
  provider: Provider,
  isAdmin: boolean,
  personalKey: string | null | undefined,
  environment: Environment = process.env,
) {
  return Boolean(personalKey || (isAdmin && environment[environmentNames[provider]]));
}

export function providerAccessSource(
  provider: Provider,
  isAdmin: boolean,
  personalKey: string | null | undefined,
  environment: Environment = process.env,
) {
  if (personalKey) return 'personal' as const;
  if (isAdmin && environment[environmentNames[provider]]) return 'environment' as const;
  return null;
}
