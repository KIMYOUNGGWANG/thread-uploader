import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/threads-api", () => ({ getFreshBrandCredentials: vi.fn() }));
vi.mock("@/lib/threads/reply-mention-engine", () => ({
  publishDueDraftReplies: vi.fn(),
  scanAndDraftRepliesForBrand: vi.fn(),
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

describe("GET /api/cron/replies", () => {
  // An expired Threads token can't be refreshed, so scanning those brands only produced an error every run.
  it("only scans brands with an unexpired Threads token", async () => {
    await GET(new NextRequest("http://localhost/api/cron/replies"));
    expect(prisma.brand.findMany).toHaveBeenCalledWith({
      where: { accessToken: { not: null }, tokenExpiry: { gt: expect.any(Date) } },
    });
  });
});
