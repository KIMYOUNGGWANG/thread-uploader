/**
 * Anti-Repeat Memory Engine
 * Prevents repetitive angles, identical hooks, and duplicate structures across recent posts.
 * Inspired by autoTHREADS recent-post anti-repeat memory.
 */

import { IDENTITY_MARKER_PATTERN } from "@/lib/viral-intent-modes";

export interface RecentPostSummary {
  content: string;
  topic?: string | null;
  hookType?: string | null;
  ctaType?: string | null;
  campaignFormulaId?: string | null;
  formulaId?: string | null;
  firstComment?: string | null;
  status?: string | null;
}

export interface SimilarityCheckResult {
  isDuplicate: boolean;
  similarityScore: number;
  matchedIndex?: number;
  reason?: string;
}

/**
 * Extracts the opening sentence or first meaningful line of a post.
 */
export function extractFirstSentence(text: string): string {
  const clean = text
    .replace(/^\[.*?\]\s*/, "") // Remove bracket tags
    .replace(/^#+\s*/, "")      // Remove markdown headings
    .trim();

  const firstLine = clean.split("\n").find((line) => line.trim().length > 0) || clean;
  const sentenceMatch = firstLine.match(/^[^.!?]+[.!?]*/);
  return (sentenceMatch ? sentenceMatch[0] : firstLine).trim();
}

function computeSetJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount++;
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

function tokenizeWords(text: string): Set<string> {
  const clean = text.toLowerCase().replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, " ");
  return new Set(clean.split(/\s+/).filter((w) => w.length >= 2));
}

function tokenizeBigrams(text: string): Set<string> {
  const clean = text.toLowerCase().replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣]/g, "");
  const bigrams = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) {
    bigrams.add(clean.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Computes Jaccard similarity between two texts based on word and character bi-gram overlap.
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  const wordSim = computeSetJaccard(tokenizeWords(textA), tokenizeWords(textB));
  const bigramSim = computeSetJaccard(tokenizeBigrams(textA), tokenizeBigrams(textB));
  return Math.max(wordSim, bigramSim);
}

/**
 * Formats recent posts into a clear anti-repeat prompt context for the LLM.
 */
export function formatAntiRepeatContext(
  posts: RecentPostSummary[],
  limit = 5
): string {
  const slice = posts.slice(0, limit);
  if (slice.length === 0) {
    return "최근 생성 글 없음. 단, 일반적인 첫 문장/전형적인 구조/뻔한 결론 반복은 피한다.";
  }

  const lines: string[] = [
    `최근 작성된 ${slice.length}개 포스트 목록입니다. 아래 글들과 첫 문장 훅, 전개 각도, 비유, 결론 구조를 절대 반복하지 마십시오:`,
  ];

  slice.forEach((post, i) => {
    const firstSentence = extractFirstSentence(post.content);
    const snippet = post.content.slice(0, 100).replace(/\s+/g, " ");
    const topic = post.topic ? ` [주제: ${post.topic}]` : "";
    const hook = post.hookType ? ` [훅: ${post.hookType}]` : "";
    lines.push(`${i + 1}.${topic}${hook} 첫문장: "${firstSentence}" (내용: ${snippet}…)`);
  });

  lines.push("");
  lines.push("[안티 리피트 필수 지침]");
  lines.push("1. 위 목록의 첫 문장 질문/선언 구조를 유사하게 변형해서 재사용하지 마십시오.");
  lines.push("2. 같은 주제더라도 다른 감정적 트리거(호기심, 반전, 현실적 공감, 경고 등)와 새로운 관점을 취하십시오.");
  lines.push("3. 본문 내 선택지나 체크리스트의 키워드 및 예시를 완전히 새롭게 구성하십시오.");

  return lines.join("\n");
}

/**
 * Validates whether a candidate post is too similar to any recent post.
 */
export function checkAntiRepeatSimilarity(
  candidateContent: string,
  recentPosts: RecentPostSummary[],
  options?: {
    firstSentenceThreshold?: number;
    overallThreshold?: number;
    checkLimit?: number;
  }
): SimilarityCheckResult {
  const firstSentenceThreshold = options?.firstSentenceThreshold ?? 0.6; // 60% overlap in first sentence
  const overallThreshold = options?.overallThreshold ?? 0.65; // 65% overlap in full body
  const checkLimit = options?.checkLimit ?? 10;

  const candidateFirstSentence = extractFirstSentence(candidateContent);
  const targetPosts = recentPosts.slice(0, checkLimit);

  for (let i = 0; i < targetPosts.length; i++) {
    const recent = targetPosts[i];
    const recentFirstSentence = extractFirstSentence(recent.content);

    // 1. Check first sentence similarity (hook plagiarism)
    const firstSentenceSim = calculateJaccardSimilarity(candidateFirstSentence, recentFirstSentence);
    if (firstSentenceSim >= firstSentenceThreshold) {
      return {
        isDuplicate: true,
        similarityScore: firstSentenceSim,
        matchedIndex: i,
        reason: `최근 글 #${i + 1}과 첫 문장 훅 유사도(${Math.round(firstSentenceSim * 100)}%) 과다: "${recentFirstSentence}"`,
      };
    }

    // 2. Check overall body similarity
    const overallSim = calculateJaccardSimilarity(candidateContent, recent.content);
    if (overallSim >= overallThreshold) {
      return {
        isDuplicate: true,
        similarityScore: overallSim,
        matchedIndex: i,
        reason: `최근 글 #${i + 1}과 본문 전체 유사도(${Math.round(overallSim * 100)}%) 과다`,
      };
    }
  }

  return {
    isDuplicate: false,
    similarityScore: 0,
  };
}

export interface StructureSignature {
  opener: "hierarchy" | "question" | "callout" | "statement";
  hasNumberedChoices: boolean;
  closer: "save" | "ask" | "other";
  commentOpener: string | null;
}

function contentLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\[.*?\]\s*/, "").replace(/^#+\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function classifyOpener(lines: string[]): StructureSignature["opener"] {
  const firstLine = lines[0] ?? "";
  const openingComparisons = lines.slice(0, 2).join(" ").match(/보다/g)?.length ?? 0;
  if (openingComparisons >= 2) return "hierarchy";
  if (firstLine.includes("?")) return "question";
  if (IDENTITY_MARKER_PATTERN.test(firstLine)) return "callout";
  return "statement";
}

