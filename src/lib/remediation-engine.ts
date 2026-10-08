/**
 * 2-Stage Hybrid Remediation Engine
 *
 * Automatically elevates draft posts to 80+ algorithmic escape velocity score
 * using 0-token deterministic heuristic patching first, followed by
 * 1-token targeted LLM rewriting for the weakest dimension if still under threshold.
 */

import {
  scoreThreadsPostAlgorithmic,
  type AlgorithmicPredictionResult,
} from "@/lib/threads-algorithm-scorer";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { FORMAL_TONE_PATTERN } from "@/lib/viral-intent-modes";

const URL_REGEX = /https?:\/\/[^\s]+/gi;

const META_TEXT_PATTERNS = [
  /자수\s*체크[^\n]*/gi,
  /글자\s*수\s*확인[^\n]*/gi,
  /500자\s*이하\s*통과[^\n]*/gi,
  /공백[·\s]*줄바꿈.*포함[^\n]*/gi,
  /Threads\s*본문\s*[:：]?[^\n]*/gi,
  /초안\s*작성\s*[:：]?[^\n]*/gi,
];

export interface HeuristicFixResult {
  content: string;
  firstComment: string | null;
  modified: boolean;
  changes: string[];
}

/**
 * 0-Token Heuristic Patcher (Instant, deterministic, zero cost)
 * - Moves body links to firstComment
 * - Removes residual meta / counting text
 * - Spacing & paragraph breath optimization
 */
export function applyHeuristicFixes(
  content: string,
  firstComment: string | null = null
): HeuristicFixResult {
  let modifiedContent = content;
  let modifiedComment = firstComment;
  let isModified = false;
  const changes: string[] = [];

  // 1. Move URL from content body to first comment (Meta algorithm penalty mitigation)
  const bodyUrls = modifiedContent.match(URL_REGEX);
  if (bodyUrls && bodyUrls.length > 0) {
    const primaryUrl = bodyUrls[0];
    modifiedContent = modifiedContent.replace(URL_REGEX, "").trim();
    if (!modifiedComment) {
      modifiedComment = `상세 내용 및 링크: ${primaryUrl}`;
    } else if (!modifiedComment.includes(primaryUrl)) {
      modifiedComment = `${modifiedComment}\n\n링크: ${primaryUrl}`.trim();
    }
    isModified = true;
    changes.push("본문 링크를 첫 댓글로 자동 이관 (+15점)");
  }

  // 2. Strip generator meta artifacts
  for (const pattern of META_TEXT_PATTERNS) {
    if (pattern.test(modifiedContent)) {
      modifiedContent = modifiedContent.replace(pattern, "").trim();
      isModified = true;
      changes.push("생성 메타 텍스트 라벨 제거");
    }
  }

  // 3. Format & paragraph spacing optimization
  // If continuous text has 3+ lines without empty lines, split into double-spaced blocks
  const rawLines = modifiedContent.split("\n");
  if (rawLines.length >= 3 && !modifiedContent.includes("\n\n")) {
    const spacedLines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      spacedLines.push(rawLines[i]);
      if ((i + 1) % 2 === 0 && i !== rawLines.length - 1) {
        spacedLines.push(""); // Insert empty line
      }
    }
    modifiedContent = spacedLines.join("\n").trim();
    isModified = true;
    changes.push("모바일 피드 가독성을 위한 단락 호흡 자동 분할 (+5~10점)");
  }

  // 4. Long first line with a dash: the part before the dash becomes a standalone hook (hook scoring caps line 1 at 60 chars)
  const [firstLine, ...restLines] = modifiedContent.split("\n");
  const dashMatch = firstLine.length > 60 ? firstLine.match(/^(.{10,60}?)\s*[—–]\s*(.+)$/) : null;
  if (dashMatch) {
    modifiedContent = [dashMatch[1].trim(), dashMatch[2].trim(), ...restLines].join("\n");
    isModified = true;
    changes.push("긴 첫 줄을 대시 기준으로 분리해 훅을 단독 줄로 배치");
  }

  // 5. Split lines over 140 chars at sentence boundaries (dense walls cost format points)
  const splitLines = modifiedContent.split("\n").flatMap((line) => (
    line.length > 140 ? line.split(/(?<=[.!?])\s+/) : [line]
  ));
  if (splitLines.length !== modifiedContent.split("\n").length) {
    modifiedContent = splitLines.join("\n");
    isModified = true;
    changes.push("140자 초과 줄을 문장 단위로 분할");
  }

  return {
    content: modifiedContent.replace(/\n{3,}/g, "\n\n").trim(),
    firstComment: modifiedComment ? modifiedComment.trim() : null,
    modified: isModified,
    changes,
  };
}

