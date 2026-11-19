import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NewsPlatform } from "./verify";

// The only writer of NewsVariant text / revision / approval / lock fields (see prisma/schema.prisma NewsVariant).
// Invariants: every text or media change bumps revision, approval holds only while approvedRevision == revision,
// and a locked variant (publishing started) is never edited or re-approved.

export type DeskResult<T = undefined> = { ok: true; value: T } | { ok: false; status: number; error: string };

const ok = <T>(value: T): DeskResult<T> => ({ ok: true, value });
const fail = (status: number, error: string): DeskResult<never> => ({ ok: false, status, error });

class DeskConflict extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const newsSourceKey = (newsItemId: string) => `news:${newsItemId}`;

export interface NewsMedia {
  url: string;
  sha256: string;
  name: string;
  bytes: number;
}

export function parseMedia(raw: string): NewsMedia[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((m): m is NewsMedia => typeof m?.url === "string") : [];
  } catch {
    return [];
  }
}

export const isApproved = (variant: { revision: number; approvedRevision: number | null }) =>
  variant.approvedRevision !== null && variant.approvedRevision === variant.revision;

export async function createNewsItem(
  data: Omit<Prisma.NewsItemUncheckedCreateInput, "variants">,
  drafts: Partial<Record<NewsPlatform, string>>,
) {
  return prisma.newsItem.create({
    data: {
      ...data,
      variants: { create: Object.entries(drafts).map(([platform, text]) => ({ platform, text: text ?? "" })) },
    },
    include: { variants: true },
  });
}

export async function setVariantText(variantId: string, text: string): Promise<DeskResult> {
  const { count } = await prisma.newsVariant.updateMany({
    where: { id: variantId, lockedAt: null },
    data: { text, revision: { increment: 1 } },
  });
  return count === 1 ? ok(undefined) : fail(409, "발행을 시작한 원고라 고칠 수 없어. 실패했다면 잠금을 먼저 풀어줘");
}

/** Approves exactly the revision the operator was looking at; a newer edit (any tab) makes this a no-op. */
export async function approveVariant(variantId: string, seenRevision: number, now = new Date()): Promise<DeskResult> {
  const { count } = await prisma.newsVariant.updateMany({
    where: { id: variantId, revision: seenRevision, lockedAt: null },
    data: { approvedRevision: seenRevision, approvedAt: now },
  });
  return count === 1 ? ok(undefined) : fail(409, "그새 원고가 바뀌었거나 이미 발행 중이야. 새로고침해서 다시 확인해줘");
}

export async function revokeApproval(variantId: string): Promise<DeskResult> {
  const { count } = await prisma.newsVariant.updateMany({
    where: { id: variantId, lockedAt: null },
    data: { approvedRevision: null, approvedAt: null },
  });
  return count === 1 ? ok(undefined) : fail(409, "발행을 시작한 원고는 승인을 취소할 수 없어");
}

/**
 * Replaces the media of an item and revokes every approval (revision+1), unless some platform already started
 * publishing. The item row is updated first so this serializes with queueNewsUpload on the same row lock.
 */
export async function setNewsMedia(newsItemId: string, media: NewsMedia[]): Promise<DeskResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.newsItem.update({ where: { id: newsItemId }, data: { media: JSON.stringify(media) } });
      const locked = await tx.newsVariant.count({ where: { newsItemId, lockedAt: { not: null } } });
      if (locked > 0) throw new DeskConflict(409, "이미 발행을 시작한 플랫폼이 있어서 이미지를 바꿀 수 없어");
      await tx.newsVariant.updateMany({ where: { newsItemId }, data: { revision: { increment: 1 } } });
    });
    return ok(undefined);
  } catch (error) {
    if (error instanceof DeskConflict) return fail(error.status, error.message);
    throw error;
  }
}

/** Kakao has no API: "sent" is the operator's word, recorded once and locked like a publish. */
export async function markKakaoSent(newsItemId: string, now = new Date()): Promise<DeskResult> {
  const variant = await prisma.newsVariant.findUnique({ where: { newsItemId_platform: { newsItemId, platform: "kakao" } } });
  if (!variant) return fail(404, "카카오 원고가 없어");
  if (!isApproved(variant)) return fail(409, "승인한 원고만 보냈다고 표시할 수 있어");
  const { count } = await prisma.newsVariant.updateMany({
    where: { id: variant.id, revision: variant.revision, approvedRevision: variant.revision, lockedAt: null },
    data: { lockedAt: now, manualDoneAt: now },
  });
  return count === 1 ? ok(undefined) : fail(409, "그새 원고가 바뀌었거나 이미 표시했어");
}

