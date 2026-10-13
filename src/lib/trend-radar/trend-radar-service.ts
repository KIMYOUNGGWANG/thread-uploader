import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CLAUDE_TEXT_MODEL, readMessageText } from "@/lib/claude-text";
import { resolveBrandProfile, type BrandProfile } from "@/lib/brand-profile";
import { serializeBrandConfigUpdate } from "@/types/brand";
import { harvestTemporalTrends, type AbstractedTrendSkeleton, type TargetDomainCategory } from "./temporal-trend-harvester";
import { transposeSkeleton, type TransposedViralCandidate } from "./transposition-engine";
import { toTrendRadarMemory } from "./trend-radar-memory";

// Web search with dynamic filtering needs an Opus/Sonnet-class model; transposition is plain text.
const TREND_SEARCH_MODEL = "claude-opus-5-5";
const DOMAINS: TargetDomainCategory[] = ["CAREER_CONFLICT", "WEALTH_PANIC", "RELATIONSHIP_TOXICITY"];
const MAX_PAUSE_RESUMES = 3;
const MAX_TRANSPOSITIONS = 6;

export interface TrendRadarRunResult {
  slug: string;
  skeletons: number;
  saved: number;
  skipped?: string;
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

async function harvestAllDomains(client: Anthropic, now: Date): Promise<AbstractedTrendSkeleton[]> {
  const queryFn = createWebSearchQuery(client);
  // One domain per call, in parallel, to stay inside the route's maxDuration.
  const perDomain = await Promise.all(
    DOMAINS.map((domain) => harvestTemporalTrends({ domains: [domain], referenceDate: now, queryFn }))
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
  const skeletons = await harvestAllDomains(client, now);
  const candidates = await transposeAll(client, skeletons, profile);
  if (candidates.length === 0) return { slug: brand.slug, skeletons: skeletons.length, saved: 0, skipped: "no trends transposed" };

  const trendRadar = toTrendRadarMemory(candidates, now);
  await prisma.brand.update({
    where: { id: brand.id },
    data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, { trendRadar }) },
  });
  return { slug: brand.slug, skeletons: skeletons.length, saved: trendRadar.items.length };
}
