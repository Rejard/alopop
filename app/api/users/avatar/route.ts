import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const file = formData.get('file') as File;

    if (!userId || !file) {
      return NextResponse.json({ error: 'userId and file are required' }, { status: 400 });
    }

    // 파일 버퍼 변환
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 파일명 생성 및 저장 경로 지정
    const ext = path.extname(file.name);
    const uniqueFilename = `${userId}_${Date.now()}${ext}`;
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

    // 기존 User DB의 avatar_url 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar_url: publicUrl },
      select: { id: true, username: true, avatar_url: true }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
