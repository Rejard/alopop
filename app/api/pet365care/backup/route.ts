import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

/**
 * Pet365Care 데이터 백업/복원 API
 * 
 * 게임 세이브 슬롯 방식: 유저당 1개 슬롯
 * 클라이언트에서 lz-string으로 압축 → 서버 DB에 저장
 * 
 * GET  — 백업 메타 조회 (data 없이)
 * POST — 백업 저장 (upsert)
 * PUT  — 백업 데이터 다운로드 (복원용)
 * DELETE — 슬롯 삭제
 */

// GET: 백업 정보 조회 (데이터 포함하지 않음 — 용량 절약)
export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const backup = await prisma.pet365Backup.findUnique({
      where: { userId: user.id },
      select: { size: true, petCount: true, version: true, updatedAt: true },
    });

    if (!backup) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        size: backup.size,
        petCount: backup.petCount,
        version: backup.version,
        updatedAt: backup.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Pet365 Backup] GET error:', error);
    return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
  }
}

// POST: 백업 저장
export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const { compressed, originalSize, petCount } = await request.json();

    if (!compressed || !originalSize) {
      return NextResponse.json({ success: false, error: '데이터 누락' }, { status: 400 });
    }

    // 최대 5MB 제한
    if (compressed.length > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '데이터가 너무 큽니다 (최대 5MB)' }, { status: 400 });
    }

    const backup = await prisma.pet365Backup.upsert({
      where: { userId: user.id },
      update: {
        data: compressed,
        size: originalSize,
        petCount: petCount || 0,
        version: { increment: 1 },
      },
      create: {
        userId: user.id,
        data: compressed,
        size: originalSize,
        petCount: petCount || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        size: backup.size,
        petCount: backup.petCount,
        version: backup.version,
        updatedAt: backup.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Pet365 Backup] POST error:', error);
    return NextResponse.json({ success: false, error: '저장 실패' }, { status: 500 });
  }
}

// PUT: 백업 데이터 다운로드 (복원용)
export async function PUT(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const backup = await prisma.pet365Backup.findUnique({
      where: { userId: user.id },
    });

    if (!backup) {
      return NextResponse.json({ success: false, error: '백업이 없습니다' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        compressed: backup.data,
        size: backup.size,
        petCount: backup.petCount,
        version: backup.version,
        updatedAt: backup.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Pet365 Backup] PUT error:', error);
    return NextResponse.json({ success: false, error: '복원 실패' }, { status: 500 });
  }
}

// DELETE: 슬롯 삭제
export async function DELETE(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    await prisma.pet365Backup.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pet365 Backup] DELETE error:', error);
    return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 });
  }
}
