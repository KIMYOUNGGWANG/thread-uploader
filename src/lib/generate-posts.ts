import type { Brand } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { formatCreatorPatternContext } from "@/lib/creator-prompt-patterns";
import { formatGrowthPromptContext, parseStoredGrowthMemory } from "@/lib/growth-learning";
import { findProhibitedPhrases, readProhibitedPhrases } from "@/lib/trend-radar/negative-pattern-learner";
import { formatTrendRadarContext, readTrendRadar } from "@/lib/trend-radar/trend-radar-memory";
import { isValidCampaignLandingUrl } from "@/lib/product-auto-setup";
import { checkQuality, type QualityResult } from "@/lib/quality-gate";
import {
  checkAntiRepeatSimilarity,
  checkStructureRepeat,
  extractStructureSignature,
  formatAntiRepeatContext,
  type RecentPostSummary,
} from "@/lib/anti-repeat-memory";
import { THREADS_CONTENT_MAX_LENGTH, THREADS_CONTENT_TARGET_LENGTH, THREADS_MULTI_PART_MAX_LENGTH } from "@/lib/threads-limits";
import { buildAdmissionFirstComment, buildConversationIgniterComment } from "@/lib/charlie-viral-skills";
import { buildShortRedirectUrl, buildTrackedUrl } from "@/lib/tracking-url";
import { selectLearnedFormula } from "@/lib/thompson-sampling-router";
import { isLeanSprintRun, selectCampaignFormulaForViralMode, selectLeanViralMode } from "@/lib/lean-mode-selector";
import { splitContentIntoThreadParts } from "@/lib/thread-splitter";
import {
  ENGLISH_VIRAL_MODE_LABELS,
  formatViralIntentModePrompt,
  hasFortuneOverclaim,
  hasReplyBurdenPromise,
  resolveViralIntentMode,
  selectViralIntentMode,
  type ViralIntentMode,
  type ClosingFormat,
  CLOSING_FORMAT_PROMPT_KO,
  NEW_YEAR_MODES,
  pickClosingFormat,
  REFERENCE_REPLAY_MODE,
  WINNER_REPLAY_MODE,
} from "@/lib/viral-intent-modes";
import { NEW_YEAR_BRANDS, newYearSlotMode, type NewYearModeId } from "@/lib/new-year/new-year-season";
import { buildNewYearBrief, buildNewYearLink, checkNewYearFacts, newYearFirstComment } from "@/lib/new-year/new-year-content";
import { formatViralPromptContext } from "@/lib/viral-analysis";
import {
  formatMarketingSkillsPrompt,
  type HookArchetype,
  type ContentPillar,
} from "@/lib/marketing-skills";
import { getActiveCampaign, parseBrandConfig } from "@/types/brand";
import type { BrandConfig, CampaignConfig, QualityProfileId } from "@/types/brand";
import { parseViralMemory } from "@/types/viral";
import { findBorrowedYearBoundaryClaim, findFormulaShapeViolation, getDomainPreset, normalizeIpchunSpelling } from "@/lib/domain-registry";
import { resolveDynamicContext, isRelationshipTopic, planTopicQuota } from "@/lib/context-matrix-engine";
import { remediatePostAlgorithmic } from "@/lib/remediation-engine";
import { reconcileRemediation } from "@/lib/remediation-regate";
import { findSaturatedTopics, formatSaturationReason, isSituationSaturated, SATURATION_WINDOW } from "@/lib/topic-saturation-guard";
import { coupleCtaToLink, shouldLinkAt } from "@/lib/link-cadence";
import { parseStructuredPostOutput, generateCardUrlsForPost } from "@/lib/structured-generator";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { judgeEnglishNaturalness } from "@/lib/english-naturalness";
import { judgeReadability } from "@/lib/readability-judge";
import { checkReadabilityRules, checkTemplateCap, opensWithReversal, tightenChoiceLines } from "@/lib/readability-rules";
import { lengthGateReason, lengthPromptLines, loadLengthExperimentState, planLengthArms, shuffleArms } from "@/lib/length-experiment";
import { INSTAGRAM_BIO_ANCHOR_STATUS } from "@/lib/instagram-bio-anchor";
import { hasGeneratedMeta } from "@/lib/generated-meta-patterns";
import { loadWinnerReplaySource, WINNER_REPLAY_SOURCE_PREFIX } from "@/lib/winner-replay";
import { REFERENCE_REPLAY_SOURCE_PREFIX } from "@/lib/reference-replay";
import type { LengthArm } from "@/types/length-experiment";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20000,
  maxRetries: 1, // generateOne already retries 429/529/timeouts with backoff
});
const SEPARATOR = "===FIRST_COMMENT===";
const RETRYABLE_STATUSES = new Set([429, 529]);
const RECENT_POST_AVOIDANCE_COUNT = 24;
const POST_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours between posts

interface GrowthExperiment {
  // Pre-registered length experiment arm for this draft (docs/experiments/2026-10-16-post-length.md).
  lengthTarget?: LengthArm;
  formula: GenerationFormula;
  topic: string;
  targetAudience: string;
  situation: string;
  hookType: string;
  ctaType: string;
  angleVariation?: string;
  structureVariation?: string;
  viralIntentMode?: ViralIntentMode;
  qualityProfile: QualityProfileId;
  campaign: CampaignConfig | null;
  campaignFormulaId: string | null;
  shouldLink: boolean;
  sequenceIndex?: number;
  closingFormat?: ClosingFormat;
  // The "X가 아니라 Y" opener cap is already hit, so the prompt forbids that opener up front.
  reversalCapped?: boolean;
  // Content of a high-view past post whose structure the winner_replay draft follows.
  winnerReference?: string;
  // The reference is another account's post (ref_replay), not our own winner, so the prompt words it differently.
  referenceReplay?: true;
  // 2027 New Year season slot: the mode and the only saju values the draft may use (src/lib/new-year).
  newYearMode?: NewYearModeId;
  newYearSlotIndex?: number;
  newYearBrief?: string;
}

interface GenerationFormula {
  id: string;
  name: string;
  weight: number;
  instruction: string;
}

type CampaignGrowthExperiment = GrowthExperiment & { campaign: CampaignConfig };
type RecentPostForPrompt = {
  content: string;
  topic: string | null;
  hookType: string | null;
  ctaType: string | null;
  campaignFormulaId: string | null;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildFormulaPool(
  formulas: GenerationFormula[],
  dbWeights: Record<string, number>
): GenerationFormula[] {
  const pool: GenerationFormula[] = [];
  for (const formula of formulas) {
    const weight = dbWeights[formula.id] ?? formula.weight;
    for (let i = 0; i < weight; i++) pool.push(formula);
  }
  return pool;
}

function cleanGeneratedContentLabels(content: string): string {
  let cleaned = content
    // Remove separator residue
    .replace(/===FIRST_COMMENT===/gi, "")
    // Remove markdown headers with emojis and keywords: # 📌 THREADS POST, ## Threads Post etc.
    .replace(/^\s*#+\s*[^#\n]*(?:Threads|스레드|포스트|Post|본문|초안)[^\n]*\n+/gi, "")
    // Remove leading horizontal rules with labels: --- **본문**
    .replace(/^\s*---\s*\n+\s*(?:\*\*)?본문(?:\*\*)?\s*\n+/gi, "")
    // Remove leading labels like [본문], **본문**, Threads 본문:
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:\[)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\s*[-:：][^\]\n]*)?(?:\])?(?:\*\*)?\s*[:：]?\s*/gi, "")
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\*\*)?\s*[:：]?\s*/gi, "")
    .replace(/^#+\s*(?:본문|Threads\s*본문|Threads\s*포스트|Threads\s*Post|첫\s*댓글)[^\n]*\n+/gi, "")
    // Remove standalone leading horizontal rules
    .replace(/^\s*---\s*\n+/g, "")
    // Remove trailing generation checklist/metadata sections
    .replace(/\n\s*---\s*\n+\s*(?:\*\*)?(?:생성\s*완료|자수|포맷|훅\s*유형|규격|체크리스트|검증)[\s\S]*$/gi, "")
    // Remove trailing horizontal rule
    .replace(/\n+\s*---\s*$/gi, "")
    .trim();

  // If still starts with **본문** or similar standalone line
  cleaned = cleaned.replace(/^\s*\*\*본문\*\*\s*\n+/gi, "").trim();

  return normalizeIpchunSpelling(tightenChoiceLines(cleaned));
}

function enforceGeneratedSurfaceSafety<T extends QualityResult>(
  qualityResult: T,
  result: { post: string; firstComment: string },
  isEnglish = false
): T {
  const reasons = [...qualityResult.reasons];
  const surface = [result.post, result.firstComment].join("\n");
  if (isEnglish && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(surface) && !reasons.includes("영문 프로필에 한글 문자 포함 (Zero Hangul 위반)")) {
    reasons.unshift("영문 프로필에 한글 문자 포함 (Zero Hangul 위반)");
  }
  if (result.post.length > THREADS_MULTI_PART_MAX_LENGTH && !reasons.some((r) => r.includes("2400자") || r.includes("제한 초과"))) {
    reasons.unshift(`본문 ${result.post.length}자 - 5단 스레드 최대 허용(2,400자) 초과`);
  }
  if (hasReplyBurdenPromise(surface) && !reasons.includes("reply-burden CTA 포함")) {
    reasons.unshift("reply-burden CTA 포함");
  }
  if (hasFortuneOverclaim(surface) && !reasons.includes("overclaim 운세/상대 마음 보장 표현 포함")) {
    reasons.unshift("overclaim 운세/상대 마음 보장 표현 포함");
  }
  if (hasGeneratedMeta(surface) && !reasons.includes("generated meta text 포함")) {
    reasons.unshift("generated meta text 포함");
  }
  return reasons.length === qualityResult.reasons.length
    ? qualityResult
    : { ...qualityResult, pass: false, reasons };
}

