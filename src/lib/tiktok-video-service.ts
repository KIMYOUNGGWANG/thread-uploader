import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { Brand, TikTokVideoDraft, TikTokVideoMetric } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatGrowthPromptContext, parseStoredGrowthMemory } from "@/lib/growth-learning";
import { checkTikTokVideoQuality } from "@/lib/tiktok-video-quality";
import { formatViralPromptContext } from "@/lib/viral-analysis";
import { getActiveCampaign, parseBrandConfig, TIKTOK_VIDEO_EXPERIMENT_DEFAULT } from "@/types/brand";
import type { TikTokVideoFormatConfig, TikTokVideoFormatId } from "@/types/brand";
import type { TikTokSceneBeat, TikTokVideoDraftResponse, TikTokVideoDraftStatus, TikTokVideoMetricResponse, TikTokSummaryResponse } from "@/types/tiktok-video";
import { parseViralMemory } from "@/types/viral";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const VALID_STATUSES = new Set<TikTokVideoDraftStatus>(["DRAFT", "APPROVED", "UPLOADED_MANUAL", "ARCHIVED"]);
const VALID_FORMATS = new Set<TikTokVideoFormatId>([
  "career_timing_diagnosis",
  "comment_diagnosis",
  "self_confession",
  "saju_myth_busting",
  "landing_teaser",
]);

type TikTokDraftWithMetrics = TikTokVideoDraft & { metrics: TikTokVideoMetric[] };

export class TikTokVideoDisabledError extends Error {
  constructor() {
    super("TikTok video lab is disabled for this product");
  }
}

interface GenerateTikTokVideosInput {
  brand: Brand;
  campaignId?: string | null;
  count: number;
  formatIds?: TikTokVideoFormatId[];
}

interface DraftCandidate {
  title: string;
  spokenHook: string;
  script: string;
  sceneBeats: TikTokSceneBeat[];
  captionOverlays: string[];
  onScreenText: string[];
  hashtags: string[];
  cta: string;
  durationSeconds: number;
}

interface UpdateDraftInput {
  status?: TikTokVideoDraftStatus;
  title?: string;
  spokenHook?: string;
  script?: string;
  sceneBeats?: TikTokSceneBeat[];
  captionOverlays?: string[];
  onScreenText?: string[];
  hashtags?: string[];
  cta?: string;
}

interface UpdateMetricInput {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profileClicks?: number;
  landingClicks?: number;
  conversions?: number;
  measuredAt?: string;
}

