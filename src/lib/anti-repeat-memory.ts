/**
 * Anti-Repeat Memory Engine
 * Prevents repetitive angles, identical hooks, and duplicate structures across recent posts.
 * Inspired by autoTHREADS recent-post anti-repeat memory.
 */

export interface RecentPostSummary {
  content: string;
  topic?: string | null;
  hookType?: string | null;
  ctaType?: string | null;
  campaignFormulaId?: string | null;
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
