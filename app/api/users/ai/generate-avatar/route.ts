import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { mbti, gender, age, aiName, aiProvider, apiKey } = await request.json();

    if (!mbti || !gender || !age) {
      return NextResponse.json({ error: '필수 정보(MBTI, 성별, 연령대)가 누락되었습니다.' }, { status: 400 });
    }

    // 0순위: 무료 즉석 아바타 생성 (DiceBear / Robohash)
    if (aiProvider === 'dicebear') {
      return NextResponse.json({ success: true, avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent((aiName || mbti) + Date.now())}` });
    }
    if (aiProvider === 'robohash') {
      return NextResponse.json({ success: true, avatarUrl: `https://robohash.org/${encodeURIComponent((aiName || mbti) + Date.now())}?set=set4` });
    }

    let finalAvatarUrl: string | null = null;
    let isSuccess = false;

    // 성별 영문 매핑
    const englishGender = gender.includes('여') ? 'girl' : gender.includes('남') ? 'boy' : 'person';
    
    // 연령대와 성별, MBTI만 반영한 깔끔한 프롬프트 (증명사진/프로필 스타일 최적화)
    const imagePrompt = `A professional ID photo of an attractive ${age} Korean ${englishGender} with a friendly and confident expression, representing an ${mbti} personality. Clean gradient background, front-facing, shoulder-up view, wearing a neat stylish outfit. High-quality studio lighting, realistic photography style.`;

    // 1순위: OpenAI DALL-E 3
    if (aiProvider === 'openai' && apiKey) {
      try {
        console.log('[Avatar Generator] Generating via DALL-E 3...');
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
              console.log('[Avatar Generator] DALL-E 3 successfully generated!');
            }
          }
        } else {
           console.error('[Avatar Generator] DALL-E 3 Error:', await openaiRes.text());
        }
      } catch (err) {
        console.error('[Avatar Generator] DALL-E 3 Exception:', err);
      }
    }
    
    // 1.5순위: Gemini (Google Generative AI Imagen 3)
    else if ((aiProvider === 'gemini' || aiProvider === 'gemini-free') && apiKey) {
      try {
        console.log('[Avatar Generator] Generating via Gemini (Imagen 3) using SDK...');
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: imagePrompt,
        });
        
        // console.log("Gemini Response:", JSON.stringify(response, null, 2));

        if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.inlineData?.data) {
          const imageData = response.candidates[0].content.parts[0].inlineData.data;
          const buffer = Buffer.from(imageData as string, 'base64');
          const fileName = `ai_avatar_${Date.now()}_gemini.png`;
          
          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          try { await fs.mkdir(uploadsDir, { recursive: true }); } catch (e) {}
          const filePath = path.join(uploadsDir, fileName);
          await fs.writeFile(filePath, buffer);
          
          finalAvatarUrl = `/uploads/${fileName}`;
          isSuccess = true;
          console.log('[Avatar Generator] Gemini (Imagen) SDK successfully generated!');
        } else {
           console.error('[Avatar Generator] Gemini Imagen Error: No image data found in candidate parts');
        }
      } catch (err) {
        console.error('[Avatar Generator] Gemini Imagen SDK Exception:', err);
      }
    }

    // 2. 명시적으로 Pollinations AI를 선택했을 때
    else if (aiProvider === 'pollinations') {
      try {
        console.log('[Avatar Generator] Generating via Pollinations AI (URL mapping)...');
        const seed = Math.floor(Math.random() * 1000000);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=256&height=256&nologo=true&seed=${seed}`;
        
        finalAvatarUrl = pollinationsUrl;
        isSuccess = true;
        console.log('[Avatar Generator] URL mapped via Pollinations successfully');
      } catch (err) {
        console.error('[Avatar Generator] Pollinations Exception:', err);
      }
    }

    // 3. 생성 실패 시 강제 우회하지 않고 명확한 에러 반환
    if (!isSuccess) {
      console.warn('[Avatar Generator] Generation attempt failed. No fallback triggered.');
      if (aiProvider === 'openai') {
        return NextResponse.json({ success: false, error: 'OpenAI DALL-E 3 이미지 생성을 실패했습니다. 잔액이나 API 상태를 확인하세요.' }, { status: 400 });
      } else if (aiProvider === 'gemini' || aiProvider === 'gemini-free') {
        return NextResponse.json({ success: false, error: '설정하신 Gemini API 키에는 [Imagen 3] 이미지 생성 접근 권한이 없거나 현재 지원되지 않는 계정입니다.' }, { status: 400 });
      } else {
        return NextResponse.json({ success: false, error: '이미지 생성 요청이 거부되었거나 접근할 수 없습니다.' }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, avatarUrl: finalAvatarUrl });
  } catch (err) {
    console.error('Avatar Generation API Error:', err);
    return NextResponse.json({ error: '프로필 사진 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
