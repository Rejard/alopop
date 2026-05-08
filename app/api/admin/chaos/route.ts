import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    let status = { status: 'idle' };
    try {
      const statusData = await fs.readFile(path.join(process.cwd(), 'chaos_status.json'), 'utf8');
      status = JSON.parse(statusData);
    } catch(e) {} // File doesn't exist yet

    let log = '';
    try {
      log = await fs.readFile(path.join(process.cwd(), 'chaos_log.txt'), 'utf8');
    } catch(e) {}

    return NextResponse.json({ ...status, log });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userCount, durationSec } = await request.json();
    
    try {
      const statusData = await fs.readFile(path.join(process.cwd(), 'chaos_status.json'), 'utf8');
      const status = JSON.parse(statusData);
      if (status.status === 'running') {
        return NextResponse.json({ error: 'Chaos test is already running' }, { status: 400 });
      }
    } catch(e) {}

    const count = userCount || 100;
    const duration = durationSec || 180;

    // Detached process so the Next.js API can return immediately
    const p = spawn('node', ['chaosCommander.mjs', count.toString(), duration.toString()], {
      detached: true,
      stdio: 'ignore', 
      cwd: process.cwd()
    });
    
    p.unref();

    return NextResponse.json({ success: true, message: 'Chaos started', userCount: count, durationSec: duration });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start chaos' }, { status: 500 });
  }
}
