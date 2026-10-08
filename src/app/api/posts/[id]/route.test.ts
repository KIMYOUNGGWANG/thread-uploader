import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({ prisma: { post: { update: vi.fn(async ({ data }) => ({ id: "p1", ...data })) } } }));
vi.mock("@/lib/brand-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brand-access")>();
  return { ...actual, requirePostForCurrentUser: vi.fn(async () => ({})) };
});

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/posts/p1", { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "p1" }) }
  );
}

describe("PATCH /api/posts/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects arbitrary status values like PUBLISHED", async () => {
    const res = await patch({ status: "PUBLISHED" });
    expect(res.status).toBe(400);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it("approval to PENDING clears the quality and score gates", async () => {
    await patch({ status: "PENDING" });
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PENDING", qualityPass: true, algorithmicPass: true }),
    }));
  });

  it("editing content without approval resets the score pass", async () => {
    await patch({ content: "새 본문" });
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { content: "새 본문", algorithmicPass: null },
    }));
  });
});
