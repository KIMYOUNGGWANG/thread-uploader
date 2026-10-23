import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: vi.fn(() => true) }));
vi.mock("@/lib/youtube/shorts-service", () => ({
  snapshotShorts: vi.fn(),
  cleanupShorts: vi.fn(),
}));

import { verifyCronSecret } from "@/lib/cron-auth";
import { cleanupShorts, snapshotShorts } from "@/lib/youtube/shorts-service";
import { GET } from "./route";

const url = "http://localhost/api/cron/shorts/snapshot";

describe("GET /api/cron/shorts/snapshot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(verifyCronSecret).mockReturnValue(true);
  });

  it("calls snapshotShorts then cleanupShorts and returns both counts", async () => {
    vi.mocked(snapshotShorts).mockResolvedValue({ snapshots: 7, quotaUsed: 2, errors: [] });
    vi.mocked(cleanupShorts).mockResolvedValue({ deleted: 4 });
    const res = await GET(new NextRequest(url));
    expect(vi.mocked(snapshotShorts).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(cleanupShorts).mock.invocationCallOrder[0],
    );
    expect(await res.json()).toEqual({
      success: true,
      brands: [{ slug: "*", snapshots: 7, deleted: 4, quotaUsed: 2, errors: [] }],
    });
  });

  it("still runs cleanup and returns 200 when snapshotShorts throws", async () => {
    vi.mocked(snapshotShorts).mockRejectedValue(new Error("boom"));
    vi.mocked(cleanupShorts).mockResolvedValue({ deleted: 2 });
    const res = await GET(new NextRequest(url));
    expect(cleanupShorts).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      brands: [
        { slug: "*", snapshots: 0, deleted: 2, quotaUsed: 0, errors: [{ adapter: "youtube_shorts", source: "route", message: "boom" }] },
      ],
    });
  });

  it("returns 401 without the cron secret", async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(false);
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(401);
    expect(snapshotShorts).not.toHaveBeenCalled();
  });
});
