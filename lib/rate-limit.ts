const rateLimitCache = new Map<string, number[]>();

/**
 * 초경량 인메모리 Rate Limiter (Redis 없이 서버 메모리 활용)
 * @param identifier 사용자 ID 또는 IP 주소 등 고유 식별자
 * @param limit 허용할 최대 요청 횟수
 * @param windowMs 제한을 적용할 시간(밀리초)
 * @returns 제한을 초과하지 않았으면 true, 초과했으면 false
 */
export function checkRateLimit(identifier: string, limit: number = 3, windowMs: number = 1000): boolean {
  const now = Date.now();
  
  if (!rateLimitCache.has(identifier)) {
    rateLimitCache.set(identifier, [now]);
    return true;
  }

  const timestamps = rateLimitCache.get(identifier)!;
  
  // 윈도우 시간 내의 타임스탬프만 필터링 (오래된 기록 삭제)
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  
  if (validTimestamps.length >= limit) {
    // 제한 초과 시 기록 갱신 후 차단
    rateLimitCache.set(identifier, validTimestamps);
    return false; 
  }

  // 통과 시 새 타임스탬프 추가
  validTimestamps.push(now);
  rateLimitCache.set(identifier, validTimestamps);
  
  // Map 사이즈가 비정상적으로 커지는 것(메모리 릭)을 방지하는 자체 청소 로직
  if (rateLimitCache.size > 20000) {
    const expiredKeys = [];
    for (const [key, times] of rateLimitCache.entries()) {
      if (times.length === 0 || now - times[times.length - 1] > windowMs * 2) {
        expiredKeys.push(key);
      }
    }
    expiredKeys.forEach(k => rateLimitCache.delete(k));
  }
  
  return true;
}
