import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findMany: vi.fn(async () => [
        { id: "b1", slug: "cosmicpath", brandConfig: '{"topics":["사주"]}' },
        { id: "b2", slug: "wellness-media", brandConfig: '{"wellness":{"feeds":["https://a.test/rss"]}}' },
        { id: "b3", slug: "broken", brandConfig: '{"wellness":{}}' },
      ]),
    },
  },
}));
vi.mock("@/lib/wellness/pipeline", () => ({
  runWellnessForBrand: vi.fn(async (brand: { slug: string }) => {
    if (brand.slug === "broken") throw new Error("boom");
    return { slug: brand.slug, collected: 1, scored: 1, drafted: ["p1"], failed: 0, errors: [] };
  }),
}));

import { runWellnessForBrand } from "@/lib/wellness/pipeline";
import { GET } from "./route";

const call = (auth?: string) =>
  GET(new NextRequest("http://localhost/api/cron/wellness", auth ? { headers: { authorization: auth } } : undefined));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.mocked(runWellnessForBrand).mockClear();
});

describe("GET /api/cron/wellness", () => {
  it("rejects calls without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect(runWellnessForBrand).not.toHaveBeenCalled();
  });

  it("runs only wellness brands and isolates a failing brand", async () => {
    const response = await call("Bearer s3cret");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(vi.mocked(runWellnessForBrand).mock.calls.map(([brand]) => brand.slug)).toEqual(["wellness-media", "broken"]);
    expect(body.results).toEqual([
      expect.objectContaining({ slug: "wellness-media", drafted: ["p1"] }),
      expect.objectContaining({ slug: "broken", errors: ["boom"] }),
    ]);
  });
});
