import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { exec } from 'child_process';
import path from 'path';

/**
 * 전국 동물병원 공공데이터 동기화 — 서버 터미널 직접 실행
 * 
 * Next.js API Route 타임아웃 우회: child_process로 CLI 스크립트를
 * 백그라운드에서 실행하고, 결과를 파일로 저장.
 * 
 * POST: 동기화 시작 (백그라운드)
 * GET: 마지막 동기화 결과 조회
 */

const RESULT_FILE = path.join(process.cwd(), '.sync-hospitals-result.json');

export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    if (!user.isAdmin) return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const clear = body.clear !== false; // 기본 true

    const scriptPath = path.join(process.cwd(), 'scripts', 'sync-hospitals.ts');
    const cmd = `npx tsx "${scriptPath}"${clear ? ' --clear' : ''} --max-pages 200`;
    const cwd = process.cwd();

    // 결과 파일 초기화
    const fs = await import('fs');
    fs.writeFileSync(RESULT_FILE, JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }));

    // 백그라운드 실행 (타임아웃 없음)
    exec(cmd, { cwd, timeout: 600000, env: { ...process.env } }, (error, stdout, stderr) => {
      const result = {
        status: error ? 'error' : 'done',
        finishedAt: new Date().toISOString(),
        stdout: stdout?.trim() || '',
        stderr: stderr?.trim() || '',
        error: error?.message || null,
      };

      // 결과에서 숫자 파싱
      const match = stdout?.match(/신규:(\d+).*업데이트:(\d+).*스킵:(\d+).*DB총:(\d+)/);
      if (match) {
        Object.assign(result, {
          inserted: parseInt(match[1]),
          updated: parseInt(match[2]),
          skipped: parseInt(match[3]),
          totalHospitals: parseInt(match[4]),
        });
      }

      try { fs.writeFileSync(RESULT_FILE, JSON.stringify(result)); } catch {}
      console.log('[Sync CLI]', result.status, result.stdout?.slice(-100));
    });

    return NextResponse.json({
      success: true,
      message: '전국 동기화가 백그라운드에서 시작되었습니다. 3~5분 소요됩니다.',
    });
  } catch (error) {
    console.error('[Sync CLI] Error:', error);
    return NextResponse.json({ success: false, error: '실행 실패' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    if (!user.isAdmin) return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 });

    const fs = await import('fs');
    if (!fs.existsSync(RESULT_FILE)) {
      return NextResponse.json({ success: true, data: { status: 'never', message: '아직 실행된 적 없습니다.' } });
    }

    const result = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf-8'));
    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: '상태 조회 실패' }, { status: 500 });
  }
}
