import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/channels/backfill", () => ({
  runChannelBackfill: vi.fn(async ({ apply }: { apply: boolean }) => ({
    groupsToCreate: 0, accountsToCreate: 0, threadsPosts: 0, instagramPosts: 0, applied: apply,
  })),
}));

import { runChannelBackfill } from "@/lib/channels/backfill";
import { GET } from "./route";

describe("GET /api/cron/backfill-channel-structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects calls without the cron secret", async () => {
    const res = await GET(new NextRequest("http://x/api/cron/backfill-channel-structure"));
    expect(res.status).toBe(401);
    expect(runChannelBackfill).not.toHaveBeenCalled();
  });

  it("defaults to dry-run and applies only with ?apply=1", async () => {
    const headers = { authorization: "Bearer s3cret" };
    await GET(new NextRequest("http://x/api/cron/backfill-channel-structure", { headers }));
    expect(runChannelBackfill).toHaveBeenLastCalledWith({ apply: false });
    await GET(new NextRequest("http://x/api/cron/backfill-channel-structure?apply=1", { headers }));
    expect(runChannelBackfill).toHaveBeenLastCalledWith({ apply: true });
  });
});
