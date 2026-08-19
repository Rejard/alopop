import { create } from 'zustand';

export type AIProvider = 'gemini-free' | 'openai' | 'gemini' | 'anthropic';

interface SettingsStore {
  isOpen: boolean;
  forceGlobal: boolean;
  selectedProvider: AIProvider;
  apiKeys: Record<AIProvider, string>;
  setIsOpen: (isOpen: boolean, forceGlobal?: boolean) => void;
  setSelectedProvider: (provider: AIProvider) => void;
  setApiKey: (provider: AIProvider, key: string) => void;
  loadSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  forceGlobal: false,
  selectedProvider: 'gemini-free',
  apiKeys: {
    'gemini-free': '',
    openai: '',
    gemini: '',
    anthropic: '',
  },
  setIsOpen: (isOpen, forceGlobal = false) => set({ isOpen, forceGlobal }),
  setSelectedProvider: (provider) => {
    try {
      localStorage.setItem('alo_ai_provider', provider);
    } catch (e) {
      console.warn('[Settings] localStorage write failed:', e);
    }
    set({ selectedProvider: provider });
  },
  setApiKey: (provider, key) => {
    set((state) => {
      const newKeys = { ...state.apiKeys, [provider]: key };
      try {
        localStorage.setItem('alo_api_keys', JSON.stringify(newKeys));
      } catch (e) {
        console.warn('[Settings] localStorage write failed:', e);
      }
      return { apiKeys: newKeys };
    });

    if (provider === 'gemini-free') return;
    fetch('/api/users/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey: key || null }),
    }).catch((err) => {
      console.warn('[Settings] server key save failed, localStorage fallback kept:', err);
    });
  },
  loadSettings: () => {
    try {
      const provider = localStorage.getItem('alo_ai_provider') as AIProvider;
      if (provider) set({ selectedProvider: provider });
    } catch (e) {
      console.warn('[Settings] localStorage read failed:', e);
    }

    fetch('/api/users/keys')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { keys: { openai: string; gemini: string; anthropic: string } }) => {
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            openai: data.keys.openai || '',
            gemini: data.keys.gemini || '',
            anthropic: data.keys.anthropic || '',
          },
        }));
      })
      .catch((err) => {
        console.warn('[Settings] server key fetch failed, falling back to localStorage:', err);
        try {
          const keysStr = localStorage.getItem('alo_api_keys');
          if (keysStr) {
            set({ apiKeys: JSON.parse(keysStr) });
          }
        } catch (e) {
          console.error('Failed to parse API keys from localStorage', e);
        }
      });
  },
}));

