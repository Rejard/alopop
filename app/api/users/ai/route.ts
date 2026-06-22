import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';

export async function POST(request: Request) {
  let currentUsr: any = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    const { name, mbti, gender, age, tone, hobby, avatarUrl } = await request.json();
    if (!name || !mbti || !gender || !tone) {
      return NextResponse.json({ error: 'Required AI profile fields are missing.' }, { status: 400 });
    }

    const aiPrompt = `AI persona settings:
- Name: ${name}
- MBTI: ${mbti}
- Gender: ${gender}
- Age range: ${age || 'unspecified'}
- Tone/personality: ${tone}
- Interests/hobbies: ${hobby || 'unspecified'}

Respond naturally from this persona.`;

    const aiUser = await prisma.user.create({
      data: {
        username: name,
        isAi: true,
        aiOwnerId: currentUser.id,
        aiPrompt,
        avatar_url: avatarUrl || null,
        walletBalance: 0,
        statusMessage: `${mbti} | ${age || ''} | ${tone}`,
      },
    });

    await prisma.friendship.createMany({
      data: [
        { userId: currentUser.id, friendId: aiUser.id },
        { userId: aiUser.id, friendId: currentUser.id },
      ],
    });

    await logUserActivity({
      userId: currentUser.id,
      targetUserId: aiUser.id,
      activityType: 'AI_FRIEND_CREATE',
      status: 'SUCCESS',
      metadata: { mbti, gender, tone },
    });

    return NextResponse.json({ success: true, aiUser });
  } catch (err) {
    console.error('AI user create error:', err);
    await logUserActivity({
      userId: currentUsr?.id,
      activityType: 'AI_FRIEND_CREATE',
      status: 'FAILED',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: 'Failed to create AI user.' }, { status: 500 });
  }
}
