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

  const callbackUrl = new URL('/auth/alopop/callback', getPet365CareUrl());
  callbackUrl.searchParams.set('token', token);

  // iframe 임베드 모드: URL을 JSON으로 반환
  const url = new URL(request.url);
  if (url.searchParams.get('embed') === '1') {
    return NextResponse.json({ url: callbackUrl.toString() });
  }

  return NextResponse.redirect(callbackUrl);
}
