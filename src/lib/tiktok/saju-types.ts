// saju-types.ts — Pure TypeScript types and constants for Saju charts (no Remotion runtime dependencies).

export interface SajuPillar {
  heavenly: { char: string; element: "wood" | "fire" | "earth" | "metal" | "water"; name: string };
  earthly: { char: string; element: "wood" | "fire" | "earth" | "metal" | "water"; name: string };
  role: "시주 (말년)" | "일주 (본인)" | "월주 (청년)" | "년주 (초년)";
}

export interface SajuCardData {
  title?: string;
  subtitle?: string;
  dayMaster?: string;
  destinyKeyword?: string;
  elementsRatio?: { wood: number; fire: number; earth: number; metal: number; water: number };
  pillars?: SajuPillar[];
}

export const DEFAULT_SAJU_PILLARS: SajuPillar[] = [
  { heavenly: { char: "甲", element: "wood", name: "갑목" }, earthly: { char: "子", element: "water", name: "자수" }, role: "시주 (말년)" },
  { heavenly: { char: "丙", element: "fire", name: "병화" }, earthly: { char: "午", element: "fire", name: "오화" }, role: "일주 (본인)" },
  { heavenly: { char: "戊", element: "earth", name: "무토" }, earthly: { char: "辰", element: "earth", name: "진토" }, role: "월주 (청년)" },
  { heavenly: { char: "庚", element: "metal", name: "경금" }, earthly: { char: "申", element: "metal", name: "신금" }, role: "년주 (초년)" },
];
