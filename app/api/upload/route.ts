import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';

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
  ['text/html', '.html'],
]);

function isValidMagicNumber(buffer: Buffer, mimeType: string): boolean {
  // Validate raw bytes of binary formats to prevent MIME spoofing.
  if (mimeType === 'image/png') {
    return buffer.length >= 4 && buffer.readUInt32BE(0) === 0x89504E47;
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.readUInt32BE(0) === 0x52494646 && buffer.readUInt32BE(8) === 0x57454250;
  }
  if (mimeType === 'image/gif') {
    return buffer.length >= 4 && buffer.readUInt32BE(0) === 0x47494638;
  }
  if (mimeType === 'application/pdf') {
    return buffer.length >= 4 && buffer.readUInt32BE(0) === 0x25504446;
  }
  if (mimeType === 'video/mp4') {
    return buffer.length >= 8 && buffer.readUInt32BE(4) === 0x66747970;
  }
  if (mimeType === 'video/webm') {
    return buffer.length >= 4 && buffer.readUInt32BE(0) === 0x1A45DFA3;
  }
  return true;
}

export async function POST(request: Request) {
  let currentUsr: any = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

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
    if (!isValidMagicNumber(buffer, file.type)) {
      return NextResponse.json({ error: 'Invalid or corrupted file content' }, { status: 400 });
    }
    const uniqueFilename = `chat_${currentUser.id}_${Date.now()}_${Math.random().toString(36).slice(2)}${safeExt}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    await fs.mkdir(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, uniqueFilename);
    const publicUrl = `/uploads/${uniqueFilename}`;
    await fs.writeFile(filepath, buffer);

    let type = 'FILE';
    if (file.type.startsWith('image/')) type = 'IMAGE';
    else if (file.type.startsWith('video/')) type = 'VIDEO';

    await logUserActivity({
      userId: currentUser.id,
      activityType: 'FILE_UPLOAD',
      status: 'SUCCESS',
      metadata: { size: file.size, type },
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      type,
      name: file.name,
    });
  } catch (error) {
    console.error('File upload error:', error);
    await logUserActivity({
      userId: currentUsr?.id,
      activityType: 'FILE_UPLOAD',
      status: 'FAILED',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
