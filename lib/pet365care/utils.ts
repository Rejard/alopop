/**
 * Pet365Care 유틸리티 (Alopop 내부 통합 버전)
 * alopop-bridge.ts에서 추출 — 이모지 매핑만 유지
 */

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐶", cat: "🐱", rabbit: "🐰", hamster: "🐹",
  bird: "🦜", turtle: "🐢", duck: "🦆", hedgehog: "🦔",
  fish: "🐟", other: "🐾",
};

export function getSpeciesEmoji(species: string): string {
  return SPECIES_EMOJI[species] || "🐾";
}