export async function getTikTokVideoDrafts(
  brandId: string,
  status?: TikTokVideoDraftStatus
): Promise<{ drafts: TikTokVideoDraftResponse[] }> {
  const drafts = await prisma.tikTokVideoDraft.findMany({
    where: {
      brandId,
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
    include: { metrics: { orderBy: { measuredAt: "desc" }, take: 1 } },
    take: 50,
  });
  return { drafts: drafts.map(serializeDraft) };
}

export async function generateTikTokVideoDrafts(input: GenerateTikTokVideosInput): Promise<{
  count: number;
  drafts: TikTokVideoDraftResponse[];
  quality: { passed: number; failed: number };
}> {
  const config = parseBrandConfig(input.brand.brandConfig);
  if (!config.tiktokVideo.enabled) throw new TikTokVideoDisabledError();
  const campaign = getActiveCampaign(config, input.campaignId ?? config.tiktokVideo.parentCampaignId);
  if (!campaign) throw new Error("campaign not found");

  const formatPool = buildFormatPool(config.tiktokVideo.formats, input.formatIds);
  if (formatPool.length === 0) throw new Error("TikTok formats are not configured");

  const growthContext = formatGrowthPromptContext(parseStoredGrowthMemory(input.brand.growthMemory));
  const viralContext = formatViralPromptContext(parseViralMemory(input.brand.viralMemory));
  const accountContext = await buildAccountPatternContext(input.brand.id);
  const created: TikTokDraftWithMetrics[] = [];

  for (let index = 0; index < input.count; index++) {
    const format = formatPool[index % formatPool.length];
    const candidate = await buildDraftCandidate({
      brand: input.brand,
      format,
      durationSeconds: config.tiktokVideo.defaultDurationSeconds,
      growthContext,
      viralContext,
      accountContext,
      index,
    });
    const quality = checkTikTokVideoQuality({
      formatId: format.id,
      spokenHook: candidate.spokenHook,
      script: candidate.script,
      captionOverlays: candidate.captionOverlays,
      onScreenText: candidate.onScreenText,
      cta: candidate.cta,
      sceneBeats: candidate.sceneBeats,
    });
    const draftId = randomUUID();
    const landingUrl = buildTikTokUtmLink(config.websiteUrl, config.tiktokVideo.landingUrl || campaign.landingUrl, campaign.utmCampaign, draftId);
    const draft = await prisma.tikTokVideoDraft.create({
      data: {
        id: draftId,
        brandId: input.brand.id,
        campaignId: campaign.id,
        formatId: format.id,
        status: "DRAFT",
        title: candidate.title,
        spokenHook: candidate.spokenHook,
        script: candidate.script,
        sceneBeats: JSON.stringify(candidate.sceneBeats),
        captionOverlays: JSON.stringify(candidate.captionOverlays),
        onScreenText: JSON.stringify(candidate.onScreenText),
        hashtags: JSON.stringify(candidate.hashtags),
        cta: candidate.cta,
        landingUrl,
        utmContent: draftId,
        qualityProfile: quality.profile,
        qualityPass: quality.pass,
        qualityScore: quality.score,
        qualityReasons: JSON.stringify(quality.reasons),
        durationSeconds: candidate.durationSeconds,
      },
      include: { metrics: { orderBy: { measuredAt: "desc" }, take: 1 } },
    });
    created.push(draft);
  }

  const drafts = created.map(serializeDraft);
  return {
    count: drafts.length,
    drafts,
    quality: {
      passed: drafts.filter((draft) => draft.qualityPass).length,
      failed: drafts.filter((draft) => !draft.qualityPass).length,
    },
  };
}

export async function updateTikTokVideoDraft(id: string, input: UpdateDraftInput): Promise<TikTokVideoDraftResponse> {
  const current = await prisma.tikTokVideoDraft.findUnique({
    where: { id },
    include: { metrics: { orderBy: { measuredAt: "desc" }, take: 1 } },
  });
  if (!current) throw new Error("TikTok draft not found");

  const merged = {
    title: input.title ?? current.title,
    spokenHook: input.spokenHook ?? current.spokenHook,
    script: input.script ?? current.script,
    sceneBeats: input.sceneBeats ?? parseSceneBeats(current.sceneBeats),
    captionOverlays: input.captionOverlays ?? parseStringList(current.captionOverlays),
    onScreenText: input.onScreenText ?? parseStringList(current.onScreenText),
    hashtags: input.hashtags ?? parseStringList(current.hashtags),
    cta: input.cta ?? current.cta,
    status: input.status ?? parseDraftStatus(current.status) ?? "DRAFT",
  };
  const quality = checkTikTokVideoQuality({
    formatId: parseFormatId(current.formatId),
    spokenHook: merged.spokenHook,
    script: merged.script,
    sceneBeats: merged.sceneBeats,
    captionOverlays: merged.captionOverlays,
    onScreenText: merged.onScreenText,
    cta: merged.cta,
  });

  if (merged.status === "APPROVED" && !quality.pass) {
    throw new Error("quality_failed");
  }
  if (merged.status === "UPLOADED_MANUAL" && current.status !== "APPROVED") {
    throw new Error("approve_before_upload");
  }

  const updated = await prisma.tikTokVideoDraft.update({
    where: { id },
    data: {
      title: merged.title,
      spokenHook: merged.spokenHook,
      script: merged.script,
      sceneBeats: JSON.stringify(merged.sceneBeats),
      captionOverlays: JSON.stringify(merged.captionOverlays),
      onScreenText: JSON.stringify(merged.onScreenText),
      hashtags: JSON.stringify(merged.hashtags),
      cta: merged.cta,
      status: merged.status,
      qualityPass: quality.pass,
      qualityScore: quality.score,
      qualityReasons: JSON.stringify(quality.reasons),
    },
    include: { metrics: { orderBy: { measuredAt: "desc" }, take: 1 } },
  });
  return serializeDraft(updated);
}

export async function updateTikTokVideoMetrics(draftId: string, input: UpdateMetricInput): Promise<TikTokVideoMetricResponse> {
  const metricInput = {
    views: input.views ?? 0,
    likes: input.likes ?? 0,
    comments: input.comments ?? 0,
    shares: input.shares ?? 0,
    saves: input.saves ?? 0,
    profileClicks: input.profileClicks ?? 0,
    landingClicks: input.landingClicks ?? 0,
    conversions: input.conversions ?? 0,
  };
  const performanceScore = calculateTikTokPerformanceScore(metricInput);
  const metric = await prisma.tikTokVideoMetric.create({
    data: {
      draftId,
      ...metricInput,
      measuredAt: input.measuredAt ? new Date(input.measuredAt) : new Date(),
      performanceScore,
    },
  });
  return serializeMetric(metric);
}

export async function getTikTokSummary(brand: Brand, campaignId?: string | null): Promise<TikTokSummaryResponse> {
  const config = parseBrandConfig(brand.brandConfig);
  const campaign = getActiveCampaign(config, campaignId ?? config.tiktokVideo.parentCampaignId);
  if (!campaign) throw new Error("campaign not found");
  const drafts = await prisma.tikTokVideoDraft.findMany({
    where: { brandId: brand.id, campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
    include: { metrics: { orderBy: { measuredAt: "desc" }, take: 1 } },
    take: 80,
  });
  const recentDrafts = drafts.slice(0, 12).map(serializeDraft);
  return {
    brandId: brand.id,
    campaignId: campaign.id,
    totals: {
      drafts: drafts.length,
      approved: drafts.filter((draft) => draft.status === "APPROVED").length,
      manualUploads: drafts.filter((draft) => draft.status === "UPLOADED_MANUAL").length,
      qualityPassed: drafts.filter((draft) => draft.qualityPass).length,
      qualityFailed: drafts.filter((draft) => !draft.qualityPass).length,
    },
    topFormats: buildTopFormats(drafts),
    recommendations: buildTikTokRecommendations(drafts),
    recentDrafts,
  };
}

export function parseDraftStatus(input: unknown): TikTokVideoDraftStatus | undefined {
  return typeof input === "string" && VALID_STATUSES.has(input as TikTokVideoDraftStatus)
    ? input as TikTokVideoDraftStatus
    : undefined;
}

export function parseFormatIds(input: unknown): TikTokVideoFormatId[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const ids = input.filter((value): value is TikTokVideoFormatId => (
    typeof value === "string" && VALID_FORMATS.has(value as TikTokVideoFormatId)
  ));
  return ids.length ? Array.from(new Set(ids)) : undefined;
}

export function optionalMetric(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) return undefined;
  return Math.round(input);
}

function buildFormatPool(formats: TikTokVideoFormatConfig[], onlyFormatIds?: TikTokVideoFormatId[]): TikTokVideoFormatConfig[] {
  const selected = onlyFormatIds?.length
    ? formats.filter((format) => onlyFormatIds.includes(format.id))
    : formats;
  const pool: TikTokVideoFormatConfig[] = [];
  for (const format of selected.length ? selected : TIKTOK_VIDEO_EXPERIMENT_DEFAULT.formats) {
    for (let i = 0; i < format.weight; i++) pool.push(format);
  }
  return pool.length ? pool : TIKTOK_VIDEO_EXPERIMENT_DEFAULT.formats;
}

async function buildDraftCandidate(input: {
  brand: Brand;
  format: TikTokVideoFormatConfig;
  durationSeconds: number;
  growthContext: string;
  viralContext: string;
  accountContext: string;
  index: number;
}): Promise<DraftCandidate> {
  if (!anthropic) return fallbackDraft(input.format, input.durationSeconds, input.index);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1400,
    temperature: 0.9,
    system: "너는 CosmicPath의 TikTok 숏폼 전략가다. 과장된 운명 보장 없이 커리어 타이밍 불안을 댓글 진단형 영상으로 만든다.",
    messages: [{
      role: "user",
      content: buildTikTokPrompt(input),
    }],
  });
  const raw = (message.content[0] as { text: string }).text.trim();
  return normalizeCandidate(parseJsonObject(raw), input.format, input.durationSeconds, input.index);
}

