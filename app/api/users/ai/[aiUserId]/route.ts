import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

export async function PUT(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { aiUserId } = await context.params;
    const { name, mbti, gender, age, tone, hobby, avatarUrl } = await request.json();
    if (!name || !mbti || !gender || !tone) {
      return NextResponse.json({ error: 'Required AI profile fields are missing.' }, { status: 400 });
    }

    const existingAiUser = await prisma.user.findUnique({ where: { id: aiUserId } });
    if (!existingAiUser?.isAi || existingAiUser.aiOwnerId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const aiPrompt = `AI persona settings:
- Name: ${name}
- MBTI: ${mbti}
- Gender: ${gender}
- Age range: ${age || 'unspecified'}
- Tone/personality: ${tone}
- Interests/hobbies: ${hobby || 'unspecified'}

Respond naturally from this persona.`;

    const updatedUser = await prisma.user.update({
      where: { id: aiUserId },
      data: {
        username: name,
        aiPrompt,
        statusMessage: `${mbti} | ${age || ''} | ${tone}`,
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      },
    });

    return NextResponse.json({ success: true, aiUser: updatedUser });
  } catch (err) {
    console.error('AI user update error:', err);
    return NextResponse.json({ error: 'Failed to update AI user.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const { aiUserId } = await context.params;
    const existingAiUser = await prisma.user.findUnique({ where: { id: aiUserId } });
    if (!existingAiUser?.isAi || existingAiUser.aiOwnerId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: aiUserId },
          { friendId: aiUserId },
        ],
      },
    });

    await prisma.user.delete({ where: { id: aiUserId } });

    return NextResponse.json({ success: true, message: 'AI user deleted.' });
  } catch (err) {
    console.error('AI user delete error:', err);
    return NextResponse.json({ error: 'Failed to delete AI user.' }, { status: 500 });
  }
}
