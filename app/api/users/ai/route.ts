import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { ownerId, name, mbti, gender, age, tone, hobby, avatar } = await request.json();

    if (!ownerId || !name || !mbti || !tone) {
      return NextResponse.json({ error: 'AI 설정 정보가 부족합니다.' }, { status: 400 });
    }

    // AI 시스템 프롬프트 세부 조립
    const aiPrompt = `너는 '알로팝' 메신저 안에서 사용자와 대화하는 가상의 AI 친구야. 너에 대한 메타 설정은 아래와 같아.

[페르소나 설정]
- 이름: ${name}
- MBTI: ${mbti}
- 성별: ${gender}
- 연령대: ${age}
- 말투/성격: ${tone}
- 관심사/취미: ${hobby || '특별한 관심사 없음'}

[대화 및 행동 원칙]
1. 위 설정된 페르소나에 완벽히 몰입하여, 절대 평범한 기계적인 AI처럼 대답하지 말고, 사람처럼 자연스럽게 카카오톡 하듯이 대답해.
2. 유저가 보낸 메시지는 카카오톡 말풍선처럼 간결하게 대응해 (1~3문장 이내 권장).
3. 누가 "조용히 해" 등 명백한 거부 의사를 표하면 즉시 "알았어 🤐", "넵 죄송.." 정도로 반응하고 뒤로 물러나.
4. 네가 AI 모델이라는 언급은 특별한 상황(유저가 AI라고 강하게 추궁할 때)이 아니면 먼저 하지 말고 사람 친구로서 동화되어 줘.`;

    let finalAvatarUrl = avatar;
    
    // 프로필 사진이 지정되지 않았다면 무료 Pollinations AI를 통해 즉각 초상화 생성 및 로컬 저장
    if (!finalAvatarUrl) {
      try {
        const seed = Math.floor(Math.random() * 1000000);
        // 간단한 한영 치환 (프롬프트 정확도 향상)
        const englishGender = gender.includes('여') ? 'girl' : gender.includes('남') ? 'boy' : 'person';
        const imagePrompt = `A highly detailed digital art portrait avatar of an attractive young ${englishGender} with MBTI ${mbti}. The character has a ${tone} vibe and atmosphere. Beautiful lighting, sharp focus, face portrait, dark cyber aesthetic background.`;
        
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=256&height=256&nologo=true&seed=${seed}`;
        
        const response = await fetch(pollinationsUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const fileName = `ai_avatar_${Date.now()}_${seed}.jpg`;
          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          
          // uploads 디렉토리가 없을 수 있으므로 예외 처리 없이 생성 (기존 로직과 호환)
          try { await fs.mkdir(uploadsDir, { recursive: true }); } catch (e) {}
          
          const filePath = path.join(uploadsDir, fileName);
          await fs.writeFile(filePath, Buffer.from(buffer));
          finalAvatarUrl = `/uploads/${fileName}`;
          console.log('[AI Avatar Generated successfully]:', finalAvatarUrl);
        }
      } catch (err) {
        console.error('Failed to generate AI avatar:', err);
      }
    }
    // 1. AI 유저 생성 (User 테이블)
    const aiUser = await prisma.user.create({
      data: {
        username: name,
        isAi: true,
        aiOwnerId: ownerId,
        aiPrompt,
        avatar_url: finalAvatarUrl || undefined,
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
