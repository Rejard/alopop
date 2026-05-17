import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const OFFLINE_NOTICE_TTL_MS = Number(process.env.OFFLINE_NOTICE_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;
let offlineQueueColumns: Set<string> | null = null;

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  hamster: '🐹',
  bird: '🐦',
  turtle: '🐢',
  duck: '🦆',
  hedgehog: '🦔',
  fish: '🐟',
  other: '🐾',
};

function emojiToAvatarUrl(emoji: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="80" text-anchor="start">${emoji}</text></svg>`
  )}`;
}

function createOfflineNotice(message: { messageId?: string; receiverId?: string; createdAt?: number }) {
  return JSON.stringify({
    messageId: `offline_notice_${message.messageId || Date.now()}`,
    senderId: 'system',
    senderName: 'System',
    receiverId: message.receiverId || null,
    messageType: 'SYSTEM',
    content: '새 메시지가 도착했습니다. 다시 접속해 확인해 주세요.',
    createdAt: message.createdAt || Date.now(),
    offlineNotice: true,
  });
}

async function hasEnhancedOfflineQueue() {
  if (offlineQueueColumns) return offlineQueueColumns.has('expiresAt') && offlineQueueColumns.has('status');
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info('OfflineMessage')`);
  offlineQueueColumns = new Set(columns.map((column) => column.name));
  return offlineQueueColumns.has('expiresAt') && offlineQueueColumns.has('status');
}

async function saveOfflineNotice(receiverId: string, message: { messageId?: string; receiverId?: string; createdAt?: number }) {
  if (await hasEnhancedOfflineQueue()) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO OfflineMessage (id, receiverId, kind, status, payload, createdAt, expiresAt, attemptCount)
       VALUES (?, ?, 'NOTICE', 'PENDING', ?, ?, ?, 0)`,
      uuidv4(),
      receiverId,
      createOfflineNotice(message),
      new Date().toISOString(),
      new Date(Date.now() + OFFLINE_NOTICE_TTL_MS).toISOString()
    );
    return;
  }

  await prisma.offlineMessage.create({
    data: {
      receiverId,
      kind: 'NOTICE',
      status: 'PENDING',
      payload: createOfflineNotice(message),
      expiresAt: new Date(Date.now() + OFFLINE_NOTICE_TTL_MS),
      attemptCount: 0,
    },
  });
}

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { petName, species, roomName, message } = await request.json();
    if (!message || !roomName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emoji = SPECIES_EMOJI[species] || SPECIES_EMOJI.other;
    const botUsername = `${petName || 'Pet'} 🐾`;

    let botUser = await prisma.user.findFirst({
      where: {
        username: botUsername,
        isAi: true,
        aiOwnerId: currentUser.id,
      },
    });

    if (!botUser) {
      botUser = await prisma.user.create({
        data: {
          username: botUsername,
          avatar_url: emojiToAvatarUrl(emoji),
          isAi: true,
          aiOwnerId: currentUser.id,
          aiPrompt: `Pet365Care - ${petName || 'Pet'}(${species || 'other'}) health care bot`,
        },
      });
      console.log(`[Pet365Care Notify] Created bot user: ${botUsername} (${botUser.id})`);
    } else if (!botUser.avatar_url) {
      await prisma.user.update({
        where: { id: botUser.id },
        data: { avatar_url: emojiToAvatarUrl(emoji) },
      });
    }

    let room = await prisma.room.findFirst({
      where: {
        isGroup: false,
        members: {
          every: {
            userId: { in: [botUser.id, currentUser.id] },
          },
        },
      },
      include: { members: true },
    });

    if (room && room.members.length !== 2) {
      room = null;
    }

    if (!room) {
      room = await prisma.room.create({
        data: {
          name: roomName,
          isGroup: false,
          members: {
            create: [
              { userId: botUser.id, isHost: true },
              { userId: currentUser.id },
            ],
          },
        },
        include: { members: true },
      });
      console.log(`[Pet365Care Notify] Created room: ${room.id} "${roomName}"`);
    }

    const chatMessage = {
      messageId: uuidv4(),
      senderId: botUser.id,
      senderName: botUsername,
      receiverId: room.id,
      content: message,
      messageType: 'TEXT' as const,
      createdAt: Date.now(),
    };

    const port = process.env.PORT || 3099;
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_INTERNAL_SECRET_DEFAULT';

    try {
      await fetch(`http://127.0.0.1:${port}/api/internal/pet365-relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-alopop-internal': internalSecret,
        },
        body: JSON.stringify({
          targetUserId: currentUser.id,
          message: chatMessage,
        }),
      });
    } catch (relayErr) {
      console.error('[Pet365Care Notify] Relay error:', relayErr);
      await saveOfflineNotice(currentUser.id, chatMessage);
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      chatMessage,
    });
  } catch (error) {
    console.error('[Pet365Care Notify] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
