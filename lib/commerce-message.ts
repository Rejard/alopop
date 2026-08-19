const commerceCardPattern = /\n?\[\[ALOPOP_COMMERCE_CARD:([a-z0-9-]{1,80})\]\]/i;

export function appendCommerceCardMarker(reply: string, offerId: string) {
  const safeOfferId = offerId.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  if (!safeOfferId) return reply;
  return `${reply.trim()}\n\n[[ALOPOP_COMMERCE_CARD:${safeOfferId}]]`;
}

export function parseCommerceCardMarker(content: string) {
  const match = content.match(commerceCardPattern);
  return {
    text: content.replace(commerceCardPattern, "").trim(),
    offerId: match?.[1]?.toLowerCase() || null,
  };
}

export function containsCommerceCardMarker(content: string) {
  return commerceCardPattern.test(content);
}
