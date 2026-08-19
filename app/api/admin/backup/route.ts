import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';
import { checkRateLimit } from '@/lib/rate-limit';
import { createBackup, rotateBackups, listBackups, restoreBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user, response } = await requireAdminUser(request);
    if (!user) return response;

    const backups = listBackups();
    return NextResponse.json({ backups });
  } catch (error) {
    console.error('[Backup API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminUser(request);
    if (!user) return response;

    if (!checkRateLimit(`backup:${user.id}`, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const backup = createBackup();
    const deleted = rotateBackups(7);

    await logUserActivity({
      userId: user.id,
      activityType: 'DB_BACKUP_CREATE',
      status: 'SUCCESS',
      metadata: { filename: backup.filename, size: backup.size, rotatedCount: deleted },
    });

    return NextResponse.json({ backup, rotatedCount: deleted });
  } catch (error) {
    console.error('[Backup API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user, response } = await requireAdminUser(request);
    if (!user) return response;

    if (!checkRateLimit(`backup:${user.id}`, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const filename = body?.filename;

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }

    const result = restoreBackup(filename);

    await logUserActivity({
      userId: user.id,
      activityType: 'DB_BACKUP_RESTORE',
      status: 'SUCCESS',
      metadata: { restoredFrom: filename, preRestoreFile: result.preRestoreFile },
    });

    return NextResponse.json({
      message: 'Restore completed',
      restoredFrom: filename,
      preRestoreFile: result.preRestoreFile,
    });
  } catch (error: any) {
    console.error('[Backup API] PUT error:', error);
    const message = error?.message?.includes('not found') ? error.message : 'Internal server error';
    const status = error?.message?.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
