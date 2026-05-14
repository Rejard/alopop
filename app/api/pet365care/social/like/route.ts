import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

/**
 * 좋아요 토글 API
 * POST { postId } → 좋아요 추가 또는 취소
 */
export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ success: false, error: 'postId 누락' }, { status: 400 });

    const existing = await prisma.petLike.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    });

    if (existing) {
      // 좋아요 취소
      await prisma.petLike.delete({ where: { id: existing.id } });
      await prisma.petPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      return NextResponse.json({ success: true, data: { liked: false } });
    } else {
      // 좋아요
      await prisma.petLike.create({
        data: { postId, userId: user.id },
      });
      await prisma.petPost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });
      return NextResponse.json({ success: true, data: { liked: true } });
    }
  } catch (error) {
    console.error('[PetSocial] Like error:', error);
    return NextResponse.json({ success: false, error: '좋아요 실패' }, { status: 500 });
  }
}
