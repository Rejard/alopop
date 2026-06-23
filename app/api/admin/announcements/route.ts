import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';
import { z } from 'zod';
import { logUserActivity } from '@/lib/auditLogger';

const CreateAnnouncementSchema = z.object({
  userId: z.string().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  isActive: z.boolean().optional(),
  durationMs: z.union([z.number(), z.string()]).optional(),
});

const UpdateAnnouncementSchema = z.object({
  userId: z.string().optional(),
  announcementId: z.string().min(1),
  action: z.enum(['TOGGLE_ACTIVE']),
});

export async function GET(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(announcements);
  } catch (error) {
    console.error('Fetch announcements error:', error);
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let currentUser: any = null;
  let announcementTitle: string = '';
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;
    currentUser = adminUser;

    const parseResult = CreateAnnouncementSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { title, content, isActive, durationMs } = parseResult.data;
    announcementTitle = title;
    const parsedDurationMs = durationMs ? Number(durationMs) : 4000;
    const created = await prisma.announcement.create({
      data: {
        title,
        content,
        durationMs: Number.isFinite(parsedDurationMs) && parsedDurationMs > 0 ? parsedDurationMs : 4000,
        isActive: isActive ?? true,
      },
    });

    await logUserActivity({
      userId: adminUser.id,
      activityType: 'ADMIN_ANNOUNCEMENT_CREATE',
      status: 'SUCCESS',
      metadata: { announcementId: created.id },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Failed to create announcement:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'ADMIN_ANNOUNCEMENT_CREATE',
      status: 'FAILED',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let currentUser: any = null;
  let targetId: string = '';
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;
    currentUser = adminUser;

    const parseResult = UpdateAnnouncementSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { announcementId } = parseResult.data;
    targetId = announcementId;
    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data: { isActive: !announcement.isActive },
    });

    await logUserActivity({
      userId: adminUser.id,
      activityType: 'ADMIN_ANNOUNCEMENT_TOGGLE',
      status: 'SUCCESS',
      metadata: { announcementId, isActive: updated.isActive },
    });

    return NextResponse.json({ success: true, announcement: updated });
  } catch (error) {
    console.error('Update announcement error:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'ADMIN_ANNOUNCEMENT_TOGGLE',
      status: 'FAILED',
      metadata: { announcementId: targetId, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let currentUser: any = null;
  let targetId: string = '';
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;
    currentUser = adminUser;

    const { searchParams } = new URL(request.url);
    const announcementId = searchParams.get('announcementId');
    targetId = announcementId || '';
    if (!announcementId) {
      return NextResponse.json({ error: 'announcementId is required' }, { status: 400 });
    }

    await prisma.announcement.delete({
      where: { id: announcementId },
    });

    await logUserActivity({
      userId: adminUser.id,
      activityType: 'ADMIN_ANNOUNCEMENT_DELETE',
      status: 'SUCCESS',
      metadata: { announcementId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    await logUserActivity({
      userId: currentUser?.id,
      activityType: 'ADMIN_ANNOUNCEMENT_DELETE',
      status: 'FAILED',
      metadata: { announcementId: targetId, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
