import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

/**
 * 반려동물 봇 채팅방에서 펫 정보 복구 API
 * 
 * DB의 Pet365Care 봇 유저에서 petName, species를 추출하여
 * 클라이언트 localStorage에 등록할 수 있도록 반환합니다.
 */
export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;

    // 현재 유저가 소유한 Pet365Care 봇 유저들 조회
    const botUsers = await prisma.user.findMany({
      where: {
        isAi: true,
        aiOwnerId: user.id,
        aiPrompt: { contains: 'Pet365Care' },
      },
      select: {
        id: true,
        username: true,
        aiPrompt: true,
        avatar_url: true,
        createdAt: true,
      },
    });

    // aiPrompt에서 펫 정보 파싱: "Pet365Care - 흰둥이(dog) 건강 관리 봇"
    const pets = botUsers.map(bot => {
      const match = bot.aiPrompt?.match(/Pet365Care\s*-\s*(.+?)\((\w+)\)/);
      const petName = match?.[1]?.trim() || bot.username.replace(/\s*🐾$/, '');
      const species = match?.[2] || 'other';

      return {
        botUserId: bot.id,
        name: petName,
        species,
        username: bot.username,
        createdAt: bot.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        pets,
        count: pets.length,
      },
    });
  } catch (error) {
    console.error('[Pet365Care] Recover pets error:', error);
    return NextResponse.json({ success: false, error: '복구 실패' }, { status: 500 });
  }
}
