import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * 펫 소셜 이미지 업로드 API
 * POST (multipart/form-data) → /uploads/pet_social_xxx.jpg
 */
export async function POST(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ success: false, error: '파일 없음' }, { status: 400 });
    }
    if (files.length > 4) {
      return NextResponse.json({ success: false, error: '최대 4장까지 업로드 가능' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: '파일 크기 초과 (최대 5MB)' }, { status: 400 });
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      if (!allowed.includes(ext)) {
        return NextResponse.json({ success: false, error: `지원하지 않는 형식: ${ext}` }, { status: 400 });
      }

      const filename = `pet_social_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);
      urls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ success: true, data: { urls } });
  } catch (error) {
    console.error('[PetSocial] Upload error:', error);
    return NextResponse.json({ success: false, error: '업로드 실패' }, { status: 500 });
  }
}
