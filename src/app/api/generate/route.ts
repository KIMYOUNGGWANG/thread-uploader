import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { formatCreatorPatternContext } from "@/lib/creator-prompt-patterns";
import { formatGrowthPromptContext, parseStoredGrowthMemory } from "@/lib/growth-learning";
import { isValidCampaignLandingUrl } from "@/lib/product-auto-setup";
import { checkQuality } from "@/lib/quality-gate";
import { formatViralPromptContext } from "@/lib/viral-analysis";
import { getActiveCampaign, parseBrandConfig } from "@/types/brand";
import type { BrandConfig, CampaignConfig, QualityProfileId } from "@/types/brand";
import { parseViralMemory } from "@/types/viral";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SEPARATOR = "===FIRST_COMMENT===";
const RETRYABLE_STATUSES = new Set([429, 529]);

interface GrowthExperiment {
  formula: GenerationFormula;
  topic: string;
  targetAudience: string;
  situation: string;
  hookType: string;
  ctaType: string;
  qualityProfile: QualityProfileId;
  campaign: CampaignConfig | null;
  campaignFormulaId: string | null;
  shouldLink: boolean;
}

interface GenerationFormula {
  id: string;
  name: string;
  weight: number;
  instruction: string;
}

type CampaignGrowthExperiment = GrowthExperiment & { campaign: CampaignConfig };

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleTopics(topics: string[], count: number): string[] {
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  const result: string[] = [];
  while (result.length < count) {
    result.push(...shuffled.slice(0, Math.min(topics.length, count - result.length)));
  }
  return result;
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

async function generateOne(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  qualityFeedback: string[] = [],
  retries = 5,
  delayMs = 3000
): Promise<{ post: string; firstComment: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        temperature: 0.95,
        system: config.systemPrompt,
        messages: [
          {
            role: "user",
            content: buildGenerationPrompt(experiment, config, growthContext, viralContext, qualityFeedback),
          },
        ],
      });

      const raw = (message.content[0] as { text: string }).text.trim();
      const parts = raw.split(SEPARATOR);
      return { post: parts[0].trim(), firstComment: (parts[1] ?? "").trim() };
    } catch (err: unknown) {
      const status = typeof err === "object" && err !== null ? (err as { status?: number }).status : undefined;
      if (status !== undefined && RETRYABLE_STATUSES.has(status) && attempt < retries) {
        console.warn(`API ${status} (attempt ${attempt}/${retries}). Retrying in ${delayMs * attempt}ms…`);
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
  maxRetries = 2
): Promise<{
  post: string;
  firstComment: string;
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
}> {
  let lastResult = await generateOne(experiment, config, growthContext, viralContext);
  const qualityContext = buildProductQualityContext(config);
  let qualityResult = checkQuality(lastResult.post, experiment.qualityProfile, qualityContext);

  for (let attempt = 1; attempt <= maxRetries && !qualityResult.pass; attempt++) {
    console.warn(`Quality FAIL (${qualityResult.profile}, score ${qualityResult.score}, attempt ${attempt}/${maxRetries}):`, qualityResult.reasons);
    lastResult = await generateOne(experiment, config, growthContext, viralContext, qualityResult.reasons);
    qualityResult = checkQuality(lastResult.post, experiment.qualityProfile, qualityContext);
  }

  if (!qualityResult.pass) {
    console.warn(`Quality WARNING: 최대 재시도 초과. profile=${qualityResult.profile}, score=${qualityResult.score}. 그대로 저장.`);
  }

  return {
    post: lastResult.post,
    firstComment: lastResult.firstComment,
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
  };
}

function buildExperiment(
  formula: GenerationFormula,
  topic: string,
  config: BrandConfig,
  campaign: CampaignConfig | null,
  index: number
): GrowthExperiment {
  const qualityProfile = campaign?.qualityProfile ?? config.qualityProfile ?? "saju_viral";
  const cadence = Math.max(1, campaign?.linkCadenceEvery ?? 1);
  return {
    formula,
    topic,
    targetAudience: pickRandom(config.targets.length ? config.targets : ["일반 독자"]),
    situation: pickRandom(config.situations.length ? config.situations : ["일상적인 상황"]),
    hookType: pickRandom(config.hookTypes?.length ? config.hookTypes : ["공감형 훅"]),
    ctaType: pickRandom(config.ctaTypes?.length ? config.ctaTypes : ["첫 댓글 링크"]),
    qualityProfile,
    campaign,
    campaignFormulaId: campaign ? formula.id : null,
    shouldLink: campaign ? index % cadence === 0 : Boolean(config.websiteUrl.trim()),
  };
}

export function buildGenerationPrompt(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  qualityFeedback: string[] = []
): string {
  const creatorPatternContext = formatCreatorPatternContext(experiment.hookType, experiment.ctaType);

  return [
    `[공식: ${experiment.formula.name}]`,
    experiment.formula.instruction,
    "",
    ...formatProductPrompt(config),
    ...formatCampaignPrompt(experiment),
    `[주제]\n${experiment.topic}`,
    `[타겟 독자]\n${experiment.targetAudience}`,
    `[상황/맥락]\n${experiment.situation}`,
    `[훅 유형]\n${experiment.hookType}`,
    `[CTA 유형]\n${experiment.ctaType}`,
    ...(creatorPatternContext ? [creatorPatternContext] : []),
    `[성과 학습 메모리]\n${growthContext}`,
    `[바이럴 레퍼런스 학습 메모리]\n${viralContext}`,
    ...formatQualityFeedback(qualityFeedback),
    "",
    `위 실험 조건을 조합해서 Threads 포스트 1개를 작성해줘. 작성 후 ${SEPARATOR} 를 출력하고, 바로 아래에 첫 댓글을 작성해줘.`,
    "본문과 첫 댓글에 실제 URL은 쓰지 마. 시스템이 저장 후 필요한 경우 UTM 링크를 붙인다.",
  ].join("\n");
}

function formatProductPrompt(config: BrandConfig): string[] {
  const profile = config.productProfile;
  const experiment = config.activeExperiment;
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

function buildProductQualityContext(config: BrandConfig) {
  const profile = config.productProfile;
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
  };
}

function formatCampaignPrompt(experiment: GrowthExperiment): string[] {
  if (!experiment.campaign) return [];
  const campaignExperiment = { ...experiment, campaign: experiment.campaign };
  if (experiment.qualityProfile === "career_decision") return formatCareerCampaignPrompt(campaignExperiment);
  if (experiment.qualityProfile === "product_growth") return formatProductGrowthCampaignPrompt(campaignExperiment);
  return [
    `[캠페인]\n${campaignExperiment.campaign.name} (${campaignExperiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 댓글/프로필 방문만 유도"}`,
    "",
  ];
}

function formatCareerCampaignPrompt(experiment: CampaignGrowthExperiment): string[] {
  return [
    `[캠페인]\n${experiment.campaign.name} (${experiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    "[중요: 캠페인 예외]",
    "- 브랜드 기본 프롬프트의 '댓글로 남겨줘 금지'는 일반 사주 글 기준이다.",
    "- 이 캠페인은 댓글 진단 실험이므로 본문 안에 상황 공유/댓글 CTA가 반드시 있어야 한다.",
    "- 자동 답장 약속처럼 보이지 않게 '댓글에 상황 짧게 써줘' 또는 'A/B/C 중 어디에 가까운지 같이 보자'처럼 쓴다.",
    "[커리어 wedge 필수 조건]",
    "- 첫 줄은 반드시 이직/퇴사/버틸지/옮길지/번아웃/월급 현타/동기보다 뒤처짐 중 하나의 커리어 불안으로 시작",
    "- 댓글에 현재 상황을 쓰게 만들기",
    "- 본문 후반에 버팀형/이동형/준비형 또는 A/B/C 분류 프레임을 명확히 넣기",
    "- '좋은 일이 올 거예요' 같은 generic 자기계발 문장 금지",
    "- 사주 전문용어를 억지로 넣지 말고, 타이밍/흐름/성향/결정 패턴 정도로 CosmicPath 결을 유지",
    "- 마지막 2줄 안에 댓글 CTA 또는 친구 공유 CTA를 넣기",
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 댓글 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 댓글/프로필 방문만 유도"}`,
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
    "- 댓글, 링크 확인, 프로필 방문, 신청, 가입, 요청 중 하나의 명확한 행동을 넣기",
    "- 특정 제품과 무관한 generic 동기부여 문장 금지",
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 제품 확인 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 댓글/프로필 방문만 유도"}`,
    "",
  ];
}

function formatQualityFeedback(qualityFeedback: string[]): string[] {
  if (qualityFeedback.length === 0) return [];
  return [
    "",
    "[품질 게이트 실패 이유 - 이번 재작성에서 반드시 수정]",
    ...qualityFeedback.map((reason) => `- ${reason}`),
  ];
}

function buildLegacyFormula(formula: { id: string; name: string; weight: number; instruction: string }): GenerationFormula {
  return formula;
}

export function validateGenerationReadiness(
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
  const formulaPool = buildFormulaPool(sourceFormulas, activeCampaign ? {} : dbWeights);
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

export function buildCampaignUtmLink(websiteUrl: string, campaign: CampaignConfig, postId: string): { url: string; utmContent: string } | null {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { brandId?: unknown; count?: unknown; insertAtFront?: unknown; campaignId?: unknown; approvedCampaignStart?: unknown };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const count = typeof body.count === "number" ? body.count : 30;
    const insertAtFront = body.insertAtFront === true;
    const requestedCampaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    const approvedCampaignStart = body.approvedCampaignStart === true;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (count < 1 || count > 300) {
      return NextResponse.json({ error: "count는 1~300 사이여야 합니다" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);

    const config = parseBrandConfig(brand.brandConfig);
    const activeCampaign = getActiveCampaign(config, requestedCampaignId);
    const dbWeights = JSON.parse(brand.formulaWeights) as Record<string, number>;
    const readinessError = validateGenerationReadiness(config, activeCampaign, dbWeights, approvedCampaignStart);
    if (readinessError) {
      return NextResponse.json({ error: readinessError }, { status: 400 });
    }
    const sourceFormulas = activeCampaign
      ? activeCampaign.formulas
      : config.formulas.map(buildLegacyFormula);
    const formulaPool = buildFormulaPool(sourceFormulas, activeCampaign ? {} : dbWeights);
    const allTopics = [...config.topics, ...(config.trendingTopics ?? [])];
    const topics = shuffleTopics(allTopics, count);
    const growthContext = formatGrowthPromptContext(parseStoredGrowthMemory(brand.growthMemory));
    const viralContext = formatViralPromptContext(parseViralMemory(brand.viralMemory));

    const BATCH = 3;
    const BATCH_COOLDOWN = 500;
    const results: Awaited<ReturnType<typeof generateWithQuality>>[] = [];

    for (let i = 0; i < count; i += BATCH) {
      const batch = Array.from({ length: Math.min(BATCH, count - i) }, (_, j) => {
        const formula = pickRandom(formulaPool);
        const topic = topics[i + j];
        const experiment = buildExperiment(formula, topic, config, activeCampaign, i + j);
        return generateWithQuality(experiment, config, growthContext, viralContext);
      });
      results.push(...await Promise.all(batch));
      if (i + BATCH < count) {
        await new Promise((res) => setTimeout(res, BATCH_COOLDOWN));
      }
    }

    const now = Date.now();
    let baseTime = now;
    if (insertAtFront) {
      const earliest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "asc" },
      });
      if (earliest && earliest.scheduledAt.getTime() > now) {
        baseTime = Math.max(now, earliest.scheduledAt.getTime() - count * 1000);
      }
    } else {
      const latest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "desc" },
      });
      if (latest && latest.scheduledAt.getTime() > now) {
        baseTime = latest.scheduledAt.getTime() + 1000;
      }
    }

    let linkedCount = 0;
    const createdPosts = [];
    for (const [index, result] of results.entries()) {
      const post = await prisma.post.create({
        data: {
          brandId,
          content: result.post,
          firstComment: result.firstComment || null,
          imageUrls: "[]",
          scheduledAt: new Date(baseTime + index * 1000),
          status: "PENDING",
          formulaId: result.formulaId,
          topic: result.topic,
          targetAudience: result.targetAudience,
          situation: result.situation,
          hookType: result.hookType,
          ctaType: result.ctaType,
          qualityScore: result.qualityScore,
          qualityProfile: result.qualityProfile,
          qualityPass: result.qualityPass,
          qualityReasons: JSON.stringify(result.qualityReasons),
          campaignId: result.campaignId,
          campaignFormulaId: result.campaignFormulaId,
          careerDecisionType: result.careerDecisionType,
        },
      });

      if (result.shouldLink && activeCampaign) {
        const utm = buildCampaignUtmLink(config.websiteUrl, activeCampaign, post.id);
        if (utm) {
          linkedCount++;
          createdPosts.push(await prisma.post.update({
            where: { id: post.id },
            data: {
              firstComment: appendFirstCommentLink(result.firstComment, utm.url),
              linkUrl: utm.url,
              utmContent: utm.utmContent,
            },
          }));
          continue;
        }
      }
      createdPosts.push(post);
    }

    return NextResponse.json({
      success: true,
      count: createdPosts.length,
      linkedCount,
      campaignId: activeCampaign?.id ?? null,
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Generate error:", error);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