function ensureMaxThreadsLength(content: string): string {
  if (content.length <= THREADS_MULTI_PART_MAX_LENGTH) return content;
  const lines = content.trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const isHashtag = lastLine.startsWith("#");
  const hashtagSuffix = isHashtag ? "\n\n" + lastLine : "";
  const bodyText = isHashtag ? lines.slice(0, -1).join("\n") : content;
  const maxBodyLen = THREADS_MULTI_PART_MAX_LENGTH - hashtagSuffix.length;

  if (bodyText.length > maxBodyLen) {
    const truncated = bodyText.slice(0, maxBodyLen);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf(".\n"),
      truncated.lastIndexOf("? "),
      truncated.lastIndexOf("?\n"),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("!\n")
    );
    if (lastSentenceEnd > 250) {
      return truncated.slice(0, lastSentenceEnd + 1).trim() + hashtagSuffix;
    }
    return truncated.trim() + hashtagSuffix;
  }
  return content;
}

async function generateOne(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  recentPostContext: string,
  qualityFeedback: string[] = [],
  retries = 5,
  delayMs = 3000
): Promise<{ post: string; firstComment: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        model: CLAUDE_TEXT_MODEL,
        max_tokens: 4000,
        output_config: { effort: "low" },
        system: config.systemPrompt,
        messages: [
          {
            role: "user",
            content: buildGenerationPrompt(experiment, config, growthContext, viralContext, recentPostContext, qualityFeedback),
          },
        ],
      });

      const raw = readMessageText(message);
      const parsed = parseStructuredPostOutput(raw);
      const post = cleanGeneratedContentLabels(parsed.content);
      let firstComment = cleanGeneratedContentLabels(parsed.firstComment);
      // Korean one-line questions are often under 15 characters; only a near-empty saju comment needs the fallback.
      const minimumCommentLength = experiment.qualityProfile === "saju_viral" ? 5 : 15;
      if (!firstComment || firstComment.length < minimumCommentLength) {
        firstComment = buildAdmissionFirstComment(post, {
          topic: experiment.topic,
          voiceProfile: config.voiceProfile,
        });
      }
      return { post, firstComment };
    } catch (err: unknown) {
      const status = typeof err === "object" && err !== null ? (err as { status?: number }).status : undefined;
      const isTimeout = err instanceof Error && (err.name === "APIConnectionTimeoutError" || err.message.toLowerCase().includes("timeout"));
      if (((status !== undefined && RETRYABLE_STATUSES.has(status)) || isTimeout) && attempt < retries) {
        console.warn(`API ${isTimeout ? "Timeout" : status} (attempt ${attempt}/${retries}). Retrying in ${delayMs * attempt}ms…`);
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error("generateOne: exceeded max retries");
}

async function generateWithQuality(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  recentPostContext: string,
  maxRetries = 2,
  recentPosts: RecentPostSummary[] = [],
  prohibitedPhrases: string[] = []
): Promise<{
  post: string;
  firstComment: string;
  conversationIgniter?: string;
  formulaId: string;
  topic: string;
  targetAudience: string;
  situation: string;
  hookType: string;
  ctaType: string;
  qualityScore: number;
  qualityProfile: QualityProfileId;
  qualityPass: boolean;
  qualityReasons: string[];
  campaignId: string | null;
  campaignFormulaId: string | null;
  careerDecisionType: string | null;
  shouldLink: boolean;
  lengthTarget?: LengthArm;
  newYearMode?: NewYearModeId;
  newYearSlotIndex?: number;
  regate: (post: string, firstComment: string) => Promise<QualityResult>;
}> {
  const isEnglish =
    experiment.qualityProfile === "ecommerce_d2c" ||
    config.voiceProfile?.language === "en" ||
    Boolean(config.productProfile?.productName?.toLowerCase().includes("global"));
  const qualityContext = {
    ...buildProductQualityContext(config, experiment.viralIntentMode?.id),
    ignoreFoldLength: Boolean(experiment.lengthTarget),
  };

  // One gate for the first draft, every retry, and the post-remediation re-check.
  // Word overlap and a shared skeleton both count as a repeat; the skeleton rules are Korean saju templates,
  // so other profiles only get the word-overlap check.
  const checkStructure = experiment.qualityProfile === "saju_viral";
  const runQualityGate = (post: string, firstComment: string): QualityResult => {
    let gate: QualityResult = enforceGeneratedSurfaceSafety(
      checkQuality(post, experiment.qualityProfile, qualityContext),
      { post, firstComment },
      isEnglish
    );
    // Phrases learned from bottom performers (cron/feedback) fail the gate so the retry prompt avoids them
    const prohibitedHits = findProhibitedPhrases(post, prohibitedPhrases);
    if (prohibitedHits.length > 0) {
      gate = { ...gate, pass: false, reasons: [`학습된 금지 문구 포함: ${prohibitedHits.join(", ")}`, ...gate.reasons] };
    }
    // Per-formula checks: batch siblings generate in parallel and can't see each other, so a claim owned by
    // another formula fails per draft; a draft that dropped its formula's own shape fails too.
    const formulaViolation = findBorrowedYearBoundaryClaim(experiment.formula.id, post) ?? findFormulaShapeViolation(experiment.formula.id, post);
    if (formulaViolation) {
      gate = { ...gate, pass: false, reasons: [formulaViolation, ...gate.reasons] };
    }
    // One angle must not take over the account (learnings 2026-09-03)
    const saturated = findSaturatedTopics(post, recentPosts.map((recent) => recent.content));
    if (saturated.length > 0) {
      gate = { ...gate, pass: false, reasons: [...saturated.map(formatSaturationReason), ...gate.reasons] };
    }
    if (recentPosts.length > 0) {
      const repeat = [
        checkAntiRepeatSimilarity(post, recentPosts),
        ...(checkStructure ? [checkStructureRepeat(post, firstComment, recentPosts)] : []),
      ].find((check) => check.isDuplicate && check.reason);
      if (repeat?.reason) {
        gate = { ...gate, pass: false, reasons: [repeat.reason, ...gate.reasons] };
      }
    }
    // A replay is compared with its source on its own: in the shared recent list it fell outside the 10-post window.
    if (experiment.winnerReference) {
      const copy = checkAntiRepeatSimilarity(post, [{ content: experiment.winnerReference }]);
      if (copy.isDuplicate) {
        gate = { ...gate, pass: false, reasons: [`승자 원본과 너무 비슷함: ${copy.reason ?? "유사도 과다"}`, ...gate.reasons] };
      }
    }
    // Posts auto-publish unreviewed, so saju values that disagree with the New Year data never pass.
    if (experiment.newYearMode) {
      const factProblems = checkNewYearFacts(post, experiment.newYearMode, experiment.newYearSlotIndex ?? 0);
      if (factProblems.length > 0) {
        gate = { ...gate, pass: false, reasons: [...factProblems, ...gate.reasons] };
      }
    }
    // A miss retries the same formula with the arm's band as feedback, and makes a too-short rewrite revert.
    const lengthReason = experiment.lengthTarget && config.lengthExperiment
      ? lengthGateReason(post, experiment.lengthTarget, config.lengthExperiment)
      : null;
    if (lengthReason) {
      gate = { ...gate, pass: false, reasons: [lengthReason, ...gate.reasons] };
    }
    // Saju jargon cap, unanswerable questions, invented first-person stories (cosmicpath Korean posts only)
    if (experiment.qualityProfile === "saju_viral") {
      const readability = checkReadabilityRules(post, firstComment);
      if (!readability.pass) {
        gate = { ...gate, pass: false, reasons: [...readability.reasons, ...gate.reasons] };
      }
      // Safety net for the template cap: reversal openers, and numbered choices from a formula other than the excluded one
      const template = checkTemplateCap(post, recentPosts.filter(countsTowardTemplateCap));
      if (!template.pass) {
        gate = { ...gate, pass: false, reasons: [...template.reasons, ...gate.reasons] };
      }
    }
    return gate;
  };

  // The LLM judges run only for drafts that already pass the sync gate (saves a call per failed draft):
  // English naturalness for English drafts, and readability for a non-saju reader on saju_viral drafts.
  // This is also the post-remediation regate, so a rewrite that fails a judge reverts to the judged original.
  const gateWithJudges = async (post: string, firstComment: string): Promise<QualityResult> => {
    let gate = runQualityGate(post, firstComment);
    if (!gate.pass) return gate;
    if (isEnglish) {
      const verdict = await judgeEnglishNaturalness(post);
      if (!verdict.natural) gate = { ...gate, pass: false, reasons: [`unnatural English: ${verdict.reason}`, ...gate.reasons] };
    }
    if (gate.pass && experiment.qualityProfile === "saju_viral") {
      const verdict = await judgeReadability(post, firstComment);
      if (!verdict.readable) gate = { ...gate, pass: false, reasons: [`읽힘 판정 실패: ${verdict.reason}`, ...gate.reasons] };
    }
    return gate;
  };

  let lastResult = await generateOne(experiment, config, growthContext, viralContext, recentPostContext);
  let qualityResult = await gateWithJudges(lastResult.post, lastResult.firstComment);

  for (let attempt = 1; attempt <= maxRetries && !qualityResult.pass; attempt++) {
    console.warn(`Quality FAIL (${qualityResult.profile}, score ${qualityResult.score}, attempt ${attempt}/${maxRetries}):`, qualityResult.reasons);
    lastResult = await generateOne(experiment, config, growthContext, viralContext, recentPostContext, qualityResult.reasons);
    qualityResult = await gateWithJudges(lastResult.post, lastResult.firstComment);
  }

  if (!qualityResult.pass) {
    // Throwing makes the batch loop skip this draft instead of saving a post that already failed the gate.
    throw new Error(`Quality gate failed after retries (${qualityResult.profile}, score ${qualityResult.score}): ${qualityResult.reasons.join(", ")}`);
  }

  const conversationIgniter = buildConversationIgniterComment(lastResult.post, {
    topic: experiment.topic,
    formulaId: experiment.formula.id,
    voiceProfile: config.voiceProfile,
    hookType: experiment.hookType,
  });

  return {
    post: lastResult.post,
    firstComment: lastResult.firstComment,
    conversationIgniter,
    formulaId: experiment.formula.id,
    topic: experiment.topic,
    targetAudience: experiment.targetAudience,
    situation: experiment.situation,
    hookType: experiment.hookType,
    ctaType: experiment.ctaType,
    qualityScore: qualityResult.score,
    qualityProfile: qualityResult.profile,
    qualityPass: qualityResult.pass,
    qualityReasons: qualityResult.reasons,
    campaignId: experiment.campaign?.id ?? null,
    campaignFormulaId: experiment.campaignFormulaId,
    careerDecisionType: qualityResult.careerDecisionType ?? null,
    shouldLink: experiment.shouldLink,
    lengthTarget: experiment.lengthTarget,
    newYearMode: experiment.newYearMode,
    newYearSlotIndex: experiment.newYearSlotIndex,
    regate: gateWithJudges,
  };
}

function buildExperiment(
  formula: GenerationFormula,
  topic: string,
  config: BrandConfig,
  campaign: CampaignConfig | null,
  index: number,
  viralIntentMode = selectViralIntentMode(index),
  contextDomainId?: string,
  contextOffset = 0,
  linkOffset = 0,
  recentSituations: Array<string | null | undefined> = []
): GrowthExperiment {
  const qualityProfile = campaign?.qualityProfile ?? config.qualityProfile ?? "saju_viral";
  const shouldLink = campaign
    ? campaign.perPostLinks && shouldLinkAt({ index, linkOffset, cadence: campaign.linkCadenceEvery ?? 1 })
    : Boolean(config.websiteUrl.trim());
  const defaultCtaTypes = qualityProfile === "career_decision"
    ? ["셀프체크", "저장 유도", "공유 유도", "프로필 확인"]
    : ["링크 확인", "저장 유도", "공유 유도", "프로필 확인"];
  const ctaTypeCandidates = (config.ctaTypes?.length ? config.ctaTypes : defaultCtaTypes)
    .filter((ctaType) => !hasReplyBurdenPromise(ctaType));
  const ctaTypes = coupleCtaToLink(ctaTypeCandidates.length ? ctaTypeCandidates : defaultCtaTypes, shouldLink);

  const contextOptions = {
    domainId: contextDomainId ?? qualityProfile,
    index: index + contextOffset,
    baseTopic: topic,
    userTarget: config.targets?.length ? pickRandom(config.targets) : undefined,
    userSituation: config.situations?.length ? pickRandom(config.situations) : undefined,
  };
  let dynamicContext = resolveDynamicContext({ ...contextOptions, contextWeights: config.contextWeights });
  // A friction already used twice in the recent window steps through the unweighted permutation instead,
  // so learned weights cannot turn one scenario into the whole feed.
  for (let attempt = 1; attempt <= SATURATION_WINDOW && isSituationSaturated(dynamicContext.friction, recentSituations); attempt++) {
    dynamicContext = resolveDynamicContext({ ...contextOptions, index: contextOptions.index + attempt });
  }

  return {
    formula,
    topic: dynamicContext.dynamicTopic,
    targetAudience: dynamicContext.targetAudience,
    situation: dynamicContext.situation,
    hookType: pickRandom(config.hookTypes?.length ? config.hookTypes : ["공감형 훅"]),
    ctaType: pickRandom(ctaTypes),
    viralIntentMode,
    qualityProfile,
    campaign,
    campaignFormulaId: campaign ? viralIntentMode.id : null,
    shouldLink,
    sequenceIndex: index,
  };
}

function buildGenerationPrompt(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  recentPostContext = "최근 생성 글 없음. 같은 첫 문장/같은 구조/같은 결론 반복은 피한다.",
  qualityFeedback: string[] = []
): string {
  const isEnglish =
    experiment.qualityProfile === "ecommerce_d2c" ||
    config.voiceProfile?.language === "en" ||
    Boolean(config.productProfile?.productName?.toLowerCase().includes("global"));

  const creatorPatternContext = formatCreatorPatternContext(experiment.hookType, experiment.ctaType);
  const lengthLines = experiment.lengthTarget ? lengthPromptLines(experiment.lengthTarget) : null;
  const viralIntentMode = experiment.viralIntentMode
    ?? resolveViralIntentMode(experiment.campaignFormulaId ?? experiment.formula.id, 0);
  const marketingSkillsContext = experiment.qualityProfile === "product_growth"
    ? formatMarketingSkillsPrompt({
        hookArchetype: mapToHookArchetype(experiment.hookType, experiment.sequenceIndex ?? 0),
        pillar: selectPillarForIndex(experiment.sequenceIndex ?? 0),
      })
    : null;

  const domainPreset = getDomainPreset(experiment.qualityProfile);
  const crossDomainGuardrails = domainPreset.forbiddenCrossDomainTerms.length > 0
    ? [
        isEnglish ? "[Cross-Domain Safety Guardrails]" : "[금지된 도메인 교차 용어 (Cross-Domain Safety Guardrail)]",
        isEnglish
          ? `- Do not include any of these forbidden terms or concepts in the post or comment: ${domainPreset.forbiddenCrossDomainTerms.join(", ")}`
          : `- 다음 단어/개념은 다른 도메인 용어이므로 본문과 댓글에 절대 포함해서는 안 됩니다: ${domainPreset.forbiddenCrossDomainTerms.join(", ")}`,
        "",
      ]
    : [];

  const languageMandate = isEnglish
    ? [
        "[CRITICAL LANGUAGE MANDATE - ABSOLUTE REQUIREMENT]",
        "- The entire output MUST be written strictly in fluent, natural English (US/UK English).",
        "- ZERO Korean characters (Hangul / 가-힣) are allowed anywhere in the post body or the first comment.",
        "- Both the main Threads post and the first comment must be 100% native, compelling English.",
        "",
      ]
    : [];

  const viralRules = isEnglish
    ? [
        "[Threads Viral Compression & High-Retention Hook Rules]",
        `- Target body length: ~${THREADS_CONTENT_TARGET_LENGTH} chars (approx 35-55 words / max ${THREADS_CONTENT_MAX_LENGTH} chars). Highly compressed and punchy.`,
        "- Hook within the first 100 characters before the feed fold. Stop the scroll instantly. No boring preamble, no lectures, no bullet lists.",
        "- [Charlie Hills 2-Line Contrast Hook]: Line 1 is a bold provocative assertion (<40 chars). Line 2 immediately delivers a counter-intuitive twist/contrast (<40 chars) shattering conventional wisdom.",
        "- [Single-Point Razor]: Focus on ONE contrarian insight. Never summarize or list multiple unfocused ideas.",
        "- [Focused Conflict]: Zero in on one specific persona friction and internal conflict.",
        "- [Zero-in-body URL]: Never place links or URLs inside the post body.",
        "- [Zero AI Slop]: Avoid cliché patterns like 'Here is the truth', 'Imagine if', 'Let's dive in', or checkbox emojis.",
        `- [Zero-Promo Conversation Igniter First Comment]: Below the delimiter (${SEPARATOR}), write 1-2 lines: a raw provocative question readers can answer from their own life. Never invent a personal story or confession, and never write sales pitches or spam links in the first comment.`,
        "- [Strictly No Meta Text]: Never output character counts, draft labels, headers (# Title), or explanations.",
      ]
    : [
        "[Threads 압축 바이럴 규격 및 12만 뷰 검증 구조]",
        lengthLines?.rule ?? `- 본문 목표 길이는 ${THREADS_CONTENT_TARGET_LENGTH}자 내외(이상적 범위: 140~240자, 최대 ${THREADS_CONTENT_MAX_LENGTH}자 이하)로 극도로 압축한다.`,
        `- 상단 100자(피드 접히기 전 Fold)에서 스크롤을 멈추게 해야 한다. 지루한 배경 설명, 훈계조 사주 강의, 불필요한 증상 나열(□)은 절대 금지한다.`,
        // Mirrors the template cap and the first-line chart gate: asking for a reversal or a 살·일주 callout here
        // produced drafts the gate then dropped.
        `- [Charlie Hills 2-Line Hook]: 첫 문장은 40자 이내의 대담한 단언(Opening)으로 시작하고, 바로 다음 줄은 40자 이내로 그 단언의 이유나 의외의 결과를 보여준다. 'X가 아니라 Y' 뒤집기 틀은 쓰지 않고, 비교가 필요하면 '~보다'를 한 번만 쓴다.`,
        "- [첫 줄 스크롤 멈춤]: 첫 줄은 누구나 겪어본 구체 상황이나 통념 반박으로 스크롤을 멈추게 한다. 숫자는 프롬프트에 주어진 것만 쓰고 지어내지 않는다. 첫 줄은 사주를 모르는 사람도 읽히게 쓰고, '신금 일주는', '일간이 ~', '도화살 있으면' 같은 독자 사주 전제로 시작하지 않는다. 살·일주는 둘째 줄 이후에 근거로만 쓴다. 최근 글에 쓰인 첫 줄 틀은 반복하지 않고, 평서문 끝에 억지로 물음표를 붙이지 않는다.",
        "- [Single-Point Razor]: 원문이나 여러 주제를 요약/나열하지 말고, 상식을 뒤집는 단 하나의 반직관적 주장(Contrarian Insight)에만 모든 문장을 집중할 것.",
        "- [Focused Conflict]: 타겟과 상황에 제시된 페르소나의 실전 마찰 1개만 깊게 파고들고, 여러 갈등이나 딜레마를 백화점식으로 나열하지 말 것.",
        "- [No Factual Hallucination]: 프롬프트에 제공되지 않은 가짜 개인 일화나 날조된 매출/사례 숫자를 지어내지 말고, 구조적 관찰과 냉철한 논리로 설득할 것.",
        "- [Zero-in-body URL]: 본문에는 절대 링크/URL을 넣지 않는다 (알고리즘 노출 패널티 방지).",
        "- [AI Slop 절대 금지]: 'AI한테 생년월일 넣었더니', '반박시 니 말이 맞음', '끝. 더 이상 설명 안 함', '핵심만 말해줌', '□ 나열 체크박스' 등 복제된 클리셰 문구는 즉시 품질 탈락 처리된다.",
        `- [Zero-Promo Conversation Igniter 첫 댓글]: 첫 댓글은 구분자(${SEPARATOR}) 바로 아래에 1~2줄로 작성한다. **[치명적 금지 규칙]** 첫 댓글에 '프로필 링크', '리포트', '판정표', '진단', 링크, 상업적 유도 문구를 절대 쓰지 마라 (Meta 알고리즘이 즉각 스팸 봇으로 판정하여 조회수를 0으로 락을 건다). 첫 댓글 방향은 바이럴 모드의 '첫 댓글:' 규칙을 따르고, '난 솔직히'로 시작하지 않으며 최근 글의 첫 댓글과 다른 말로 시작한다.`,
        "- [메타 텍스트 및 체크리스트 출력 절대 금지]: 글자 수 확인, 자수 체크, 초안, Threads 본문 같은 메타 텍스트를 절대 출력하지 않는다. 제목(# 제목), 구분선(---), '생성 완료', '포맷 체크', '본문/첫댓글 안내' 등 기획서용 메타 텍스트를 본문이나 첫 댓글에 단 한 줄도 출력하지 마라.",
      ];

  const sideMissionPrompt = config.sideMission
    ? isEnglish
      ? [
          "[Side Mission: Natural Sub-Promotion]",
          `- Mission: ${config.sideMission}`,
          "- Core rule: Never hard-sell or advertise openly. Weave in smoothly at the end or in the first comment only when context allows.",
          "",
        ]
      : [
          "[사이드 미션 (Side Mission: 자연스러운 서브 프로모션)]",
          `- 미션 내용: ${config.sideMission}`,
          "- 핵심 지침: 본문 전면에 절대 노골적 광고나 하드셀을 하지 마라. 글의 맥락이 자연스러울 때만 마지막 부분 또는 첫 댓글에 부드럽게 한 줄 녹여내라.",
          "",
        ]
    : [];

  const voiceProfilePrompt = config.voiceProfile
    ? isEnglish
      ? [
          "[Brand Voice Profile]",
          `- Tone: ${config.voiceProfile.tone}`,
          `- Perspective: ${config.voiceProfile.perspective}`,
          `- Sentence length / Rhythm: ${config.voiceProfile.sentenceLength} / ${config.voiceProfile.paragraphStyle}`,
          ...(config.voiceProfile.forbiddenPhrases.length ? [`- Forbidden phrases/tones: ${config.voiceProfile.forbiddenPhrases.join(", ")}`] : []),
        ]
      : [
          `[브랜드 고유 보이스 (Voice Profile)]`,
          `- 톤: ${config.voiceProfile.tone}`,
          `- 화자 관점: ${config.voiceProfile.perspective}`,
          `- 문장 길이/호흡: ${config.voiceProfile.sentenceLength} / ${config.voiceProfile.paragraphStyle}`,
          ...(config.voiceProfile.forbiddenPhrases.length ? [`- 금지 어조: ${config.voiceProfile.forbiddenPhrases.join(", ")}`] : []),
        ]
    : [];

  const enMode = isEnglish ? ENGLISH_VIRAL_MODE_LABELS[viralIntentMode.id] : null;
  const variationAngle = experiment.angleVariation ?? enMode?.label ?? viralIntentMode.label;
  const variationStructure = experiment.structureVariation ?? enMode?.instruction ?? viralIntentMode.instruction;
  const sanitizedRecentPostContext = isEnglish && recentPostContext.includes("최근 생성 글 없음")
    ? "No recent posts. Avoid repeating identical openings, hooks, or conclusions."
    : recentPostContext;

  function sanitizeEnglishField(text: string, fallback: string): string {
    const stripped = text.replace(/\([^)]*[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]+[^)]*\)/g, "").trim();
    if (/^[ㄱ-ㅎ|ㅏ-ㅣ|가-힣\s\d.,!?'"#-]+$/.test(stripped) || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(stripped)) {
      return fallback;
    }
    return stripped || fallback;
  }

  const enTopic = sanitizeEnglishField(experiment.topic, "Western Astrology vs Korean Saju: debunking birth chart myths");
  const enTarget = sanitizeEnglishField(experiment.targetAudience, "Western 22-36 Gen Z & Millennials (US, CA, UK, AU)");
  const enSituation = sanitizeEnglishField(experiment.situation, "Questioning why Western horoscopes fail to give concrete life answers");

  const experimentParams = isEnglish
    ? [
        `[Topic]\n${enTopic}`,
        `[Target Audience]\n${enTarget}`,
        `[Situation/Context]\n${enSituation}`,
        `[Hook Type]\n${experiment.hookType}`,
        `[CTA Type]\n${experiment.ctaType}`,
        `[Variation]\nAngle: ${variationAngle}\nStructure: ${variationStructure}`,
        ...(creatorPatternContext ? [creatorPatternContext] : []),
        `[Performance Memory]\n${growthContext}`,
        `[Viral Reference Memory]\n${viralContext}`,
        `[Recent Post Avoidance]\n${sanitizedRecentPostContext}`,
        ...formatQualityFeedback(qualityFeedback, true),
        "",
        `Combine the experimental conditions above and write 1 high-retention Threads post (~${THREADS_CONTENT_TARGET_LENGTH} chars, max ${THREADS_CONTENT_MAX_LENGTH} chars) STRICTLY IN ENGLISH. Output ${SEPARATOR} and immediately write the first comment in English below it.`,
        "Do NOT write actual URLs in the body or first comment. The system handles UTM tracking links.",
      ]
    : [
        `[주제]\n${experiment.topic}`,
        `[타겟 독자]\n${experiment.targetAudience}`,
        `[상황/맥락]\n${experiment.situation}`,
        `[훅 유형]\n${experiment.hookType}`,
        `[CTA 유형]\n${experiment.ctaType}`,
        `[이번 글 변주]\n각도: ${experiment.angleVariation ?? viralIntentMode.label}\n구조: ${experiment.structureVariation ?? viralIntentMode.instruction}`,
        ...(experiment.closingFormat ? [`[마무리 형식]\n${CLOSING_FORMAT_PROMPT_KO[experiment.closingFormat]}`] : []),
        ...(experiment.reversalCapped ? [REVERSAL_CAPPED_PROMPT_KO] : []),
        ...(creatorPatternContext ? [creatorPatternContext] : []),
        `[성과 학습 메모리]\n${growthContext}`,
        `[바이럴 레퍼런스 학습 메모리]\n${viralContext}`,
        `[최근 생성 글 회피]\n${recentPostContext}`,
        ...formatQualityFeedback(qualityFeedback, false),
        "",
        `${lengthLines?.request ?? `위 실험 조건을 조합해서 ${THREADS_CONTENT_TARGET_LENGTH}자 내외(140~240자, 최대 ${THREADS_CONTENT_MAX_LENGTH}자 이하) Threads 포스트 1개를 작성해줘.`} 작성 후 ${SEPARATOR} 를 출력하고, 바로 아래에 첫 댓글을 작성해줘.`,
        "본문과 첫 댓글에 실제 URL은 쓰지 마. 시스템이 저장 후 필요한 경우 UTM 링크를 붙인다.",
      ];

  // A New Year formula is built from the KO mode label, so an English prompt takes the English one.
  const enNewYearFormula = isEnglish && experiment.newYearMode ? ENGLISH_VIRAL_MODE_LABELS[experiment.newYearMode] : null;
  return [
    ...languageMandate,
    isEnglish ? `[Formula: ${enNewYearFormula?.label ?? experiment.formula.name}]` : `[공식: ${experiment.formula.name}]`,
    enNewYearFormula?.instruction ?? experiment.formula.instruction,
    "",
    ...formatProductPrompt(config),
    ...formatCampaignPrompt(experiment),
    formatViralIntentModePrompt(viralIntentMode, isEnglish),
    ...(experiment.winnerReference
      ? [`[참고 글: ${experiment.referenceReplay ? "다른 계정에서 반응이 좋았던 글. 구조만 따르고 주제·소재·문장은 새로 써" : "조회수가 높았던 글. 구조만 따르고 주제·문장은 새로 써"}]\n---\n${experiment.winnerReference}\n---`]
      : []),
    ...(experiment.newYearBrief
      ? [`${isEnglish
          ? "[New Year facts: use only these values; never invent other day masters, months or ganji]"
          : "[신년 자료: 이 값만 쓰고 다른 일간·달·간지를 지어내지 마]"}\n${experiment.newYearBrief}`]
      : []),
    ...(marketingSkillsContext ? [marketingSkillsContext] : []),
    ...crossDomainGuardrails,
    ...viralRules,
    ...sideMissionPrompt,
    ...voiceProfilePrompt,
    ...experimentParams,
  ].join("\n");
}

