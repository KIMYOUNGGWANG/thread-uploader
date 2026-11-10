import { checkMetaPolicySafety } from "@/lib/meta-policy-guard";
import { findProhibitedPhrases, readProhibitedPhrases } from "@/lib/trend-radar/negative-pattern-learner";
import { COMPLIANCE_PREFIX, complianceReason, type CardSlide } from "@/lib/wellness/slides";

// Health-claim wording that food/supplement advertising rules forbid (disease treatment or prevention, guaranteed effect).
// Kept here instead of the global Meta guard so other brands' quality gates do not change.
// ponytail: regex list, replace with a reviewed term table if the list grows past a few dozen entries.
const HEALTH_CLAIM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(불면증|우울증|당뇨|고혈압|비만|아토피|탈모|암)\s*(을|를|이|가)?\s*(치료|완치|개선|예방|해결)/, label: "질병 치료·예방 표현" },
  { pattern: /(면역력|혈당|혈압|콜레스테롤)\s*(을|를|이|가)?\s*(강화|높여|낮춰|조절|개선)/, label: "효능 단정 표현" },
  { pattern: /(살|체중|지방)\s*(이|가)?\s*(빠지는|빠진다|빠져요|빠집니다|녹는|녹아)/, label: "체중 감량 효능 단정" },
  { pattern: /(100%|무조건|반드시|확실히)\s*(효과|효능|낫|좋아)/, label: "효과 보장 표현" },
  { pattern: /(부작용\s*(이|은)?\s*(없|전혀)|의사\s*처방\s*없이)/, label: "안전성 보장 표현" },
];

export function findComplianceIssues(text: string, brandPhrases: string[]): string[] {
  const issues = new Set<string>();
  for (const { pattern, label } of HEALTH_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) issues.add(`${label}: "${match[0]}"`);
  }
  for (const violation of checkMetaPolicySafety(text).violations) issues.add(violation.reason);
  for (const phrase of findProhibitedPhrases(text, brandPhrases)) issues.add(`브랜드 금지 문구: "${phrase}"`);
  return [...issues];
}

export interface CardPostText {
  content: string;
  instagramCaption: string | null;
  slides: CardSlide[];
}

export function cardPostSurface(post: CardPostText): string {
  const slideText = post.slides.flatMap((slide) => [slide.headline, slide.body ?? "", ...(slide.items ?? [])]);
  return [post.content, post.instagramCaption ?? "", ...slideText].join("\n");
}

// After a human edit the stored warnings must describe the edited text: drop old compliance reasons, re-check, keep the rest.
export function recheckQualityReasons(rawReasons: string, post: CardPostText, rawBrandConfig: string): string {
  let reasons: string[] = [];
  try {
    const parsed: unknown = JSON.parse(rawReasons || "[]");
    if (Array.isArray(parsed)) reasons = parsed.filter((reason): reason is string => typeof reason === "string");
  } catch {
    reasons = [];
  }
  const issues = findComplianceIssues(cardPostSurface(post), readProhibitedPhrases(rawBrandConfig));
  return JSON.stringify([...reasons.filter((reason) => !reason.startsWith(COMPLIANCE_PREFIX)), ...issues.map(complianceReason)]);
}
