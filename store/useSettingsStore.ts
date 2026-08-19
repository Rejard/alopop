import { create } from 'zustand';

export type AIProvider = 'gemini-free' | 'openai' | 'gemini' | 'anthropic';
type StoredProvider = Exclude<AIProvider, 'gemini-free'>;
type ApiKeys = Record<AIProvider, string>;
export type ProviderAvailability = Record<AIProvider, boolean>;

interface SettingsStore {
  isOpen: boolean;
  forceGlobal: boolean;
  selectedProvider: AIProvider;
  apiKeys: ApiKeys;
  providerAvailability: ProviderAvailability;
  setIsOpen: (isOpen: boolean, forceGlobal?: boolean) => void;
  setSelectedProvider: (provider: AIProvider) => void;
  setApiKey: (provider: AIProvider, key: string) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const emptyKeys: ApiKeys = {
  'gemini-free': '',
  openai: '',
  gemini: '',
  anthropic: '',
};

const emptyAvailability: ProviderAvailability = {
  'gemini-free': false,
  openai: false,
  gemini: false,
  anthropic: false,
};

function availabilityFromFlags(flags: Record<string, unknown> | undefined): ProviderAvailability {
  return {
    ...emptyAvailability,
    openai: Boolean(flags?.hasOpenAiKey),
    gemini: Boolean(flags?.hasGeminiKey),
    anthropic: Boolean(flags?.hasAnthropicKey),
  };
}

function readLegacyKeys(): Partial<ApiKeys> {
  try {
    const value = localStorage.getItem('alo_api_keys');
    if (!value) return {};
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function removeLegacyKey(provider: StoredProvider) {
  const legacy = readLegacyKeys();
  delete legacy[provider];
  const hasRemainingKey = Object.entries(legacy).some(([name, value]) => name !== 'gemini-free' && typeof value === 'string' && value.trim());
  if (hasRemainingKey) localStorage.setItem('alo_api_keys', JSON.stringify(legacy));
  else localStorage.removeItem('alo_api_keys');
}

async function saveServerKey(provider: StoredProvider, apiKey: string) {
  const response = await fetch('/api/users/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey: apiKey || null }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API 키 저장 실패 (HTTP ${response.status})`);
  return data;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  isOpen: false,
  forceGlobal: false,
  selectedProvider: 'gemini-free',
  apiKeys: emptyKeys,
  providerAvailability: emptyAvailability,
  setIsOpen: (isOpen, forceGlobal = false) => set({ isOpen, forceGlobal }),
  setSelectedProvider: (provider) => {
    try {
      localStorage.setItem('alo_ai_provider', provider);
    } catch (error) {
      console.warn('[Settings] provider persistence failed:', error);
    }
    set({ selectedProvider: provider });
  },
  setApiKey: async (provider, key) => {
    const normalizedKey = key.trim();
    if (provider === 'gemini-free') {
      set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: '' } }));
      return;
    }
    const data = await saveServerKey(provider, normalizedKey);
    set((state) => ({
      apiKeys: { ...state.apiKeys, [provider]: normalizedKey },
      providerAvailability: availabilityFromFlags(data.flags),
    }));
    removeLegacyKey(provider);
  },
  loadSettings: async () => {
    try {
      const provider = localStorage.getItem('alo_ai_provider') as AIProvider;
      if (provider) set({ selectedProvider: provider });
    } catch (error) {
      console.warn('[Settings] provider load failed:', error);
    }

    const legacy = readLegacyKeys();
    const legacyKeys: ApiKeys = {
      ...emptyKeys,
      openai: typeof legacy.openai === 'string' ? legacy.openai : '',
      gemini: typeof legacy.gemini === 'string' ? legacy.gemini : '',
      anthropic: typeof legacy.anthropic === 'string' ? legacy.anthropic : '',
    };
    if (legacyKeys.openai || legacyKeys.gemini || legacyKeys.anthropic) {
      set({
        apiKeys: legacyKeys,
        providerAvailability: {
          ...emptyAvailability,
          openai: Boolean(legacyKeys.openai),
          gemini: Boolean(legacyKeys.gemini),
          anthropic: Boolean(legacyKeys.anthropic),
        },
      });
    }

    try {
      const response = await fetch('/api/users/keys', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      const serverKeys: ApiKeys = {
        ...emptyKeys,
        openai: data.keys?.openai || '',
        gemini: data.keys?.gemini || '',
        anthropic: data.keys?.anthropic || '',
      };
      const mergedKeys = { ...serverKeys };
      let mergedAvailability = availabilityFromFlags(data.flags);

      for (const provider of ['openai', 'gemini', 'anthropic'] as StoredProvider[]) {
        if (!serverKeys[provider] && legacyKeys[provider]) {
          const saved = await saveServerKey(provider, legacyKeys[provider]);
          mergedKeys[provider] = legacyKeys[provider];
          mergedAvailability = availabilityFromFlags(saved.flags);
          removeLegacyKey(provider);
        }
      }

      set({ apiKeys: mergedKeys, providerAvailability: mergedAvailability });
    } catch (error) {
      console.warn('[Settings] server key load or migration failed:', error);
      if (!legacyKeys.openai && !legacyKeys.gemini && !legacyKeys.anthropic) {
        set({ apiKeys: get().apiKeys });
      }
    }
  },
}));
