import crypto from 'crypto';
import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, requireAdminUser } from '@/lib/auth';
import {
  DIAGNOSTIC_AREAS,
  DIAGNOSTIC_CODES,
  DIAGNOSTIC_SEVERITIES,
  sanitizeDiagnosticMetadata,
  sanitizeDiagnosticText,
} from '@/lib/diagnostics';

export const dynamic = 'force-dynamic';

const MAX_LOG_BYTES = 2 * 1024 * 1024;
const LOG_DIR = path.join(process.cwd(), 'data');
const LOG_FILE = path.join(LOG_DIR, 'diagnostics.jsonl');

const DiagnosticSchema = z.object({
  area: z.enum(DIAGNOSTIC_AREAS),
  code: z.enum(DIAGNOSTIC_CODES),
  severity: z.enum(DIAGNOSTIC_SEVERITIES),
  status: z.number().int().min(100).max(599).optional(),
  safeMessage: z.string().max(240).optional(),
  fingerprint: z.string().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function getHashSecret() {
  return process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_DIAGNOSTICS_DEFAULT';
}

function hashUserId(userId: string) {
  return crypto
    .createHmac('sha256', getHashSecret())
    .update(userId)
    .digest('base64url')
    .slice(0, 24);
}

async function appendDiagnostic(entry: Record<string, unknown>) {
  await mkdir(LOG_DIR, { recursive: true });

  try {
    const current = await stat(LOG_FILE);
    if (current.size > MAX_LOG_BYTES) {
      await writeFile(LOG_FILE, '', 'utf8');
    }
  } catch {
    // Missing log file is fine.
  }

  await writeFile(LOG_FILE, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', flag: 'a' });
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    const parseResult = DiagnosticSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid diagnostic payload' }, { status: 400 });
    }

    const payload = parseResult.data;
    await appendDiagnostic({
      ts: new Date().toISOString(),
      userHash: currentUser ? hashUserId(currentUser.id) : null,
      area: payload.area,
      code: payload.code,
      severity: payload.severity,
      status: payload.status || null,
      safeMessage: sanitizeDiagnosticText(payload.safeMessage) || null,
      fingerprint: sanitizeDiagnosticText(payload.fingerprint, 80) || null,
      metadata: sanitizeDiagnosticMetadata(payload.metadata),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Diagnostic collection error:', error);
    return NextResponse.json({ error: 'Failed to record diagnostic' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { user: adminUser, response } = await requireAdminUser(request);
    if (!adminUser) return response;

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);

    let content = '';
    try {
      content = await readFile(LOG_FILE, 'utf8');
    } catch {
      return NextResponse.json({ events: [] });
    }

    const events = content
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Diagnostic read error:', error);
    return NextResponse.json({ error: 'Failed to read diagnostics' }, { status: 500 });
  }
}
