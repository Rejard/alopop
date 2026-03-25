import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // 파일 버퍼 변환
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 파일명 생성 및 저장 경로 지정
    const ext = path.extname(file.name);
    const uniqueFilename = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    // 디렉토리가 없으면 생성
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, uniqueFilename);
    const publicUrl = `/uploads/${uniqueFilename}`;

    // 파일 로컬 저장소 쓰기
    await fs.writeFile(filepath, buffer);

    // 파일 타입 판단 (MIME 타입 확장 지원: 동영상 처리)
    let type = 'FILE';
    if (file.type.startsWith('image/')) type = 'IMAGE';
    else if (file.type.startsWith('video/')) type = 'VIDEO';

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      type: type,
      name: file.name
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