function mapToHookArchetype(hookType: string, sequenceIndex: number): HookArchetype {
  const lower = hookType.toLowerCase();
  if (lower.includes("호기심") || lower.includes("curiosity")) return "curiosity";
  if (lower.includes("스토리") || lower.includes("경험") || lower.includes("story")) return "story";
  if (lower.includes("가치") || lower.includes("체크리스트") || lower.includes("숫자") || lower.includes("value")) return "value";
  if (lower.includes("반전") || lower.includes("상식") || lower.includes("역발상") || lower.includes("contrarian")) return "contrarian";
  const archetypes: HookArchetype[] = ["curiosity", "value", "contrarian", "story"];
  return archetypes[sequenceIndex % archetypes.length];
}

function selectPillarForIndex(sequenceIndex: number): ContentPillar {
  const pillars: ContentPillar[] = ["insight", "education", "story", "opinion", "promotion"];
  return pillars[sequenceIndex % pillars.length];
}

function formatRecentPostContext(posts: RecentPostForPrompt[]): string {
  return formatAntiRepeatContext(posts, 5);
}

function formatProductPrompt(config: BrandConfig): string[] {
  const profile = config.productProfile;
  const experiment = config.activeExperiment;
  const isEnglish =
    config.voiceProfile?.language === "en" ||
    Boolean(profile.productName?.toLowerCase().includes("global"));

  if (isEnglish) {
    return [
      "[Product Profile]",
      `Product Name: ${profile.productName}`,
      `Description: ${profile.oneLineDescription || "Not set"}`,
      `Target Customer: ${profile.targetCustomer || "Not set"}`,
      `Offer Promise: ${profile.offerPromise || "Not set"}`,
      `Landing URL: ${profile.landingUrl || config.websiteUrl || "Not set"}`,
      `Primary Channel: ${profile.primaryChannel}`,
      `Primary Metric: ${profile.primaryMetric}`,
      `Conversion Metric: ${profile.conversionMetric}`,
      `Positioning Notes: ${profile.positioningNotes || "Not set"}`,
      "[Current Experiment]",
      `Experiment Name: ${experiment.name}`,
      `Hypothesis: ${experiment.hypothesis}`,
      `Stage: ${experiment.stage}`,
      `Duration: ${experiment.durationDays} days`,
      `Primary Metric: ${experiment.primaryMetric}`,
      `Guardrail: ${experiment.guardrailMetric}`,
      `Status: ${experiment.status}`,
      "",
    ];
  }

  return [
    "[제품 프로필]",
    `제품명: ${profile.productName}`,
    `한 줄 설명: ${profile.oneLineDescription || "미설정"}`,
    `타깃 고객: ${profile.targetCustomer || "미설정"}`,
    `오퍼 약속: ${profile.offerPromise || "미설정"}`,
    `랜딩 URL: ${profile.landingUrl || config.websiteUrl || "미설정"}`,
    `주요 채널: ${profile.primaryChannel}`,
    `핵심 지표: ${profile.primaryMetric}`,
    `전환 지표: ${profile.conversionMetric}`,
    `포지셔닝 메모: ${profile.positioningNotes || "미설정"}`,
    "[현재 실험]",
    `실험명: ${experiment.name}`,
    `가설: ${experiment.hypothesis}`,
    `단계: ${experiment.stage}`,
    `기간: ${experiment.durationDays}일`,
    `핵심 지표: ${experiment.primaryMetric}`,
    `가드레일: ${experiment.guardrailMetric}`,
    `상태: ${experiment.status}`,
    "",
  ];
}

