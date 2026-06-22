import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';

export async function POST(request: Request) {
  let currentUser: any = null;
  let targetPostId: string = '';
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    currentUser = user;

    const { postId } = await request.json();
    targetPostId = postId || '';
    if (!postId) return NextResponse.json({ success: false, error: 'postId 누락' }, { status: 400 });

    const existing = await prisma.petLike.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    });

    if (existing) {
      await prisma.petLike.delete({ where: { id: existing.id } });
      await prisma.petPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });

      await logUserActivity({
        userId: user.id,
        activityType: 'PET365_POST_UNLIKE',
        status: 'SUCCESS',
        metadata: { postId },
      });

      return NextResponse.json({ success: true, data: { liked: false } });
    } else {
      await prisma.petLike.create({
        data: { postId, userId: user.id },
      });
      await prisma.petPost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });

      await logUserActivity({
        userId: user.id,
        activityType: 'PET365_POST_LIKE',
        status: 'SUCCESS',
        metadata: { postId },
      });

      return NextResponse.json({ success: true, data: { liked: true } });
    }
  } catch (error) {
    console.error('[PetSocial] Like error:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'PET365_POST_LIKE_TOGGLE',
      status: 'FAILED',
      metadata: { postId: targetPostId, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ success: false, error: '좋아요 실패' }, { status: 500 });
  }
}
