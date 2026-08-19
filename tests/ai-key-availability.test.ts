import assert from 'node:assert/strict';
import test from 'node:test';
import { hasProviderAccess, providerAccessSource } from '../lib/ai-key-availability.ts';

const environment = { GOOGLE_GENERATIVE_AI_API_KEY: 'configured' };

test('관리자는 Gemini 환경 키를 사용할 수 있다', () => {
  assert.equal(hasProviderAccess('gemini', true, null, environment), true);
  assert.equal(providerAccessSource('gemini', true, null, environment), 'environment');
});

test('일반 사용자에게 관리자 환경 키를 제공하지 않는다', () => {
  assert.equal(hasProviderAccess('gemini', false, null, environment), false);
  assert.equal(providerAccessSource('gemini', false, null, environment), null);
});

test('개인 키가 있으면 개인 키 상태를 우선한다', () => {
  assert.equal(hasProviderAccess('gemini', false, 'personal', environment), true);
  assert.equal(providerAccessSource('gemini', true, 'personal', environment), 'personal');
});
