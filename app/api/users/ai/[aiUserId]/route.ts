import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function PUT(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  try {
    const { ownerId, name, mbti, gender, age, tone, hobby, regenerateAvatar, aiProvider, apiKey } = await request.json();
    const { aiUserId } = await context.params;

    if (!aiUserId || !ownerId || !name || !mbti || !tone) {
      return NextResponse.json({ error: 'AI 필수 설정 정보가 누락되었습니다.' }, { status: 400 });
    }

    const aiUser = await prisma.user.findUnique({ where: { id: aiUserId } });
    if (!aiUser || aiUser.aiOwnerId !== ownerId) {
      return NextResponse.json({ error: '해당 AI 친구를 수정할 권한이 없습니다.' }, { status: 403 });
    }

    // 새로운 시스템 프롬프트 조립
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

    let finalAvatarUrl = aiUser.avatar_url;

    // "사진 재생성" 옵션이 켜져 있다면, 기존 사진을 덮어쓰고 새로운 초상화를 추출합니다.
    if (regenerateAvatar || !finalAvatarUrl) {
      let isSuccess = false;
      const englishGender = gender.includes('여') ? 'girl' : gender.includes('남') ? 'boy' : 'person';
      const imagePrompt = `A highly detailed digital art portrait avatar of an attractive young ${englishGender} with MBTI ${mbti}. The character has a ${tone} vibe and atmosphere. Beautiful lighting, sharp focus, face portrait, dark cyber aesthetic background.`;

      // 1순위: OpenAI DALL-E 3
      if (aiProvider === 'openai' && apiKey) {
        try {
          console.log('[AI Avatar UPDATE] Generating via DALL-E 3...');
          const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: imagePrompt,
              n: 1,
              size: "1024x1024"
            })
          });

          if (openaiRes.ok) {
            const openaiData = await openaiRes.json();
            if (openaiData.data && openaiData.data[0]?.url) {
              const imgRes = await fetch(openaiData.data[0].url);
              if (imgRes.ok) {
                const buffer = await imgRes.arrayBuffer();
                const fileName = `ai_avatar_${Date.now()}_dalle.jpg`;
                const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
                try { await fs.mkdir(uploadsDir, { recursive: true }); } catch (e) {}
                const filePath = path.join(uploadsDir, fileName);
                await fs.writeFile(filePath, Buffer.from(buffer));
                finalAvatarUrl = `/uploads/${fileName}`;
                isSuccess = true;
                console.log('[AI Avatar UPDATE via DALL-E 3 successfully]');
              }
            }
          } else {
             console.error('[DALL-E 3 UPDATE Error]', await openaiRes.text());
          }
        } catch (err) {
          console.error('[DALL-E 3 UPDATE Exception]', err);
        }
      }

      // 1.5순위: Gemini (Google Generative AI Imagen 3)
      else if ((aiProvider === 'gemini' || aiProvider === 'gemini-free') && apiKey) {
        try {
          console.log('[AI Avatar UPDATE] Generating via Gemini (Imagen 3)...');
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [{ prompt: imagePrompt }],
              parameters: { sampleCount: 1, aspectRatio: "1:1" }
            })
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const base64Image = geminiData?.predictions?.[0]?.bytesBase64Encoded;
            if (base64Image) {
              const buffer = Buffer.from(base64Image, 'base64');
              const fileName = `ai_avatar_${Date.now()}_gemini.jpg`;
              const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
              try { await fs.mkdir(uploadsDir, { recursive: true }); } catch (e) {}
              const filePath = path.join(uploadsDir, fileName);
              await fs.writeFile(filePath, buffer);
              finalAvatarUrl = `/uploads/${fileName}`;
              isSuccess = true;
              console.log('[AI Avatar UPDATE via Gemini (Imagen) successfully]');
            }
          } else {
             console.error('[Gemini Imagen UPDATE Error]', await geminiRes.text());
          }
        } catch (err) {
          console.error('[Gemini Imagen UPDATE Exception]', err);
        }
      }
      if (!isSuccess) {
        try {
          console.log('[AI Avatar UPDATE] Generating via Pollinations AI as Fallback...');
          const seed = Math.floor(Math.random() * 1000000);
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=256&height=256&nologo=true&seed=${seed}`;
          
          const response = await fetch(pollinationsUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const fileName = `ai_avatar_${Date.now()}_${seed}.jpg`;
            const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
            try { await fs.mkdir(uploadsDir, { recursive: true }); } catch (e) {}
            const filePath = path.join(uploadsDir, fileName);
            await fs.writeFile(filePath, Buffer.from(buffer));
            finalAvatarUrl = `/uploads/${fileName}`;
            isSuccess = true;
            console.log('[AI Avatar UPDATE via Pollinations successfully]');
          } else {
             console.error('[Pollinations UPDATE Error]', await response.text());
          }
        } catch (err) {
          console.error('[Pollinations UPDATE Exception]', err);
        }
      }

      // 3순위: 이니셜 처리 (완전 실패 시 null 유지)
      if (!isSuccess) {
        console.warn('[AI Avatar UPDATE] All generation attempts failed. Falling back to initials.');
        finalAvatarUrl = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id: aiUserId },
      data: {
        username: name,
        aiPrompt: aiPrompt,
        avatar_url: finalAvatarUrl,
        statusMessage: `${mbti} | ${age} | ${tone}`
      }
    });

    return NextResponse.json({ success: true, aiUser: updated });
  } catch (err) {
    console.error('Update AI error:', err);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ aiUserId: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');
    const { aiUserId } = await context.params;

    if (!aiUserId || !ownerId) {
      return NextResponse.json({ error: '필수 정보 누락' }, { status: 400 });
    }

    const aiUser = await prisma.user.findUnique({ where: { id: aiUserId } });
    if (!aiUser || aiUser.aiOwnerId !== ownerId) {
      return NextResponse.json({ error: '해당 AI 친구를 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    // AI 계정 자체를 DB에서 영구 삭제
    // (Prisma Schema의 onDelete: Cascade 설정으로 인해 해당 AI와의 Friendship 등도 함께 사라집니다.)
    await prisma.user.delete({ where: { id: aiUserId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete AI error:', err);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}
