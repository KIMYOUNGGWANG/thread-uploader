import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Brand } from "@prisma/client";
import type { ReferenceRefillResult } from "@/lib/reference-replay-refill";

const discoverViralExamples = vi.hoisted(() => vi.fn());
const learnViralPatterns = vi.hoisted(() => vi.fn(async () => ({ learnedPatterns: 3 })));

const analyzeTopViralExamples = vi.hoisted(() => vi.fn(async () => ({ analyzed: 0 })));
const refillReferenceReplay = vi.hoisted(() =>
  vi.fn<(brand: Brand, now: Date) => Promise<ReferenceRefillResult>>(async () => ({ generated: 0, skipped: "no_source" })),
);
const sendSystemAlert = vi.hoisted(() => vi.fn(async () => true));
const withKeywords = JSON.stringify({ viralDiscovery: { keywords: ["사주"] } });
const brandRows = vi.hoisted(() => ({ value: [] as Array<{ id: string; slug: string; name: string; brandConfig: string }> }));
const findMany = vi.hoisted(() => vi.fn(async () => brandRows.value));

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findMany } } }));
vi.mock("@/lib/alert-service", () => ({ sendSystemAlert }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: () => true }));
vi.mock("@/lib/viral-service", () => ({ discoverViralExamples, learnViralPatterns }));
vi.mock("@/lib/viral-llm-analysis", () => ({ analyzeTopViralExamples }));
vi.mock("@/lib/reference-replay-refill", () => ({ refillReferenceReplay }));

import { GET } from "./route";

const request = () => new NextRequest("http://localhost/api/cron/viral");

describe("viral cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Both brands have keywords by default; the skip case overrides brand b.
    brandRows.value = [
      { id: "a", slug: "cosmicpath", name: "cosmicpath", brandConfig: withKeywords },
      { id: "b", slug: "catchdex", name: "catchdex", brandConfig: withKeywords },
    ];
  });

  it("returns 500 when a brand's external sources all failed, so the scheduler run goes red", async () => {
    discoverViralExamples.mockImplementation(async (brandId: string) =>
      brandId === "a"
        ? { saved: 9, errors: [{ message: "Application does not have permission" }], externalAllFailed: true }
        : { saved: 0, errors: [], externalAllFailed: false },
    );
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.externalSourcesFailed).toEqual(["cosmicpath"]);
    // Own-post learning still runs for every brand.
    expect(learnViralPatterns).toHaveBeenCalledTimes(2);
  });

  it("stays 200 when external sources partly succeed", async () => {
    discoverViralExamples.mockResolvedValue({ saved: 5, errors: [{ message: "one keyword failed" }], externalAllFailed: false });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it("skips brands with no keywords configured", async () => {
    brandRows.value[1].brandConfig = "{}";
    discoverViralExamples.mockResolvedValue({ saved: 0, errors: [], externalAllFailed: false });
    const body = await (await GET(request())).json();
    expect(discoverViralExamples).toHaveBeenCalledTimes(1);
    expect(discoverViralExamples).toHaveBeenCalledWith("a", expect.anything());
    expect(body.brands).toContainEqual({ slug: "catchdex", skipped: "no_keywords" });
  });

  it("sends an error alert when every external source failed", async () => {
    discoverViralExamples.mockResolvedValue({ saved: 0, errors: [{ message: "no permission" }], externalAllFailed: true });
    await GET(request());
    expect(sendSystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", title: "Viral discovery failed", message: "no permission", brandName: "cosmicpath" }),
    );
  });

  it("sends no alert when external sources partly succeed", async () => {
    discoverViralExamples.mockResolvedValue({ saved: 5, errors: [{ message: "one keyword failed" }], externalAllFailed: false });
    await GET(request());
    expect(sendSystemAlert).not.toHaveBeenCalled();
  });

  it("alerts and returns 500 when discovery throws, instead of a silent 200", async () => {
    discoverViralExamples.mockImplementation(async (brandId: string) => {
      if (brandId === "a") throw new Error("db down");
      return { saved: 1, errors: [], externalAllFailed: false };
    });
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.externalSourcesFailed).toEqual(["cosmicpath"]);
    expect(body.brands).toContainEqual({ slug: "cosmicpath", success: false, error: "db down" });
    expect(sendSystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", title: "Viral discovery failed", message: "db down", brandName: "cosmicpath" }),
    );
    // The healthy brand is still processed.
    expect(learnViralPatterns).toHaveBeenCalledTimes(1);
  });

  it("warns when keyword search returned only the brand's own posts, but only on analysis runs", async () => {
    discoverViralExamples.mockResolvedValue({ saved: 3, errors: [], externalAllFailed: false, keywordOnlyOwnPosts: true });
    const body = await (await GET(request())).json();
    expect(sendSystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning", title: "Keyword search returned only own posts", brandName: "cosmicpath" }),
    );
    expect(body.brands[0].keywordOnlyOwnPosts).toBe(true);

    vi.clearAllMocks();
    await GET(new NextRequest("http://localhost/api/cron/viral?analyze=false"));
    expect(sendSystemAlert).not.toHaveBeenCalled();
  });

  it("tries a ref_replay draft for every harvested brand and reports it", async () => {
    discoverViralExamples.mockResolvedValue({ saved: 1, errors: [], externalAllFailed: false });
    refillReferenceReplay.mockResolvedValueOnce({ generated: 1, sourceId: "ex_1" });
    const body = await (await GET(request())).json();
    expect(refillReferenceReplay).toHaveBeenCalledTimes(2);
    expect(refillReferenceReplay.mock.calls[0][0]).toMatchObject({ id: "a" });
    expect(body.brands[0].referenceReplay).toEqual({ generated: 1, sourceId: "ex_1" });
  });

  it("skips Claude analysis when analyze=false but still harvests, learns and tries ref_replay", async () => {
    discoverViralExamples.mockResolvedValue({ saved: 1, errors: [], externalAllFailed: false });
    const response = await GET(new NextRequest("http://localhost/api/cron/viral?analyze=false"));
    expect(response.status).toBe(200);
    expect(analyzeTopViralExamples).not.toHaveBeenCalled();
    expect(learnViralPatterns).toHaveBeenCalledTimes(2);
    expect(refillReferenceReplay).toHaveBeenCalledTimes(2);
  });

  it("keeps the brand green when refillReferenceReplay throws", async () => {
    discoverViralExamples.mockResolvedValue({ saved: 1, errors: [], externalAllFailed: false });
    refillReferenceReplay.mockRejectedValueOnce(new Error("generation exploded"));
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.brands[0].referenceReplay).toEqual({ generated: 0, skipped: "dropped", reason: "generation exploded" });
    expect(body.brands[0].success).toBe(true);
  });
});
