import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findMany: vi.fn() } } }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: vi.fn(() => true) }));
vi.mock("@/lib/youtube/shorts-service", () => ({ discoverShorts: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { discoverShorts } from "@/lib/youtube/shorts-service";
import { GET } from "./route";

// brandConfig is stored as a JSON string
const enabledConfig = JSON.stringify({ viralDiscovery: { adapters: [{ id: "youtube_shorts", enabled: true }] } });
const disabledConfig = JSON.stringify({ viralDiscovery: { adapters: [{ id: "youtube_shorts", enabled: false }] } });
const ok = { discovered: 3, saved: 2, quotaUsed: 101, errors: [] };

function call(query = "") {
  return GET(new NextRequest(`http://localhost/api/cron/shorts/discover${query}`));
}

describe("GET /api/cron/shorts/discover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(verifyCronSecret).mockReturnValue(true);
    vi.mocked(discoverShorts).mockResolvedValue(ok);
  });

  it("returns 401 without the cron secret", async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(false);
    const res = await call();
    expect(res.status).toBe(401);
    expect(prisma.brand.findMany).not.toHaveBeenCalled();
    expect(discoverShorts).not.toHaveBeenCalled();
  });

  it("runs only brands with youtube_shorts enabled when brands is omitted", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValue([
      { id: "b1", slug: "on", brandConfig: enabledConfig },
      { id: "b2", slug: "off", brandConfig: disabledConfig },
    ] as never);
    const res = await call();
    expect(discoverShorts).toHaveBeenCalledTimes(1);
    expect(discoverShorts).toHaveBeenCalledWith("b1");
    expect(await res.json()).toEqual({ success: true, brands: [{ slug: "on", ...ok }] });
  });

  it("limits to ?brands= slugs", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValue([{ id: "b2", slug: "off", brandConfig: disabledConfig }] as never);
    await call("?brands=off, other");
    expect(prisma.brand.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: { in: ["off", "other"] } } }));
    expect(discoverShorts).toHaveBeenCalledWith("b2");
  });

  it("keeps going when one brand throws and reports it in errors", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValue([
      { id: "b1", slug: "a", brandConfig: enabledConfig },
      { id: "b2", slug: "b", brandConfig: enabledConfig },
    ] as never);
    vi.mocked(discoverShorts).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(ok);
    const body = await (await call()).json();
    expect(body.success).toBe(true);
    expect(body.brands).toEqual([
      { slug: "a", quotaUsed: 0, errors: [{ adapter: "youtube_shorts", source: "route", message: "boom" }] },
      { slug: "b", ...ok },
    ]);
  });
});
