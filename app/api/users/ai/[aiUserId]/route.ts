import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';

export async function PUT(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  let currentUsr: any = null;
  let targetId: string | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const { aiUserId } = await context.params;
    targetId = aiUserId;
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

    await logUserActivity({
      userId: currentUser.id,
      targetUserId: aiUserId,
      activityType: 'AI_FRIEND_UPDATE',
      status: 'SUCCESS',
      metadata: { mbti, gender, tone },
    });

    return NextResponse.json({ success: true, aiUser: updatedUser });
  } catch (err) {
    console.error('AI user update error:', err);
    await logUserActivity({
      userId: currentUsr?.id,
      targetUserId: targetId,
      activityType: 'AI_FRIEND_UPDATE',
      status: 'FAILED',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: 'Failed to update AI user.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  let currentUsr: any = null;
  let targetId: string | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const { aiUserId } = await context.params;
    targetId = aiUserId;
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

    await logUserActivity({
      userId: currentUser.id,
      targetUserId: aiUserId,
      activityType: 'AI_FRIEND_DELETE',
      status: 'SUCCESS',
    });

    return NextResponse.json({ success: true, message: 'AI user deleted.' });
  } catch (err) {
    console.error('AI user delete error:', err);
    await logUserActivity({
      userId: currentUsr?.id,
      targetUserId: targetId,
      activityType: 'AI_FRIEND_DELETE',
      status: 'FAILED',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: 'Failed to delete AI user.' }, { status: 500 });
  }
}
