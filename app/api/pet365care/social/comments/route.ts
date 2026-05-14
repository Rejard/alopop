import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

/**
 * 댓글 API
 * POST — 댓글 작성
 * DELETE — 댓글 삭제 (본인만)
 * GET — 게시물 댓글 목록
 */

export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    if (!postId) return NextResponse.json({ success: false, error: 'postId 누락' }, { status: 400 });

    const comments = await prisma.petComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
    });

    const authorIds = [...new Set(comments.map(c => c.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, username: true, avatar_url: true },
    });
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));

    return NextResponse.json({
      success: true,
      data: comments.map(c => ({
        ...c,
        isMine: c.authorId === user.id,
        author: authorMap[c.authorId] || { id: c.authorId, username: '알 수 없음', avatar_url: null },
      })),
    });
  } catch (error) {
    console.error('[PetSocial] Comments GET error:', error);
    return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { postId, content } = await request.json();
    if (!postId || !content?.trim()) {
      return NextResponse.json({ success: false, error: '필수 입력 누락' }, { status: 400 });
    }

    const comment = await prisma.petComment.create({
      data: { postId, authorId: user.id, content: content.trim() },
    });

    // 댓글 수 증가
    await prisma.petPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...comment,
        isMine: true,
        author: { id: user.id, username: user.username, avatar_url: user.avatar_url },
      },
    });
  } catch (error) {
    console.error('[PetSocial] Comment POST error:', error);
    return NextResponse.json({ success: false, error: '작성 실패' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID 누락' }, { status: 400 });

    const comment = await prisma.petComment.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ success: false, error: '댓글 없음' }, { status: 404 });
    if (comment.authorId !== user.id && !user.isAdmin) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    await prisma.petComment.delete({ where: { id } });
    await prisma.petPost.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PetSocial] Comment DELETE error:', error);
    return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 });
  }
}
