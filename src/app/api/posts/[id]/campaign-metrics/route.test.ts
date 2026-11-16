import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  updatePost: vi.fn<(args: { where: object; data: Record<string, unknown> }) => Promise<object>>(async ({ data }) => ({ id: "p1", ...data })),
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requirePostForCurrentUser: vi.fn(async () => ({
    post: { id: "p1", views: 1000, likes: 10, replies: 2, reposts: 1, clicks: 0, conversions: 0, manualPaidConversions: 0 },
  })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { post: { update: mocks.updatePost } } }));

import { PATCH } from "./route";

describe("PATCH /api/posts/[id]/campaign-metrics", () => {
  // metricsAt means "when the views were read"; entering clicks by hand does not re-read views.
  it("saves the entered counts and score without touching metricsAt", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/posts/p1/campaign-metrics", { method: "PATCH", body: JSON.stringify({ clicks: 12 }) }),
      { params: Promise.resolve({ id: "p1" }) }
    );

    expect(response.status).toBe(200);
    const { data } = mocks.updatePost.mock.calls[0][0];
    expect(data.clicks).toBe(12);
    expect(data.performanceScore).toEqual(expect.any(Number));
    expect(data).not.toHaveProperty("metricsAt");
  });
});
