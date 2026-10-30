import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Brand } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findExample: vi.fn(),
  upsert: vi.fn(),
  findPost: vi.fn(),
  generate: vi.fn(),
  markAttempted: vi.fn(async () => undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { viralExample: { findUnique: mocks.findExample, upsert: mocks.upsert }, post: { findFirst: mocks.findPost } },
}));
vi.mock("@/lib/reference-replay", () => ({
  MANUAL_X_SOURCE: "manual_x",
  REFERENCE_REPLAY_SOURCE_PREFIX: "ref_replay_source:",
  markReferenceAttempted: mocks.markAttempted,
}));
vi.mock("@/lib/generate-posts", () => ({ generatePostsForBrand: mocks.generate }));

import { createManualReferenceDraft, parseManualReferenceInput, parseXStatusUrl, type ManualReferenceInput } from "@/lib/manual-reference";
import { hashContent } from "@/lib/viral-harvester";

const content = "이 글은 충분히 길어서 검증을 통과하는 본문입니다 정말로";
const errorsOf = (body: unknown) => {
  const result = parseManualReferenceInput(body);
  if (result.ok) throw new Error("expected errors");
  return result.errors;
};

describe("parseManualReferenceInput", () => {
  it("rejects content under 20 non-whitespace characters", () => {
    expect(errorsOf({ content: `${"가".repeat(19)}   \n `, kind: "info" }).content).toBeDefined();
    expect(parseManualReferenceInput({ content: "가".repeat(20), kind: "info" }).ok).toBe(true);
  });

  it("rejects content over 5000 characters and non-string content", () => {
    expect(errorsOf({ content: "가".repeat(5001), kind: "info" }).content).toBeDefined();
    expect(errorsOf({ content: 5, kind: "info" }).content).toBeDefined();
  });

  it("rejects an unknown kind", () => {
    expect(errorsOf({ content, kind: "news" }).kind).toBeDefined();
  });

  it("rejects a non-http linkUrl and a non-X sourceUrl", () => {
    expect(errorsOf({ content, kind: "info", linkUrl: "ftp://a" }).linkUrl).toBeDefined();
    expect(errorsOf({ content, kind: "info", sourceUrl: "https://x.com/a" }).sourceUrl).toBeDefined();
  });

  it("accepts empty link and source as null", () => {
    expect(parseManualReferenceInput({ content, kind: "info", linkUrl: "  ", sourceUrl: "" })).toEqual({
      ok: true,
      value: { content, kind: "info", linkUrl: null, sourceUrl: null },
    });
  });

  it("keeps an info linkUrl but drops it for a story", () => {
    const info = parseManualReferenceInput({ content, kind: "info", linkUrl: "https://a.com/x" });
    expect(info.ok && info.value.linkUrl).toBe("https://a.com/x");
    const story = parseManualReferenceInput({ content, kind: "story", linkUrl: "https://a.com/x" });
    expect(story.ok && story.value.linkUrl).toBeNull();
  });

  it("rejects a non-object body", () => {
    expect(errorsOf(null).content).toBeDefined();
  });
});

describe("parseXStatusUrl", () => {
  it("extracts id and lowercased handle, ignoring photo suffix and query", () => {
    expect(parseXStatusUrl("https://twitter.com/Foo/status/123/photo/1?s=20")).toEqual({ statusId: "123", handle: "foo" });
    expect(parseXStatusUrl("https://www.x.com/Bar/status/45")).toEqual({ statusId: "45", handle: "bar" });
  });

  it("returns a null handle for /i/web/ links", () => {
    expect(parseXStatusUrl("https://x.com/i/web/status/9")).toEqual({ statusId: "9", handle: null });
  });

  it("rejects other hosts, non-status paths and non-http schemes", () => {
    expect(parseXStatusUrl("https://x.com/a")).toBeNull();
    expect(parseXStatusUrl("https://evil.com/a/status/1")).toBeNull();
    expect(parseXStatusUrl("ftp://x.com/a/status/1")).toBeNull();
    expect(parseXStatusUrl("not a url")).toBeNull();
  });
});

