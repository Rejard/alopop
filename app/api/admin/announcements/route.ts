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

export async function PUT(request: Request) {
  try {
    const { userId, announcementId, action } = await request.json();

    if (!userId || !announcementId || !action) {
      return NextResponse.json({ error: 'userId, announcementId, and action are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    if (action === 'TOGGLE_ACTIVE') {
      const updated = await prisma.announcement.update({
        where: { id: announcementId },
        data: { isActive: !announcement.isActive }
      });
      return NextResponse.json({ success: true, announcement: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const announcementId = searchParams.get('announcementId');

    if (!userId || !announcementId) {
      return NextResponse.json({ error: 'userId and announcementId are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.announcement.delete({
      where: { id: announcementId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