function buildTikTokPrompt(input: {
  format: TikTokVideoFormatConfig;
  durationSeconds: number;
  growthContext: string;
  viralContext: string;
  accountContext: string;
}): string {
  return [
    `TikTok 영상 포맷: ${input.format.name} (${input.format.id})`,
    input.format.instruction,
    `목표 길이: ${input.durationSeconds}초`,
    "",
    "[성과 학습 메모리]",
    input.growthContext,
    "",
    "[바이럴 레퍼런스 메모리]",
    input.viralContext,
    "",
    "[watched account 패턴]",
    input.accountContext,
    "",
    "조건:",
    "- 반드시 한국어로 작성",
    "- spokenHook은 첫 0-2초에 말할 1문장",
    "- 첫 hook/caption에 이직, 퇴사, 버틸지, 옮길지, 번아웃, 커리어, 회사 중 하나 포함",
    "- 타이밍/흐름/성향/결정 패턴/운의 리듬 중 하나로 CosmicPath 결 유지",
    "- 댓글에 A/B/C 또는 현재 상황을 남기게 하는 CTA 포함",
    "- '좋은 일이 올 거예요' 같은 generic 자기계발 금지",
    "- 의학/법률/금융/운명 확정 보장 금지",
    "",
    "아래 JSON만 출력:",
    JSON.stringify({
      title: "영상 제목",
      spokenHook: "0-2초 훅",
      script: "15-35초 spoken script",
      sceneBeats: [
        { startSecond: 0, endSecond: 2, visualDirection: "화면 지시", narration: "내레이션" },
      ],
      captionOverlays: ["큰 자막 1", "큰 자막 2"],
      onScreenText: ["짧은 화면 텍스트"],
      hashtags: ["#커리어", "#퇴사고민"],
      cta: "댓글 CTA",
      durationSeconds: input.durationSeconds,
    }, null, 2),
  ].join("\n");
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("AI response did not include JSON");
  const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("AI response JSON must be an object");
  return parsed as Record<string, unknown>;
}

