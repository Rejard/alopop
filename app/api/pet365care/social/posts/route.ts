import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

type VerifiedRegionPayload = {
  name?: unknown;
  lat?: unknown;
  lng?: unknown;
  verifiedAt?: unknown;
  expiresAt?: unknown;
};

type LocalMeetupPayload = {
  region?: VerifiedRegionPayload;
  topic?: unknown;
  joinMode?: unknown;
  radiusKm?: unknown;
};

type WalkMatePayload = {
  startPlace?: unknown;
  startTime?: unknown;
  routeSummary?: unknown;
  durationMinutes?: unknown;
  capacity?: unknown;
};

type SocialPostPayload = {
  id?: unknown;
  content?: unknown;
  images?: unknown;
  category?: unknown;
  meetup?: {
    local?: LocalMeetupPayload;
    mate?: WalkMatePayload;
  };
};

type ValidLocalMeetup = {
  region: {
    name: string;
    lat: number;
    lng: number;
    verifiedAt: Date;
  };
  topic: string;
  joinMode: string;
  radiusKm: number;
};

type ValidWalkMate = {
  startPlace: string;
  startTime: Date;
  routeSummary: string;
  durationMinutes: number;
  capacity: number;
};

const ALLOWED_CATEGORIES = new Set(['daily', 'walk', 'health', 'funny', 'local', 'mate']);
const MAX_IMAGES = 4;
const MAX_LOCAL_RADIUS_KM = 20;
const MAX_MATE_CAPACITY = 30;
const MAX_MATE_DURATION_MINUTES = 240;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function validateImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, MAX_IMAGES);
}

function validateLocalMeetup(payload: LocalMeetupPayload | undefined): ValidLocalMeetup | null {
  const region = payload?.region;
  const name = text(region?.name);
  const lat = Number(region?.lat);
  const lng = Number(region?.lng);
  const verifiedAt = text(region?.verifiedAt);
  const expiresAt = text(region?.expiresAt);
  const verifiedAtDate = new Date(verifiedAt);
  const expiresAtTime = new Date(expiresAt).getTime();

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || Number.isNaN(verifiedAtDate.getTime())) {
    return null;
  }
  if (!expiresAt || Number.isNaN(expiresAtTime) || expiresAtTime <= Date.now()) {
    return null;
  }

  return {
    region: {
      name,
      lat,
      lng,
      verifiedAt: verifiedAtDate,
    },
    topic: text(payload?.topic) || '동네 정보 공유',
    joinMode: text(payload?.joinMode) || '채팅방',
    radiusKm: numberInRange(payload?.radiusKm, 3, 1, MAX_LOCAL_RADIUS_KM),
  };
}

function validateWalkMate(payload: WalkMatePayload | undefined): ValidWalkMate | null {
  const startPlace = text(payload?.startPlace);
  const startTimeValue = text(payload?.startTime);
  const routeSummary = text(payload?.routeSummary);
  const startTime = new Date(startTimeValue);

  if (!startPlace || !routeSummary || !startTimeValue || Number.isNaN(startTime.getTime())) {
    return null;
  }

  return {
    startPlace,
    startTime,
    routeSummary,
    durationMinutes: numberInRange(payload?.durationMinutes, 40, 10, MAX_MATE_DURATION_MINUTES),
    capacity: numberInRange(payload?.capacity, 6, 1, MAX_MATE_CAPACITY),
  };
}

