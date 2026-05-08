import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { setSessionCookie } from '@/lib/auth';

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

type GooglePayload = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

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

    let payload: GooglePayload | undefined;

    if (credential.split('.').length === 3) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${credential}` },
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
      }
      payload = await res.json() as GooglePayload;
    }

    if (!payload || !payload.sub) {
      return NextResponse.json(
        { error: 'Invalid Google payload' },
        { status: 401 }
      );
    }

    const { sub: googleId, email, name, picture } = payload;

    let user = await prisma.user.findUnique({
      where: { googleId },
    });

    const isTargetAdmin = email === 'lemaiiisk@gmail.com';

    if (!user) {
      let inviteCode = '';
      let isUnique = false;

      while (!isUnique) {
        inviteCode = generateInviteCode();
        const existing = await prisma.user.findUnique({
          where: { inviteCode },
        });
        if (!existing) {
          isUnique = true;
        }
      }

      let initialBalance = 10000;
      try {
        const bonusSetting = await prisma.systemSetting.findUnique({ where: { key: 'SIGNUP_BONUS' } });
        if (bonusSetting?.value) {
          const val = parseInt(bonusSetting.value, 10);
          if (!isNaN(val)) initialBalance = val;
        }
      } catch (e) {
        console.error('Failed to get SIGNUP_BONUS', e);
      }

      user = await prisma.user.create({
        data: {
          googleId,
          email,
          username: name || 'GoogleUser',
          avatar_url: picture,
          inviteCode,
          isAdmin: isTargetAdmin,
          walletBalance: initialBalance,
        },
      });
    } else if (isTargetAdmin && !user.isAdmin) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
      });
    }

    const response = NextResponse.json(user);
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error('Google Auth Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
