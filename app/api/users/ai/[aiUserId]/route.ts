import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  try {
    const { aiUserId } = await context.params;
    const { ownerId, name, mbti, gender, age, tone, hobby, aiProvider, apiKey, avatarUrl } = await request.json();

    if (!ownerId || !name || !mbti || !gender || !tone) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 본인 확인: 이 AI를 생성한 유저가 맞는지
    const existingAiUser = await prisma.user.findUnique({ where: { id: aiUserId } });
    if (!existingAiUser || existingAiUser.aiOwnerId !== ownerId) {
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 });
    }

    const aiPrompt = `다음은 이 AI의 페르소나 설정입니다:
- 이름: ${name}
- MBTI: ${mbti}
- 성별: ${gender}
- 연령대: ${age}
- 말투/성격: ${tone}
- 관심사/취미: ${hobby || '특별한 관심사 없음'}

위 설정을 바탕으로 사용자와 자연스럽고 대화하세요. (기본적으로 한국어로 대답하세요.)`;

    const updateData: any = {
      username: name,
      aiPrompt,
      statusMessage: `${mbti} | ${age} | ${tone}`,
    };

    // avatarUrl 값이 전달되었을 때만 업데이트 (null도 명시적으로 전달받았다면 적용)
    if (avatarUrl !== undefined) {
      updateData.avatar_url = avatarUrl;
    }

    const updatedUser = await prisma.user.update({
      where: { id: aiUserId },
      data: updateData
    });

    return NextResponse.json({ success: true, aiUser: updatedUser });
  } catch (err) {
    console.error('AI 유저 수정 중 에러:', err);
    return NextResponse.json({ error: 'AI 수정 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  try {
    const { aiUserId } = await context.params;
    const url = new URL(request.url);
    const ownerId = url.searchParams.get('ownerId');

    if (!ownerId) {
      return NextResponse.json({ error: '인증 정보(ownerId)가 누락되었습니다.' }, { status: 400 });
    }

    // 권한 확인
    const existingAiUser = await prisma.user.findUnique({ where: { id: aiUserId } });
    if (!existingAiUser || existingAiUser.aiOwnerId !== ownerId) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    // 1. 해당 AI와 관련된 Friendship 레코드들 삭제
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: aiUserId },
          { friendId: aiUserId }
        ]
      }
    });

    // 2. 해당 AI가 참여한 채팅방(RoomMember) 관련 정보 삭제 (옵션)
    // await prisma.roomMember.deleteMany({
    //   where: { userId: aiUserId }
    // });
    
    // (선택 사항) 해당 AI가 보낸 메시지를 유지할지 삭제할지 결정
    // 기본적으로 메시지는 외래키 옵션에 따라 삭제되거나 null 처리됩니다.
    // 여기서는 User 레코드 자체를 지웁니다.

    // 3. User 테이블에서 AI 삭제
    await prisma.user.delete({
      where: { id: aiUserId }
    });

    return NextResponse.json({ success: true, message: 'AI가 영구적으로 삭제되었습니다.' });
  } catch (err) {
    console.error('AI 삭제 중 에러:', err);
    return NextResponse.json({ error: 'AI 삭제 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
