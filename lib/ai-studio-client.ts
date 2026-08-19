export async function requestAiStudioText(input: {
  provider: 'openai' | 'gemini' | 'anthropic';
  model: string;
  prompt: string;
  temperature: number;
}) {
  const response = await fetch('/api/ai-studio-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI 호출 실패 (HTTP ${response.status})`);
  if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('AI가 빈 응답을 반환했습니다.');
  return data.text;
}
