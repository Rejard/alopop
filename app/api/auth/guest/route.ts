import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function generateInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // 고유한 6자리 대문자 영문숫자 혼합 초대 코드 생성
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

    // 게스트 모드: 무조건 새로운 익명 유저 레코드(고유 UUID)를 발급하여 반환
    const user = await prisma.user.create({
      data: { 
        username,
        inviteCode
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Guest Login Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
