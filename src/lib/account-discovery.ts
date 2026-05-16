import type { AccountPattern, Brand, DiscoveredAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  analyzeViralText,
  calculateEngagementRate,
  calculateVelocityScore,
  calculateViralScore,
} from "@/lib/viral-analysis";
import { learnViralPatterns } from "@/lib/viral-service";
import { fetchPublicProfilePosts, searchThreadsByKeyword, type ThreadsPublicPost } from "@/lib/threads-api";
import { parseBrandConfig, type BrandConfig } from "@/types/brand";
import type {
  AccountPatternDimension,
  AccountPatternResponse,
  DiscoveredAccountCategory,
  DiscoveredAccountResponse,
  DiscoveredAccountSource,
  DiscoveredAccountStatus,
} from "@/types/account-discovery";
import type { ViralSourceError } from "@/types/viral";

const DEFAULT_MIN_SCORE = 60;
const DEFAULT_DISCOVERY_LIMIT = 20;
const DEFAULT_POST_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_KEYWORDS = 5;
const MAX_HANDLES = 20;

interface DiscoverOptions {
  keywords?: string[];
  handles?: string[];
  limit?: number;
  minScore?: number;
}

interface AnalyzeOptions {
  accountIds?: string[];
  limit?: number;
}

interface CandidateSeed {
  username: string;
  sourceKeyword: string;
  source: DiscoveredAccountSource;
  trusted: boolean;
  posts: ThreadsPublicPost[];
}

interface ScoredAccount {
  score: number;
  category: DiscoveredAccountCategory;
  reason: string;
}

interface PatternSeed {
  dimension: AccountPatternDimension;
  value: string | null;
}

