import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, loginId, password } = await request.json();

    if (!userId || !loginId || !password) {
      return NextResponse.json(
        { error: 'userId, loginId, password are required' },
        { status: 400 }
      );
    }

    // 1-0. 현재 유저가 이미 바인딩된 상태인지 판별
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      return NextResponse.json({ error: '존재하지 않는 유저입니다.' }, { status: 404 });
    }

    if (currentUser.loginId) {
       return NextResponse.json(
        { error: '이미 정식 계정으로 연동이 완료된 계정입니다.' },
        { status: 400 }
      );
    }

    // 1. 이미 존재하는 loginId 인지 중복 검사
    const existing = await prisma.user.findUnique({
      where: { loginId }
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 사용 중인 아이디입니다.' },
        { status: 409 }
      );
    }

    // 2. 현재 익명 유저 레코드에 loginId / password 속성을 부여하여 본 계정 스펙으로 연동(승급)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { loginId, password }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Account Bind Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