function buildProductQualityContext(
  config: BrandConfig,
  viralIntentModeId?: ViralIntentMode["id"]
) {
  const profile = config.productProfile;
  const isEnglish = config.voiceProfile?.language === "en" || Boolean(profile.productName?.toLowerCase().includes("global"));
  return {
    productName: profile.productName,
    productKeywords: [
      profile.productName,
      profile.oneLineDescription,
      profile.targetCustomer,
      profile.offerPromise,
      ...config.topics,
    ].filter((value) => value.trim().length > 0),
    ctaTerms: ["확인", "랜딩", "링크", "프로필", profile.conversionMetric],
    isEnglish,
    viralIntentModeId,
  };
}

function formatCampaignPrompt(experiment: GrowthExperiment): string[] {
  if (!experiment.campaign) return [];
  const campaignExperiment = { ...experiment, campaign: experiment.campaign };
  if (experiment.qualityProfile === "career_decision") return formatCareerCampaignPrompt(campaignExperiment);
  if (experiment.qualityProfile === "product_growth") return formatProductGrowthCampaignPrompt(campaignExperiment);
  if (experiment.qualityProfile === "ecommerce_d2c") {
    return [
      `[Campaign]\n${campaignExperiment.campaign.name} (${campaignExperiment.campaign.id})`,
      `[Quality Profile]\n${experiment.qualityProfile}`,
      `[Link Policy]\n${experiment.shouldLink ? "This post should naturally introduce the first-comment link to the Etsy blueprint." : "Zero links in this post. Focus on bookmark, share, or profile visit."}`,
      "",
    ];
  }
  return [
    `[캠페인]\n${campaignExperiment.campaign.name} (${campaignExperiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    ...(experiment.qualityProfile === "saju_viral" ? SAJU_VIRAL_REQUIREMENTS : []),
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 저장/공유/프로필 방문만 유도"}`,
    "",
  ];
}

