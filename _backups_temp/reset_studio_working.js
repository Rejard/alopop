const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- [AI 스튜디오 명칭 및 상태 긴급 클렌징 스크립트 기동] ---');
  try {
    // 1. 혹시 남아있는 '오리지널 게임 개발 스튜디오' 명칭 보정 마이그레이션
    const updateNames = await prisma.studio.updateMany({
      where: { name: '오리지널 게임 개발 스튜디오', isSystem: true },
      data: { name: '게임 개발 스튜디오' }
    });
    console.log(`명칭 마이그레이션 완료: ${updateNames.count}개 스튜디오 이름이 '게임 개발 스튜디오'로 보정되었습니다.`);

    // 2. 전체 스튜디오의 작업 상태 및 컨텍스트 리셋
    const result = await prisma.studio.updateMany({
      data: {
        isWorking: false,
        currentProjectJson: '{}',
        agentStateJson: '{}'
      }
    });
    console.log(`성공적으로 모든 스튜디오의 isWorking 상태를 false로 강제 리셋하고 작업 컨텍스트를 초기화했습니다.`);
    console.log(`업데이트된 스튜디오 레코드 수: ${result.count}`);
  } catch (err) {
    console.error('데이터베이스 업데이트 중 에러가 발생했습니다:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