export interface RemediationResult {
  content: string;
  firstComment: string | null;
  scoreResult: AlgorithmicPredictionResult;
  pass: boolean;
  method: "INITIAL_PASS" | "HEURISTIC_PATCH" | "TARGETED_REWRITE" | "FAILED_QUARANTINED";
  rewriteCount: number;
  actionableFixes: string[];
}

/** Only text inside <post>…</post> counts as a rewrite; commentary or advice without the tag is rejected. */
export function extractRewrittenPost(raw: string): string | null {
  const body = raw.match(/<post>([\s\S]*?)<\/post>/i)?.[1]?.trim();
  return body ? body : null;
}

/**
 * 1-Token Targeted LLM Rewriter
 * Targets only the dimension with the largest point deficit.
 */
export async function executeTargetedRewrite(
  content: string,
  firstComment: string | null,
  weakestDimension: { name: string; score: number; maxScore: number; actionableFix: string },
  context?: { topic?: string; targetAudience?: string; productProfile?: string }
): Promise<{ content: string; firstComment: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // If no API key, return unedited
    return { content, firstComment };
  }

  // Without a timeout the SDK waits up to 10 minutes on a stalled request and blocks the whole batch.
  const anthropic = new Anthropic({ apiKey, timeout: 20000, maxRetries: 1 });

  const prompt = `당신은 Threads 알고리즘 최적화 수석 에디터입니다.
아래 포스트 초안의 본문 의미, 논지, 어조를 왜곡 없이 그대로 유지하면서 다음 1가지 약점만 즉시 수정하십시오.

[약점 및 수정 지침]
- 평가 차원: ${weakestDimension.name} (현재 ${weakestDimension.score}/${weakestDimension.maxScore}점)
- 개선 요구사항: ${weakestDimension.actionableFix}

[컨텍스트]
- 주제: ${context?.topic ?? "지정되지 않음"}
- 타겟 독자: ${context?.targetAudience ?? "지정되지 않음"}

[필수 작성 규칙]
1. 원문의 핵심 메시지와 사실관계를 훼손하지 마십시오.
2. 첫 문장의 긴장감(대비/호기심)을 강화하거나, 본문 끝에 독자가 즉각 반응할 수 있는 간결한 질문(양자택일 등)을 보강하십시오.
3. 본문에 링크(http/https)나 '자수 체크' 등의 사족을 일체 넣지 마십시오.
4. 원문 언어를 그대로 유지하십시오. 원문이 영어면 영어로만 출력하고 한글을 절대 쓰지 마십시오.
   원문이 반말/독백체(~야, ~임, ~했음)면 그 문체를 유지하고 ~습니다/~하세요 같은 존댓말로 바꾸지 마십시오.
5. 첫 줄은 60자 이내 단독 줄로, 140자를 넘는 줄을 만들지 말고, 전체 450자 이내로 유지하십시오.
6. 완성된 Threads 본문을 <post> 와 </post> 태그 사이에만 출력하십시오. 태그 밖에는 아무것도 쓰지 마십시오(설명, 수정 내역, 조언 금지).

[원문 초안]
${content}`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 3000,
      thinking: { type: "disabled" }, // short-form copy; thinking only adds latency and output tokens
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });

    const rewritten = extractRewrittenPost(readMessageText(response));
    if (rewritten) return { content: rewritten, firstComment };
    console.warn("[RemediationEngine] Rewrite had no <post> block (advice or commentary instead of a post); keeping the original.");
  } catch (error) {
    console.error("[RemediationEngine] Targeted LLM rewrite failed:", error);
  }

  return { content, firstComment };
}

