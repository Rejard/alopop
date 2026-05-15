import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateSystemSettingsSchema = z.object({
  userId: z.string().optional(),
  settings: z.array(z.object({
    key: z.string().min(1),
    value: z.string(),
  })),
});

export async function GET(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Fetch system settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const parseResult = UpdateSystemSettingsSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    for (const setting of parseResult.data.settings) {
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: { key: setting.key, value: setting.value },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update system settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
