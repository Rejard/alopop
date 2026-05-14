/**
 * Pet365Care AI 클라이언트 — Alopop 내부 AI API 사용
 *
 * Pet365Care 독립 서버에서는 Gemini 직접 호출이었으나,
 * Alopop 통합 이후에는 Alopop 서버 API를 경유하여
 * 프로바이더/모델/키를 통합 관리합니다.
 */

export async function analyzeImage(imageBase64: string): Promise<{ diagnosis: string; confidence: number; mood: string }> {
  // base64에서 data:image/... 접두사 제거
  let base64Data = imageBase64;
  if (imageBase64.startsWith("data:")) {
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)/);
    if (match) base64Data = match[2];
  }

  try {
    const res = await fetch("/api/pet365care/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyzeImage",
        imageBase64: base64Data,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AI 분석 오류: ${res.status} ${err}`);
    }
    const data = await res.json();
    return {
      diagnosis: data.diagnosis || "분석 완료",
      confidence: data.confidence || 75,
      mood: data.mood || "분석 완료",
    };
  } catch (e) {
    console.error("[Pet365Care AI] analyzeImage error:", e);
    return { diagnosis: "AI 분석에 실패했습니다.", confidence: 0, mood: "오류" };
  }
}

export async function generateCareTip(petName: string, species: string, breed: string, age: number): Promise<{ title: string; content: string; iconType: string }> {
  try {
    const res = await fetch("/api/pet365care/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generateCareTip",
        petName, species, breed, age,
      }),
    });
    if (!res.ok) {
      return { title: "오늘의 케어 팁", content: "반려동물과 함께하는 하루를 즐겨보세요!", iconType: "Heart" };
    }
    return await res.json();
  } catch {
    return { title: "오늘의 케어 팁", content: "반려동물과 함께하는 하루를 즐겨보세요!", iconType: "Heart" };
  }
}
