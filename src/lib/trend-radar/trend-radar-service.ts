import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { resolveBrandProfile, type BrandProfile } from "@/lib/brand-profile";
import { serializeBrandConfigUpdate } from "@/types/brand";
import { getFreshBrandCredentials, searchThreadsByKeyword } from "@/lib/threads-api";
import {
  DOMAIN_THREADS_KEYWORDS,
  harvestTemporalTrends,
  selectThreadsTrendSamples,
  type AbstractedTrendSkeleton,
  type TargetDomainCategory,
  type ThreadsTrendSample,
} from "./temporal-trend-harvester";
import { transposeSkeleton, type TransposedViralCandidate } from "./transposition-engine";
import { toTrendRadarMemory } from "./trend-radar-memory";

// Web search with dynamic filtering needs a Sonnet-class model; transposition is plain text.
const TREND_SEARCH_MODEL = "claude-sonnet-5-5";
const DOMAINS: TargetDomainCategory[] = ["CAREER_CONFLICT", "WEALTH_PANIC", "RELATIONSHIP_TOXICITY"];
const MAX_PAUSE_RESUMES = 3;
const MAX_TRANSPOSITIONS = 6;
const THREADS_RESULTS_PER_KEYWORD = 25;

// Surfaced in the cron response: keyword_search failures are otherwise invisible (web search still fills the run).
export interface ThreadsSearchStats {
  calls: number;
  failed: number;
  posts: number;
  firstError?: string;
  skipped?: string;
}

export interface TrendRadarRunResult {
  slug: string;
  skeletons: number;
  saved: number;
  skipped?: string;
  threadsSearch?: ThreadsSearchStats;
}

function createWebSearchQuery(client: Anthropic) {
  return async (prompt: string): Promise<string> => {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    for (let attempt = 0; attempt <= MAX_PAUSE_RESUMES; attempt++) {
      const message = await client.messages.create({
        model: TREND_SEARCH_MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages,
      });
      if (message.stop_reason !== "pause_turn") return readMessageText(message);
      messages.push({ role: "assistant", content: message.content });
    }
    throw new Error("Trend web search kept pausing without a final answer");
  };
}

function createTextQuery(client: Anthropic) {
  return async (prompt: string): Promise<string> => {
    const message = await client.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    return readMessageText(message);
  };
}

// Threads is the channel we publish on, so what is hot there outranks generic web results.
// Missing/expired token degrades to web-search-only instead of failing the run.
async function createThreadsSamplesFn(brandId: string, now: Date, stats: ThreadsSearchStats) {
  let accessToken: string;
  try {
    accessToken = (await getFreshBrandCredentials(brandId)).accessToken;
  } catch (error) {
    stats.skipped = error instanceof Error ? error.message : String(error);
    console.warn("[trend-radar] Threads search skipped:", stats.skipped);
    return undefined;
  }
  return async (domain: TargetDomainCategory): Promise<ThreadsTrendSample[]> => {
    const keywords = DOMAIN_THREADS_KEYWORDS[domain];
    const settled = await Promise.allSettled(
      keywords.map((keyword) => searchThreadsByKeyword(accessToken, keyword, THREADS_RESULTS_PER_KEYWORD))
    );
    const results = settled.flatMap((result, index) => {
      stats.calls += 1;
      if (result.status === "fulfilled") {
        stats.posts += result.value.length;
        return [{ keyword: keywords[index], posts: result.value }];
      }
      stats.failed += 1;
      stats.firstError ??= result.reason instanceof Error ? result.reason.message : String(result.reason);
      return [];
    });
    return selectThreadsTrendSamples(results, now);
  };
}

async function harvestAllDomains(client: Anthropic, brandId: string, now: Date, stats: ThreadsSearchStats): Promise<AbstractedTrendSkeleton[]> {
  const queryFn = createWebSearchQuery(client);
  const threadsSamplesFn = await createThreadsSamplesFn(brandId, now, stats);
  // One domain per call, in parallel, to stay inside the route's maxDuration.
  const perDomain = await Promise.all(
    DOMAINS.map((domain) => harvestTemporalTrends({ domains: [domain], referenceDate: now, queryFn, threadsSamplesFn }))
  );
  return perDomain.flat();
}

async function transposeAll(client: Anthropic, skeletons: AbstractedTrendSkeleton[], profile: BrandProfile) {
  const queryFn = createTextQuery(client);
  const settled = await Promise.allSettled(
    skeletons.slice(0, MAX_TRANSPOSITIONS).map((skeleton) => transposeSkeleton(skeleton, profile, queryFn))
  );
  return settled.flatMap((result): TransposedViralCandidate[] => (result.status === "fulfilled" ? [result.value] : []));
}

/** Harvests the last 72h of Korean community tension and stores brand-transposed hooks on brandConfig.trendRadar. */
export async function refreshBrandTrendRadar(brand: { id: string; slug: string; name: string; brandConfig: string }): Promise<TrendRadarRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { slug: brand.slug, skeletons: 0, saved: 0, skipped: "ANTHROPIC_API_KEY is not set" };
  const profile = resolveBrandProfile(brand.brandConfig, brand.slug, brand.name);
  if (profile.language !== "ko") return { slug: brand.slug, skeletons: 0, saved: 0, skipped: "trend radar sources are Korean-only" };

  const client = new Anthropic({ apiKey, timeout: 240_000, maxRetries: 1 });
  const now = new Date();
  const threadsSearch: ThreadsSearchStats = { calls: 0, failed: 0, posts: 0 };
  const skeletons = await harvestAllDomains(client, brand.id, now, threadsSearch);
  const candidates = await transposeAll(client, skeletons, profile);
  if (candidates.length === 0) return { slug: brand.slug, skeletons: skeletons.length, saved: 0, skipped: "no trends transposed", threadsSearch };

  const trendRadar = toTrendRadarMemory(candidates, now);
  await prisma.brand.update({
    where: { id: brand.id },
    data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, { trendRadar }) },
  });
  return { slug: brand.slug, skeletons: skeletons.length, saved: trendRadar.items.length, threadsSearch };
}
