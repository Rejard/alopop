import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const AiFriendSchema = z.object({
  name: z.string().trim().min(1).max(30),
  mbti: z.enum(['ESTJ', 'ESTP', 'ESFJ', 'ESFP', 'ENTJ', 'ENTP', 'ENFJ', 'ENFP', 'ISTJ', 'ISTP', 'ISFJ', 'ISFP', 'INTJ', 'INTP', 'INFJ', 'INFP']),
  gender: z.enum(['여성', '남성', '성별 없음']),
  age: z.string().trim().max(30).optional().nullable(),
  tone: z.string().trim().min(1).max(100),
  hobby: z.string().trim().max(200).optional().nullable(),
  avatarUrl: z.string().trim().max(2048).optional().nullable(),
});

export async function POST(request: Request) {
  let currentUsr: { id: string } | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    if (!checkRateLimit(`ai-friend-create:${currentUser.id}`, 5, 60000)) {
      return NextResponse.json({ error: 'Too many AI friend creation requests.' }, { status: 429 });
    }

    const parsed = AiFriendSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid AI profile.' }, { status: 400 });
    }
    const { name, mbti, gender, age, tone, hobby, avatarUrl } = parsed.data;

    const aiPrompt = `AI persona settings:
- Name: ${name}
- MBTI: ${mbti}
- Gender: ${gender}
- Age range: ${age || 'unspecified'}
- Tone/personality: ${tone}
- Interests/hobbies: ${hobby || 'unspecified'}

Respond naturally from this persona.`;

    const aiUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
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

      await tx.friendship.createMany({
        data: [
          { userId: currentUser.id, friendId: created.id },
          { userId: created.id, friendId: currentUser.id },
        ],
      });

      return created;
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
