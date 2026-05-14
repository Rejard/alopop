import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { createPet365CareHandoffToken, getPet365CareUrl } from '@/lib/pet365care-sso';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user, response } = await requireCurrentUser(request);
  if (!user) return response;

  const token = createPet365CareHandoffToken({
    id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    isAdmin: user.isAdmin,
  });

  // 외부 공개 URL (Cloudflare Tunnel 등으로 서빙되는 URL)
  const publicUrl = process.env.PET365CARE_PUBLIC_URL || getPet365CareUrl();
  const callbackUrl = new URL('/auth/alopop/callback', publicUrl);
  callbackUrl.searchParams.set('token', token);

  // iframe 임베드 모드: 직접 외부 URL로 반환 (모바일 호환)
  const url = new URL(request.url);
  if (url.searchParams.get('embed') === '1') {
    return NextResponse.json({ url: callbackUrl.toString() });
  }

  return NextResponse.redirect(callbackUrl);
}

