import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { ownerId, name, mbti, gender, age, tone, hobby, aiProvider, apiKey, avatarUrl } = await request.json();

    if (!ownerId || !name || !mbti || !gender || !tone) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // AI 상태 메시지 (프롬프트 구성 및 프론트 정규식 파싱 등에 사용)
    const aiPrompt = `다음은 이 AI의 페르소나 설정입니다:
- 이름: ${name}
- MBTI: ${mbti}
- 성별: ${gender}
- 연령대: ${age}
- 말투/성격: ${tone}
- 관심사/취미: ${hobby || '특별한 관심사 없음'}

위 설정을 바탕으로 사용자와 자연스럽고 대화하세요. (기본적으로 한국어로 대답하세요.)`;

    // 1. AI 유저 생성 (User 테이블)
    const aiUser = await prisma.user.create({
      data: {
        username: name,
        isAi: true,
        aiOwnerId: ownerId,
        aiPrompt,
        avatar_url: avatarUrl || null,
        walletBalance: 0,
        statusMessage: `${mbti} | ${age} | ${tone}` // 리스트에 보여줄 상태메시지
      }
    });

    // 2. 창조자(ownerId)와 방금 태어난 AI(aiUser.id) 사이의 프렌드십 즉시 결성 (상호 등록)
    await prisma.friendship.createMany({
      data: [
        { userId: ownerId, friendId: aiUser.id },
        { userId: aiUser.id, friendId: ownerId }
      ]
    });

    return NextResponse.json({ success: true, aiUser });
  } catch (err) {
    console.error('AI 유저 생성 중 에러:', err);
    return NextResponse.json({ error: 'AI 생성 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