// Mirrors the saju_viral quality gate so drafts are written to pass it instead of being discarded.
const SAJU_VIRAL_REQUIREMENTS = [
  "[필수 조건 — 하나라도 빠지면 품질 게이트에서 폐기됨]",
  "- 사주·궁합·운세 같은 단어는 자연스럽게 1번 이상 나온다. 사주 전문 용어(일간·재성·관성·도화살 등)는 1개까지만 쓰고, 쓰면 그 문장이나 바로 다음 문장에서 쉬운 말로 푼다.",
  "- 기준 독자는 사주를 모르는 25~35세다. 독자가 자기 사주를 몰라도 오늘 써먹을 생각이나 행동 하나를 남긴다.",
  "- 마지막 질문과 첫 댓글은 독자가 자기 경험만으로 답할 수 있어야 한다. 독자의 원국·일주·사주 구조를 묻지 않는다.",
  "- 마지막 질문과 첫 댓글에는 사주 전문 용어를 쓰지 않는다. 첫 줄에 쓴 용어(예: 화개살)도 마지막 질문에서 되풀이하지 않는다.",
  "- 첫 댓글에 지어낸 1인칭 경험담을 쓰지 않는다.",
  "- 100% 반말/독백체(~임, ~했음, ~야)로 쓰고 ~습니다/~하세요 같은 존댓말은 쓰지 않는다.",
  "- 첫 줄 모양과 끝맺음은 바이럴 모드 규칙을 따른다. 모든 글을 질문이나 번호 선택지로 끝낼 필요는 없다.",
];

function formatCareerCampaignPrompt(experiment: CampaignGrowthExperiment): string[] {
  return [
    `[캠페인]\n${experiment.campaign.name} (${experiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    "[작성 가이드: 날것의 스토리텔링과 자연스러운 참여 유도]",
    "- 설명충 같은 훈계조나 사주 이론 강의(표준시 30분 왜곡, 타로 폐기 등)를 절대 반복하지 않는다.",
    "- 기질-조직 미스매치(식상 vs 관성), 10년 대운 교운기 번아웃 리스크, 단일 사주 맹점 등 실전 의사결정 팩트를 날것의 독백체로 쓴다.",
    "- 직장인이면 한 번쯤 겪는 현실 딜레마를 옆에서 본 장면처럼 100% 반말/독백체(~임, ~했음, ~있냐)로 쓴다. 지어낸 1인칭 경험담('나도 ~했음')은 쓰지 않는다.",
    "- 절대 금지 어휘: '심리적 자유', '타이밍 손실 리스크', '리스크', '손익', '시나리오', '골든타임', '의사결정', '데이터상' 등 기획서/보고서용 단어 절대 사용 금지.",
    "- 댓글 강요 대신, 글 말미에 독자가 본인의 상황을 스스로 점검할 수 있는 3가지 선택 프레임(예: 'A. 버팀형 / B. 이동형 / C. 준비형 중 어디에 가까운지 체크해' 또는 '7대 엔진 감사표: 1단계~5단계 체크 후 기준 삼아봐')을 명확한 셀프체크/행동선으로 제시하여 마무리한다.",
    "- 모듈러 감사형(modular_audit)인 경우: 1~5단계는 자가진단 기준을 명확히 주고, 6~7단계(손절선/탈출 윈도우)는 첫 댓글 링크를 통해 정밀 진단받도록 결핍 구조를 유지한다.",
    "- 첫 줄은 진로/이직/퇴사/인간관계/돈에 대한 솔직한 관찰이나 반전으로 시작한다.",
    "- '좋은 일이 올 거예요' 같은 뻔한 위로 문장을 쓰지 않는다.",
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 자연스럽게 연결" : "이번 글은 링크 없이 저장/공유/프로필 확인 유도"}`,
    "",
  ];
}

