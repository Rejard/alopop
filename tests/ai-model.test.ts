import assert from 'node:assert/strict';
import test from 'node:test';
import { GEMINI_TEXT_MODEL, normalizeAiTextModel } from '../lib/ai-model.ts';

test('Gemini 텍스트 요청은 3.6 Flash로 통일한다', () => {
  assert.equal(GEMINI_TEXT_MODEL, 'gemini-3.6-flash');
  assert.equal(normalizeAiTextModel('gemini', 'gemini-1.5-pro-latest'), 'gemini-3.6-flash');
  assert.equal(normalizeAiTextModel('gemini', 'gemini-3.1-flash-lite-preview'), 'gemini-3.6-flash');
});

test('다른 공급자의 모델은 유지한다', () => {
  assert.equal(normalizeAiTextModel('openai', 'gpt-5.4'), 'gpt-5.4');
  assert.equal(normalizeAiTextModel('anthropic', 'claude-4-6-sonnet-latest'), 'claude-4-6-sonnet-latest');
});