/**
 * Executes the full 2-stage remediation loop:
 * Initial evaluation -> 0-Token Heuristic Patch -> 1-Token Targeted Rewrite -> Final decision.
 */
export async function remediatePostAlgorithmic(
  content: string,
  firstComment: string | null = null,
  context?: { topic?: string; targetAudience?: string; productProfile?: string },
  threshold = 80
): Promise<RemediationResult> {
  // Step 1: 0-Token Heuristic Patch (Strip body links, meta artifacts, format spacing)
  const heuristicResult = applyHeuristicFixes(content, firstComment);
  const heuristicScore = scoreThreadsPostAlgorithmic(
    heuristicResult.content,
    heuristicResult.firstComment
  );

  // If score passes after heuristic cleanup
  if (heuristicScore.totalScore >= threshold) {
    return {
      content: heuristicResult.content,
      firstComment: heuristicResult.firstComment,
      scoreResult: heuristicScore,
      pass: true,
      method: heuristicResult.modified ? "HEURISTIC_PATCH" : "INITIAL_PASS",
      rewriteCount: 0,
      actionableFixes: heuristicScore.actionableFixes,
    };
  }

  // Step 2: targeted rewrites, keeping the best-scoring draft
  let best = { ...heuristicResult, score: heuristicScore };
  let rewriteCount = 0;
  while (best.score.totalScore < threshold && rewriteCount < MAX_REWRITES) {
    const candidate = await rewriteOnce(best.content, best.firstComment, best.score, context);
    rewriteCount++;
    if (candidate.score.totalScore > best.score.totalScore && !introducesFormalTone(best.content, candidate.content)) {
      best = { ...best, ...candidate };
    }
  }

  const isPass = best.score.totalScore >= threshold;
  return {
    content: best.content,
    firstComment: best.firstComment,
    scoreResult: best.score,
    pass: isPass,
    method: isPass ? "TARGETED_REWRITE" : "FAILED_QUARANTINED",
    rewriteCount,
    actionableFixes: best.score.actionableFixes,
  };
}

const MAX_REWRITES = 2;

/** A rewrite must not turn a casual-voice draft into 존댓말. */
export function introducesFormalTone(before: string, after: string): boolean {
  return FORMAL_TONE_PATTERN.test(after) && !FORMAL_TONE_PATTERN.test(before);
}
// The scorer's fix hints are Korean-pattern advice; English drafts get the rubric itself.
const ENGLISH_REWRITE_CHECKLIST = [
  "Line 1: one standalone line under 60 characters that ends with '?' and contains one of: wrong, actually, not, instead, myth.",
  "Whole post under 430 characters, no line over 140 characters, blank line between ideas.",
  "Keep the closing 'A) ' and 'B) ' option lines and the final line 'Which one are you?'.",
  "Write in English only.",
].join(" ");

async function rewriteOnce(
  content: string,
  firstComment: string | null,
  score: AlgorithmicPredictionResult,
  context?: { topic?: string; targetAudience?: string; productProfile?: string }
) {
  const weakest = Object.values(score.dimensions).reduce((prev, curr) => (
    curr.maxScore - curr.score > prev.maxScore - prev.score ? curr : prev
  ));
  const isEnglish = !/[가-힣]/.test(content);
  const actionableFix = isEnglish
    ? ENGLISH_REWRITE_CHECKLIST
    : score.actionableFixes.length
      ? score.actionableFixes.join(" / ")
      : `${weakest.name} 차원의 점수가 부족하므로 해당 요소를 보강하십시오.`;
  const rewritten = await executeTargetedRewrite(content, firstComment, { ...weakest, actionableFix }, context);
  // Re-run heuristic patch on rewritten content (in case LLM added URLs or artifacts)
  const clean = applyHeuristicFixes(rewritten.content, rewritten.firstComment);
  return { content: clean.content, firstComment: clean.firstComment, score: scoreThreadsPostAlgorithmic(clean.content, clean.firstComment) };
}
