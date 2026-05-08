import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { requireCurrentUser } from '@/lib/auth';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
]);

export async function POST(request: Request) {
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large' }, { status: 400 });
    }

    const safeExt = ALLOWED_UPLOAD_TYPES.get(file.type);
    if (!safeExt) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueFilename = `chat_${currentUser.id}_${Date.now()}_${Math.random().toString(36).slice(2)}${safeExt}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    await fs.mkdir(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, uniqueFilename);
    const publicUrl = `/uploads/${uniqueFilename}`;
    await fs.writeFile(filepath, buffer);

    let type = 'FILE';
    if (file.type.startsWith('image/')) type = 'IMAGE';
    else if (file.type.startsWith('video/')) type = 'VIDEO';

    return NextResponse.json({
      success: true,
      url: publicUrl,
      type,
      name: file.name,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
