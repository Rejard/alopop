import assert from 'node:assert/strict';
import test from 'node:test';
import { findInlineImageData, isSafeGeneratedSvg, resolveAvatarProvider } from '../lib/ai-avatar.ts';

test('시스템 화가에 키가 없으면 Pollinations를 사용한다', () => {
  assert.equal(resolveAvatarProvider('system', 'gemini-free', false), 'pollinations');
});

test('시스템 화가에 키가 있으면 선택 공급자를 유지한다', () => {
  assert.equal(resolveAvatarProvider('system', 'gemini', true), 'gemini');
});

test('Gemini 응답의 뒤쪽 파트에서도 이미지를 찾는다', () => {
  assert.equal(findInlineImageData([{ }, { inlineData: { data: 'image-data' } }]), 'image-data');
});

test('위험한 SVG 요소와 이벤트 속성을 거부한다', () => {
  assert.equal(isSafeGeneratedSvg('<svg><circle /></svg>'), true);
  assert.equal(isSafeGeneratedSvg('<svg><script>alert(1)</script></svg>'), false);
  assert.equal(isSafeGeneratedSvg('<svg><path onload="alert(1)" /></svg>'), false);
});