const REUSABLE = ["FAILED", "CANCELED"];

/**
 * Claims an approved variant (lockedAt) and queues its upload in one transaction, so a failed insert never leaves
 * a variant locked with nothing to unlock it. One upload row per platform account per item (sourceKey unique);
 * a FAILED/CANCELED row is reused only while it is still in that state.
 */
export async function queueNewsUpload(input: {
  newsItemId: string;
  platform: Exclude<NewsPlatform, "kakao">;
  channelAccountId: string;
  now: Date;
}): Promise<DeskResult<string>> {
  const { newsItemId, platform, channelAccountId, now } = input;
  try {
    const uploadId = await prisma.$transaction(async (tx) => {
      const item = await tx.newsItem.update({ where: { id: newsItemId }, data: { updatedAt: now }, select: { brandId: true, media: true } });
      const variant = await tx.newsVariant.findUnique({ where: { newsItemId_platform: { newsItemId, platform } } });
      if (!variant) throw new DeskConflict(404, "원고가 없어");
      if (variant.lockedAt) throw new DeskConflict(409, "이미 발행을 시작했어");
      if (!isApproved(variant)) throw new DeskConflict(409, "승인한 원고만 발행할 수 있어");
      const claim = await tx.newsVariant.updateMany({
        where: { id: variant.id, lockedAt: null, revision: variant.revision, approvedRevision: variant.revision },
        data: { lockedAt: now },
      });
      if (claim.count !== 1) throw new DeskConflict(409, "그새 원고가 바뀌었어. 새로고침해서 다시 확인해줘");

      const sourceKey = newsSourceKey(newsItemId);
      const content = {
        caption: variant.text,
        mediaUrls: JSON.stringify(parseMedia(item.media).map((m) => m.url)),
        scheduledAt: now,
      };
      const existing = await tx.channelUpload.findUnique({
        where: { channelAccountId_sourceKey: { channelAccountId, sourceKey } },
        select: { id: true },
      });
      if (!existing) {
        const created = await tx.channelUpload.create({
          data: { brandId: item.brandId, channelAccountId, kind: "post", sourceKey, privacy: "public", ...content },
          select: { id: true },
        });
        return created.id;
      }
      const requeued = await tx.channelUpload.updateMany({
        where: { id: existing.id, status: { in: REUSABLE } },
        data: {
          ...content,
          status: "QUEUED", attempts: 0, platformData: "{}", externalId: null, externalUrl: null, errorLog: null,
          nextAttemptAt: null, lockedUntil: null, publishedAt: null,
        },
      });
      if (requeued.count !== 1) throw new DeskConflict(409, "이 플랫폼은 이미 올라갔거나 올라가는 중이야");
      return existing.id;
    });
    return ok(uploadId);
  } catch (error) {
    if (error instanceof DeskConflict) return fail(error.status, error.message);
    throw error;
  }
}

/**
 * Lets the operator edit and resend after a failure. Allowed only while no upload for that platform is queued,
 * running or published. The UI warns that a "delivery uncertain" failure may have been posted anyway.
 */
export async function unlockVariant(newsItemId: string, platform: NewsPlatform): Promise<DeskResult> {
  const variant = await prisma.newsVariant.findUnique({ where: { newsItemId_platform: { newsItemId, platform } } });
  if (!variant) return fail(404, "원고가 없어");
  if (!variant.lockedAt) return ok(undefined);
  if (platform !== "kakao") {
    const active = await prisma.channelUpload.count({
      where: { sourceKey: newsSourceKey(newsItemId), channelAccount: { platform }, status: { notIn: REUSABLE } },
    });
    if (active > 0) return fail(409, "대기 중이거나 올라간 업로드가 있어서 잠금을 풀 수 없어");
  }
  await prisma.newsVariant.updateMany({ where: { id: variant.id }, data: { lockedAt: null, manualDoneAt: null } });
  return ok(undefined);
}