function classifyCloser(lastLine: string): StructureSignature["closer"] {
  if (lastLine.includes("저장해")) return "save";
  if (lastLine.includes("어때?")) return "ask";
  return "other";
}

/**
 * Reduces a post to the template it follows, so rewordings of the same skeleton still match.
 */
export function extractStructureSignature(content: string, firstComment?: string | null): StructureSignature {
  const lines = contentLines(content);
  const commentWords = (firstComment ?? "").trim().split(/\s+/).filter((word) => word.length > 0).slice(0, 2);
  return {
    opener: classifyOpener(lines),
    hasNumberedChoices: /^\s*1[.)]\s/m.test(content),
    closer: classifyCloser(lines[lines.length - 1] ?? ""),
    commentOpener: commentWords.length > 0 ? commentWords.join(" ") : null,
  };
}

type TemplateMark = "opener:hierarchy" | "closer:save" | "closer:ask";

const TEMPLATE_MARK_LABELS: Record<TemplateMark, string> = {
  "opener:hierarchy": "'X보다 센 건 Y' 서열 첫 줄",
  "closer:save": "'저장해' 마무리",
  "closer:ask": "'어때?' 마무리",
};

// Only the old template features count. Clean skeletons repeat naturally across modes and are not a problem;
// counting them forced retries whose easiest escape was re-adding a template feature.
function templateMarks(signature: StructureSignature): TemplateMark[] {
  const marks: TemplateMark[] = [];
  if (signature.opener === "hierarchy") marks.push("opener:hierarchy");
  if (signature.closer === "save") marks.push("closer:save");
  if (signature.closer === "ask") marks.push("closer:ask");
  return marks;
}

/**
 * Flags a candidate that reuses a template feature or the first-comment opener of the most recent posts.
 */
export function checkStructureRepeat(
  candidateContent: string,
  candidateFirstComment: string | null | undefined,
  recentPosts: RecentPostSummary[],
  options?: { window?: number; maxSame?: number }
): SimilarityCheckResult {
  const candidate = extractStructureSignature(candidateContent, candidateFirstComment);
  const recent = recentPosts
    .slice(0, options?.window ?? 5)
    .map((post) => extractStructureSignature(post.content, post.firstComment));
  const maxSame = options?.maxSame ?? 1;
  const repeatedMark = templateMarks(candidate).find(
    (mark) => recent.filter((signature) => templateMarks(signature).includes(mark)).length > maxSame
  );
  if (repeatedMark) {
    return { isDuplicate: true, similarityScore: 1, reason: `최근 글들과 같은 틀(${TEMPLATE_MARK_LABELS[repeatedMark]}) 반복: 이번엔 그 틀 없이 써라. 물음표·번호 선택지·'저장해'/'어때?'를 덧붙여 피하지 말고 첫 줄 시작 방식(숫자·통념 반박·호명)을 바꿔라` };
  }
  if (candidate.commentOpener && recent.some((signature) => signature.commentOpener === candidate.commentOpener)) {
    return { isDuplicate: true, similarityScore: 1, reason: `첫 댓글 첫마디 "${candidate.commentOpener}"가 최근 글과 같음: 다른 말로 시작해라` };
  }
  return { isDuplicate: false, similarityScore: 0 };
}