describe("createManualReferenceDraft", () => {
  const now = new Date("2026-10-29T03:00:00.000Z");
  const brand = { id: "b1" } as unknown as Brand;
  const input: ManualReferenceInput = { content, kind: "info", linkUrl: "https://a.com/x", sourceUrl: "https://x.com/Foo/status/123" };
  const okSummary = (count: number, failureReasons: string[] = []) => ({ ok: true, summary: { count, failedCount: 0, failureReasons } });

  beforeEach(() => {
    mocks.findExample.mockReset().mockResolvedValue(null);
    mocks.upsert.mockReset().mockResolvedValue({ id: "ex_1" });
    mocks.findPost.mockReset().mockResolvedValue(null);
    mocks.generate.mockReset().mockResolvedValue(okSummary(1));
    mocks.markAttempted.mockClear();
  });

  it("upserts a manual_x row keyed by the status id", async () => {
    mocks.findPost.mockResolvedValueOnce({ id: "p1" });
    await createManualReferenceDraft(brand, input, now);

    const [args] = mocks.upsert.mock.calls[0] as unknown as [{ where: unknown; create: Record<string, unknown>; update: Record<string, unknown> }];
    expect(args.where).toEqual({ brandId_source_sourceKey: { brandId: "b1", source: "manual_x", sourceKey: "123" } });
    expect(args.create).toMatchObject({ brandId: "b1", source: "manual_x", sourceKey: "123", content, permalink: input.sourceUrl, authorUsername: "foo", publishedAt: now });
    expect(JSON.parse(args.create.rawMetrics as string)).toEqual({ manual: true, kind: "info", linkUrl: "https://a.com/x" });
    expect(args.update).toMatchObject({ content, permalink: input.sourceUrl });
  });

  it("falls back to the content hash and a null author without a source url", async () => {
    mocks.findPost.mockResolvedValueOnce({ id: "p1" });
    await createManualReferenceDraft(brand, { ...input, sourceUrl: null }, now);

    const [args] = mocks.upsert.mock.calls[0] as unknown as [{ where: { brandId_source_sourceKey: { sourceKey: string } }; create: Record<string, unknown> }];
    expect(args.where.brandId_source_sourceKey.sourceKey).toBe(hashContent(content));
    expect(args.create).toMatchObject({ permalink: null, authorUsername: null });
  });

  it("returns duplicate without generating when a tagged post already exists", async () => {
    mocks.findExample.mockResolvedValueOnce({ id: "ex_1" });
    mocks.findPost.mockResolvedValueOnce({ id: "old" });

    expect(await createManualReferenceDraft(brand, input, now)).toEqual({ status: "duplicate" });
    expect(mocks.findPost).toHaveBeenCalledWith(expect.objectContaining({ where: { brandId: "b1", qualityReasons: { contains: "ref_replay_source:ex_1" } } }));
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("retries a row that only has replayAttemptedAt and no post", async () => {
    mocks.findExample.mockResolvedValueOnce({ id: "ex_1" });
    mocks.findPost.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "p1" });

    expect(await createManualReferenceDraft(brand, input, now)).toEqual({ status: "created", postId: "p1" });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("calls the generator with the manual review input", async () => {
    mocks.findPost.mockResolvedValueOnce({ id: "p1" });
    await createManualReferenceDraft(brand, input, now);

    expect(mocks.generate).toHaveBeenCalledWith(brand, {
      count: 1,
      insertAtFront: true,
      requestedCampaignId: null,
      approvedCampaignStart: false,
      postCategory: "GROWTH",
      initialStatus: "NEEDS_REVIEW",
      referenceReplay: { id: "ex_1", content, kind: "info", linkUrl: "https://a.com/x", manual: true },
    });
  });

  it("omits the linkUrl key when there is no link", async () => {
    mocks.findPost.mockResolvedValueOnce({ id: "p1" });
    await createManualReferenceDraft(brand, { ...input, kind: "story", linkUrl: null }, now);

    const [, generateInput] = mocks.generate.mock.calls[0] as unknown as [Brand, { referenceReplay: Record<string, unknown> }];
    expect(generateInput.referenceReplay).toEqual({ id: "ex_1", content, kind: "story", manual: true });
    expect("linkUrl" in generateInput.referenceReplay).toBe(false);
  });

  it("returns dropped with failure reasons and marks the attempt when no draft survives", async () => {
    mocks.generate.mockResolvedValue(okSummary(0, ["유사도 탈락"]));

    expect(await createManualReferenceDraft(brand, input, now)).toEqual({ status: "dropped", reasons: ["유사도 탈락"] });
    expect(mocks.markAttempted).toHaveBeenCalledWith("ex_1", now);
  });

  // A readiness refusal (e.g. no system prompt) never reached the quality gate, so it must not read as a quality drop.
  it("returns not_ready with the error when the generator refuses before generating", async () => {
    mocks.generate.mockResolvedValue({ ok: false, error: "제품에 시스템 프롬프트가 설정되지 않았습니다." });

    expect(await createManualReferenceDraft(brand, input, now)).toEqual({ status: "not_ready", error: "제품에 시스템 프롬프트가 설정되지 않았습니다." });
    expect(mocks.markAttempted).not.toHaveBeenCalled();
  });

  it("returns the newest tagged post id on success", async () => {
    mocks.findPost.mockResolvedValueOnce({ id: "p9" });

    expect(await createManualReferenceDraft(brand, input, now)).toEqual({ status: "created", postId: "p9" });
    expect(mocks.findPost).toHaveBeenLastCalledWith({
      where: { brandId: "b1", qualityReasons: { contains: "ref_replay_source:ex_1" } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
  });
});
