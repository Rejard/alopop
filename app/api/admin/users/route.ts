import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth';
import { getAdminUsersOverview } from '@/lib/admin-users';

export const dynamic = 'force-dynamic';

const AdminUsersQuerySchema = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(['all', 'regular', 'admin', 'ai', 'agent', 'qa']).optional(),
  activity: z.enum(['all', 'ACTIVE_ESTIMATE', 'QUIET_ESTIMATE', 'INACTIVE_ESTIMATE']).optional(),
  apiKey: z.enum(['all', 'has', 'none']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const url = new URL(request.url);
    const parseResult = AdminUsersQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const overview = await getAdminUsersOverview(parseResult.data);
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Fetch admin users overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
