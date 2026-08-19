export interface StoredChatMessage {
  id: string;
  messageId: string;
  roomId: string;
  senderId: string;
  receiverId: string | null;
  type: string;
  content: string;
  createdAt: Date;
}

export function buildChatMessageHistoryPage(
  newestFirstMessages: StoredChatMessage[],
  limit: number,
  decryptContent: (content: string) => string,
  senderNames: ReadonlyMap<string, string>,
) {
  const pageMessages = newestFirstMessages.slice(0, limit);
  const nextCursor = newestFirstMessages.length > limit
    ? pageMessages[pageMessages.length - 1]?.id ?? null
    : null;
  const messages = pageMessages.reverse().map((message) => ({
    id: message.id,
    messageId: message.messageId,
    roomId: message.roomId,
    senderId: message.senderId,
    senderName: senderNames.get(message.senderId) || 'Unknown',
    receiverId: message.receiverId || message.roomId,
    type: message.type,
    messageType: message.type,
    content: decryptContent(message.content),
    createdAt: message.createdAt.getTime(),
  }));

  return { messages, nextCursor };
}
