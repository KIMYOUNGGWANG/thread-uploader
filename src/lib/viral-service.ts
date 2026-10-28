import { decryptToken } from "@/lib/crypto";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { NEW_YEAR_MODE_IDS } from "@/lib/new-year/new-year-season";
import { SHORTS_SOURCE } from "@/lib/youtube/shorts-service";
import {
  analyzeViralText,
  buildViralMemory,
  calculateEngagementRate,
  calculateVelocityScore,
  calculateViralScore,
  keepFeedbackFields,
  calculateSearchSignalScore,
  mergeStoredRawMetrics,
} from "@/lib/viral-analysis";
import { fetchPublicProfilePosts, searchThreadsByKeyword, type ThreadsPublicPost } from "@/lib/threads-api";
import { allExternalSourcesFailed, harvestFromThreadsSources } from "@/lib/viral-harvester";
import { calculateReferenceScore, isEligibleSource, normalizeHandle, type EligibilityRules } from "@/lib/reference-radar";
import { parseBrandConfig } from "@/types/brand";
import {
  parseViralMemory,
  type ManualViralExample,
  type ViralAdapterId,
  type ViralPatternSummary,
  type ViralSourceError,
} from "@/types/viral";

export interface ViralDiscoveryOptions {
  useSavedSources?: boolean;
  keywords?: string[];
  handles?: string[];
  includeOwnPosts?: boolean;
  manualExamples?: ManualViralExample[];
  limit?: number;
}

interface CandidateExample {
  adapter: ViralAdapterId;
  source: string;
  sourceKey: string;
  authorUsername: string | null;
  permalink: string | null;
  content: string;
  publishedAt: Date | null;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  shares: number | null;
  rawMetrics: Record<string, string | number | boolean | null>;
}

interface DiscoveryRunConfig {
  useSavedSources: boolean;
  keywords: string[];
  handles: string[];
  excludedTerms: string[];
  minViralScore: number;
  limit: number;
  includeOwnPosts: boolean;
  includeManual: boolean;
}

export async function getViralReport(brandId: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const [examples, patterns, totalExamples] = await Promise.all([
    prisma.viralExample.findMany({
      where: { brandId, source: { not: SHORTS_SOURCE } },
      orderBy: [{ viralScore: "desc" }, { discoveredAt: "desc" }],
      take: 12,
    }),
    prisma.viralPattern.findMany({
      where: { brandId },
      orderBy: [{ confidence: "desc" }, { avgViralScore: "desc" }],
      take: 12,
    }),
    prisma.viralExample.count({ where: { brandId, source: { not: SHORTS_SOURCE } } }),
  ]);

  return {
    brandId,
    sampleSize: totalExamples,
    memory: parseViralMemory(brand.viralMemory),
    topPatterns: patterns.map((pattern) => ({
      id: pattern.id,
      dimension: pattern.dimension,
      value: pattern.value,
      sourceCount: pattern.sourceCount,
      avgViralScore: pattern.avgViralScore,
      confidence: pattern.confidence,
      recommendation: pattern.recommendation,
      exampleIds: parseStringArray(pattern.exampleIds),
    })),
    examples: examples.map((example) => ({
      ...readReferenceMetrics(example.rawMetrics),
      id: example.id,
      source: example.source,
      authorUsername: example.authorUsername,
      permalink: example.permalink,
      content: example.content,
      publishedAt: example.publishedAt?.toISOString() ?? null,
      discoveredAt: example.discoveredAt.toISOString(),
      views: example.views,
      likes: example.likes,
      replies: example.replies,
      reposts: example.reposts,
      quotes: example.quotes,
      shares: example.shares,
      engagementRate: example.engagementRate,
      viralScore: example.viralScore,
      hookType: example.hookType,
      topic: example.topic,
      emotionalDriver: example.emotionalDriver,
      structureType: example.structureType,
      ctaType: example.ctaType,
      patternSummary: example.patternSummary,
      keyTakeaway: example.keyTakeaway,
    })),
  };
}

