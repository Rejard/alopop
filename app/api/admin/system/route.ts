import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' }
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Fetch system settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, settings } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 보안 검증: userId가 실제 관리자인지 확인
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // settings array 업데이트
    if (Array.isArray(settings)) {
      for (const setting of settings) {
        await prisma.systemSetting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: { key: setting.key, value: setting.value }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update system settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
