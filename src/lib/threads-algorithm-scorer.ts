/**
 * Pre-Publish 5D Algorithmic Velocity Predictor (Threadify Score Equivalent)
 *
 * Evaluates draft posts across 5 key dimensions derived from 2026 Meta Threads algorithm dynamics:
 * 1. Hook Tension (25 pts): Curiosity gap, contrast, hierarchy comparisons
 * 2. Conversation Depth (25 pts): Open dilemma, multi-choice, reply friction reduction
 * 3. Human Voice Heuristic (20 pts): Anti-AI slop compliance and sentence burstiness
 * 4. Algorithmic Penalty Risk (15 pts): Links in body, policy triggers, overclaims
 * 5. Format & Spacing (15 pts): Mobile scannability, paragraph breath, sweet-spot length
 *
 * Minimum passing score: 80 / 100
 */

import { validateAntiSlop, validateBurstiness } from "@/lib/marketing-skills";
import { checkMetaPolicySafety } from "@/lib/meta-policy-guard";
import { IDENTITY_MARKER_PATTERN, hasFortuneOverclaim, hasReplyBurdenPromise } from "@/lib/viral-intent-modes";
import { isFlatEnglishHook } from "@/lib/quality-gate";

export interface AlgorithmicDimensionScore {
  name: string;
  score: number;
  maxScore: number;
  strengths: string[];
  weaknesses: string[];
}

export interface AlgorithmicPredictionResult {
  totalScore: number; // 0 ~ 100
  lintScore: number;  // Alias for static heuristic lint score
  pass: boolean; // >= 80
  /**
   * Static heuristic lint indicator (0.0 ~ 1.0).
   * Note: This represents content rule conformance, not an empirical distribution guarantee.
   */
  escapeVelocityProbability: number;
  dimensions: {
    hookTension: AlgorithmicDimensionScore;
    conversationDepth: AlgorithmicDimensionScore;
    humanVoice: AlgorithmicDimensionScore;
    penaltyRisk: AlgorithmicDimensionScore;
    formatReadability: AlgorithmicDimensionScore;
  };
  actionableFixes: string[];
}

