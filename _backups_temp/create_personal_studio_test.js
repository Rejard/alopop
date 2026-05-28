const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== [개인 유저 로컬 스튜디오 생성 테스트 시작] ===');
  
  const testUsername = 'Rejard_Test';
  const studioName = 'Rejard의 비밀 게임 연구소';
  const studioType = 'game';

  try {
    // 1. 테스트 유저가 이미 존재하는지 조회하거나 새로 생성
    let user = await prisma.user.findFirst({
      where: { username: testUsername }
    });

    if (!user) {
      console.log(`[1] 테스트 유저 '${testUsername}' 계정이 존재하지 않아 새로 생성합니다...`);
      user = await prisma.user.create({
        data: {
          username: testUsername,
          walletBalance: 50000, // 테스트용 넉넉한 예산
          isAdmin: false,
          isAi: false
        }
      });
      console.log(`-> 유저 생성 완료! (ID: ${user.id}, 잔액: ${user.walletBalance} 코인)`);
    } else {
      console.log(`[1] 기존 테스트 유저 '${testUsername}' 계정을 사용합니다. (ID: ${user.id}, 잔액: ${user.walletBalance} 코인)`);
    }

    // 2. 예측 가능한 형태의 에이전트 초기 상태 구성 (agentStateJson)
    const initialAgentState = {
      "Alice": {
        "status": "idle",
        "room": "DevRoom",
        "log": "",
        "role": "Game Planner",
        "expertise": "게임 시스템 설계 및 세계관 시나리오 작성 전문 기획자"
      },
      "Bob": {
        "status": "idle",
        "room": "DevRoom",
        "log": "",
        "role": "UI/UX Designer",
        "expertise": "사용자 경험 및 고해상도 그래픽 리소스 아티스트"
      },
      "Carol": {
        "status": "idle",
        "room": "DevRoom",
        "log": "",
        "role": "Lead Developer",
        "expertise": "HTML5 Canvas 및 자바스크립트 엔진 기반 인게임 로직 구현 수석 개발자"
      }
    };

    const initialProjectJson = {
      active: false,
      specDoc: '',
      designDoc: '',
      codeDoc: '',
      url: '',
      gameName: ''
    };

    console.log(`[2] 개인 유저 로컬 스튜디오 '${studioName}' 생성 중...`);
    const newStudio = await prisma.studio.create({
      data: {
        name: studioName,
        type: studioType,
        isSystem: false, // 개인 유저 소유이므로 false
        isWorking: false,
        currentProjectJson: JSON.stringify(initialProjectJson),
        agentStateJson: JSON.stringify(initialAgentState),
        ownerId: user.id
      }
    });

    console.log(`-> 스튜디오 생성 성공! (Studio ID: ${newStudio.id})`);

    // 3. 첫 환영 로그(StudioLog) 추가
    console.log('[3] 스튜디오 개설 축하 환영 로그 기록 중...');
    const welcomeLog = await prisma.studioLog.create({
      data: {
        studioId: newStudio.id,
        agent: '대표님',
        msg: `🚀 '${studioName}'이(가) 성공적으로 개설되었습니다! 정예 에이전트 Alice, Bob, Carol이 새로운 프로젝트 지시를 대기하고 있습니다.`,
        error: false
      }
    });
    console.log(`-> 환영 로그 기록 완료! (Log ID: ${welcomeLog.id})`);

    // 4. 최종 데이터 확인 및 상세 리포트 출력
    console.log('\n=== [생성 완료된 스튜디오 최종 요약] ===');
    const createdStudio = await prisma.studio.findUnique({
      where: { id: newStudio.id },
      include: {
        owner: true,
        logs: true
      }
    });
    console.log(JSON.stringify(createdStudio, null, 2));
    console.log('========================================');
    console.log('✅ 테스트가 성공적으로 마무리되었습니다!');

  } catch (error) {
    console.error('❌ 스튜디오 생성 테스트 도중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
