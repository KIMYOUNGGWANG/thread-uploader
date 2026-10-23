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

const HEAVENLY_STEMS: Record<string, SajuPillar["heavenly"]> = {
  갑목: { char: "甲", element: "wood", name: "갑목" },
  을목: { char: "乙", element: "wood", name: "을목" },
  병화: { char: "丙", element: "fire", name: "병화" },
  정화: { char: "丁", element: "fire", name: "정화" },
  무토: { char: "戊", element: "earth", name: "무토" },
  기토: { char: "己", element: "earth", name: "기토" },
  경금: { char: "庚", element: "metal", name: "경금" },
  신금: { char: "辛", element: "metal", name: "신금" },
  임수: { char: "壬", element: "water", name: "임수" },
  계수: { char: "癸", element: "water", name: "계수" },
};

// Example chart whose day pillar stem is the requested day master; unknown names keep the template.
export function pillarsForDayMaster(dayMaster: string): SajuPillar[] {
  const dayStem = HEAVENLY_STEMS[dayMaster.replace(/\s/g, "")];
  if (!dayStem) return DEFAULT_SAJU_PILLARS;
  return DEFAULT_SAJU_PILLARS.map((pillar) => (pillar.role === "일주 (본인)" ? { ...pillar, heavenly: dayStem } : pillar));
}
