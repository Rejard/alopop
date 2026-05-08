import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';
import { z } from 'zod';

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

export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(announcements);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const parseResult = CreateAnnouncementSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { title, content, isActive, durationMs } = parseResult.data;
    const parsedDurationMs = durationMs ? Number(durationMs) : 4000;
    const created = await prisma.announcement.create({
      data: {
        title,
        content,
        durationMs: Number.isFinite(parsedDurationMs) && parsedDurationMs > 0 ? parsedDurationMs : 4000,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const parseResult = UpdateAnnouncementSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { announcementId } = parseResult.data;
    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data: { isActive: !announcement.isActive },
    });
    return NextResponse.json({ success: true, announcement: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const { searchParams } = new URL(request.url);
    const announcementId = searchParams.get('announcementId');
    if (!announcementId) {
      return NextResponse.json({ error: 'announcementId is required' }, { status: 400 });
    }

    await prisma.announcement.delete({
      where: { id: announcementId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
