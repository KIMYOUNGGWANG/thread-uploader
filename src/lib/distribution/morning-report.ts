import { prisma } from "@/lib/prisma";
import { isRecord } from "@/types/config-normalizers";
import { kstDate } from "@/lib/video-factory/kst";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_WARN_MS = 7 * DAY_MS;
const CLIP_MIN = 10;

export type ReportChannel = "threads" | "youtube" | "instagram" | "tiktok" | "x";

export interface ReportUpload {
  id: string;
  brandName: string;
  channel: ReportChannel;
  kind: string;
  status: string;
  title: string;
  externalUrl: string | null;
  errorLog: string | null;
  privacy: string;
  at: string;
}

export interface ChannelSummary {
  channel: ReportChannel;
  published: number;
  failed: number;
  views: number | null;
}

export interface PendingVideo {
  draftId: string;
  brandName: string;
  brandSlug: string;
  title: string;
  coverUrl: string | null;
  autoPublishAt: string;
  canceled: boolean;
}

export interface PendingUpload {
  id: string;
  brandName: string;
  channel: ReportChannel;
  kind: string;
  title: string;
  scheduledAt: string;
}

export type TodoKind = "tiktok_public" | "reconnect" | "clips" | "failed_upload" | "review_posts" | "video_verdict";

export interface TodoItem {
  kind: TodoKind;
  key: string;
  text: string;
  href?: string;
  uploadId?: string;
}

export interface MorningReport {
  generatedAt: string;
  since: string;
  summary: ChannelSummary[];
  recent: ReportUpload[];
  pendingVideos: PendingVideo[];
  pendingUploads: PendingUpload[];
  threadsBacklog: { brandName: string; brandSlug: string; pending: number; review: number }[];
  todos: TodoItem[];
}

function firstLine(text: string, max = 60): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function hookTitle(script: string): string {
  try {
    const parsed: unknown = JSON.parse(script);
    const lines = isRecord(parsed) && isRecord(parsed.hook) ? parsed.hook.lines : null;
    return Array.isArray(lines) ? lines.filter((l) => typeof l === "string").join(" ") : "";
  } catch {
    return "";
  }
}

function madePublic(platformData: string): boolean {
  try {
    const parsed: unknown = JSON.parse(platformData);
    return isRecord(parsed) && typeof parsed.madePublicAt === "string";
  } catch {
    return false;
  }
}

/** Since yesterday 00:00 KST: "what went up overnight and yesterday". */
export function reportSince(now: Date): Date {
  return new Date(new Date(`${kstDate(now)}T00:00:00+09:00`).getTime() - DAY_MS);
}

const CHANNEL_LABEL: Record<ReportChannel, string> = {
  threads: "Threads", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", x: "X",
};

