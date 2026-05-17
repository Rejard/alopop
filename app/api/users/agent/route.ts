import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

type AgentUpdateData = {
  username: string;
  agentPath: string | null;
  statusMessage: string | null;
  avatar_url?: string;
};

export async function GET(request: Request) {
  const { user, response } = await requireCurrentUser(request);
  if (!user) return response;

  const agents = await prisma.user.findMany({
    where: { isAgent: true, aiOwnerId: user.id },
    select: {
      id: true,
      username: true,
      agentToken: true,
      agentPath: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const { user, response } = await requireCurrentUser(request);
  if (!user) return response;

  const { name, path, role } = await request.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const token = randomBytes(24).toString('hex');
  const agentName = name.trim();
  if (!agentName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const newAgent = await prisma.user.create({
    data: {
      username: agentName,
      isAgent: true,
      isAi: true,
      aiOwnerId: user.id,
      agentToken: token,
      agentPath: typeof path === 'string' && path.trim() ? path.trim() : null,
      statusMessage: typeof role === 'string' && role.trim() ? role.trim() : null,
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(agentName)}&colors=blue`,
    },
  });

  await prisma.friendship.create({
    data: {
      userId: user.id,
      friendId: newAgent.id,
    },
  });

  return NextResponse.json({ agent: newAgent });
}

export async function PUT(request: Request) {
  const { user, response } = await requireCurrentUser(request);
  if (!user) return response;

  const { id, name, path, avatarUrl, role } = await request.json();
  if (!id || typeof id !== 'string' || !name || typeof name !== 'string') {
    return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
  }

  const existingAgent = await prisma.user.findUnique({ where: { id } });
  if (!existingAgent || existingAgent.aiOwnerId !== user.id || !existingAgent.isAgent) {
    return NextResponse.json({ error: 'You can only edit your own OpenClaw agent.' }, { status: 403 });
  }

  const agentName = name.trim();
  if (!agentName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const updateData: AgentUpdateData = {
    username: agentName,
    agentPath: typeof path === 'string' && path.trim() ? path.trim() : null,
    statusMessage: typeof role === 'string' && role.trim() ? role.trim() : null,
  };

  if (typeof avatarUrl === 'string') {
    updateData.avatar_url = avatarUrl;
  }

  const updatedAgent = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ agent: updatedAgent });
}
