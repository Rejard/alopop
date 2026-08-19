import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptKey, encryptKey } from '../lib/crypto.ts';

test('API 키를 v2 형식으로 암호화하고 복호화한다', () => {
  const plaintext = 'test-api-key-value-1234567890';
  const encrypted = encryptKey(plaintext);
  assert.match(encrypted, /^v2:/);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptKey(encrypted), plaintext);
});

test('잘못된 IV 형식의 저장값은 복호화를 거부한다', () => {
  assert.equal(decryptKey('not-a-valid-iv:00112233445566778899aabbccddeeff'), null);
});
