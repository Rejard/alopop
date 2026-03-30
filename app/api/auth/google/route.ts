import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

function generateInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export async function POST(request: Request) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json(
        { error: 'Google credential is required' },
        { status: 400 }
      );
    }

    let payload: any;

    if (credential.split('.').length === 3) {
      // Google JWT 토큰(ID Token) 검증
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      // Access Token인 경우 구글 userinfo API를 통해 검증
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${credential}` }
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
      }
      payload = await res.json();
    }

    if (!payload || !payload.sub) {
      return NextResponse.json(
        { error: 'Invalid Google payload' },
        { status: 401 }
      );
    }

    const { sub: googleId, email, name, picture } = payload;

    // 기존 로그인 유저 확인
    let user = await prisma.user.findUnique({
      where: { googleId },
    });

    if (!user) {
      // 신규 유저 생성 (자동 회원가입)
      let inviteCode = '';
      let isUnique = false;

      while (!isUnique) {
        inviteCode = generateInviteCode();
        const existing = await prisma.user.findUnique({
          where: { inviteCode }
        });
        if (!existing) {
          isUnique = true;
        }
      }

      user = await prisma.user.create({
        data: {
          googleId,
          email,
          username: name || 'GoogleUser',
          avatar_url: picture,
          inviteCode
        },
      });
    }

    // 유저 정보 반환 (UUID 등 전체 객체)
    return NextResponse.json(user);
    
  } catch (error) {
    console.error('Google Auth Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