export async function getDiscoveredAccounts(
  brandId: string,
  status?: DiscoveredAccountStatus
) {
  const accounts = await prisma.discoveredAccount.findMany({
    where: {
      brandId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { relevanceScore: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  const patterns = await prisma.accountPattern.findMany({
    where: { brandId },
    orderBy: [{ confidence: "desc" }, { sourceCount: "desc" }],
    take: 12,
  });

  return {
    accounts: accounts.map(formatAccount),
    patterns: patterns.map(formatPattern),
  };
}

export async function discoverAccounts(brandId: string, options: DiscoverOptions = {}) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const config = parseBrandConfig(brand.brandConfig);
  const keywords = buildSeedKeywords(config, options.keywords);
  const handles = buildSeedHandles(config, options.handles);
  const limit = clamp(options.limit ?? DEFAULT_DISCOVERY_LIMIT, 1, MAX_LIMIT);
  const minScore = clamp(options.minScore ?? DEFAULT_MIN_SCORE, 0, 100);
  const errors: ViralSourceError[] = [];
  const seeds = new Map<string, CandidateSeed>();

  for (const keyword of keywords.slice(0, MAX_KEYWORDS)) {
    try {
      const posts = await searchThreadsByKeyword(brand.accessToken, keyword, Math.min(limit, 20));
      for (const post of posts) {
        const username = normalizeUsername(post.username);
        if (!username) continue;
        const existing = seeds.get(username);
        seeds.set(username, {
          username,
          sourceKeyword: existing?.sourceKeyword ?? keyword,
          source: existing?.source ?? "keyword_search",
          trusted: existing?.trusted ?? false,
          posts: [...(existing?.posts ?? []), post],
        });
      }
    } catch (error) {
      errors.push({ adapter: "threads_keyword", source: keyword, message: formatError(error) });
    }
  }

  for (const handle of handles.slice(0, MAX_HANDLES)) {
    const username = normalizeUsername(handle);
    if (!username) continue;

    const existing = seeds.get(username);
    const profilePosts = existing ? [] : await fetchProfilePostsSafely(brand.accessToken, username, errors);
    seeds.set(username, {
      username,
      sourceKeyword: existing?.sourceKeyword ?? "seed_handle",
      source: existing?.source ?? "manual",
      trusted: true,
      posts: dedupePosts([...(existing?.posts ?? []), ...profilePosts]),
    });
  }

  let saved = 0;
  const candidateSeeds = Array.from(seeds.values()).slice(0, limit);
  for (const seed of candidateSeeds) {
    const profilePosts = seed.source === "keyword_search"
      ? await fetchProfilePostsSafely(brand.accessToken, seed.username, errors)
      : [];
    const allPosts = dedupePosts([...seed.posts, ...profilePosts]);
    const scored = scoreAccount(seed.username, allPosts, config, seed.sourceKeyword);
    const relevanceScore = seed.trusted ? Math.max(scored.score, minScore) : scored.score;
    if (relevanceScore < minScore) continue;
    const reason = seed.trusted && scored.score < minScore
      ? "사용자가 지정한 seed handle · watch 여부를 직접 판단"
      : scored.reason;

    const existing = await prisma.discoveredAccount.findUnique({
      where: { brandId_username: { brandId, username: seed.username } },
    });

    await prisma.discoveredAccount.upsert({
      where: { brandId_username: { brandId, username: seed.username } },
      update: {
        relevanceScore,
        category: scored.category,
        reason,
        source: seed.source,
        sourceKeyword: seed.sourceKeyword,
        lastDiscoveredAt: new Date(),
      },
      create: {
        brandId,
        username: seed.username,
        profileUrl: `https://www.threads.net/@${seed.username}`,
        status: "candidate",
        category: scored.category,
        relevanceScore,
        reason,
        source: seed.source,
        sourceKeyword: seed.sourceKeyword,
      },
    });

    if (existing?.status !== "ignored") saved++;
  }

  const candidates = await prisma.discoveredAccount.findMany({
    where: {
      brandId,
      status: { in: ["candidate", "watched"] },
      relevanceScore: { gte: minScore },
    },
    orderBy: [{ relevanceScore: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return {
    success: true,
    discovered: seeds.size,
    saved,
    candidates: candidates.map(formatAccount),
    errors,
  };
}

export async function updateDiscoveredAccountStatus(
  accountId: string,
  status: DiscoveredAccountStatus
) {
  const account = await prisma.discoveredAccount.update({
    where: { id: accountId },
    data: { status },
  });
  return formatAccount(account);
}

export async function analyzeWatchedAccounts(brandId: string, options: AnalyzeOptions = {}) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const config = parseBrandConfig(brand.brandConfig);
  const brandTopics = buildBrandTopics(config);
  const limit = clamp(options.limit ?? DEFAULT_POST_LIMIT, 1, MAX_LIMIT);
  const errors: ViralSourceError[] = [];
  const accounts = await prisma.discoveredAccount.findMany({
    where: {
      brandId,
      status: "watched",
      ...(options.accountIds?.length ? { id: { in: options.accountIds } } : {}),
    },
    orderBy: [{ relevanceScore: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });

  let savedPosts = 0;
  for (const account of accounts) {
    try {
      const posts = await fetchPublicProfilePosts(brand.accessToken, account.username, limit);
      for (const post of dedupePosts(posts)) {
        if (!post.text?.trim()) continue;
        const wasNew = await saveAccountPost(brand, account, post, config, brandTopics);
        if (wasNew) savedPosts++;
      }
      await prisma.discoveredAccount.update({
        where: { id: account.id },
        data: { lastScannedAt: new Date() },
      });
    } catch (error) {
      errors.push({ adapter: "threads_profile", source: account.username, message: formatError(error) });
    }
  }

  const patterns = await refreshAccountPatterns(brandId);
  const viralLearning = await learnViralPatterns(brandId);

  return {
    success: true,
    scannedAccounts: accounts.length,
    savedPosts,
    learnedPatterns: patterns.length,
    recommendations: [
      ...patterns.slice(0, 3).map((pattern) => pattern.recommendation),
      ...viralLearning.memory.recommendations.slice(0, 2),
    ],
    errors,
  };
}

async function saveAccountPost(
  brand: Brand,
  account: DiscoveredAccount,
  post: ThreadsPublicPost,
  config: BrandConfig,
  brandTopics: string[]
): Promise<boolean> {
  const sourceKey = post.id;
  const content = post.text ?? "";
  const analysis = analyzeViralText(content, brandTopics);
  const discoveredAt = new Date();
  const publishedAt = parseDate(post.timestamp);
  const relevanceScore = scoreContent(content, config);
  const viralScore = calculateViralScore({ publishedAt, discoveredAt }, content);
  const existing = await prisma.discoveredAccountPost.findUnique({
    where: { accountId_sourceKey: { accountId: account.id, sourceKey } },
  });

  await prisma.$transaction([
    prisma.discoveredAccountPost.upsert({
      where: { accountId_sourceKey: { accountId: account.id, sourceKey } },
      update: {
        permalink: post.permalink ?? null,
        content,
        publishedAt,
        hookType: analysis.hookType,
        topic: analysis.topic,
        emotionalDriver: analysis.emotionalDriver,
        structureType: analysis.structureType,
        ctaType: analysis.ctaType,
        patternSummary: analysis.patternSummary,
        relevanceScore,
      },
      create: {
        accountId: account.id,
        sourceKey,
        permalink: post.permalink ?? null,
        content,
        publishedAt,
        hookType: analysis.hookType,
        topic: analysis.topic,
        emotionalDriver: analysis.emotionalDriver,
        structureType: analysis.structureType,
        ctaType: analysis.ctaType,
        patternSummary: analysis.patternSummary,
        relevanceScore,
      },
    }),
    prisma.viralExample.upsert({
      where: {
        brandId_source_sourceKey: {
          brandId: brand.id,
          source: "threads_profile",
          sourceKey,
        },
      },
      update: {
        authorUsername: account.username,
        permalink: post.permalink ?? null,
        content,
        publishedAt,
        engagementRate: calculateEngagementRate({ publishedAt, discoveredAt }),
        velocityScore: calculateVelocityScore({ publishedAt, discoveredAt }),
        viralScore,
        hookType: analysis.hookType,
        topic: analysis.topic,
        emotionalDriver: analysis.emotionalDriver,
        structureType: analysis.structureType,
        ctaType: analysis.ctaType,
        patternSummary: analysis.patternSummary,
        keyTakeaway: analysis.keyTakeaway,
        rawMetrics: JSON.stringify({
          accountId: account.id,
          username: account.username,
          watchedAccount: true,
          relevanceScore,
        }),
        discoveredAt,
      },
      create: {
        brandId: brand.id,
        source: "threads_profile",
        sourceKey,
        authorUsername: account.username,
        permalink: post.permalink ?? null,
        content,
        publishedAt,
        engagementRate: calculateEngagementRate({ publishedAt, discoveredAt }),
        velocityScore: calculateVelocityScore({ publishedAt, discoveredAt }),
        viralScore,
        hookType: analysis.hookType,
        topic: analysis.topic,
        emotionalDriver: analysis.emotionalDriver,
        structureType: analysis.structureType,
        ctaType: analysis.ctaType,
        patternSummary: analysis.patternSummary,
        keyTakeaway: analysis.keyTakeaway,
        rawMetrics: JSON.stringify({
          accountId: account.id,
          username: account.username,
          watchedAccount: true,
          relevanceScore,
        }),
        discoveredAt,
      },
    }),
  ]);

  return !existing;
}

async function refreshAccountPatterns(brandId: string): Promise<AccountPatternResponse[]> {
  const posts = await prisma.discoveredAccountPost.findMany({
    where: { account: { brandId, status: "watched" } },
    orderBy: [{ relevanceScore: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  const groups = new Map<string, { dimension: AccountPatternDimension; value: string; count: number }>();

  for (const post of posts) {
    for (const seed of getPatternSeeds(post)) {
      if (!seed.value) continue;
      const key = `${seed.dimension}:${seed.value}`;
      const current = groups.get(key);
      groups.set(key, {
        dimension: seed.dimension,
        value: seed.value,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  const patterns = Array.from(groups.values())
    .map((pattern) => ({
      ...pattern,
      confidence: Math.min(100, Math.round(pattern.count * 18)),
      recommendation: buildPatternRecommendation(pattern.dimension, pattern.value),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);

  await prisma.$transaction([
    prisma.accountPattern.deleteMany({ where: { brandId } }),
    ...patterns.map((pattern) => prisma.accountPattern.create({
      data: {
        brandId,
        accountId: null,
        dimension: pattern.dimension,
        value: pattern.value,
        sourceCount: pattern.count,
        confidence: pattern.confidence,
        recommendation: pattern.recommendation,
      },
    })),
  ]);

  const saved = await prisma.accountPattern.findMany({
    where: { brandId },
    orderBy: [{ confidence: "desc" }, { sourceCount: "desc" }],
    take: 12,
  });
  return saved.map(formatPattern);
}

function scoreAccount(
  username: string,
  posts: ThreadsPublicPost[],
  config: BrandConfig,
  sourceKeyword: string
): ScoredAccount {
  const text = [username, sourceKeyword, ...posts.map((post) => post.text ?? "")].join("\n");
  const score = scoreContent(text, config);
  const category = categorize(text);
  const reasons = [];
  if (hasCareerSignal(text)) reasons.push("커리어 불안 신호");
  if (hasSajuSignal(text)) reasons.push("사주/타이밍 언어");
  if (hasCtaSignal(text)) reasons.push("댓글/공유 CTA");
  if (hasBrandTopicSignal(text, config)) reasons.push("브랜드 토픽 겹침");
  return {
    score,
    category,
    reason: reasons.length ? reasons.join(" · ") : "공개 글 구조가 일부 연관됨",
  };
}

function scoreContent(content: string, config: BrandConfig): number {
  let score = 0;
  if (hasBrandTopicSignal(content, config)) score += 30;
  if (hasCareerSignal(content)) score += 25;
  if (hasSajuSignal(content)) score += 15;
  if (hasCtaSignal(content)) score += 15;
  if (!hasExcludedTerm(content, config.viralDiscovery.excludedTerms)) score += 15;
  return Math.min(100, score);
}

function buildSeedKeywords(config: BrandConfig, requested: string[] = []): string[] {
  return unique([
    ...requested,
    ...config.viralDiscovery.keywords,
    ...config.topics,
    ...(config.trendingTopics ?? []),
    "이직 고민",
    "퇴사 고민",
    "번아웃",
    "커리어 타이밍",
    "직업운",
  ]).slice(0, MAX_KEYWORDS);
}

function buildSeedHandles(config: BrandConfig, requested: string[] = []): string[] {
  return unique([
    ...requested,
    ...config.viralDiscovery.competitorHandles,
  ])
    .map((handle) => extractUsername(handle))
    .filter((handle): handle is string => Boolean(handle));
}

function buildBrandTopics(config: BrandConfig): string[] {
  return unique([
    ...config.topics,
    ...(config.trendingTopics ?? []),
    ...config.targets,
    ...config.situations,
    "이직",
    "퇴사",
    "번아웃",
    "커리어",
    "직업운",
  ]);
}

async function fetchProfilePostsSafely(
  accessToken: string,
  username: string,
  errors: ViralSourceError[]
): Promise<ThreadsPublicPost[]> {
  try {
    return await fetchPublicProfilePosts(accessToken, username, DEFAULT_POST_LIMIT);
  } catch (error) {
    errors.push({ adapter: "threads_profile", source: username, message: formatError(error) });
    return [];
  }
}

function getPatternSeeds(post: {
  hookType: string | null;
  topic: string | null;
  emotionalDriver: string | null;
  structureType: string | null;
  ctaType: string | null;
}): PatternSeed[] {
  return [
    { dimension: "hook", value: post.hookType },
    { dimension: "topic", value: post.topic },
    { dimension: "emotion", value: post.emotionalDriver },
    { dimension: "structure", value: post.structureType },
    { dimension: "cta", value: post.ctaType },
  ];
}

function buildPatternRecommendation(dimension: AccountPatternDimension, value: string): string {
  const labels: Record<AccountPatternDimension, string> = {
    hook: "첫 문장",
    topic: "주제",
    emotion: "감정",
    structure: "전개 구조",
    cta: "행동 유도",
  };
  return `watched 계정에서 ${labels[dimension]} '${value}' 패턴이 반복됩니다. 다음 배치에서 구조만 변주해 테스트하세요.`;
}

function categorize(content: string): DiscoveredAccountCategory {
  if (hasSajuSignal(content) && hasCareerSignal(content)) return "competitor";
  if (hasSajuSignal(content)) return "saju";
  if (hasCareerSignal(content)) return "career";
  if (hasCtaSignal(content)) return "creator";
  return "adjacent";
}

function hasBrandTopicSignal(content: string, config: BrandConfig): boolean {
  const normalized = content.toLowerCase();
  return buildBrandTopics(config).some((topic) => normalized.includes(topic.toLowerCase()));
}

function hasCareerSignal(content: string): boolean {
  return /(이직|퇴사|커리어|직장|회사|연봉|번아웃|취업|면접|직업|일할|버틸지|옮길지)/.test(content);
}

function hasSajuSignal(content: string): boolean {
  return /(사주|운세|직업운|대운|세운|타이밍|흐름|성향|팔자|명리|운의|도화|홍염|화개)/.test(content);
}

function hasCtaSignal(content: string): boolean {
  return /(댓글|저장|공유|보내줘|프로필|첫 댓글|링크|태그)/.test(content);
}

function hasExcludedTerm(content: string, excludedTerms: string[]): boolean {
  const normalized = content.toLowerCase();
  return excludedTerms.some((term) => normalized.includes(term.toLowerCase()));
}

function formatAccount(account: DiscoveredAccount): DiscoveredAccountResponse {
  return {
    id: account.id,
    brandId: account.brandId,
    username: account.username,
    displayName: account.displayName,
    bio: account.bio,
    profileUrl: account.profileUrl,
    status: normalizeStatus(account.status),
    category: normalizeCategory(account.category),
    relevanceScore: account.relevanceScore,
    reason: account.reason,
    source: account.source === "manual" || account.source === "profile_expand" ? account.source : "keyword_search",
    sourceKeyword: account.sourceKeyword,
    lastDiscoveredAt: account.lastDiscoveredAt.toISOString(),
    lastScannedAt: account.lastScannedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function formatPattern(pattern: AccountPattern): AccountPatternResponse {
  return {
    id: pattern.id,
    brandId: pattern.brandId,
    accountId: pattern.accountId,
    dimension: normalizeDimension(pattern.dimension),
    value: pattern.value,
    sourceCount: pattern.sourceCount,
    confidence: pattern.confidence,
    recommendation: pattern.recommendation,
  };
}

function normalizeStatus(status: string): DiscoveredAccountStatus {
  return status === "watched" || status === "ignored" ? status : "candidate";
}

function normalizeCategory(category: string): DiscoveredAccountCategory {
  if (category === "career" || category === "saju" || category === "creator" || category === "competitor" || category === "adjacent") {
    return category;
  }
  return "unknown";
}

function normalizeDimension(dimension: string): AccountPatternDimension {
  if (dimension === "topic" || dimension === "emotion" || dimension === "structure" || dimension === "cta") {
    return dimension;
  }
  return "hook";
}

function normalizeUsername(username?: string | null): string | null {
  const normalized = username?.replace(/^@/, "").trim().toLowerCase();
  return normalized && /^[a-z0-9._]+$/.test(normalized) ? normalized : null;
}

function extractUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/@([^/?#]+)/);
    return normalizeUsername(match?.[1]);
  } catch {
    return normalizeUsername(trimmed);
  }
}

function dedupePosts(posts: ThreadsPublicPost[]): ThreadsPublicPost[] {
  const seen = new Set<string>();
  const result: ThreadsPublicPost[] = [];
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    result.push(post);
  }
  return result;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