function parseImages(images: string | null) {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const cursor = searchParams.get('cursor');
    const sort = searchParams.get('sort');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    const where = category && category !== 'all' ? { category } : {};

    const posts = await prisma.petPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: sort === 'hot' ? 100 : limit + 1,
      ...(sort !== 'hot' && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        likes: { where: { userId: user.id }, select: { id: true } },
        _count: { select: { comments: true } },
      },
    });

    const hotScore = (post: typeof posts[number]) => {
      const ageHours = Math.max(1, (Date.now() - post.createdAt.getTime()) / 36e5);
      const recentBoost = Math.max(0, 24 - ageHours) / 6;
      return post.commentCount * 3 + post.likeCount * 2 + recentBoost;
    };

    const rankedPosts = sort === 'hot'
      ? [...posts].sort((a, b) => hotScore(b) - hotScore(a))
      : posts;

    const hasMore = sort !== 'hot' && rankedPosts.length > limit;
    const items = rankedPosts.slice(0, limit);

    const authorIds = [...new Set(items.map(p => p.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, username: true, avatar_url: true },
    });
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));

    const feed = items.map(p => ({
      id: p.id,
      content: p.content,
      images: parseImages(p.images),
      category: p.category,
      meetup: {
        type: p.meetupType,
        local: p.meetupType === 'local' ? {
          regionName: p.verifiedRegionName,
          regionLat: p.verifiedRegionLat,
          regionLng: p.verifiedRegionLng,
          verifiedAt: p.verifiedRegionAt,
          topic: p.localTopic,
          joinMode: p.localJoinMode,
          radiusKm: p.localRadiusKm,
        } : null,
        mate: p.meetupType === 'mate' ? {
          startPlace: p.mateStartPlace,
          startTime: p.mateStartTime,
          routeSummary: p.mateRouteSummary,
          durationMinutes: p.mateDurationMinutes,
          capacity: p.mateCapacity,
        } : null,
      },
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

    const payload = await request.json() as SocialPostPayload;
    const content = text(payload.content);
    if (!content) {
      return NextResponse.json({ success: false, error: '내용을 입력해주세요' }, { status: 400 });
    }

    const category = ALLOWED_CATEGORIES.has(text(payload.category)) ? text(payload.category) : 'daily';
    const localMeetup = category === 'local' ? validateLocalMeetup(payload.meetup?.local) : null;
    const walkMate = category === 'mate' ? validateWalkMate(payload.meetup?.mate) : null;

    if (category === 'local' && !localMeetup) {
      return NextResponse.json({ success: false, error: '지역 모임은 유효한 동네 인증이 필요합니다' }, { status: 400 });
    }
    if (category === 'mate' && !walkMate) {
      return NextResponse.json({ success: false, error: '산책 메이트는 출발 장소, 시간, 코스가 필요합니다' }, { status: 400 });
    }

    const images = validateImages(payload.images);
    const post = await prisma.petPost.create({
      data: {
        authorId: user.id,
        content,
        images: images.length ? JSON.stringify(images) : null,
        category,
        meetupType: localMeetup ? 'local' : walkMate ? 'mate' : null,
        verifiedRegionName: localMeetup?.region.name,
        verifiedRegionLat: localMeetup?.region.lat,
        verifiedRegionLng: localMeetup?.region.lng,
        verifiedRegionAt: localMeetup?.region.verifiedAt,
        localTopic: localMeetup?.topic,
        localJoinMode: localMeetup?.joinMode,
        localRadiusKm: localMeetup?.radiusKm,
        mateStartPlace: walkMate?.startPlace,
        mateStartTime: walkMate?.startTime,
        mateRouteSummary: walkMate?.routeSummary,
        mateDurationMinutes: walkMate?.durationMinutes,
        mateCapacity: walkMate?.capacity,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...post,
        images,
        meetup: {
          type: post.meetupType,
          local: localMeetup ? {
            regionName: post.verifiedRegionName,
            regionLat: post.verifiedRegionLat,
            regionLng: post.verifiedRegionLng,
            verifiedAt: post.verifiedRegionAt,
            topic: post.localTopic,
            joinMode: post.localJoinMode,
            radiusKm: post.localRadiusKm,
          } : null,
          mate: walkMate ? {
            startPlace: post.mateStartPlace,
            startTime: post.mateStartTime,
            routeSummary: post.mateRouteSummary,
            durationMinutes: post.mateDurationMinutes,
            capacity: post.mateCapacity,
          } : null,
        },
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

export async function PUT(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const payload = await request.json() as SocialPostPayload;
    const id = text(payload.id);
    const content = text(payload.content);
    if (!id) return NextResponse.json({ success: false, error: 'ID 누락' }, { status: 400 });
    if (!content) return NextResponse.json({ success: false, error: '내용을 입력해주세요' }, { status: 400 });

    const post = await prisma.petPost.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ success: false, error: '게시물 없음' }, { status: 404 });
    if (post.authorId !== user.id) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    const nextImages = Array.isArray(payload.images) ? validateImages(payload.images) : parseImages(post.images);
    const updated = await prisma.petPost.update({
      where: { id },
      data: {
        content,
        images: nextImages.length ? JSON.stringify(nextImages) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        images: nextImages,
        isLiked: false,
        isMine: true,
        author: { id: user.id, username: user.username, avatar_url: user.avatar_url },
      },
    });
  } catch (error) {
    console.error('[PetSocial] PUT error:', error);
    return NextResponse.json({ success: false, error: '수정 실패' }, { status: 500 });
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