function normalizeCandidate(raw: Record<string, unknown>, format: TikTokVideoFormatConfig, durationSeconds: number, index: number): DraftCandidate {
  return {
    title: normalizeText(raw.title, `${format.name} #${index + 1}`),
    spokenHook: normalizeText(raw.spokenHook, fallbackDraft(format, durationSeconds, index).spokenHook),
    script: normalizeText(raw.script, fallbackDraft(format, durationSeconds, index).script),
    sceneBeats: normalizeSceneBeats(raw.sceneBeats, durationSeconds),
    captionOverlays: normalizeStringList(raw.captionOverlays, fallbackDraft(format, durationSeconds, index).captionOverlays),
    onScreenText: normalizeStringList(raw.onScreenText, fallbackDraft(format, durationSeconds, index).onScreenText),
    hashtags: normalizeHashtags(raw.hashtags),
    cta: normalizeText(raw.cta, fallbackDraft(format, durationSeconds, index).cta),
    durationSeconds: clampDuration(raw.durationSeconds, durationSeconds),
  };
}

function fallbackDraft(format: TikTokVideoFormatConfig, durationSeconds: number, index: number): DraftCandidate {
  const variants = [
    {
      hook: "퇴사할지 버틸지 헷갈리면 이 3가지만 봐",
      frame: "A는 버팀형, B는 이동형, C는 준비형이야.",
    },
    {
      hook: "이직 고민이 반복된다면 결정 패턴부터 봐야 해",
      frame: "지금 흔들리는 게 감정인지 타이밍인지 나눠보자.",
    },
    {
      hook: "번아웃인데 옮길지 말지 모르겠다면 멈춰봐",
      frame: "운의 리듬보다 먼저 봐야 할 건 에너지 누수야.",
    },
  ];
  const variant = variants[index % variants.length];
  return {
    title: `${format.name} ${index + 1}`,
    spokenHook: variant.hook,
    script: `${variant.hook}. ${variant.frame} 버팀형은 판을 엎기보다 조건을 정리할 때고, 이동형은 같은 문제가 반복될 때야. 준비형은 당장 결론보다 2주 안에 확인할 조건이 먼저야. 댓글에 A/B/C랑 지금 상황을 짧게 써줘.`,
    sceneBeats: [
      { startSecond: 0, endSecond: 2, visualDirection: "정면 클로즈업, 첫 문장 큰 자막", narration: variant.hook },
      { startSecond: 3, endSecond: 12, visualDirection: "A/B/C 선택지 자막 전환", narration: variant.frame },
      { startSecond: 13, endSecond: durationSeconds, visualDirection: "댓글 입력 예시와 CosmicPath 리포트 화면 티저", narration: "댓글에 상황을 남기면 어느 흐름에 가까운지 같이 볼 수 있어." },
    ],
    captionOverlays: [variant.hook, "버팀형 / 이동형 / 준비형", "댓글에 A/B/C"],
    onScreenText: ["커리어 타이밍", "결정 패턴", "댓글 진단"],
    hashtags: ["#커리어", "#퇴사고민", "#이직고민", "#CosmicPath"],
    cta: "댓글에 A/B/C와 지금 상황을 짧게 남겨줘.",
    durationSeconds,
  };
}

