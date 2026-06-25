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
  },
  loadSettings: () => {
    try {
      const provider = localStorage.getItem('alo_ai_provider') as AIProvider;
      const keysStr = localStorage.getItem('alo_api_keys');
      if (provider) set({ selectedProvider: provider });
      if (keysStr) {
        try {
          set({ apiKeys: JSON.parse(keysStr) });
        } catch (e) {
          console.error('Failed to parse API keys', e);
        }
      }
    } catch (e) {
      console.warn('[Settings] localStorage read failed:', e);
    }
  }
}));
