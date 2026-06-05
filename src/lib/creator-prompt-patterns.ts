import patternData from "@/data/advanced-creator-patterns.json";

interface PatternGuidance {
  label: string;
  guidance: string;
}

interface CreatorFormula {
  id: string;
  name: string;
  weight: number;
  instruction: string;
}

const hookGuidance = buildGuidanceMap(patternData.hooks);
const ctaGuidance = buildGuidanceMap(patternData.ctas);

export const ADVANCED_CREATOR_HOOK_TYPES = patternData.hooks.map((pattern) => pattern.label);
export const ADVANCED_CREATOR_CTA_TYPES = patternData.ctas.map((pattern) => pattern.label);
export const ADVANCED_CREATOR_FORMULAS = patternData.formulas satisfies CreatorFormula[];

export function formatCreatorPatternContext(hookType: string, ctaType: string): string {
  const hook = hookGuidance.get(hookType);
  const cta = ctaGuidance.get(ctaType);
  if (!hook && !cta) return "";

  return [
    "[고급 creator 패턴]",
    hook ? `- 훅 실행법: ${hook}` : "",
    cta ? `- CTA 실행법: ${cta}` : "",
    "- 위 패턴의 구조만 사용하고, 문장과 주장은 브랜드 톤에 맞게 새로 작성.",
  ].filter(Boolean).join("\n");
}

function buildGuidanceMap(patterns: PatternGuidance[]): Map<string, string> {
  return new Map(patterns.map((pattern) => [pattern.label, pattern.guidance]));
}