function formatProductGrowthCampaignPrompt(experiment: CampaignGrowthExperiment): string[] {
  return [
    `[캠페인]\n${experiment.campaign.name} (${experiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    "[제품 성장 필수 조건]",
    "- 첫 줄은 타깃 고객의 구체적인 문제, 비용, 시간 낭비, 망설임, 또는 반복 작업에서 시작",
    "- 제품명/제품 카테고리/오퍼 약속 중 하나를 본문 안에 자연스럽게 포함",
    "- 추상적인 자기계발 문장이 아니라 실제 제품 사용 전후 차이를 보여주기",
    "- 링크 확인, 프로필 방문, 신청, 가입, 저장, 공유 중 하나의 명확한 행동을 넣기",
    "- 댓글 CTA를 쓰지 말고 A/B/C 선택, 숫자 선택, 체크리스트 자기분류는 본문 안에서 셀프체크로 완결",
    "- 운영자가 답글을 달아야 성립하는 CTA 금지",
    "- 개인 질문 접수, 답글 약속, 무료 풀이 약속 금지.",
    "- 장문 사연 요청 금지.",
    "- 개인별 검토를 암시하는 CTA 금지.",
    "- 특정 제품과 무관한 generic 동기부여 문장 금지",
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 제품 확인 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 저장/공유/프로필 방문만 유도"}`,
    "",
  ];
}

function formatQualityFeedback(qualityFeedback: string[], isEnglish = false): string[] {
  if (qualityFeedback.length === 0) return [];
  return [
    "",
    isEnglish ? "[Quality Gate Feedback - Must fix on retry]" : "[품질 게이트 실패 이유 - 이번 재작성에서 반드시 수정]",
    ...qualityFeedback.map((reason) => `- ${reason}`),
  ];
}

function buildLegacyFormula(formula: { id: string; name: string; weight: number; instruction: string }): GenerationFormula {
  return formula;
}

function validateGenerationReadiness(
  config: BrandConfig,
  activeCampaign: CampaignConfig | null,
  dbWeights: Record<string, number> = {},
  approvedCampaignStart = false
): string | null {
  if (!config.formulas.length && !activeCampaign?.formulas.length) {
    return "제품에 공식이 설정되지 않았습니다. 제품 설정에서 formulas를 추가하세요.";
  }
  if (!config.systemPrompt) {
    return "제품에 시스템 프롬프트가 설정되지 않았습니다.";
  }

  const sourceFormulas = activeCampaign
    ? activeCampaign.formulas
    : config.formulas.map(buildLegacyFormula);
  const formulaPool = buildFormulaPool(sourceFormulas, dbWeights);
  if (formulaPool.length === 0) {
    return "공식 가중치가 모두 0입니다. 제품 설정을 확인하세요.";
  }
  const allTopics = [...config.topics, ...(config.trendingTopics ?? [])];
  if (allTopics.length === 0) {
    return "토픽이 없습니다. 제품 설정에서 주제 또는 트렌딩 토픽을 추가하세요.";
  }
  if (activeCampaign?.qualityProfile === "product_growth" || config.qualityProfile === "product_growth") {
    return validateProductGrowthCampaignReadiness(config, activeCampaign, approvedCampaignStart);
  }
  return null;
}

function validateProductGrowthCampaignReadiness(
  config: BrandConfig,
  activeCampaign: CampaignConfig | null,
  approvedCampaignStart: boolean
): string | null {
  const profile = config.productProfile;
  if (!profile.oneLineDescription) return "제품 한 줄 설명이 필요합니다.";
  if (!profile.targetCustomer) return "타깃 고객이 필요합니다.";
  if (!profile.offerPromise) return "오퍼 약속이 필요합니다.";
  if (!profile.landingUrl || !isValidCampaignLandingUrl(profile.landingUrl)) {
    return "제품 랜딩 URL 형식이 필요합니다.";
  }
  if (!activeCampaign?.landingUrl || !isValidCampaignLandingUrl(activeCampaign.landingUrl)) {
    return "캠페인 랜딩 URL 형식이 필요합니다.";
  }
  if (config.activeExperiment.status !== "active") return "제품 실험 상태가 active가 아닙니다.";
  if (!approvedCampaignStart) return "캠페인 시작 승인이 필요합니다.";
  return null;
}

function buildCampaignUtmLink(websiteUrl: string, campaign: CampaignConfig, postId: string): { url: string; utmContent: string } | null {
  const utmContent = campaign.utmContentTemplate === "{{postId}}" ? postId : postId;
  const landingUrl = campaign.landingUrl.trim();
  if (!landingUrl) return null;
  const params = new URLSearchParams({
    utm_source: campaign.utmSource,
    utm_campaign: campaign.utmCampaign,
    utm_content: utmContent,
  });

  if (/^https?:\/\//.test(landingUrl)) {
    const url = new URL(landingUrl);
    for (const [key, value] of params) url.searchParams.set(key, value);
    return { url: url.toString(), utmContent };
  }

  const normalized = /^https?:\/\//.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  try {
    if (websiteUrl.trim()) {
      const url = new URL(landingUrl.startsWith("/") ? landingUrl : `/${landingUrl}`, normalized);
      for (const [key, value] of params) url.searchParams.set(key, value);
      return { url: url.toString(), utmContent };
    }
  } catch {
    return null;
  }
  return { url: `${landingUrl}${landingUrl.includes("?") ? "&" : "?"}${params.toString()}`, utmContent };
}

function appendFirstCommentLink(firstComment: string, linkUrl: string): string {
  return [firstComment.trim(), `→ ${linkUrl}`].filter(Boolean).join("\n\n");
}

export interface GeneratePostsInput {
  count: number;
  insertAtFront: boolean;
  requestedCampaignId: string | null;
  approvedCampaignStart: boolean;
  postCategory: string;
  /** 있으면 count는 1로 고정되고, 이 글의 구조만 따르는 ref_replay 글 하나를 만든다. 실험 팔·Thompson 선택·승자 재현을 건너뛴다. */
  referenceReplay?: { id: string; content: string };
}

export interface GeneratePostsSummary {
  count: number;
  failedCount: number;
  // Why each dropped draft failed, so a refill that comes back short can be diagnosed from its response.
  failureReasons: string[];
  linkedCount: number;
  campaignId: string | null;
  auditSummary: { total: number; passed: number; needsReview: number };
}

function describeFailure(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  return message.slice(0, 300);
}

export type GeneratePostsResult = { ok: false; error: string } | { ok: true; summary: GeneratePostsSummary };

/**
 * Generates, scores and queues posts for one brand. Callers own authorization:
 * the dashboard route checks the session owner, the refill cron checks CRON_SECRET.
 */
const NUMBERED_CHOICE_PROBE = "1. a\n2. b";
const REVERSAL_PROBE = "a가 아니라 b";
const REVERSAL_CAPPED_PROMPT_KO =
  "[첫 줄 제한]\n첫 두 줄에 '~가 아니라', '~아님', '~이 아니고' 같은 뒤집기를 쓰지 않는다. 비교가 필요하면 '~보다'로 쓴다.";
// The template cap counts posts readers see or will see ("발행·대기 글"). This run's drafts carry no status and count;
// archived, failed, and review-queue posts do not, so a regate that archives choice posts frees the cap.
// Reference hooks shown as "검증 훅" get copied, so saju_viral only shows ones its gate would let through:
// jargon cap, no "X가 아니라 Y" opener, no chained "A보다 센 B" ranking.
function isReadableSajuHook(hook: string): boolean {
  return checkReadabilityRules(hook, "").pass && !opensWithReversal(hook) && extractStructureSignature(hook).opener !== "hierarchy";
}

const TEMPLATE_CAP_STATUSES = new Set(["PUBLISHED", "PUBLISHING", "PARTIAL_FAILED", "PENDING"]);
function countsTowardTemplateCap(post: RecentPostSummary): boolean {
  return post.status == null || TEMPLATE_CAP_STATUSES.has(post.status);
}

// First publish slot for this run: after the queue's last pending post, or squeezed in front of the first one.
async function resolveQueueBaseTime(brandId: string, insertAtFront: boolean, count: number, now: number): Promise<number> {
  let baseTime = now + POST_INTERVAL_MS;
  if (insertAtFront) {
    const earliest = await prisma.post.findFirst({
      where: { status: "PENDING", brandId },
      orderBy: { scheduledAt: "asc" },
    });
    if (earliest && earliest.scheduledAt.getTime() > now) {
      baseTime = Math.max(now + 10 * 60 * 1000, earliest.scheduledAt.getTime() - count * POST_INTERVAL_MS);
    }
  } else {
    const latest = await prisma.post.findFirst({
      where: { status: "PENDING", brandId },
      orderBy: { scheduledAt: "desc" },
    });
    if (latest && latest.scheduledAt.getTime() > now) {
      baseTime = latest.scheduledAt.getTime() + POST_INTERVAL_MS;
    }
  }
  return baseTime;
}

