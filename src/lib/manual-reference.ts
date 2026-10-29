import type { Brand } from "@prisma/client";
import { generatePostsForBrand } from "@/lib/generate-posts";
import { prisma } from "@/lib/prisma";
import { MANUAL_X_SOURCE, REFERENCE_REPLAY_SOURCE_PREFIX, markReferenceAttempted } from "@/lib/reference-replay";
import type { ReferenceKind } from "@/lib/viral-intent-modes";
import { hashContent } from "@/lib/viral-harvester";

const MIN_CONTENT_CHARS = 20;
const MAX_CONTENT_CHARS = 5000;

export type ManualReferenceInput = { content: string; kind: ReferenceKind; linkUrl: string | null; sourceUrl: string | null };
type ManualReferenceField = "content" | "kind" | "linkUrl" | "sourceUrl";

export type ManualReferenceResult =
  | { status: "created"; postId: string }
  | { status: "dropped"; reasons: string[] }
  | { status: "duplicate" };

function parseHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// ponytail: handle is null for /i/web/ links (the author is not in the URL).
export function parseXStatusUrl(url: string): { statusId: string; handle: string | null } | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!/^(?:www\.)?(?:x|twitter)\.com$/i.test(parsed.hostname)) return null;
  const match = /^\/(i\/web|[A-Za-z0-9_]{1,15})\/status\/(\d+)(?:\/.*)?$/.exec(parsed.pathname);
  if (!match) return null;
  return { statusId: match[2], handle: match[1] === "i/web" ? null : match[1].toLowerCase() };
}

function optionalString(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  return { ok: true, value: value.trim() || null };
}

export function parseManualReferenceInput(
  body: unknown,
): { ok: true; value: ManualReferenceInput } | { ok: false; errors: Partial<Record<ManualReferenceField, string>> } {
  const errors: Partial<Record<ManualReferenceField, string>> = {};
  const record: Record<string, unknown> = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const content = typeof record.content === "string" ? record.content : "";
  if (content.replace(/\s/g, "").length < MIN_CONTENT_CHARS) errors.content = `원글 본문은 공백을 빼고 ${MIN_CONTENT_CHARS}자 이상이어야 해`;
  else if (content.length > MAX_CONTENT_CHARS) errors.content = `원글 본문은 ${MAX_CONTENT_CHARS.toLocaleString("en-US")}자 이하여야 해`;

  const kind = record.kind;
  if (kind !== "story" && kind !== "info") errors.kind = "글 유형은 사연형 또는 정보형이어야 해";

  // A story never carries a link (the generator disables the product link whenever one is set), so it is not validated.
  let linkUrl: string | null = null;
  if (kind !== "story") {
    const link = optionalString(record.linkUrl);
    if (!link.ok || (link.value !== null && !parseHttpUrl(link.value))) errors.linkUrl = "링크는 http:// 또는 https://로 시작해야 해";
    else linkUrl = link.value;
  }

  const source = optionalString(record.sourceUrl);
  let sourceUrl: string | null = null;
  if (!source.ok || (source.value !== null && !parseXStatusUrl(source.value))) errors.sourceUrl = "X 원글 주소는 x.com 또는 twitter.com의 /status/숫자 주소여야 해";
  else sourceUrl = source.value;

  if (Object.keys(errors).length > 0 || (kind !== "story" && kind !== "info")) return { ok: false, errors };
  return { ok: true, value: { content, kind, linkUrl, sourceUrl } };
}

function findTaggedPost(brandId: string, exampleId: string, newestFirst = false) {
  return prisma.post.findFirst({
    where: { brandId, qualityReasons: { contains: `${REFERENCE_REPLAY_SOURCE_PREFIX}${exampleId}` } },
    ...(newestFirst ? { orderBy: { createdAt: "desc" as const } } : {}),
    select: { id: true },
  });
}

export async function createManualReferenceDraft(brand: Brand, input: ManualReferenceInput, now: Date): Promise<ManualReferenceResult> {
  const status = input.sourceUrl ? parseXStatusUrl(input.sourceUrl) : null;
  const sourceKey = status?.statusId ?? hashContent(input.content);
  const key = { brandId: brand.id, source: MANUAL_X_SOURCE, sourceKey };

  // Checked before the upsert so a duplicate never rewrites the stored row.
  const existing = await prisma.viralExample.findUnique({ where: { brandId_source_sourceKey: key }, select: { id: true } });
  if (existing && (await findTaggedPost(brand.id, existing.id))) return { status: "duplicate" };

  const fields = {
    content: input.content,
    permalink: input.sourceUrl,
    authorUsername: status?.handle ?? null,
    publishedAt: now,
    rawMetrics: JSON.stringify({ manual: true, kind: input.kind, linkUrl: input.linkUrl }),
  };
  const example = await prisma.viralExample.upsert({
    where: { brandId_source_sourceKey: key },
    update: fields,
    create: { ...key, ...fields },
    select: { id: true },
  });

  const result = await generatePostsForBrand(brand, {
    count: 1,
    insertAtFront: true,
    requestedCampaignId: null,
    approvedCampaignStart: false,
    postCategory: "GROWTH",
    initialStatus: "NEEDS_REVIEW",
    referenceReplay: { id: example.id, content: input.content, kind: input.kind, ...(input.linkUrl ? { linkUrl: input.linkUrl } : {}), manual: true },
  });
  if (!result.ok) return { status: "dropped", reasons: [result.error] };
  if (result.summary.count === 0) {
    await markReferenceAttempted(example.id, now);
    return { status: "dropped", reasons: result.summary.failureReasons };
  }

  const post = await findTaggedPost(brand.id, example.id, true);
  if (!post) throw new Error("레퍼런스 초안은 만들어졌는데 저장된 글을 찾지 못했어");
  return { status: "created", postId: post.id };
}
