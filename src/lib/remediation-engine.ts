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

  const anthropic = new Anthropic({ apiKey });

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
5. 첫 줄은 60자 이내 단독 줄로, 140자를 넘는 줄을 만들지 말고, 전체 450자 이내로 유지하십시오.
6. 완성된 Threads 본문 텍스트만 출력하십시오. 설명이나 서론/결론은 금지합니다.

[원문 초안]
${content}`;

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_GENERATION_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 600,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block && block.type === "text" && block.text.trim()) {
      return {
        content: block.text.trim(),
        firstComment,
      };
    }
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

  // Step 2: 1-Token Targeted Rewrite (Focus strictly on weakest dimension)
  const dims = [
    heuristicScore.dimensions.hookTension,
    heuristicScore.dimensions.conversationDepth,
    heuristicScore.dimensions.humanVoice,
    heuristicScore.dimensions.penaltyRisk,
    heuristicScore.dimensions.formatReadability,
  ];

  const weakest = dims.reduce((prev, curr) => {
    const prevDeficit = prev.maxScore - prev.score;
    const currDeficit = curr.maxScore - curr.score;
    return currDeficit > prevDeficit ? curr : prev;
  });

  const fixInstruction = heuristicScore.actionableFixes.length
    ? heuristicScore.actionableFixes.join(" / ")
    : `${weakest.name} 차원의 점수가 부족하므로 해당 요소를 보강하십시오.`;

  const rewritten = await executeTargetedRewrite(
    heuristicResult.content,
    heuristicResult.firstComment,
    {
      name: weakest.name,
      score: weakest.score,
      maxScore: weakest.maxScore,
      actionableFix: fixInstruction,
    },
    context
  );

  // Re-run heuristic patch on rewritten content (in case LLM added URLs or artifacts)
  const finalClean = applyHeuristicFixes(rewritten.content, rewritten.firstComment);
  const finalScore = scoreThreadsPostAlgorithmic(finalClean.content, finalClean.firstComment);

  const isPass = finalScore.totalScore >= threshold;

  return {
    content: finalClean.content,
    firstComment: finalClean.firstComment,
    scoreResult: finalScore,
    pass: isPass,
    method: isPass ? "TARGETED_REWRITE" : "FAILED_QUARANTINED",
    rewriteCount: 1,
    actionableFixes: finalScore.actionableFixes,
  };
}
