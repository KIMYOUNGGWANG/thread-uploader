import type { QualityResult } from "@/lib/quality-gate";
import { hasLowTouchEngagementMechanic } from "@/lib/viral-intent-modes";

export interface ProductQualityContext {
  productName?: string;
  productKeywords?: string[];
  ctaTerms?: string[];
}

const GENERIC_SELF_HELP_PATTERNS = [
  /좋은 일이 올 거예요/,
  /좋은 일이 올 거야/,
  /스스로를 믿으세요/,
  /스스로를 믿어/,
  /작은 변화가 큰 기적/,
  /포기하지 마세요/,
  /포기하지 마/,
  /당신은 할 수 있어/,
  /언젠가 다 잘될/,
];

export function checkProductGrowthQuality(post: string, context: ProductQualityContext): QualityResult {
  const firstLine = post.split("\n").find((line) => line.trim().length > 0) ?? "";
  const reasons: string[] = [];
  let score = 0;

  if (hasProductHook(firstLine)) {
    score++;
  } else {
    reasons.push(`첫 줄 hook 약함: "${firstLine.slice(0, 40)}"`);
  }

  if (hasProductRelevance(post, context)) {
    score++;
  } else {
    reasons.push("product relevance 없음");
  }

  if (hasProductCta(post, context)) {
    score++;
  } else {
    reasons.push("product CTA 없음");
  }

  if (GENERIC_SELF_HELP_PATTERNS.some((pattern) => pattern.test(post))) {
    reasons.push("generic filler 문장 포함");
  } else {
    score++;
  }

  return { pass: score >= 3 && !reasons.some((reason) => reason.includes("generic")), score, profile: "product_growth", reasons };
}

function hasProductHook(firstLine: string): boolean {
  return /\?/.test(firstLine)
    || /아직도/.test(firstLine)
    || /왜/.test(firstLine)
    || /몇\s*분/.test(firstLine)
    || /줄일/.test(firstLine)
    || /놓치/.test(firstLine);
}

function hasProductRelevance(post: string, context: ProductQualityContext): boolean {
  const terms = [
    context.productName,
    ...(context.productKeywords ?? []),
  ].filter((term): term is string => typeof term === "string" && term.trim().length > 0);
  return terms.some((term) => post.toLowerCase().includes(term.toLowerCase()));
}

function hasProductCta(post: string, context: ProductQualityContext): boolean {
  const terms = ["확인", "랜딩", "링크", "프로필", "댓글", "저장", ...(context.ctaTerms ?? [])];
  return terms.some((term) => post.includes(term)) && hasLowTouchEngagementMechanic(post);
}
