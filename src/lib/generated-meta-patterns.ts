// Single source of truth for "the model leaked its own instructions/checklist into the post".
// Used by generation (generate-posts, quality-gate, generation-engine) and the publish gate.
export const GENERATED_META_PATTERNS: readonly RegExp[] = [
  /자수\s*체크/,
  /글자\s*수\s*확인/,
  /공백[·\s]*줄바꿈.*포함/,
  /500자\s*이하\s*통과/,
  /Threads\s*본문/i,
  /초안\s*작성/,
  /#+\s*📌\s*THREADS\s*POST/i,
  /---\s*\*\*본문\*\*/i,
  /^\*\*본문\*\*/m,
  /===FIRST_COMMENT===/i,
  /#\s*The\s*Peach\s*Blossom/i,
  // The model describing its own draft ("셀프체크형 포스트입니다"), a char-count label ("본문 (482자)"),
  // or a draft title line ("# Threads Post: ..."). Each matched only leaked posts in 291 published ones.
  /(포스트|게시물)입니다/,
  /\(\s*\d{2,4}\s*(자|chars?|characters)\s*\)/i,
  /^\s*#*\s*(threads?\s+post|post\s+draft|draft)\s*[:：]/im,
];

export function hasGeneratedMeta(text: string): boolean {
  return GENERATED_META_PATTERNS.some((pattern) => pattern.test(text));
}
