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

export async function generateHistorySummary(petName: string, recordsText: string): Promise<string> {
  try {
    const res = await fetch("/api/pet365care/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generateHistorySummary",
        petName, recordsText,
      }),
    });
    if (!res.ok) {
      return "분석 기록 요약에 실패했습니다.";
    }
    const data = await res.json();
    return data.summary || "분석 기록을 요약할 수 없습니다.";
  } catch {
    return "분석 기록 요약 중 오류가 발생했습니다.";
  }
}

export async function generateDailyCoaching(petName: string, checksText: string): Promise<string> {
  try {
    const res = await fetch("/api/pet365care/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generateDailyCoaching",
        petName, checksText,
      }),
    });
    if (!res.ok) {
      return "오늘도 우리 아이와 즐거운 하루 보내세요!";
    }
    const data = await res.json();
    return data.coaching || "오늘도 우리 아이와 즐거운 하루 보내세요!";
  } catch {
    return "오늘도 우리 아이와 즐거운 하루 보내세요!";
  }
}

export async function generateWeeklyRoutineCoaching(petName: string, weeklyStatsText: string, userName?: string): Promise<string> {
  try {
    const res = await fetch("/api/pet365care/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generateWeeklyRoutineCoaching",
        petName, weeklyStatsText, userName,
      }),
    });
    if (!res.ok) {
      return "데이터를 바탕으로 루틴을 점검해 보세요!";
    }
    const data = await res.json();
    return data.coaching || "데이터를 바탕으로 루틴을 점검해 보세요!";
  } catch {
    return "데이터를 바탕으로 루틴을 점검해 보세요!";
  }
}
