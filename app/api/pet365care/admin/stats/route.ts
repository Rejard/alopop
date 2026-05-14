import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/auth';

/**
 * Pet365Care 관리자 통계 API
 * 
 * Alopop 버전: Pet365Care 데이터는 localStorage 기반이므로
 * 서버 DB에서 관리 가능한 항목만 통계 제공
 * - 병원 데이터 (Hospital)
 * - AI 사용 로그 (Pet365ApiLog)
 * - Pet365Care 봇 유저 수 / 채팅방 수
 */
export async function GET(request: Request) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) return response;
    if (!user.isAdmin) {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalHospitals,
      emergencyHospitals,
      totalBotUsers,
      totalBotRooms,
      aiSuccess24h,
      aiFail24h,
      aiFallback24h,
      aiTotal,
      aiToday,
      recentLogs,
    ] = await Promise.all([
      // 병원 통계
      prisma.hospital.count(),
      prisma.hospital.count({ where: { isEmergency: true } }),

      // Pet365Care 봇 유저 (펫별 봇)
      prisma.user.count({ where: { isAi: true, aiPrompt: { contains: 'Pet365Care' } } }),

      // Pet365Care 봇이 포함된 채팅방 수
      prisma.room.count({
        where: {
          members: {
            some: {
              user: { isAi: true, aiPrompt: { contains: 'Pet365Care' } }
            }
          }
        }
      }),

      // 24h AI 통계
      prisma.pet365ApiLog.count({ where: { type: 'AI_SUCCESS', createdAt: { gte: yesterday } } }),
      prisma.pet365ApiLog.count({ where: { type: 'AI_FAIL', createdAt: { gte: yesterday } } }),
      prisma.pet365ApiLog.count({ where: { type: 'AI_FALLBACK', createdAt: { gte: yesterday } } }),

      // 전체 AI 분석 수
      prisma.pet365ApiLog.count(),
      prisma.pet365ApiLog.count({ where: { createdAt: { gte: todayStart } } }),

      // 최근 실패/fallback 로그 10건
      prisma.pet365ApiLog.findMany({
        where: { type: { not: 'AI_SUCCESS' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const aiTotal24h = aiSuccess24h + aiFail24h + aiFallback24h;
    const aiSuccessRate = aiTotal24h > 0 ? Math.round((aiSuccess24h / aiTotal24h) * 100) : 100;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalHospitals,
          emergencyHospitals,
          totalBotUsers,
          totalBotRooms,
          aiTotal,
          aiToday,
        },
        ai: {
          successRate: aiSuccessRate,
          success24h: aiSuccess24h,
          fail24h: aiFail24h,
          fallback24h: aiFallback24h,
          total24h: aiTotal24h,
        },
        recentLogs,
      },
    });
  } catch (error) {
    console.error('[Pet365Care Admin] Stats error:', error);
    return NextResponse.json({ success: false, error: '통계 조회에 실패했습니다.' }, { status: 500 });
  }
}
