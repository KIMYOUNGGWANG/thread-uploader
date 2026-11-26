import type { Brand, ChannelUpload, NewsItem, NewsVariant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBrandForCurrentUser, ResourceNotFoundError } from "@/lib/brand-access";
import { ensureLegacyChannelAccount } from "@/lib/channels/publication-mirror";
import { applyUploadAction } from "@/lib/distribution/controls";
import { runDueUploads } from "@/lib/distribution/runner";
import { parseBrandConfig, type AccountHealthState } from "@/types/brand";
import { isApproved, newsSourceKey, parseMedia, queueNewsUpload, unlockVariant, type NewsMedia } from "./approval";
import { checkVariant, NEWS_PLATFORMS, type Fact, type NewsPlatform, type VariantCheck } from "./verify";

export const MAX_MEDIA = 5;
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/i;

/** Only images we uploaded to our own Blob store: immutable (random suffix) and fetchable by Telegram/Threads. */
export function parseMediaInput(raw: unknown): NewsMedia[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_MEDIA) return null;
  const media: NewsMedia[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const { url, sha256, name, bytes } = entry as Record<string, unknown>;
    if (typeof url !== "string") return null;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" || !BLOB_HOST.test(parsed.hostname)) return null;
    media.push({
      url,
      sha256: typeof sha256 === "string" ? sha256.slice(0, 64) : "",
      name: typeof name === "string" ? name.slice(0, 200) : "",
      bytes: typeof bytes === "number" && Number.isFinite(bytes) ? bytes : 0,
    });
  }
  return media;
}

export type ItemWithVariants = NewsItem & { variants: NewsVariant[] };

export async function loadItemForCurrentUser(id: string): Promise<{ item: ItemWithVariants; brand: Brand }> {
  const item = await prisma.newsItem.findUnique({ where: { id }, include: { variants: true } });
  if (!item) throw new ResourceNotFoundError("기사를 찾을 수 없어");
  const { brand } = await requireBrandForCurrentUser(item.brandId);
  return { item, brand };
}

export function threadsHealth(brand: Pick<Brand, "brandConfig">): Partial<AccountHealthState> {
  const config = parseBrandConfig(brand.brandConfig || "{}");
  return config.accountHealth ?? { status: config.shadowbanStatus };
}

export function checkFor(item: Pick<NewsItem, "sourceText" | "media">, variant: Pick<NewsVariant, "platform" | "text">, brand: Pick<Brand, "brandConfig">): VariantCheck {
  return checkVariant({
    platform: variant.platform as NewsPlatform,
    text: variant.text,
    imageCount: parseMedia(item.media).length,
    sourceText: item.sourceText,
    threadsAccountHealth: variant.platform === "threads" ? threadsHealth(brand) : undefined,
  });
}

export interface ChannelStatus {
  connected: boolean;
  handle: string | null;
  reason: string | null;
}

export async function channelStatuses(brand: Brand): Promise<Record<"telegram" | "threads", ChannelStatus>> {
  const telegram = await prisma.channelAccount.findFirst({ where: { brandId: brand.id, platform: "telegram" }, orderBy: { createdAt: "asc" } });
  // Same row accountFor() publishes through; read only (no ensureLegacyChannelAccount here), a missing row is created at publish.
  const threadsAccount = await prisma.channelAccount.findFirst({ where: { brandId: brand.id, platform: "threads" }, orderBy: { createdAt: "asc" }, select: { enabled: true } });
  const threadsLinked = Boolean(brand.accessToken && brand.threadsUserId);
  const threadsPaused = threadsAccount !== null && !threadsAccount.enabled;
  const botReady = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  return {
    telegram: {
      connected: Boolean(botReady && telegram?.enabled && telegram.externalUserId),
      handle: telegram?.handle ?? null,
      reason: !botReady ? "서버에 TELEGRAM_BOT_TOKEN이 없어" : !telegram ? "브랜드 설정에서 채널을 연결해줘" : !telegram.enabled ? "채널 업로드가 꺼져 있어" : null,
    },
    threads: {
      connected: threadsLinked && !threadsPaused,
      handle: null,
      reason: !threadsLinked ? "Threads 계정이 연결돼 있지 않아" : threadsPaused ? "Threads 업로드가 꺼져 있어" : null,
    },
  };
}

async function uploadsFor(itemId: string) {
  return prisma.channelUpload.findMany({
    where: { sourceKey: newsSourceKey(itemId) },
    include: { channelAccount: { select: { platform: true } } },
  });
}

type UploadWithPlatform = ChannelUpload & { channelAccount: { platform: string } };

export interface VariantView {
  platform: NewsPlatform;
  text: string;
  revision: number;
  approved: boolean;
  approvedAt: string | null;
  locked: boolean;
  manualDoneAt: string | null;
  check: VariantCheck;
  upload: { id: string; status: string; externalUrl: string | null; errorLog: string | null; publishedAt: string | null } | null;
  canUnlock: boolean;
}

export interface NewsItemView {
  id: string;
  brandId: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceText: string;
  rawMode: boolean;
  operatorNote: string | null;
  facts: Fact[];
  media: NewsMedia[];
  createdAt: string;
  variants: VariantView[];
  channels: Record<"telegram" | "threads", ChannelStatus>;
}

function parseFacts(raw: string): Fact[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Fact[]) : [];
  } catch {
    return [];
  }
}

