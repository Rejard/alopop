import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function GET(request: Request) {
  const { user } = await requireCurrentUser(request);
  // Allow normal users to create their own agents? The user asked to just log in and create. Let's allow any logged in user.
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agents = await prisma.user.findMany({
    where: { isAgent: true, aiOwnerId: user.id },
    select: { id: true, username: true, agentToken: true, agentPath: true, createdAt: true }
  });

  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const { user } = await requireCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, path } = await request.json();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const token = randomBytes(24).toString('hex');
  
  const newAgent = await prisma.user.create({
    data: {
      username: name,
      isAgent: true,
      isAi: true,
      aiOwnerId: user.id,
      agentToken: token,
      agentPath: path || null,
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}&colors=blue`
    }
  });

  await prisma.friendship.create({
    data: {
      userId: user.id,
      friendId: newAgent.id
    }
  });

  return NextResponse.json({ agent: newAgent });
}

export async function PUT(request: Request) {
  const { user } = await requireCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, name, path, avatarUrl } = await request.json();
  if (!id || !name) return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });

  const existingAgent = await prisma.user.findUnique({ where: { id } });
  if (!existingAgent || existingAgent.aiOwnerId !== user.id) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 });
  }

  const updateData: any = {
    username: name,
    agentPath: path || null,
  };

  if (avatarUrl !== undefined) {
    updateData.avatar_url = avatarUrl;
  }

  const updatedAgent = await prisma.user.update({
    where: { id },
    data: updateData
  });

  return NextResponse.json({ agent: updatedAgent });
}
