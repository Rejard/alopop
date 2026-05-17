import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const AuditLogsQuerySchema = z.object({
  targetUserId: z.string().min(1).optional(),
  action: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

type AdminAuditLogRow = {
  id: string;
  action: string;
  reason: string;
  metadata: string | null;
  createdAt: Date | string;
  adminId: string;
  adminName: string;
  targetUserId: string | null;
  targetUserName: string | null;
};

export async function GET(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const url = new URL(request.url);
    const parseResult = AuditLogsQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { targetUserId, action, limit = 50 } = parseResult.data;
    const rows = await prisma.$queryRaw<AdminAuditLogRow[]>`
      SELECT
        log."id",
        log."action",
        log."reason",
        log."metadata",
        log."createdAt",
        log."adminId",
        admin."username" AS "adminName",
        log."targetUserId",
        target."username" AS "targetUserName"
      FROM "AdminAuditLog" log
      JOIN "User" admin ON admin."id" = log."adminId"
      LEFT JOIN "User" target ON target."id" = log."targetUserId"
      WHERE (${targetUserId || null} IS NULL OR log."targetUserId" = ${targetUserId || null})
        AND (${action || null} IS NULL OR log."action" = ${action || null})
      ORDER BY log."createdAt" DESC
      LIMIT ${limit}
    `;

    const logs = rows.map((row) => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
      admin: {
        id: row.adminId,
        username: row.adminName,
      },
      targetUser: row.targetUserId
        ? {
          id: row.targetUserId,
          username: row.targetUserName,
        }
        : null,
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Fetch admin audit logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