export async function buildMorningReport(ownerId: string | null, now = new Date()): Promise<MorningReport> {
  const since = reportSince(now);
  const brands = await prisma.brand.findMany({
    where: ownerId ? { ownerId } : {},
    select: {
      id: true, name: true, slug: true, tokenExpiry: true, accessToken: true,
      instagramAccessToken: true, instagramTokenExpiry: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const brandIds = brands.map((b) => b.id);
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const nameOf = (id: string) => brandById.get(id)?.name ?? "";

  const [uploads, threadsPosts, pendingDrafts, queued, backlog, accounts, clipCounts, factoryBrands, unjudged] = await Promise.all([
    prisma.channelUpload.findMany({
      where: {
        brandId: { in: brandIds },
        OR: [
          { publishedAt: { gte: since } },
          { status: "FAILED", updatedAt: { gte: new Date(now.getTime() - 3 * DAY_MS) } },
          { status: "PUBLISHED", privacy: "private", publishedAt: { gte: new Date(now.getTime() - 14 * DAY_MS) } },
        ],
      },
      include: { channelAccount: { select: { platform: true } }, videoDraft: { select: { script: true } }, post: { select: { content: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.post.findMany({
      where: { brandId: { in: brandIds }, OR: [{ publishedAt: { gte: since } }, { status: "FAILED", createdAt: { gte: since } }] },
      select: { id: true, brandId: true, status: true, content: true, publishedAt: true, createdAt: true, views: true, errorLog: true, threadsId: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
    }),
    prisma.videoDraft.findMany({
      where: { brandId: { in: brandIds }, status: "COMPLETED", autoPublishAt: { gt: now }, uploads: { none: {} } },
      select: { id: true, brandId: true, script: true, coverUrl: true, autoPublishAt: true, canceledAt: true },
      orderBy: { autoPublishAt: "asc" },
    }),
    prisma.channelUpload.findMany({
      where: { brandId: { in: brandIds }, status: "QUEUED", scheduledAt: { gt: now } },
      include: { channelAccount: { select: { platform: true } }, post: { select: { content: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.post.groupBy({
      by: ["brandId", "status"],
      where: { brandId: { in: brandIds }, status: { in: ["PENDING", "NEEDS_REVIEW"] } },
      _count: { _all: true },
    }),
    prisma.channelAccount.findMany({
      where: { brandId: { in: brandIds }, platform: { in: ["youtube", "tiktok", "x"] }, enabled: true },
      select: { brandId: true, platform: true, accessToken: true, refreshToken: true },
    }),
    prisma.clipAsset.groupBy({ by: ["brandId"], where: { brandId: { in: brandIds }, enabled: true }, _count: { _all: true } }),
    prisma.videoDraft.groupBy({ by: ["brandId"], where: { brandId: { in: brandIds }, createdAt: { gte: new Date(now.getTime() - 14 * DAY_MS) } }, _count: { _all: true } }),
    prisma.videoDraft.count({ where: { brandId: { in: brandIds }, status: "COMPLETED", userVerdict: null, createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
  ]);

  const recent: ReportUpload[] = [];
  for (const post of threadsPosts) {
    if (!post.publishedAt && post.status !== "FAILED") continue;
    recent.push({
      id: post.id,
      brandName: nameOf(post.brandId),
      channel: "threads",
      kind: "text",
      status: post.status,
      title: firstLine(post.content),
      externalUrl: null,
      errorLog: post.status === "FAILED" ? post.errorLog : null,
      privacy: "public",
      at: (post.publishedAt ?? post.createdAt).toISOString(),
    });
  }
  for (const upload of uploads) {
    if (!(upload.publishedAt && upload.publishedAt >= since) && upload.status !== "FAILED") continue;
    recent.push({
      id: upload.id,
      brandName: nameOf(upload.brandId),
      channel: upload.channelAccount.platform as ReportChannel,
      kind: upload.kind,
      status: upload.status,
      title: upload.videoDraft ? hookTitle(upload.videoDraft.script) : firstLine(upload.post?.content ?? upload.caption),
      externalUrl: upload.externalUrl,
      errorLog: upload.errorLog,
      privacy: upload.privacy,
      at: (upload.publishedAt ?? upload.updatedAt).toISOString(),
    });
  }
  recent.sort((a, b) => b.at.localeCompare(a.at));

  const summaryMap = new Map<ReportChannel, ChannelSummary>();
  for (const item of recent) {
    const s = summaryMap.get(item.channel) ?? { channel: item.channel, published: 0, failed: 0, views: null };
    if (item.status === "PUBLISHED") s.published += 1;
    if (item.status === "FAILED") s.failed += 1;
    summaryMap.set(item.channel, s);
  }
  for (const post of threadsPosts) {
    if (post.views === null || !post.publishedAt) continue;
    const s = summaryMap.get("threads");
    if (s) s.views = (s.views ?? 0) + post.views;
  }
  for (const upload of uploads) {
    if (upload.views === null || !(upload.publishedAt && upload.publishedAt >= since)) continue;
    const s = summaryMap.get(upload.channelAccount.platform as ReportChannel);
    if (s) s.views = (s.views ?? 0) + upload.views;
  }

  const todos: TodoItem[] = [];
  for (const upload of uploads) {
    if (upload.channelAccount.platform === "tiktok" && upload.status === "PUBLISHED" && upload.privacy === "private" && !madePublic(upload.platformData)) {
      const title = upload.videoDraft ? hookTitle(upload.videoDraft.script) : "영상";
      todos.push({ kind: "tiktok_public", key: `tt-${upload.id}`, text: `TikTok 비공개 영상 공개로 바꾸기 — ${nameOf(upload.brandId)} · ${title}`, uploadId: upload.id });
    }
  }
  for (const upload of uploads) {
    if (upload.status !== "FAILED") continue;
    todos.push({
      kind: "failed_upload",
      key: `fail-${upload.id}`,
      text: `${CHANNEL_LABEL[upload.channelAccount.platform as ReportChannel] ?? upload.channelAccount.platform} 업로드 실패 — ${upload.errorLog ?? "이유 없음"}`,
      uploadId: upload.id,
    });
  }
  for (const brand of brands) {
    const settings = `/brands/${brand.slug}/settings`;
    if (brand.accessToken && brand.tokenExpiry && brand.tokenExpiry.getTime() - now.getTime() < TOKEN_WARN_MS) {
      todos.push({ kind: "reconnect", key: `threads-${brand.id}`, text: `${brand.name}: Threads 토큰 만료 임박 (${kstDate(brand.tokenExpiry)})`, href: settings });
    }
    if (brand.instagramAccessToken && brand.instagramTokenExpiry && brand.instagramTokenExpiry.getTime() - now.getTime() < TOKEN_WARN_MS) {
      todos.push({ kind: "reconnect", key: `ig-${brand.id}`, text: `${brand.name}: Instagram 토큰 만료 임박 또는 만료 — 다시 연결`, href: settings });
    }
  }
  for (const account of accounts) {
    if (account.accessToken && account.refreshToken) continue;
    const brand = brandById.get(account.brandId);
    if (!brand) continue;
    todos.push({
      kind: "reconnect",
      key: `${account.platform}-${account.brandId}`,
      text: `${brand.name}: ${CHANNEL_LABEL[account.platform as ReportChannel] ?? account.platform} 다시 연결 필요`,
      href: `/brands/${brand.slug}/settings`,
    });
  }
  const clipsByBrand = new Map(clipCounts.map((c) => [c.brandId, c._count._all]));
  for (const factory of factoryBrands) {
    const count = clipsByBrand.get(factory.brandId) ?? 0;
    const brand = brandById.get(factory.brandId);
    if (brand && count < CLIP_MIN) {
      todos.push({ kind: "clips", key: `clips-${brand.id}`, text: `${brand.name}: 배경 클립이 ${count}개뿐이에요 (${CLIP_MIN}개 이상 권장)`, href: `/brands/${brand.slug}/videos` });
    }
  }
  const threadsBacklog = brands.map((brand) => {
    const rows = backlog.filter((b) => b.brandId === brand.id);
    return {
      brandName: brand.name,
      brandSlug: brand.slug,
      pending: rows.find((r) => r.status === "PENDING")?._count._all ?? 0,
      review: rows.find((r) => r.status === "NEEDS_REVIEW")?._count._all ?? 0,
    };
  });
  for (const b of threadsBacklog) {
    if (b.review > 0) todos.push({ kind: "review_posts", key: `review-${b.brandSlug}`, text: `${b.brandName}: 검토 대기 글 ${b.review}개`, href: `/brands/${b.brandSlug}` });
  }
  if (unjudged > 0) {
    todos.push({ kind: "video_verdict", key: "verdict", text: `판정 안 한 완성 영상 ${unjudged}편`, href: brands[0] ? `/brands/${brands[0].slug}/videos` : undefined });
  }

  return {
    generatedAt: now.toISOString(),
    since: since.toISOString(),
    summary: [...summaryMap.values()],
    recent: recent.slice(0, 40),
    pendingVideos: pendingDrafts.map((d) => ({
      draftId: d.id,
      brandName: nameOf(d.brandId),
      brandSlug: brandById.get(d.brandId)?.slug ?? "",
      title: hookTitle(d.script),
      coverUrl: d.coverUrl,
      autoPublishAt: (d.autoPublishAt as Date).toISOString(),
      canceled: d.canceledAt !== null,
    })),
    pendingUploads: queued.map((u) => ({
      id: u.id,
      brandName: nameOf(u.brandId),
      channel: u.channelAccount.platform as ReportChannel,
      kind: u.kind,
      title: firstLine(u.post?.content ?? u.caption),
      scheduledAt: u.scheduledAt.toISOString(),
    })),
    threadsBacklog,
    todos,
  };
}
