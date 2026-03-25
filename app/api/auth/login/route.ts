import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { loginId, password } = await request.json();

    if (!loginId || !password) {
      return NextResponse.json(
        { error: 'loginId and password are required' },
        { status: 400 }
      );
    }

    // loginId를 기준으로 본 계정 유저 탐색
    const user = await prisma.user.findUnique({
      where: { loginId },
    });

    // 존재하는 아이디인지 그리고 패스워드가 정확히 일치하는지 검증
    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // 성공 시, 기존에 생성되었던 본 계정의 정보(UUID 등)를 반환하여 동기화
    return NextResponse.json(user);
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