export function toVariantView(item: ItemWithVariants, variant: NewsVariant, brand: Brand, uploads: UploadWithPlatform[]): VariantView {
  const upload = uploads.find((u) => u.channelAccount.platform === variant.platform) ?? null;
  const active = upload !== null && upload.status !== "FAILED" && upload.status !== "CANCELED";
  return {
    platform: variant.platform as NewsPlatform,
    text: variant.text,
    revision: variant.revision,
    approved: isApproved(variant),
    approvedAt: variant.approvedAt?.toISOString() ?? null,
    locked: variant.lockedAt !== null,
    manualDoneAt: variant.manualDoneAt?.toISOString() ?? null,
    check: checkFor(item, variant, brand),
    upload: upload && {
      id: upload.id, status: upload.status, externalUrl: upload.externalUrl, errorLog: upload.errorLog,
      publishedAt: upload.publishedAt?.toISOString() ?? null,
    },
    canUnlock: variant.lockedAt !== null && !active,
  };
}

export async function toItemView(item: ItemWithVariants, brand: Brand): Promise<NewsItemView> {
  const uploads = await uploadsFor(item.id);
  const order = (p: string) => NEWS_PLATFORMS.indexOf(p as NewsPlatform);
  return {
    id: item.id,
    brandId: item.brandId,
    sourceUrl: item.sourceUrl,
    sourceTitle: item.sourceTitle,
    sourceText: item.sourceText,
    rawMode: item.rawMode,
    operatorNote: item.operatorNote,
    facts: parseFacts(item.facts),
    media: parseMedia(item.media),
    createdAt: item.createdAt.toISOString(),
    variants: [...item.variants].sort((a, b) => order(a.platform) - order(b.platform)).map((v) => toVariantView(item, v, brand, uploads)),
    channels: await channelStatuses(brand),
  };
}

export interface PublishOutcome {
  platform: NewsPlatform;
  ok: boolean;
  error?: string;
}

async function accountFor(brand: Brand, platform: "telegram" | "threads"): Promise<{ id: string } | { error: string }> {
  const status = (await channelStatuses(brand))[platform];
  if (!status.connected) return { error: status.reason ?? "채널이 연결돼 있지 않아" };
  if (platform === "telegram") {
    const account = await prisma.channelAccount.findFirst({ where: { brandId: brand.id, platform: "telegram", enabled: true }, orderBy: { createdAt: "asc" } });
    return account ? { id: account.id } : { error: "텔레그램 채널을 찾을 수 없어" };
  }
  const id = await ensureLegacyChannelAccount(brand.id, "threads");
  const account = await prisma.channelAccount.findUnique({ where: { id }, select: { enabled: true } });
  return account?.enabled ? { id } : { error: "Threads 업로드가 꺼져 있어" };
}

/**
 * Queues every approved, unpublished platform (kakao is manual) and runs just those uploads.
 * `only` limits it to the channels the operator's button named, so an approval made in another tab never rides along.
 * Accounts and checks are verified before anything is locked.
 */
export async function publishItem(item: ItemWithVariants, brand: Brand, now = new Date(), only?: readonly NewsPlatform[]): Promise<PublishOutcome[]> {
  const outcomes: PublishOutcome[] = [];
  const queued: string[] = [];
  for (const variant of item.variants) {
    const platform = variant.platform as NewsPlatform;
    if (platform === "kakao" || variant.lockedAt || !isApproved(variant)) continue;
    if (only && !only.includes(platform)) continue;
    const blockers = checkFor(item, variant, brand).blockers;
    if (blockers.length > 0) {
      outcomes.push({ platform, ok: false, error: blockers.join(" · ") });
      continue;
    }
    const account = await accountFor(brand, platform);
    if ("error" in account) {
      outcomes.push({ platform, ok: false, error: account.error });
      continue;
    }
    const result = await queueNewsUpload({ newsItemId: item.id, platform, channelAccountId: account.id, now });
    if (!result.ok) {
      outcomes.push({ platform, ok: false, error: result.error });
      continue;
    }
    queued.push(result.value);
    outcomes.push({ platform, ok: true });
  }
  if (queued.length > 0) await runDueUploads(now, { ids: queued, budgetMs: 60_000 });
  return outcomes;
}

/** Advances this item's own queued/processing uploads (the page calls it while something is in flight). */
export async function tickItem(itemId: string, now = new Date()): Promise<void> {
  const rows = await prisma.channelUpload.findMany({
    where: { sourceKey: newsSourceKey(itemId), status: { in: ["QUEUED", "PROCESSING"] } },
    select: { id: true },
  });
  if (rows.length > 0) await runDueUploads(now, { ids: rows.map((r) => r.id), budgetMs: 45_000 });
}

/** Cancels a still-queued upload; nothing was sent, so the draft is unlocked again for edits. */
export async function cancelQueued(itemId: string, platform: NewsPlatform): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const upload = await prisma.channelUpload.findFirst({
    where: { sourceKey: newsSourceKey(itemId), channelAccount: { platform } },
    select: { id: true },
  });
  if (!upload) return { ok: false, status: 404, error: "대기 중인 업로드가 없어" };
  const result = await applyUploadAction(upload.id, "cancel");
  if (!result.ok) return result;
  const unlocked = await unlockVariant(itemId, platform);
  return unlocked.ok ? { ok: true } : unlocked;
}
