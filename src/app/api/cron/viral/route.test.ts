import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const discoverViralExamples = vi.hoisted(() => vi.fn());
const learnViralPatterns = vi.hoisted(() => vi.fn(async () => ({ learnedPatterns: 3 })));

vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findMany: vi.fn(async () => [{ id: "a", slug: "cosmicpath" }, { id: "b", slug: "catchdex" }]) } },
}));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: () => true }));
vi.mock("@/lib/viral-service", () => ({ discoverViralExamples, learnViralPatterns }));
vi.mock("@/lib/viral-llm-analysis", () => ({ analyzeTopViralExamples: vi.fn(async () => ({ analyzed: 0 })) }));

import { GET } from "./route";

const request = () => new NextRequest("http://localhost/api/cron/viral");

describe("viral cron", () => {
  beforeEach(() => vi.clearAllMocks());

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
});
