import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function GET(request: Request) {
  const { user, response } = await requireAdminUser(request);
  if (!user) return response;

  const agents = await prisma.user.findMany({
    where: { isAgent: true, aiOwnerId: user.id },
    select: { id: true, username: true, agentToken: true, agentPath: true, createdAt: true }
  });

  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdminUser(request);
  if (!user) return response;

  const { name, path, role } = await request.json();
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
      statusMessage: role || null,
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
  const { user, response } = await requireAdminUser(request);
  if (!user) return response;

  const { id, name, path, avatarUrl, role } = await request.json();
  if (!id || !name) return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });

  const existingAgent = await prisma.user.findUnique({ where: { id } });
  if (!existingAgent || existingAgent.aiOwnerId !== user.id) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 });
  }

  const updateData: any = {
    username: name,
    agentPath: path || null,
    statusMessage: role || null,
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
