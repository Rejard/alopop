export const GEMINI_TEXT_MODEL = 'gemini-3.6-flash';

export function normalizeAiTextModel(provider: string, model: string | null | undefined) {
  return provider === 'gemini' ? GEMINI_TEXT_MODEL : model || null;
}
