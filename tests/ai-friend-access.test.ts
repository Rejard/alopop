import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAiFriend, canStartAutonomousAiWork } from '../lib/ai-friend-access.ts';

test('소유자는 자신의 AI 친구에 접근할 수 있다', () => {
  assert.equal(canAccessAiFriend({
    currentUserId: 'owner',
    aiOwnerId: 'owner',
    hasActiveFriendship: false,
    currentUserInRoom: false,
    aiUserInRoom: false,
  }), true);
});

test('활성 친구 관계나 같은 방이 없는 사용자는 접근할 수 없다', () => {
  assert.equal(canAccessAiFriend({
    currentUserId: 'guest',
    aiOwnerId: 'owner',
    hasActiveFriendship: false,
    currentUserInRoom: false,
    aiUserInRoom: false,
  }), false);
});

test('현재 사용자와 AI가 같은 방에 있어야 방 접근이 허용된다', () => {
  assert.equal(canAccessAiFriend({
    currentUserId: 'guest',
    aiOwnerId: 'owner',
    hasActiveFriendship: false,
    currentUserInRoom: true,
    aiUserInRoom: true,
  }), true);
  assert.equal(canAccessAiFriend({
    currentUserId: 'guest',
    aiOwnerId: 'owner',
    hasActiveFriendship: false,
    currentUserInRoom: true,
    aiUserInRoom: false,
  }), false);
});

test('자율 작업은 에이전트 소유자에게만 허용된다', () => {
  assert.equal(canStartAutonomousAiWork('owner', 'owner', true), true);
  assert.equal(canStartAutonomousAiWork('guest', 'owner', true), false);
  assert.equal(canStartAutonomousAiWork('owner', 'owner', false), false);
});