export async function discoverViralExamples(brandId: string, options: ViralDiscoveryOptions = {}) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const config = parseBrandConfig(brand.brandConfig);
  const brandTopics = [...config.topics, ...(config.trendingTopics ?? [])].filter(Boolean);
  const runConfig = buildDiscoveryRunConfig(config, options, brandTopics);
  const errors: ViralSourceError[] = [];
  const candidates: CandidateExample[] = [];
  let externalAllFailed = false;

  if (runConfig.includeOwnPosts) {
    candidates.push(...await collectOwnPostCandidates(brandId, runConfig.limit));
  }

  if (runConfig.includeManual) {
    for (const manualExample of options.manualExamples ?? []) {
      const candidate = buildManualCandidate(manualExample);
      if (candidate) candidates.push(candidate);
    }
  }

  if (brand.accessToken) {
    const harvestResult = await harvestFromThreadsSources({
      accessToken: decryptToken(brand.accessToken),
      keywords: runConfig.keywords,
      handles: runConfig.handles,
      excludedTerms: runConfig.excludedTerms,
      maxPerSource: runConfig.limit,
      requestDelayMs: 300,
    });

    errors.push(...harvestResult.errors);
    externalAllFailed = allExternalSourcesFailed(harvestResult);

    for (const harvested of harvestResult.candidates) {
      candidates.push({
        adapter: harvested.adapter,
        source: harvested.source,
        sourceKey: harvested.sourceKey,
        authorUsername: harvested.authorUsername,
        permalink: harvested.permalink,
        content: harvested.content,
        publishedAt: harvested.publishedAt,
        views: harvested.views,
        likes: harvested.likes,
        replies: harvested.replies,
        reposts: harvested.reposts,
        quotes: harvested.quotes,
        shares: harvested.shares,
        rawMetrics: harvested.rawMetrics,
      });
    }
  }

  const uniqueCandidates = dedupeCandidates(candidates)
    .filter((candidate) => candidate.content.trim().length > 0)
    .filter((candidate) => !hasExcludedTerm(candidate.content, runConfig.excludedTerms));
  let saved = 0;
  const rules: EligibilityRules = {
    ownHandle: config.viralDiscovery.ownHandle ?? null,
    excludedHandles: config.viralDiscovery.excludedHandles,
    now: new Date(),
  };

  for (const candidate of uniqueCandidates) {
    const savedExample = await saveCandidate(brandId, candidate, brandTopics, runConfig.minViralScore, rules);
    if (savedExample) saved++;
  }

  // Without the threads_keyword_search permission the API answers keyword searches with the token owner's own posts only,
  // which looks like a healthy run (no errors, rows saved) while ref_replay never gets an outside source. Surface it.
  const keywordHits = candidates.filter((candidate) => candidate.adapter === "threads_keyword");
  const keywordOnlyOwnPosts =
    rules.ownHandle !== null &&
    keywordHits.length > 0 &&
    keywordHits.every((candidate) => candidate.authorUsername !== null && normalizeHandle(candidate.authorUsername) === normalizeHandle(rules.ownHandle ?? ""));

  return {
    success: true,
    discovered: candidates.length,
    saved,
    errors,
    externalAllFailed,
    keywordOnlyOwnPosts,
    ...(await getViralReport(brandId)),
  };
}

export async function learnViralPatterns(brandId: string) {
  const examples = await prisma.viralExample.findMany({
    where: { brandId, source: { not: SHORTS_SOURCE } },
    orderBy: [{ viralScore: "desc" }, { discoveredAt: "desc" }],
    take: 500,
  });

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { viralMemory: true } });
  const builtMemory = buildViralMemory(examples.map((example) => ({
    id: example.id,
    source: example.source,
    content: example.content,
    viralScore: example.viralScore,
    views: example.views,
    likes: example.likes,
    replies: example.replies,
    reposts: example.reposts,
    quotes: example.quotes,
    shares: example.shares,
    publishedAt: example.publishedAt,
    discoveredAt: example.discoveredAt,
    hookType: example.hookType,
    topic: example.topic,
    emotionalDriver: example.emotionalDriver,
    structureType: example.structureType,
    ctaType: example.ctaType,
  })));
  const memory = keepFeedbackFields(builtMemory, brand?.viralMemory ?? null);

  await prisma.$transaction([
    prisma.viralPattern.deleteMany({ where: { brandId } }),
    ...memory.topPatterns.map((pattern) => prisma.viralPattern.create({
      data: buildPatternCreateInput(brandId, pattern),
    })),
    prisma.brand.update({
      where: { id: brandId },
      data: { viralMemory: JSON.stringify(memory) },
    }),
  ]);

  return {
    success: true,
    learnedExamples: examples.length,
    learnedPatterns: memory.topPatterns.length,
    ...(await getViralReport(brandId)),
  };
}

