import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatMessageHistoryPage } from '../lib/chat-message-history.ts';
import type { StoredChatMessage } from '../lib/chat-message-history.ts';

function storedMessage(id: string, createdAt: string): StoredChatMessage {
  return {
    id,
    messageId: `message-${id}`,
    roomId: 'room-1',
    senderId: 'user-1',
    receiverId: null,
    type: 'TEXT',
    content: `encrypted-${id}`,
    createdAt: new Date(createdAt),
  };
}

test('최신순으로 조회한 대화 내역을 화면 표시용 과거순으로 변환한다', () => {
  const page = buildChatMessageHistoryPage(
    [
      storedMessage('3', '2026-08-19T03:00:00.000Z'),
      storedMessage('2', '2026-08-19T02:00:00.000Z'),
      storedMessage('1', '2026-08-19T01:00:00.000Z'),
    ],
    3,
    (content) => content.replace('encrypted-', 'plain-'),
    new Map([['user-1', '파트너']]),
  );

  assert.deepEqual(page.messages.map((message) => message.id), ['1', '2', '3']);
  assert.deepEqual(page.messages.map((message) => message.createdAt), [
    Date.parse('2026-08-19T01:00:00.000Z'),
    Date.parse('2026-08-19T02:00:00.000Z'),
    Date.parse('2026-08-19T03:00:00.000Z'),
  ]);
  assert.equal(page.messages[0].messageType, 'TEXT');
  assert.equal(page.messages[0].senderName, '파트너');
  assert.equal(page.messages[0].receiverId, 'room-1');
  assert.equal(page.messages[0].content, 'plain-1');
  assert.equal(page.nextCursor, null);
});

test('다음 페이지 커서는 현재 페이지의 마지막 조회 항목을 가리킨다', () => {
  const page = buildChatMessageHistoryPage(
    [
      storedMessage('4', '2026-08-19T04:00:00.000Z'),
      storedMessage('3', '2026-08-19T03:00:00.000Z'),
      storedMessage('2', '2026-08-19T02:00:00.000Z'),
    ],
    2,
    (content) => content,
    new Map(),
  );

  assert.deepEqual(page.messages.map((message) => message.id), ['3', '4']);
  assert.equal(page.nextCursor, '3');
});
