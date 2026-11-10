// Dependency-free slide helpers, safe to import from client components.

export interface CardSlide {
  headline: string;
  body?: string;
  items?: string[];
}

export const MIN_SLIDES = 7;
export const MAX_SLIDES = 10; // Instagram carousel API limit
export const MAX_ITEMS = 6; // what fits on one list card

// Prefix of compliance warnings stored in Post.qualityReasons (shown as a red block in review).
export const COMPLIANCE_PREFIX = "금지 표현 의심";
export const complianceReason = (issue: string) => `${COMPLIANCE_PREFIX} · ${issue}`;

export function isCardSlide(value: unknown): value is CardSlide {
  if (typeof value !== "object" || value === null) return false;
  const { headline, body, items } = value as Record<string, unknown>;
  return typeof headline === "string"
    && (body === undefined || typeof body === "string")
    && (items === undefined || (Array.isArray(items) && items.every((item) => typeof item === "string")));
}

export function parseCardSlides(raw: string | null | undefined): CardSlide[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCardSlide);
  } catch {
    return [];
  }
}

// /api/cards is CDN-cached for a year, so slide URLs carry a version that changes whenever the slide text changes.
export function slidesVersion(raw: string | null | undefined): string {
  let hash = 0x811c9dc5;
  for (const char of raw || "") {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
