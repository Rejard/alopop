import { create } from 'zustand';

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

interface SettingsStore {
  isOpen: boolean;
  selectedProvider: AIProvider;
  apiKeys: Record<AIProvider, string>;
  setIsOpen: (isOpen: boolean) => void;
  setSelectedProvider: (provider: AIProvider) => void;
  setApiKey: (provider: AIProvider, key: string) => void;
  loadSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  selectedProvider: 'openai',
  apiKeys: {
    openai: '',
    gemini: '',
    anthropic: '',
  },
  setIsOpen: (isOpen) => set({ isOpen }),
  setSelectedProvider: (provider) => {
    localStorage.setItem('alo_ai_provider', provider);
    set({ selectedProvider: provider });
  },
  setApiKey: (provider, key) => {
    set((state) => {
      const newKeys = { ...state.apiKeys, [provider]: key };
      localStorage.setItem('alo_api_keys', JSON.stringify(newKeys));
      return { apiKeys: newKeys };
    });
  },
  loadSettings: () => {
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
  }
}));