function buildDiscoveryRunConfig(
  config: ReturnType<typeof parseBrandConfig>,
  options: ViralDiscoveryOptions,
  brandTopics: string[]
): DiscoveryRunConfig {
  const useSavedSources = options.useSavedSources !== false;
  const sourceConfig = config.viralDiscovery;
  const savedKeywords = useSavedSources && isAdapterEnabled(sourceConfig.adapters, "threads_keyword")
    ? sourceConfig.keywords
    : [];
  const savedHandles = useSavedSources && isAdapterEnabled(sourceConfig.adapters, "threads_profile")
    ? sourceConfig.competitorHandles
    : [];
  const keywords = uniqueStrings([...savedKeywords, ...normalizeList(options.keywords)]);
  const keywordSources = keywords.length > 0 ? keywords : brandTopics.slice(0, 3);

  return {
    useSavedSources,
    keywords: keywordSources,
    handles: uniqueStrings([...savedHandles, ...normalizeList(options.handles).map((handle) => handle.replace(/^@/, ""))]),
    excludedTerms: useSavedSources ? sourceConfig.excludedTerms : [],
    minViralScore: useSavedSources ? sourceConfig.minViralScore : 0,
    limit: clampInteger(options.limit ?? sourceConfig.maxExamplesPerRun, 1, 50),
    includeOwnPosts: options.includeOwnPosts ?? (useSavedSources && isAdapterEnabled(sourceConfig.adapters, "owned_posts")),
    includeManual: !useSavedSources || isAdapterEnabled(sourceConfig.adapters, "manual"),
  };
}

async function collectOwnPostCandidates(brandId: string, limit: number): Promise<CandidateExample[]> {
  const posts = await prisma.post.findMany({
    where: {
      brandId,
      status: "PUBLISHED",
      OR: [
        { metricsAt: { not: null } },
        { performanceScore: { not: null } },
      ],
      // Seasonal New Year posts must not become examples; NULL formulaId stays in (SQL `NOT IN` drops NULL).
      AND: [{ OR: [{ formulaId: null }, { formulaId: { notIn: [...NEW_YEAR_MODE_IDS] } }] }],
    },
    orderBy: [
      { performanceScore: "desc" },
      { metricsAt: "desc" },
    ],
    take: limit,
  });

  return posts.map((post) => ({
    adapter: "owned_posts",
    source: "own_post",
    sourceKey: post.id,
    authorUsername: null,
    permalink: null,
    content: post.content,
    publishedAt: post.scheduledAt,
    views: post.views,
    likes: post.likes,
    replies: post.replies,
    reposts: post.reposts,
    quotes: null,
    shares: null,
    rawMetrics: {
      postId: post.id,
      threadsId: post.threadsId,
      performanceScore: post.performanceScore,
      performanceTier: post.performanceTier,
    },
  }));
}

function buildManualCandidate(example: ManualViralExample): CandidateExample | null {
  if (!example.content.trim()) return null;

  return {
    adapter: "manual",
    source: "manual",
    sourceKey: stableSourceKey(example.permalink ?? example.content),
    authorUsername: example.authorUsername ?? null,
    permalink: example.permalink ?? null,
    content: example.content,
    publishedAt: parseDate(example.publishedAt),
    views: normalizeMetric(example.views),
    likes: normalizeMetric(example.likes),
    replies: normalizeMetric(example.replies),
    reposts: normalizeMetric(example.reposts),
    quotes: normalizeMetric(example.quotes),
    shares: normalizeMetric(example.shares),
    rawMetrics: { imported: true },
  };
}

function buildThreadsCandidate(
  post: ThreadsPublicPost,
  adapter: ViralAdapterId,
  source: string,
  sourceContext: Record<string, string>
): CandidateExample {
  return {
    adapter,
    source,
    sourceKey: post.id,
    authorUsername: post.username ?? null,
    permalink: post.permalink ?? null,
    content: post.text ?? "",
    publishedAt: parseDate(post.timestamp),
    views: null,
    likes: null,
    replies: null,
    reposts: null,
    quotes: null,
    shares: null,
    rawMetrics: {
      ...sourceContext,
      hasReplies: post.has_replies ?? null,
      isQuotePost: post.is_quote_post ?? null,
      topicTag: post.topic_tag ?? null,
    },
  };
}

