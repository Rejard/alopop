const allowedCommerceHosts = new Set([
  "booking.naver.com",
  "map.naver.com",
  "search.shopping.naver.com",
]);

export function isAllowedCommerceActionUrl(actionUrl: string) {
  try {
    const parsed = new URL(actionUrl);
    return parsed.protocol === "https:" && allowedCommerceHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}