export async function generatePostsForBrand(brand: Brand, input: GeneratePostsInput): Promise<GeneratePostsResult> {
  const { insertAtFront, requestedCampaignId, approvedCampaignStart, postCategory, referenceReplay } = input;
  const count = referenceReplay ? 1 : input.count;
  const brandId = brand.id;
  const config = parseBrandConfig(brand.brandConfig);
  const activeCampaign = getActiveCampaign(config, requestedCampaignId);
  const dbWeights = JSON.parse(brand.formulaWeights) as Record<string, number>;
  const readinessError = validateGenerationReadiness(config, activeCampaign, dbWeights, approvedCampaignStart);
  if (readinessError) {
    return { ok: false, error: readinessError };
  }
  const domainProfile = activeCampaign?.qualityProfile ?? config.qualityProfile;
  const domainPreset = getDomainPreset(domainProfile);
  const domainTrackFormulas: GenerationFormula[] = [
    ...domainPreset.trackFormulas.track_a,
    ...domainPreset.trackFormulas.track_b,
    ...domainPreset.trackFormulas.track_c,
  ];

  const baseFormulas = activeCampaign
    ? activeCampaign.formulas
    : config.formulas.map(buildLegacyFormula);
  const existingFormulaIds = new Set(baseFormulas.map((f) => f.id));
  const mergedTrackFormulas = domainTrackFormulas.filter((f) => !existingFormulaIds.has(f.id));
  const sourceFormulas: GenerationFormula[] = [...baseFormulas, ...mergedTrackFormulas];

  const formulaPool = buildFormulaPool(sourceFormulas, dbWeights);
  const allTopics = [...config.topics, ...(config.trendingTopics ?? [])];
  const topics = planTopicQuota(allTopics, count);
  const growthMemory = parseStoredGrowthMemory(brand.growthMemory);
  const prohibitedPhrases = readProhibitedPhrases(brand.brandConfig);
  const growthContext = formatGrowthPromptContext(growthMemory);
  const viralContext = [
    formatViralPromptContext(parseViralMemory(brand.viralMemory), domainProfile === "saju_viral" ? isReadableSajuHook : undefined),
    formatTrendRadarContext(readTrendRadar(brand.brandConfig)),
  ].filter(Boolean).join("\n\n");
  const notAnchor = { brandId, status: { not: INSTAGRAM_BIO_ANCHOR_STATUS } };
  const recentPosts = await prisma.post.findMany({
    where: notAnchor,
    orderBy: { createdAt: "desc" },
    take: RECENT_POST_AVOIDANCE_COUNT,
    select: {
      content: true,
      firstComment: true,
      topic: true,
      situation: true,
      hookType: true,
      ctaType: true,
      campaignFormulaId: true,
      status: true,
    },
  });
  const recentPostContext = formatRecentPostContext(recentPosts);

  // The matrix is a pure function of index, and the dashboard sends 2-post chunks that each restart at 0.
  // Offsetting by the brand's post count gives every chunk fresh contexts instead of the same day's pair.
  const contextOffset = await prisma.post.count({ where: notAnchor });
  const isSajuDomain = domainProfile === "saju_viral" || domainProfile === "career_decision";
  // Link cadence counts the campaign's existing posts, so chunked requests keep the 1-in-N rhythm.
  const linkOffset = activeCampaign
    ? await prisma.post.count({ where: { brandId, campaignId: activeCampaign.id } })
    : 0;

  const BATCH = 3;
  const BATCH_COOLDOWN = 500;
  const results: Awaited<ReturnType<typeof generateWithQuality>>[] = [];
  // Formulas picked so far, including the current in-flight batch, for anti-repeat.
  const pickedFormulaIds: string[] = [];

  const failureReasons: string[] = [];
  // Live length experiment: each draft gets the arm the queue is shortest on, so publish slots never wait long.
  const lengthExperiment = await loadLengthExperimentState(brandId, config, new Date());
  const lengthArms = referenceReplay ? [undefined] : lengthExperiment ? shuffleArms(planLengthArms(lengthExperiment.pending, lengthExperiment.arm, count)) : [];
  const isLeanSprint = isLeanSprintRun({
    brandSlug: brand.slug,
    domainProfile,
    campaignId: activeCampaign?.id,
    experimentId: config.activeExperiment?.id,
    productName: config.productProfile?.productName,
    count,
  });
  // One high-view past post per lean run can be replayed with a new topic (isLeanSprintRun already excludes
  // English D2C). It is an optional arm: a failed lookup must not abort the whole run.
  const winnerSource = isLeanSprint && !referenceReplay
    ? await loadWinnerReplaySource(brandId, new Date()).catch((error: unknown) => {
        console.warn("[generate] winner replay source lookup failed, skipping replay arm:", error);
        return null;
      })
    : null;
  // Computed before generation because New Year slots are decided by each draft's planned publish date.
  const now = Date.now();
  const baseTime = await resolveQueueBaseTime(brandId, insertAtFront, count, now);
  for (let i = 0; i < count; i += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, count - i) }, (_, j) => {
      const batchIndex = i + j;
      // Newest first, so the anti-repeat windows and the template cap look at the latest drafts.
      const inBatchPosts: RecentPostSummary[] = [
        ...[...results].reverse().map((result) => ({ content: result.post, topic: result.topic, hookType: result.hookType, firstComment: result.firstComment })),
        ...recentPosts,
      ];
      // imagination_dilemma needs numbered choices, so once the cap is hit it must not be picked at all
      // (the gate alone would only burn retries and drop the draft).
      const choicesCapped = !checkTemplateCap(NUMBERED_CHOICE_PROBE, inBatchPosts.filter(countsTowardTemplateCap)).pass;
      const reversalCapped = !checkTemplateCap(REVERSAL_PROBE, inBatchPosts.filter(countsTowardTemplateCap)).pass;
      const excludedModeIds = isLeanSprint && choicesCapped ? ["imagination_dilemma"] : [];
      // A New Year slot takes its mode from the season schedule, skipping the bandit and the replay arm.
      const slotIndex = contextOffset + batchIndex;
      const newYearMode = newYearSlotMode({
        brandSlug: brand.slug,
        plannedAt: new Date(baseTime + batchIndex * POST_INTERVAL_MS),
        slotIndex,
        choicesCapped,
      });
      // No replay while the length experiment runs: an extra arm skews per-arm drop rates and its random assignment.
      const viralIntentMode = referenceReplay
        ? REFERENCE_REPLAY_MODE
        : newYearMode
        ? NEW_YEAR_MODES[newYearMode]
        : isLeanSprint
          ? selectLeanViralMode(
              batchIndex, sourceFormulas, config.thompsonPriors, pickedFormulaIds,
              Boolean(winnerSource) && !lengthExperiment && !pickedFormulaIds.includes(WINNER_REPLAY_MODE.id),
              excludedModeIds
            )
          : selectViralIntentMode(batchIndex, { sprintType: "standard_28day" });
      const quotaSelection = newYearMode || referenceReplay
        ? null
        : selectLearnedFormula(batchIndex, {
            domainProfile,
            priors: config.thompsonPriors,
            weights: dbWeights,
            recentFormulaIds: pickedFormulaIds,
          });

      const matchedFormula = quotaSelection ? sourceFormulas.find((f) => f.id === quotaSelection.formulaId) : undefined;
      // A mode without a campaign formula becomes its own formula, so New Year posts carry formulaId "ny_*".
      const formula = newYearMode || isLeanSprint || referenceReplay
        ? selectCampaignFormulaForViralMode(sourceFormulas, viralIntentMode)
        : (matchedFormula ?? (
            activeCampaign
              ? selectCampaignFormulaForViralMode(sourceFormulas, viralIntentMode)
              : pickRandom(formulaPool)
          ));
      pickedFormulaIds.push(formula.id);
      // Outside the lean sprint the mode rotates by batch index, so a 4-post global refill gave every
      // formula the same Type A/B/C self-check. A formula mapped to its own mode keeps that mode.
      const formulaMode = newYearMode || isLeanSprint || referenceReplay ? viralIntentMode : resolveViralIntentMode(formula.id, batchIndex);

      // relationship_tension must open with a relationship word, so a career slot from the alternating quota
      // gets a relationship topic instead (otherwise the fidelity gate drops the draft after every retry).
      const plannedTopic = topics[batchIndex % topics.length];
      const relationshipTopics = allTopics.filter(isRelationshipTopic);
      const topic = formulaMode.id === "relationship_tension" && !isRelationshipTopic(plannedTopic) && relationshipTopics.length
        ? relationshipTopics[batchIndex % relationshipTopics.length]
        : plannedTopic;
      // The matrix follows the topic's axis, not the sprint: a career topic in the relationship matrix
      // produced "이직 고민 (헤어지면 불안해지는 거리감 맥락)" posts.
      const useRelationshipContext = isSajuDomain && isRelationshipTopic(topic);
      const recentSituations = [...[...results].reverse().map((result) => result.situation), ...recentPosts.map((recent) => recent.situation)];
      const experiment = buildExperiment(
        formula, topic, config, activeCampaign, batchIndex, formulaMode,
        useRelationshipContext ? "saju_relationship" : undefined,
        contextOffset,
        linkOffset,
        recentSituations
      );
      experiment.lengthTarget = lengthArms[batchIndex];
      // The gate caps reversal openers only for saju_viral (same scope as the numbered-choice cap).
      experiment.reversalCapped = reversalCapped && experiment.qualityProfile === "saju_viral";
      const replaySource = formulaMode.id === WINNER_REPLAY_MODE.id ? winnerSource : null;
      if (newYearMode) {
        // newYearSlotMode only returns a mode for a slug in NEW_YEAR_BRANDS.
        experiment.newYearMode = newYearMode;
        experiment.newYearSlotIndex = slotIndex;
        experiment.newYearBrief = buildNewYearBrief(newYearMode, NEW_YEAR_BRANDS[brand.slug], slotIndex);
        // The modes set their own length (a 12-month list cannot fit a short arm), and every one carries the sample link.
        experiment.lengthTarget = undefined;
        experiment.shouldLink = true;
        experiment.closingFormat = newYearMode === "ny_pick" ? "choices" : undefined;
      }
      // A replay keeps the source's own closing, so it gets no rotated closing format to contradict it.
      else if (referenceReplay) {
        experiment.winnerReference = referenceReplay.content;
        experiment.referenceReplay = true;
      } else if (replaySource) experiment.winnerReference = replaySource.content;
      // The gate caps numbered choices only for saju_viral, so only there is a capped "choices" slot turned into a question.
      else experiment.closingFormat = pickClosingFormat(batchIndex + contextOffset, formulaMode.id, choicesCapped && experiment.qualityProfile === "saju_viral");
      return generateWithQuality(
        experiment,
        config,
        growthContext,
        viralContext,
        recentPostContext,
        2,
        inBatchPosts,
        prohibitedPhrases
      );
    });
    // One failed draft (refusal, empty reply, API hiccup) must not discard the rest of the batch.
    for (const settled of await Promise.allSettled(batch)) {
      if (settled.status === "fulfilled") results.push(settled.value);
      else {
        failureReasons.push(describeFailure(settled.reason));
        console.error("[generate] draft failed, skipping:", settled.reason);
      }
    }
    if (i + BATCH < count) {
      await new Promise((res) => setTimeout(res, BATCH_COOLDOWN));
    }
  }

  // Callers (refill cron, dashboard) only see this message, so carry the per-draft reasons in it.
  if (results.length === 0) {
    // A reference rewrite is one optional attempt: the caller records the miss instead of failing.
    if (referenceReplay) {
      return {
        ok: true,
        summary: {
          count: 0,
          failedCount: failureReasons.length,
          failureReasons,
          linkedCount: 0,
          campaignId: activeCampaign?.id ?? null,
          auditSummary: { total: 0, passed: 0, needsReview: 0 },
        },
      };
    }
    throw new Error(`All ${count} drafts failed to generate${failureReasons.length > 0 ? `: ${failureReasons.join(" | ")}` : ""}`);
  }

  let linkedCount = 0;
  const createdPosts = [];
  for (const result of results) {
    // Text only. 2026-10-22 metrics: Korean posts with auto card carousels had a median of 73 views
    // against 131 for text posts; re-enable only behind an A/B, not by default.
    const carouselDataUrls: string[] = [];
    const jitterMs = (Math.floor(Math.random() * 31) - 15) * 60 * 1000;
    // Slots follow saved posts, so a dropped draft leaves no gap in the schedule.
    const scheduledTime = Math.max(now + 5 * 60 * 1000, baseTime + createdPosts.length * POST_INTERVAL_MS + jitterMs);

    const rawPostContent = ensureMaxThreadsLength(result.post);
    const algorithmicThreshold = config.minAlgorithmicScore ?? 80;
    const rawRemediation = await remediatePostAlgorithmic(
      rawPostContent,
      result.firstComment || null,
      {
        topic: result.topic,
        targetAudience: result.targetAudience,
        productProfile: config.productProfile ? JSON.stringify(config.productProfile) : undefined,
        formulaId: result.formulaId,
      },
      algorithmicThreshold
    );
    // A rewrite can break the content gate the original already passed; keep the original then.
    const reconciled = await reconcileRemediation({
      rawContent: rawPostContent,
      rawFirstComment: result.firstComment || null,
      remediation: rawRemediation,
      regate: result.regate,
      threshold: algorithmicThreshold,
    });
    const remediation = reconciled.remediation;
    // Still under the algorithm score after rewrites: drop it rather than park it in the approval queue.
    if (!remediation.pass) {
      failureReasons.push(`algorithm score ${remediation.scoreResult.totalScore} under threshold (${result.formulaId})`);
      console.warn(`[generate] algorithm score ${remediation.scoreResult.totalScore} under threshold, skipping ${result.formulaId}`);
      continue;
    }
    // Belt and braces after rewrites: a draft outside its arm's band never reaches the experiment queue.
    if (result.lengthTarget && lengthExperiment && lengthGateReason(reconciled.content, result.lengthTarget, lengthExperiment.config)) {
      failureReasons.push(`length experiment ${result.lengthTarget} mismatch (${result.formulaId})`);
      continue;
    }

    if (result.qualityPass === false) {
      failureReasons.push(`quality gate failed (${result.formulaId})`);
      continue;
    }

    const postContent = reconciled.content;
    const initialComment = reconciled.firstComment;
    const qualityReasons = [
      ...result.qualityReasons,
      ...reconciled.extraReasons,
      ...(result.formulaId === WINNER_REPLAY_MODE.id && winnerSource ? [`${WINNER_REPLAY_SOURCE_PREFIX}${winnerSource.id}`] : []),
      ...(referenceReplay ? [`${REFERENCE_REPLAY_SOURCE_PREFIX}${referenceReplay.id}`] : []),
    ];
    const threadParts = splitContentIntoThreadParts(postContent);
    // Nobody reviews drafts by hand: every gate-passing draft is queued, learning decides which formulas get volume.
    const postStatus = "PENDING";

    const post = await prisma.post.create({
      data: {
        brandId,
        content: postContent,
        firstComment: initialComment,
        imageUrls: JSON.stringify(carouselDataUrls),
        scheduledAt: new Date(scheduledTime),
        status: postStatus,
        formulaId: result.formulaId,
        topic: result.topic,
        targetAudience: result.targetAudience,
        situation: result.situation,
        hookType: result.hookType,
        ctaType: result.ctaType,
        qualityScore: result.qualityScore,
        qualityProfile: result.qualityProfile,
        qualityPass: result.qualityPass,
        qualityReasons: JSON.stringify(qualityReasons),
        campaignId: result.campaignId,
        campaignFormulaId: result.campaignFormulaId,
        careerDecisionType: result.careerDecisionType,
        threadTotalParts: threadParts.length,
        threadPartsPosted: 0,
        sideMission: config.sideMission || null,
        postCategory,
        algorithmicScore: remediation.scoreResult.totalScore,
        algorithmicPass: remediation.pass,
        algorithmicDimensions: JSON.stringify(remediation.scoreResult.dimensions),
        algorithmicFixes: JSON.stringify(remediation.actionableFixes),
        rewriteCount: remediation.rewriteCount,
      },
    });

    // newYearMode is only set for a slug in NEW_YEAR_BRANDS.
    const newYearLang = result.newYearMode ? NEW_YEAR_BRANDS[brand.slug] : null;
    if (result.shouldLink) {
      let finalLinkUrl: string | null = null;
      let finalUtmContent: string | null = post.id;

      if (result.newYearMode && newYearLang) {
        finalLinkUrl = buildNewYearLink(post.id, result.newYearMode, newYearLang);
      } else if (activeCampaign) {
        const utm = buildCampaignUtmLink(config.websiteUrl, activeCampaign, post.id);
        if (utm) {
          finalLinkUrl = utm.url;
          finalUtmContent = utm.utmContent;
        }
      } else {
        const targetLanding = config.productProfile?.landingUrl || (config.websiteUrl ? `${config.websiteUrl}/start` : null);
        if (targetLanding) {
          finalLinkUrl = buildTrackedUrl(targetLanding, {
            postId: post.id,
            formulaId: post.formulaId ?? undefined,
            track: post.formulaId?.includes("offer") ? "track_c" : "track_b",
          });
        }
      }

      if (!finalLinkUrl && (brand.slug === "cosmicpath" || config.productProfile?.productName?.toLowerCase().includes("cosmic"))) {
        const matchLanding = "https://www.cosmicpath.app/match/new";
        const legacyLanding = "https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1";
        finalLinkUrl = config.productProfile?.landingUrl || (brand.slug === "cosmicpath" ? matchLanding : legacyLanding);
      }

      if (finalLinkUrl) {
        linkedCount++;
        const appBaseUrl = process.env.APP_URL || "https://thread-uploader.vercel.app";
        const shortRedirectUrl = buildShortRedirectUrl(appBaseUrl, post.id);
        const updateData: {
          linkUrl: string;
          utmContent: string | null;
          firstComment?: string;
        } = {
          linkUrl: finalLinkUrl,
          utmContent: finalUtmContent,
        };

        const isCosmicOrLean = Boolean(
          brand.slug === "cosmicpath" ||
          activeCampaign?.linkPlacement === "firstComment" ||
          activeCampaign?.id?.includes("cosmicpath") ||
          activeCampaign?.id?.includes("lean") ||
          config.productProfile?.productName?.toLowerCase().includes("cosmic")
        );

        // A New Year post's first comment is the fixed sample line only: the LLM comment and bridge header are dropped.
        if (newYearLang) {
          updateData.firstComment = newYearFirstComment(newYearLang, shortRedirectUrl);
        } else if (isCosmicOrLean) {
          const isGlobal = brand.slug === "cosmicpath-global" ||
            config.voiceProfile?.language === "en" ||
            config.qualityProfile === "ecommerce_d2c";
          const isCosmicBrand = brand.slug === "cosmicpath" ||
            activeCampaign?.id?.includes("cosmicpath") ||
            config.productProfile?.productName?.toLowerCase().includes("cosmic");
          const bridgeHeader = isGlobal
            ? "📌 Full Dual-Engine Natal Blueprint & Decision Dossier (Etsy):"
            : (isCosmicBrand
              ? "📌 5대 계산 엔진(사주·점성술·자미두수) 교차 판정 리포트:"
              : "");
          const bridgeComment = bridgeHeader
            ? [initialComment?.trim(), `${bridgeHeader}\n${shortRedirectUrl}`].filter(Boolean).join("\n\n")
            : appendFirstCommentLink(initialComment || "", shortRedirectUrl);

          updateData.firstComment = bridgeComment;
        }

        createdPosts.push(await prisma.post.update({
          where: { id: post.id },
          data: updateData,
        }));
        continue;
      }
    }
    createdPosts.push(post);
  }

  const passedCount = createdPosts.filter((p) => p.algorithmicPass).length;
  const needsReviewCount = createdPosts.filter((p) => p.status === "NEEDS_REVIEW").length;

  return {
    ok: true,
    summary: {
      count: createdPosts.length,
      failedCount: failureReasons.length,
      failureReasons,
      linkedCount,
      campaignId: activeCampaign?.id ?? null,
      auditSummary: {
        total: createdPosts.length,
        passed: passedCount,
        needsReview: needsReviewCount,
      },
    },
  };
}
