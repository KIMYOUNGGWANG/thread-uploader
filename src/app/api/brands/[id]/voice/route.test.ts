import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findBrandNow: vi.fn(),
  updateBrandConfig: vi.fn<(args: { where: object; data: { brandConfig: string } }) => Promise<{ count: number }>>(async () => ({ count: 1 })),
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requireBrandForCurrentUser: vi.fn(async () => ({ brand: { id: "b1", brandConfig: JSON.stringify({ topics: ["topic at start"] }) } })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findMany: vi.fn(async () => []) },
    // brandConfig is saved through patchBrandConfig: re-read the brand, then a compare-and-set updateMany
    brand: { findUnique: mocks.findBrandNow, updateMany: mocks.updateBrandConfig },
  },
}));

import { POST } from "./route";

describe("POST /api/brands/[id]/voice", () => {
  // The request reads the brand first. A settings save that landed before the write used to be reverted because the
  // whole parsed config was merged into the raw string read at the start.
  it("saves the voice profile on top of the config stored now, not the one read at the start", async () => {
    mocks.findBrandNow.mockResolvedValue({ brandConfig: JSON.stringify({ topics: ["topic saved meanwhile"] }) });

    const response = await POST(
      new NextRequest("http://localhost/api/brands/b1/voice", {
        method: "POST",
        body: JSON.stringify({ samples: ["오늘은 짧게 말할게. 핵심만 기억해."] }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );

    expect(response.status).toBe(200);
    const saved = JSON.parse(mocks.updateBrandConfig.mock.calls[0]?.[0].data.brandConfig ?? "{}");
    expect(saved.topics).toEqual(["topic saved meanwhile"]);
    expect(saved.voiceProfile).toBeDefined();
  });
});
