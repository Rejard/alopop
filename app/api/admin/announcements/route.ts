import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(announcements);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, title, content, isActive, durationMs } = await request.json();
    
    // Auth Check
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const created = await prisma.announcement.create({
      data: {
        title,
        content,
        durationMs: durationMs ? parseInt(durationMs) : 4000,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}
