import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'config', 'ai_models.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    const models = JSON.parse(fileContents);
    return NextResponse.json(models);
  } catch (error) {
    // 파일이 없거나 파싱 오류 시 기본값 반환 (앱 크래시 방지)
    console.warn('[WARN] config/ai_models.json 파일을 읽을 수 없어 기본 빈 배열들을 반환합니다.');
    return NextResponse.json({ openai: [], gemini: [], anthropic: [] });
  }
}