function buildTikTokUtmLink(websiteUrl: string, landingUrl: string, campaignId: string, draftId: string): string | null {
  const params = new URLSearchParams({
    utm_source: "tiktok",
    utm_campaign: campaignId,
    utm_content: draftId,
  });
  if (/^https?:\/\//.test(landingUrl)) {
    const url = new URL(landingUrl);
    for (const [key, value] of params) url.searchParams.set(key, value);
    return url.toString();
  }
  if (websiteUrl.trim()) {
    try {
      const normalized = /^https?:\/\//.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
      const url = new URL(landingUrl.startsWith("/") ? landingUrl : `/${landingUrl}`, normalized);
      for (const [key, value] of params) url.searchParams.set(key, value);
      return url.toString();
    } catch {
      return null;
    }
  }
  return `${landingUrl}${landingUrl.includes("?") ? "&" : "?"}${params.toString()}`;
}

async function buildAccountPatternContext(brandId: string): Promise<string> {
  const patterns = await prisma.accountPattern.findMany({
    where: { brandId },
    orderBy: [{ confidence: "desc" }, { sourceCount: "desc" }],
    take: 5,
  });
  if (patterns.length === 0) return "watched account 패턴은 아직 없습니다.";
  return patterns.map((pattern) => `- ${pattern.dimension}: ${pattern.value} (${pattern.recommendation})`).join("\n");
}

function buildTopFormats(drafts: TikTokDraftWithMetrics[]) {
  const groups = new Map<string, TikTokDraftWithMetrics[]>();
  for (const draft of drafts) {
    groups.set(draft.formatId, [...(groups.get(draft.formatId) ?? []), draft]);
  }
  return Array.from(groups.entries())
    .map(([formatId, group]) => ({
      formatId: parseFormatId(formatId),
      count: group.length,
      avgPerformanceScore: average(group.map((draft) => draft.metrics[0]?.performanceScore ?? 0)),
    }))
    .sort((a, b) => b.avgPerformanceScore - a.avgPerformanceScore)
    .slice(0, 5);
}

function buildTikTokRecommendations(drafts: TikTokDraftWithMetrics[]): string[] {
  if (drafts.length === 0) return ["첫 TikTok draft 7개를 생성해 포맷별 반응을 넓게 테스트하세요."];
  const recommendations: string[] = [];
  const passRate = drafts.filter((draft) => draft.qualityPass).length / drafts.length;
  const uploaded = drafts.filter((draft) => draft.status === "UPLOADED_MANUAL").length;
  const measured = drafts.filter((draft) => draft.metrics.length > 0).length;
  const topFormat = buildTopFormats(drafts).find((format) => format.avgPerformanceScore > 0);

  if (passRate < 0.7) recommendations.push("quality pass rate가 낮습니다. 첫 hook에 커리어 불안과 댓글 CTA를 더 명확히 넣으세요.");
  if (uploaded === 0) recommendations.push("통과한 draft 중 3개를 골라 TikTok에 수동 업로드하고 48시간 뒤 성과를 입력하세요.");
  if (uploaded > 0 && measured === 0) recommendations.push("업로드한 영상의 48시간 성과를 입력해야 다음 포맷 추천이 가능합니다.");
  if (topFormat) recommendations.push(`${formatLabel(topFormat.formatId)} 포맷을 다음 batch에서 더 자주 테스트하세요.`);
  if (recommendations.length === 0) recommendations.push("현재 포맷 분산이 안정적입니다. 다음 batch는 상위 포맷 60%, 신규 각도 40%로 생성하세요.");
  return recommendations;
}

export function calculateTikTokPerformanceScore(metrics: {
  views: number;
  comments: number;
  shares: number;
  saves: number;
  profileClicks: number;
  landingClicks: number;
  conversions: number;
}): number {
  const conversionSignal = metrics.profileClicks + metrics.landingClicks * 3 + metrics.conversions * 20;
  return Math.round(
    metrics.comments * 35
    + metrics.shares * 20
    + metrics.saves * 20
    + metrics.views * 0.15
    + conversionSignal * 10
  );
}

