import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';

// GET: 백업 정보 조회 (데이터 포함하지 않음)
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
  let currentUser: any = null;
  let size: number = 0;
  let count: number = 0;
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    currentUser = user;

    const { compressed, originalSize, petCount } = await request.json();
    size = originalSize;
    count = petCount || 0;

    if (!compressed || !originalSize) {
      return NextResponse.json({ success: false, error: '데이터 누락' }, { status: 400 });
    }

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

    await logUserActivity({
      userId: user.id,
      activityType: 'PET365_BACKUP_SAVE',
      status: 'SUCCESS',
      metadata: { originalSize, petCount: count },
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
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'PET365_BACKUP_SAVE',
      status: 'FAILED',
      metadata: { originalSize: size, petCount: count, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ success: false, error: '저장 실패' }, { status: 500 });
  }
}

// PUT: 백업 데이터 다운로드 (복원용)
export async function PUT(request: Request) {
  let currentUser: any = null;
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    currentUser = user;

    const backup = await prisma.pet365Backup.findUnique({
      where: { userId: user.id },
    });

    if (!backup) {
      return NextResponse.json({ success: false, error: '백업이 없습니다' }, { status: 404 });
    }

    await logUserActivity({
      userId: user.id,
      activityType: 'PET365_BACKUP_RESTORE',
      status: 'SUCCESS',
    });

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
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'PET365_BACKUP_RESTORE',
      status: 'FAILED',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ success: false, error: '복원 실패' }, { status: 500 });
  }
}

// DELETE: 슬롯 삭제
export async function DELETE(request: Request) {
  let currentUser: any = null;
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    currentUser = user;

    await prisma.pet365Backup.deleteMany({ where: { userId: user.id } });

    await logUserActivity({
      userId: user.id,
      activityType: 'PET365_BACKUP_DELETE',
      status: 'SUCCESS',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pet365 Backup] DELETE error:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'PET365_BACKUP_DELETE',
      status: 'FAILED',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 });
  }
}
