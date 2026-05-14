import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

/**
 * 펫 소셜 게시물 API
 * GET  — 피드 목록 (페이지네이션 + 카테고리 필터)
 * POST — 새 글 작성
 * DELETE — 글 삭제 (본인만)
 */

export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    const where = category && category !== 'all' ? { category } : {};

    const posts = await prisma.petPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        likes: { where: { userId: user.id }, select: { id: true } },
        _count: { select: { comments: true } },
      },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    // 작성자 정보 일괄 조회
    const authorIds = [...new Set(items.map(p => p.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, username: true, avatar_url: true },
    });
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));

    const feed = items.map(p => ({
      id: p.id,
      content: p.content,
      images: p.images ? JSON.parse(p.images) : [],
      category: p.category,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      isLiked: p.likes.length > 0,
      isMine: p.authorId === user.id,
      author: authorMap[p.authorId] || { id: p.authorId, username: '알 수 없음', avatar_url: null },
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: { posts: feed, hasMore, nextCursor: hasMore ? items[items.length - 1].id : null },
    });
  } catch (error) {
    console.error('[PetSocial] GET error:', error);
    return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { content, images, category } = await request.json();
    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: '내용을 입력해주세요' }, { status: 400 });
    }

    const post = await prisma.petPost.create({
      data: {
        authorId: user.id,
        content: content.trim(),
        images: images?.length ? JSON.stringify(images) : null,
        category: category || 'daily',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...post,
        images: images || [],
        isLiked: false,
        isMine: true,
        author: { id: user.id, username: user.username, avatar_url: user.avatar_url },
      },
    });
  } catch (error) {
    console.error('[PetSocial] POST error:', error);
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

    const post = await prisma.petPost.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ success: false, error: '게시물 없음' }, { status: 404 });
    if (post.authorId !== user.id && !user.isAdmin) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    await prisma.petPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PetSocial] DELETE error:', error);
    return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 });
  }
}
