import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { requireCurrentUser } from '@/lib/auth';
import { logUserActivity } from '@/lib/auditLogger';
import sharp from 'sharp';
import { findInlineImageData, isSafeGeneratedSvg } from '@/lib/ai-avatar';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { resolveAiKeyForRequest } from '@/lib/ai-key-resolution';

const AvatarRequestSchema = z.object({
  mbti: z.string().trim().min(1).max(8),
  gender: z.string().trim().min(1).max(20),
  age: z.string().trim().min(1).max(30),
  aiName: z.string().trim().max(30).optional().nullable(),
  aiProvider: z.enum(['openai', 'gemini', 'gemini-free', 'pollinations', 'dicebear', 'robohash']),
});

export async function POST(request: Request) {
  let currentUsr: { id: string } | null = null;
  let provider: string | null = null;
  try {
    const { user: currentUser, response } = await requireCurrentUser(request);
    if (!currentUser) return response;
    currentUsr = currentUser;

    if (!checkRateLimit(`ai-avatar:${currentUser.id}`, 5, 60000)) {
      return NextResponse.json({ error: '프로필 사진 생성 요청이 너무 많습니다.' }, { status: 429 });
    }

    const parsed = AvatarRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || '잘못된 프로필 사진 요청입니다.' }, { status: 400 });
    }
    const { mbti, gender, age, aiName, aiProvider } = parsed.data;
    provider = aiProvider;
    const resolvedKey = aiProvider === 'openai' || aiProvider === 'gemini' || aiProvider === 'gemini-free'
      ? await resolveAiKeyForRequest({
        user: currentUser,
        provider: aiProvider,
        allowFreeEventFallback: false,
        allowEnvFallback: currentUser.isAdmin,
      })
      : null;
    const apiKey = resolvedKey?.apiKey || null;


    if (aiProvider === 'dicebear') {
      const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent((aiName || mbti) + Date.now())}`;
      await logUserActivity({
        userId: currentUser.id,
        activityType: 'AI_AVATAR_GENERATE',
        status: 'SUCCESS',
        metadata: { aiProvider },
      });
      return NextResponse.json({ success: true, avatarUrl });
    }
    if (aiProvider === 'robohash') {
      const avatarUrl = `https://robohash.org/${encodeURIComponent((aiName || mbti) + Date.now())}?set=set4`;
      await logUserActivity({
        userId: currentUser.id,
        activityType: 'AI_AVATAR_GENERATE',
        status: 'SUCCESS',
        metadata: { aiProvider },
      });
      return NextResponse.json({ success: true, avatarUrl });
    }

    let finalAvatarUrl: string | null = null;
    let isSuccess = false;


    const englishGender = gender.includes('여') ? 'girl' : gender.includes('남') ? 'boy' : 'person';


    const imagePrompt = `A professional ID photo of an attractive ${age} Korean ${englishGender} with a friendly and confident expression, representing an ${mbti} personality. Clean gradient background, front-facing, shoulder-up view, wearing a neat stylish outfit. High-quality studio lighting, realistic photography style.`;


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
              try { await fs.mkdir(uploadsDir, { recursive: true }); } catch {}
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


    else if ((aiProvider === 'gemini' || aiProvider === 'gemini-free') && apiKey) {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      try {
        console.log('[Avatar Generator] Generating via Gemini (Imagen 3) using SDK...');
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: imagePrompt,
        });

        const imageData = findInlineImageData(response.candidates?.[0]?.content?.parts || undefined);
        if (imageData) {
          const buffer = Buffer.from(imageData as string, 'base64');
          const fileName = `ai_avatar_${Date.now()}_gemini.png`;

          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          try { await fs.mkdir(uploadsDir, { recursive: true }); } catch {}
          const filePath = path.join(uploadsDir, fileName);
          await fs.writeFile(filePath, buffer);

          finalAvatarUrl = `/uploads/${fileName}`;
          isSuccess = true;
          console.log('[Avatar Generator] Gemini (Imagen) SDK successfully generated!');
        } else {
           throw new Error('No image data found from Gemini');
        }
      } catch (err) {
        console.error('[Avatar Generator] Gemini Imagen SDK Exception, falling back to SVG generation:', err);

        try {
          console.log('[Avatar Generator] Fallback to Gemini 3.1 Flash Lite Preview for SVG generation...');
          const englishAge = age.replace('대', 's');
          const svgPrompt = `Create a stunning SVG vector illustration of a ${englishAge} Korean ${englishGender} based on the ${mbti} personality type.
          Follow these instructions strictly:
          1. Persona Context: Express the core traits, vibe, and energy of the ${mbti} personality type.
          2. Color Palette: Choose appropriate colors for the background, outfit, and skin tone that match the ${mbti} vibe and ${englishAge} demographic.
          3. Facial & Detail Features: Carefully design the hairstyle, eyes, mouth shape, and facial expressions to reflect the persona.
          4. Technical Constraints: Compose all elements using simple geometric shapes (Path, Circle, Rect). Strictly set the SVG canvas size to width="256" height="256" with viewBox="0 0 256 256". Use a center-focused Radial Gradient for background lighting effects.
          Respond ONLY with the pure <svg>...</svg> code string. Do not use markdown tags like \`\`\`svg. Output exactly starting with <svg> and ending with </svg>.`;

          const svgResponse = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: svgPrompt,
          });

          let svgText = svgResponse.text || svgResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

          svgText = svgText.replace(/```xml/gi, '').replace(/```svg/gi, '').replace(/```html/gi, '').replace(/```/g, '').trim();

          if (svgText.startsWith('<svg') && svgText.includes('</svg>')) {
             const startIndex = svgText.indexOf('<svg');
             const endIndex = svgText.lastIndexOf('</svg>') + 6;
             const pureSvg = svgText.slice(startIndex, endIndex);

             if (!isSafeGeneratedSvg(pureSvg)) {
               throw new Error('Unsafe SVG output rejected');
             }

             const fileName = `ai_avatar_${Date.now()}_gemini.png`;
             const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
             try { await fs.mkdir(uploadsDir, { recursive: true }); } catch {}
             const filePath = path.join(uploadsDir, fileName);
             await sharp(Buffer.from(pureSvg, 'utf8')).png().toFile(filePath);

             finalAvatarUrl = `/uploads/${fileName}`;
             isSuccess = true;
             console.log('[Avatar Generator] Gemini SVG successfully generated as fallback!');
          } else {
             console.error('[Avatar Generator] Gemini SVG response was invalid:', svgText.substring(0, 100));
          }
        } catch (svgErr) {
          console.error('[Avatar Generator] Gemini SVG generation Exception:', svgErr);
        }
      }
    }


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


    if (!isSuccess) {
      console.warn('[Avatar Generator] Generation attempt failed. No fallback triggered.');
      await logUserActivity({
        userId: currentUser.id,
        activityType: 'AI_AVATAR_GENERATE',
        status: 'FAILED',
        metadata: { aiProvider, error: 'Generation failed or parameter missing' },
      });
      if (aiProvider === 'openai') {
        return NextResponse.json({ success: false, error: 'OpenAI DALL-E 3 이미지 생성을 실패했습니다. 잔액이나 API 상태를 확인하세요.' }, { status: 400 });
      } else if (aiProvider === 'gemini' || aiProvider === 'gemini-free') {
        return NextResponse.json({ success: false, error: '설정하신 Gemini API 키에는 [Imagen 3] 이미지 생성 접근 권한이 없거나 현재 지원되지 않는 계정입니다.' }, { status: 400 });
      } else {
        return NextResponse.json({ success: false, error: '이미지 생성 요청이 거부되었거나 접근할 수 없습니다.' }, { status: 400 });
      }
    }

    await logUserActivity({
      userId: currentUser.id,
      activityType: 'AI_AVATAR_GENERATE',
      status: 'SUCCESS',
      metadata: { aiProvider },
    });

    return NextResponse.json({ success: true, avatarUrl: finalAvatarUrl });
  } catch (err) {
    console.error('Avatar Generation API Error:', err);
    await logUserActivity({
      userId: currentUsr?.id,
      activityType: 'AI_AVATAR_GENERATE',
      status: 'FAILED',
      metadata: { aiProvider: provider, error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: '프로필 사진 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