// "vs" is a Korean-only contrast reward: the English hook rule forbids it.
const HOOK_VS = /\svs\s/i;
const HOOK_CONTRAST_PATTERNS = [
  /보다\s*센/,
  // "감정보다 먼저": the comparison the reversal-opener cap steers drafts to ("보다가" is not one)
  /[가-힣]보다(?=[\s.,!?]|$)/,
  /비교/,
  /상식/,
  /불편한\s*진실/,
  /차이/,
  /반전/,
  /착각/,
  // Korean contrarian framing the generation prompt asks for ("통념 반박")
  /반대/,
  /통념/,
  /아니라/,
];
// Korean first lines keep these English-word and "?" rewards; English first lines are scored on
// isFlatEnglishHook instead, because rewarding them produced "Is your birth hour actually wrong, instead?".
const ENGLISH_CONTRAST_WORDS = /\b(wrong|myth|not\s+your|isn't|actually|really|instead|different)\b/i;
const QUESTION_MARK = /\?/;

const HOOK_CURIOSITY_PATTERNS = [
  /상상해/,
  /혹시/,
  /사실/,
  /진짜/,
  /이유/,
  /비밀/,
  /왜\s*그럴까/,
  /충격/,
  /\b(probably|might|nobody|most\s+people|here's\s+why|born\s+in|to\s+(?:every|all))\b/i,
  /\d+\s*(?:명|%|년|개월|개|번|만|억|살|시간)/,
  IDENTITY_MARKER_PATTERN,
  /(?:^|\s)너(?:는|가|넨|네|희)?(?=[\s,.?!]|$)/,
];

const CONVERSATION_CHOICE_PATTERNS = [
  /^\s*1\./m,
  /^\s*2\./m,
  /A\s*vs\s*B/i,
  /전자\s*vs\s*후자/,
  /골라/,
  /투표/,
  /선택/,
  /^\s*[A-C][).:]\s/m,
];

const CONVERSATION_INVITATION_PATTERNS = [
  /댓글/,
  /어때\?/,
  /있어\?/,
  /남겨/,
  /어디\s*해당/,
  /어느\s*쪽/,
  /의견/,
  /공감/,
  // Korean questions often end in -인가/-일까/-할까 without a question mark
  /(?:인가|일까|할까)[.!]?\s*$/m,
  /\b(which\s+one|are\s+you|comment|send\s+this|tag\s+(?:a|your)|drop\s+your)\b/i,
  /(?:^|\s)너(?:는|넨|네|희|가)?\s[^\n]*\?/,
];

const URL_PATTERN = /https?:\/\/[^\s]+/i;

/**
 * Evaluates a draft post across 5 dimensions and calculates algorithmic escape velocity.
 */
export function scoreThreadsPostAlgorithmic(
  content: string,
  firstComment: string | null = null
): AlgorithmicPredictionResult {
  const actionableFixes: string[] = [];

  // ==========================================
  // Dimension 1: Hook Tension (Max 25)
  // ==========================================
  const firstLine = content.split("\n")[0]?.trim() || "";
  let hookScore = 10;
  const hookStrengths: string[] = [];
  const hookWeaknesses: string[] = [];

  const isEnglishFirstLine = !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(firstLine);
  const hasFlatEnglishHook = isEnglishFirstLine && isFlatEnglishHook(firstLine);
  const hasContrast = HOOK_CONTRAST_PATTERNS.some((p) => p.test(firstLine)) ||
    (!isEnglishFirstLine && (HOOK_VS.test(firstLine) || ENGLISH_CONTRAST_WORDS.test(firstLine)));
  const hasCuriosity = HOOK_CURIOSITY_PATTERNS.some((p) => p.test(firstLine)) ||
    (!isEnglishFirstLine && QUESTION_MARK.test(firstLine));

  if (hasContrast) {
    hookScore += 8;
    hookStrengths.push("강력한 대비/서열 비교 훅 적용됨 (+8)");
  }
  if (hasCuriosity) {
    hookScore += 7;
    hookStrengths.push("호기심 갭 및 질문형 훅 적용됨 (+7)");
  }
  if (hasFlatEnglishHook) {
    hookScore += 8;
    hookStrengths.push("영문 첫 줄이 60자 이하 평서문 (+8)");
  }

  if (firstLine.length > 60) {
    hookScore -= 5;
    hookWeaknesses.push("첫 문장이 60자를 초과하여 피드 스크롤 중 이탈 유발 (-5)");
    actionableFixes.push("첫 문장 길이를 40자 이내로 압축하여 스크롤 스탑 확률을 높이십시오.");
  }

  if (!hasContrast && !hasCuriosity && !hasFlatEnglishHook) {
    hookWeaknesses.push("첫 문장에 긴장감(대비/호기심 갭)이 부족함");
    actionableFixes.push("첫 줄에 구체 숫자, 특정 살/일주 호명, 통념 반박 중 하나를 넣으십시오.");
  }
  hookScore = Math.max(0, Math.min(25, hookScore));

  // ==========================================
  // Dimension 2: Conversation Depth (Max 25)
  // ==========================================
  let convScore = 8;
  const convStrengths: string[] = [];
  const convWeaknesses: string[] = [];

  // A closing direct question is the same one-second reply device as numbered choices; once choices are
  // capped (readability template cap) drafts end this way, and scoring it lower dropped them under 80.
  const lastLine = content.split("\n").map((line) => line.trim()).filter(Boolean).pop() ?? "";
  const hasChoice = CONVERSATION_CHOICE_PATTERNS.some((p) => p.test(content)) || /[?？]$/.test(lastLine);
  const hasInvitation = CONVERSATION_INVITATION_PATTERNS.some((p) => p.test(content));
  // "한 줄로 적어줘" style asks invite a reply as much as a question mark does
  const hasFirstCommentPrompt = firstComment && /\?|댓글|적어|알려줘|말해줘/.test(firstComment);

  if (hasChoice) {
    convScore += 9;
    convStrengths.push("선택지(1, 2) 또는 양자택일 구조로 댓글 마찰력 최소화 (+9)");
  }
  if (hasInvitation) {
    convScore += 5;
    convStrengths.push("명시적 댓글 참여 유도 어휘 포함 (+5)");
  }
  if (hasFirstCommentPrompt) {
    convScore += 3;
    convStrengths.push("2단계 후속 핑퐁 점화 댓글 구성됨 (+3)");
  }

  if (!hasChoice && !hasInvitation) {
    convWeaknesses.push("독자가 1초 만에 답변할 수 있는 쉬운 대화 유발 장치 부재");
    actionableFixes.push("본문 끝에 독자에게 직접 묻는 한 문장을 두십시오.");
  }
  convScore = Math.max(0, Math.min(25, convScore));

  // ==========================================
  // Dimension 3: Human Voice Heuristic (Max 20)
  // ==========================================
  let voiceScore = 20;
  const voiceStrengths: string[] = [];
  const voiceWeaknesses: string[] = [];

  const antiSlopRes = validateAntiSlop(content);
  if (!antiSlopRes.pass) {
    voiceScore -= (10 - antiSlopRes.score) * 1.5;
    voiceWeaknesses.push(...antiSlopRes.issues);
    actionableFixes.push("AI 클리셰 단어(혁신적인, 살펴보겠습니다 등)를 일상 대화체로 변경하십시오.");
  } else {
    voiceStrengths.push("AI 클리셰 단어 없는 깨끗한 문체 (+10)");
  }

  const burstinessRes = validateBurstiness(content);
  if (!burstinessRes.pass && burstinessRes.issue) {
    voiceScore -= 5;
    voiceWeaknesses.push(burstinessRes.issue);
    actionableFixes.push("문장 길이를 다양화하여 인간적인 리듬(Burstiness)을 만드십시오.");
  } else {
    voiceStrengths.push("다채로운 문장 길이 분포 (인간적 리듬 유지, +5)");
  }
  voiceScore = Math.max(0, Math.min(20, Math.round(voiceScore)));

  // ==========================================
  // Dimension 4: Algorithmic Penalty Risk (Max 15)
  // ==========================================
  let penaltyScore = 15;
  const penaltyStrengths: string[] = [];
  const penaltyWeaknesses: string[] = [];

  // 1. Body link deduction (Severe -10)
  if (URL_PATTERN.test(content)) {
    penaltyScore -= 10;
    penaltyWeaknesses.push("본문에 외부 링크 감지됨 (알고리즘 배제 리스크, -10)");
    actionableFixes.push("본문 링크를 전면 삭제하고 프로필 바이오 또는 오토플러그로 대체하십시오.");
  } else {
    penaltyStrengths.push("본문 외부 링크 무결성 확보 (+5)");
  }

  // 2. Meta policy trigger check
  const policyRes = checkMetaPolicySafety(content);
  if (!policyRes.pass) {
    penaltyScore -= 8;
    penaltyWeaknesses.push(`메타 정책 주의 키워드 감지: ${policyRes.recommendations.join(", ")} (-8)`);
    actionableFixes.push("메타 금융/의료/사기 탐지 키워드를 완곡한 표현으로 정화하십시오.");
  } else {
    penaltyStrengths.push("메타 2026 커뮤니티 정책 안전선 준수 (+5)");
  }

  // 3. Overclaims
  if (hasFortuneOverclaim(content) || hasReplyBurdenPromise(content)) {
    penaltyScore -= 4;
    penaltyWeaknesses.push("과장 단언 또는 피로도 높은 댓글 유도 감지 (-4)");
  }
  penaltyScore = Math.max(0, Math.min(15, penaltyScore));

  // ==========================================
  // Dimension 5: Format & Readability (Max 15)
  // ==========================================
  let formatScore = 15;
  const formatStrengths: string[] = [];
  const formatWeaknesses: string[] = [];

  const charCount = content.length;
  if (charCount < 80) {
    formatScore -= 5;
    formatWeaknesses.push("분량이 너무 짧아 정보 가치 부족 (-5)");
    actionableFixes.push("최소 100자 이상으로 맥락을 보강하십시오.");
  } else if (charCount > 450) {
    formatScore -= 4;
    formatWeaknesses.push("모바일 피드 스크롤 피로 유발 분량 (-4)");
  } else {
    formatStrengths.push("모바일 스크롤에 최적화된 호흡 (100~400자, +8)");
  }

  const lines = content.split("\n");
  const hasDenseWall = lines.some((line) => line.length > 140);
  if (hasDenseWall) {
    formatScore -= 4;
    formatWeaknesses.push("140자 이상의 줄바꿈 없는 텍스트 블록 감지 (-4)");
    actionableFixes.push("1~2문장 단위로 엔터를 쳐서 단문 호흡을 만드십시오.");
  } else {
    formatStrengths.push("시각적 호흡이 원활한 단문 줄바꿈 배치 (+7)");
  }
  formatScore = Math.max(0, Math.min(15, formatScore));

  // Total Calculation
  const totalScore = hookScore + convScore + voiceScore + penaltyScore + formatScore;
  const pass = totalScore >= 80;

  // Logistic function for escape velocity: P(escape) = 1 / (1 + e^(-(score - 75)/8))
  const escapeVelocityProbability = Math.round((1 / (1 + Math.exp(-(totalScore - 75) / 8))) * 100) / 100;

  return {
    totalScore,
    lintScore: totalScore,
    pass,
    escapeVelocityProbability,
    dimensions: {
      hookTension: {
        name: "Hook Tension (훅 긴장감)",
        score: hookScore,
        maxScore: 25,
        strengths: hookStrengths,
        weaknesses: hookWeaknesses,
      },
      conversationDepth: {
        name: "Conversation Depth (대화 깊이)",
        score: convScore,
        maxScore: 25,
        strengths: convStrengths,
        weaknesses: convWeaknesses,
      },
      humanVoice: {
        name: "Human Voice (인간적 문체)",
        score: voiceScore,
        maxScore: 20,
        strengths: voiceStrengths,
        weaknesses: voiceWeaknesses,
      },
      penaltyRisk: {
        name: "Penalty Risk (알고리즘 감점 위험)",
        score: penaltyScore,
        maxScore: 15,
        strengths: penaltyStrengths,
        weaknesses: penaltyWeaknesses,
      },
      formatReadability: {
        name: "Format & Readability (가독성/호흡)",
        score: formatScore,
        maxScore: 15,
        strengths: formatStrengths,
        weaknesses: formatWeaknesses,
      },
    },
    actionableFixes,
  };
}
