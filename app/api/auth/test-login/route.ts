import { NextResponse } from 'next/server';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';

const TEST_USERNAMES = [
  'test01',
  'test02',
  'test03',
  'test04',
  'test05',
  'test06',
  'test07',
  'test08',
  'test09',
  'test10',
];

const TEST_USERS = new Set(TEST_USERNAMES);

function normalizeUsername(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function ensureTestFriendNetwork() {
  const users: User[] = [];

  for (const testUsername of TEST_USERNAMES) {
    const testUser = await prisma.user.upsert({
      where: { googleId: `test-login:${testUsername}` },
      update: {
        username: testUsername,
        email: `${testUsername}@alopop.test`,
        avatar_url: null,
        isAdmin: false,
      },
      create: {
        googleId: `test-login:${testUsername}`,
        email: `${testUsername}@alopop.test`,
        username: testUsername,
        avatar_url: null,
        isAdmin: false,
      },
    });
    users.push(testUser);
  }

  for (const user of users) {
    for (const friend of users) {
      if (user.id === friend.id) continue;

      await prisma.friendship.upsert({
        where: {
          userId_friendId: {
            userId: user.id,
            friendId: friend.id,
          },
        },
        update: { status: 'ACTIVE' },
        create: {
          userId: user.id,
          friendId: friend.id,
          status: 'ACTIVE',
        },
      });
    }
  }

}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = normalizeUsername(body?.username);
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!TEST_USERS.has(username) || password !== '1234') {
      return NextResponse.json({ error: 'Invalid test login credentials' }, { status: 401 });
    }

    await ensureTestFriendNetwork();

    const user = await prisma.user.findUniqueOrThrow({
      where: { googleId: `test-login:${username}` },
    });

    const response = NextResponse.json(user);
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error('Test Login Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