function serializeDraft(draft: TikTokDraftWithMetrics): TikTokVideoDraftResponse {
  const careerDecisionType = detectSerializedCareerDecisionType(draft.script);
  return {
    id: draft.id,
    brandId: draft.brandId,
    campaignId: draft.campaignId,
    formatId: parseFormatId(draft.formatId),
    status: parseDraftStatus(draft.status) ?? "DRAFT",
    title: draft.title,
    spokenHook: draft.spokenHook,
    script: draft.script,
    sceneBeats: parseSceneBeats(draft.sceneBeats),
    captionOverlays: parseStringList(draft.captionOverlays),
    onScreenText: parseStringList(draft.onScreenText),
    hashtags: parseStringList(draft.hashtags),
    cta: draft.cta,
    landingUrl: draft.landingUrl,
    utmContent: draft.utmContent,
    qualityProfile: "tiktok_career_timing",
    qualityPass: draft.qualityPass,
    qualityScore: draft.qualityScore,
    qualityReasons: parseStringList(draft.qualityReasons),
    ...(careerDecisionType && { careerDecisionType }),
    durationSeconds: draft.durationSeconds,
    renderTarget: {
      format: "webm",
      width: 1080,
      height: 1920,
      fps: 30,
    },
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    latestMetric: draft.metrics[0] ? serializeMetric(draft.metrics[0]) : null,
  };
}

function serializeMetric(metric: TikTokVideoMetric): TikTokVideoMetricResponse {
  return {
    draftId: metric.draftId,
    measuredAt: metric.measuredAt.toISOString(),
    views: metric.views,
    likes: metric.likes,
    comments: metric.comments,
    shares: metric.shares,
    saves: metric.saves,
    profileClicks: metric.profileClicks,
    landingClicks: metric.landingClicks,
    conversions: metric.conversions,
    performanceScore: metric.performanceScore,
  };
}

function parseStringList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function parseSceneBeats(raw: string): TikTokSceneBeat[] {
  try {
    return normalizeSceneBeats(JSON.parse(raw) as unknown, 25);
  } catch {
    return [];
  }
}

function normalizeStringList(input: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(input)) return fallback;
  const values = input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? Array.from(new Set(values)).slice(0, 12) : fallback;
}

function normalizeHashtags(input: unknown): string[] {
  const values = normalizeStringList(input, ["#커리어", "#퇴사고민", "#이직고민", "#CosmicPath"]);
  return values.map((value) => value.startsWith("#") ? value : `#${value.replace(/^#+/, "")}`).slice(0, 8);
}

function normalizeSceneBeats(input: unknown, durationSeconds: number): TikTokSceneBeat[] {
  if (!Array.isArray(input)) return fallbackDraft(TIKTOK_VIDEO_EXPERIMENT_DEFAULT.formats[0], durationSeconds, 0).sceneBeats;
  const beats = input
    .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value))
    .map((beat, index) => ({
      startSecond: normalizeSecond(beat.startSecond, index * 5),
      endSecond: normalizeSecond(beat.endSecond, Math.min(durationSeconds, index * 5 + 5)),
      visualDirection: normalizeText(beat.visualDirection, "정면 숏폼 화면"),
      narration: normalizeText(beat.narration, ""),
    }))
    .filter((beat) => beat.narration || beat.visualDirection);
  return beats.length ? beats.slice(0, 8) : fallbackDraft(TIKTOK_VIDEO_EXPERIMENT_DEFAULT.formats[0], durationSeconds, 0).sceneBeats;
}

function normalizeSecond(input: unknown, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input) ? Math.max(0, Math.round(input)) : fallback;
}

function normalizeText(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function clampDuration(input: unknown, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input)
    ? Math.min(60, Math.max(15, Math.round(input)))
    : fallback;
}

function parseFormatId(input: string): TikTokVideoFormatId {
  return VALID_FORMATS.has(input as TikTokVideoFormatId) ? input as TikTokVideoFormatId : "career_timing_diagnosis";
}

function detectSerializedCareerDecisionType(surface: string): "stay" | "move" | "prepare" | undefined {
  if (/버팀형|버티|남아|유지/.test(surface)) return "stay";
  if (/이동형|옮기|이직|퇴사|전환/.test(surface)) return "move";
  if (/준비형|준비|정리|포트폴리오|지원/.test(surface)) return "prepare";
  return undefined;
}

function formatLabel(formatId: TikTokVideoFormatId): string {
  return TIKTOK_VIDEO_EXPERIMENT_DEFAULT.formats.find((format) => format.id === formatId)?.name ?? formatId;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