async function saveCandidate(
  brandId: string,
  candidate: CandidateExample,
  brandTopics: string[],
  minViralScore: number,
  rules: EligibilityRules
) {
  const discoveredAt = new Date();
  const where = { brandId_source_sourceKey: { brandId, source: candidate.source, sourceKey: candidate.sourceKey } };
  const existing = await prisma.viralExample.findUnique({ where, select: { rawMetrics: true } });
  const stored = mergeStoredRawMetrics(existing?.rawMetrics ?? null, candidate.rawMetrics);
  const scoreMetrics = { ...candidate, discoveredAt };
  // Other accounts' posts come back without counts, so TOP-search placement stands in for engagement.
  const searchBonus = candidate.views === null ? calculateSearchSignalScore(stored.signal) : 0;
  const viralScore = calculateViralScore(scoreMetrics, candidate.content) + searchBonus;
  // minViralScore is tuned for posts with counts (own posts, shorts). A count-less outside post tops out near 40,
  // so the threshold would drop every keyword-search hit and ref_replay would never get a source; those are ranked by referenceScore instead.
  if (candidate.views !== null && viralScore < minViralScore) return null;

  stored.merged.referenceScore = calculateReferenceScore({
    signal: stored.signal,
    content: candidate.content,
    hasReplies: typeof candidate.rawMetrics.hasReplies === "boolean" ? candidate.rawMetrics.hasReplies : null,
  });
  stored.merged.eligibleSource = isEligibleSource(
    {
      authorUsername: candidate.authorUsername,
      publishedAt: candidate.publishedAt,
      timesSeen: stored.signal.timesSeen ?? 1,
      firstSeenAt: typeof stored.merged.firstSeenAt === "string" ? stored.merged.firstSeenAt : null,
    },
    rules
  );

  const fields = {
    authorUsername: candidate.authorUsername,
    permalink: candidate.permalink,
    content: candidate.content,
    publishedAt: candidate.publishedAt,
    views: candidate.views,
    likes: candidate.likes,
    replies: candidate.replies,
    reposts: candidate.reposts,
    quotes: candidate.quotes,
    shares: candidate.shares,
    engagementRate: calculateEngagementRate(candidate),
    velocityScore: calculateVelocityScore(scoreMetrics),
    viralScore,
    rawMetrics: JSON.stringify(stored.merged),
    discoveredAt,
  };
  const analysis = buildRuleAnalysisFields(candidate.content, brandTopics);

  return prisma.viralExample.upsert({
    where,
    // Rule-based labels must not overwrite a Claude analysis of the same post.
    update: stored.isLlmAnalyzed ? fields : { ...fields, ...analysis },
    create: { brandId, source: candidate.source, sourceKey: candidate.sourceKey, ...fields, ...analysis },
  });
}

function buildRuleAnalysisFields(content: string, brandTopics: string[]) {
  const analysis = analyzeViralText(content, brandTopics);
  return {
    hookType: analysis.hookType,
    topic: analysis.topic,
    emotionalDriver: analysis.emotionalDriver,
    structureType: analysis.structureType,
    ctaType: analysis.ctaType,
    patternSummary: analysis.patternSummary,
    keyTakeaway: analysis.keyTakeaway,
  };
}

function buildPatternCreateInput(brandId: string, pattern: ViralPatternSummary) {
  return {
    brandId,
    dimension: pattern.dimension,
    value: pattern.value,
    sourceCount: pattern.count,
    avgViralScore: pattern.avgViralScore,
    confidence: pattern.confidence,
    exampleIds: JSON.stringify(pattern.exampleIds),
    recommendation: pattern.recommendation,
  };
}

function dedupeCandidates(candidates: CandidateExample[]): CandidateExample[] {
  const seen = new Set<string>();
  const uniqueCandidates = [];

  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.sourceKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}

export function isAdapterEnabled(
  adapters: Array<{ id: ViralAdapterId; enabled: boolean }>,
  id: ViralAdapterId
): boolean {
  return adapters.find((adapter) => adapter.id === id)?.enabled ?? false;
}

function hasExcludedTerm(content: string, excludedTerms: string[]): boolean {
  const normalizedContent = content.toLowerCase();
  return excludedTerms.some((term) => normalizedContent.includes(term.toLowerCase()));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeMetric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function stableSourceKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readReferenceMetrics(raw: string): { referenceScore: number; timesSeen: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const record = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return { referenceScore: num(record.referenceScore), timesSeen: num(record.timesSeen) };
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
