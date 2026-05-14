/**
 * 펫 소셜 시드 데이터 — 가상의 활동 게시물 생성
 * 
 * 실행: npx ts-node scripts/seed-pet-social.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 사실적인 반려동물 커뮤니티 게시물들
const SEED_POSTS = [
  {
    content: `오늘 흰둥이랑 한강 산책 다녀왔어요! 🌊🐕\n\n아침 7시에 나가서 반포 한강공원에서 여의도까지 왕복 4km 걸었는데, 흰둥이가 강아지 친구들을 3마리나 만나서 신나게 뛰어놀았어요 ㅋㅋ\n\n요즘 날씨가 딱 산책하기 좋아서 매일 나가고 있는데, 확실히 운동량이 늘어나니까 밤에 잠도 잘 자고 컨디션도 좋아진 것 같아요 💪`,
    category: 'walk',
    likeCount: 24,
    commentCount: 3,
  },
  {
    content: `바둑이 드디어 광견병 예방접종 완료! 💉✨\n\n매년 이맘때쯤 동물병원 가는데 올해도 무사히 끝났네요. 주사 맞을 때 너무 떨어서 마음이 아팠지만... 맞고 나서 간식 줬더니 바로 기분 좋아져서 꼬리 흔들흔들 😂\n\n다른 보호자분들도 예방접종 꼭 챙기세요! 광견병은 법적 의무접종이에요 🏥`,
    category: 'health',
    likeCount: 42,
    commentCount: 7,
  },
  {
    content: `나비가 오늘 너무 웃긴 표정을 지었어요 😹\n\n밀가루 봉지를 머리에 뒤집어쓰고 거실을 돌아다니는데 진짜 배꼽빠질 뻔... 고양이는 왜 이런 걸 좋아하는 건지 ㅋㅋㅋ\n\n이 사진 보고 우울한 기분 다 날려버리세요~`,
    category: 'funny',
    likeCount: 89,
    commentCount: 12,
  },
  {
    content: `Pet365Care 앱으로 케어 체크리스트 작성 중 📋\n\n매일 아침 물갈이, 산책, 간식, 빗질 체크하는데 한 달 넘게 연속으로 100% 달성했어요! 🎉\n\n처음에는 귀찮았는데 습관이 되니까 오히려 빠뜨리면 불안해지네요. 반려동물 케어에 관심있는 분들 한번 써보세요!`,
    category: 'daily',
    likeCount: 56,
    commentCount: 8,
  },
  {
    content: `강아지 이빨 관리 팁 공유합니다! 🦷\n\n수의사 선생님한테 들은 건데요:\n\n1. 매일 양치질 (강아지 전용 치약만!)\n2. 덴탈껌은 하루 1개\n3. 딱딱한 뼈다귀는 오히려 이빨 깨질 수 있음\n4. 1년에 한 번은 스케일링 추천\n\n특히 소형견은 이빨 관리가 정말 중요하대요. 참고하세요! 🐶`,
    category: 'health',
    likeCount: 73,
    commentCount: 15,
  },
  {
    content: `오늘의 산책 로그 🗺️\n\n코스: 우리집 → 근린공원 → 카페거리 → 우리집\n거리: 2.8km\n시간: 45분\n날씨: ☀️ 맑음\n\n오늘따라 흰둥이가 컨디션이 좋아서 평소보다 더 멀리 갔어요! 중간에 강아지 카페 들러서 강아지 아이스크림도 사줬는데 너무 좋아하더라고요 🍦`,
    category: 'walk',
    likeCount: 31,
    commentCount: 4,
  },
  {
    content: `우리 나비의 하루 일과 ☀️🐱\n\n06:00 기상 (보호자 얼굴 위에서 잠)\n07:00 아침 식사 (참치 캔)\n08:00~12:00 낮잠 1차\n12:30 점심 간식\n13:00~17:00 낮잠 2차\n17:30 캣타워에서 바깥 구경\n18:00 저녁 식사\n19:00~22:00 미친 듯이 뛰어다님 (야간 모드)\n23:00 보호자 베개 점령 후 취침\n\n...하루에 16시간은 자는 것 같아요 😂`,
    category: 'funny',
    likeCount: 112,
    commentCount: 19,
  },
  {
    content: `🏥 반기 건강검진 결과 공유\n\n바둑이 (믹스견, 5살)\n- 체중: 12.3kg → 12.1kg (정상!)\n- 심장사상충: 음성 ✅\n- 혈액검사: 모두 정상 ✅\n- 치석: 약간 있음 → 다음 달 스케일링 예약\n\n건강해서 너무 다행이에요 😭 정기 검진 꼭 받으세요!`,
    category: 'health',
    likeCount: 45,
    commentCount: 6,
  },
];

// 시드 댓글들
const SEED_COMMENTS = [
  '너무 귀여워요!! 😍',
  '우리 애도 이렇게 해봐야겠어요',
  '정보 감사합니다! 도움이 많이 됐어요 👍',
  'ㅋㅋㅋ 진짜 웃기다 😂',
  '부럽다... 우리 애는 산책 싫어해요 ㅠ',
  '어디 병원 다니세요?',
  '저도 Pet365Care 쓰고 있는데 진짜 좋아요!',
  '흰둥이 너무 귀엽다 🥰',
  '건강검진 중요하죠! 잘 챙기시네요',
  '사진 더 올려주세요!',
  '강아지 카페 어디에요?? 알려주세요!',
  '우리 냥이도 똑같이 행동해요 ㅋㅋ',
];

async function main() {
  console.log('🌱 펫 소셜 시드 데이터 생성 시작...\n');

  // Rejard 유저 찾기 (관리자)
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (!admin) {
    console.error('❌ 관리자 유저를 찾을 수 없습니다');
    return;
  }

  // 다른 유저 목록 (댓글용)
  const allUsers = await prisma.user.findMany({
    where: { isAi: false },
    select: { id: true, username: true },
    take: 5,
  });

  console.log(`📋 관리자: ${admin.username} (${admin.id})`);
  console.log(`👥 유저 ${allUsers.length}명 사용\n`);

  // 시간을 과거로 설정하여 자연스러운 타임라인 생성
  const now = Date.now();

  for (let i = 0; i < SEED_POSTS.length; i++) {
    const seed = SEED_POSTS[i];
    const createdAt = new Date(now - (i + 1) * 3600000 * (3 + Math.random() * 12)); // 3~15시간 간격

    const post = await prisma.petPost.create({
      data: {
        authorId: admin.id,
        content: seed.content,
        category: seed.category,
        likeCount: seed.likeCount,
        commentCount: seed.commentCount,
        createdAt,
      },
    });

    // 댓글 추가 (commentCount만큼)
    const commentCount = Math.min(seed.commentCount, 3); // 최대 3개만 실제 생성
    for (let j = 0; j < commentCount; j++) {
      const commentAuthor = allUsers[j % allUsers.length];
      const commentContent = SEED_COMMENTS[(i * 3 + j) % SEED_COMMENTS.length];
      await prisma.petComment.create({
        data: {
          postId: post.id,
          authorId: commentAuthor.id,
          content: commentContent,
          createdAt: new Date(createdAt.getTime() + (j + 1) * 600000), // 10분 간격
        },
      });
    }

    console.log(`  ✅ [${seed.category}] "${seed.content.slice(0, 30)}..." (❤️${seed.likeCount} 💬${commentCount})`);
  }

  console.log(`\n🎉 시드 완료! ${SEED_POSTS.length}개 게시물 + 댓글 생성됨`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
