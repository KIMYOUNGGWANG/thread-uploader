import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ running: 0, maxRunning: 0 }));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: () => null,
  requireBrandForCurrentUser: vi.fn(async () => ({ brand: { id: "b1", name: "CosmicPath" } })),
}));
vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "token", userId: "u1" })),
  publishReplyWithRetryForBrand: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(async () =>
        Array.from({ length: 5 }, (_, index) => ({ id: `p${index}`, content: `post ${index}`, threadsId: `t${index}`, createdAt: new Date() }))
      ),
    },
  },
}));
vi.mock("@/lib/threads-replies", () => ({
  fetchRepliesForPost: vi.fn(async (threadsId: string) =>
    Array.from({ length: 6 }, (_, index) => ({ id: `${threadsId}-r${index}`, text: `reply ${index}`, timestamp: "", username: "reader" }))
  ),
  generateDraftReply: vi.fn(async () => {
    state.running++;
    state.maxRunning = Math.max(state.maxRunning, state.running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    state.running--;
    return "draft";
  }),
}));

import { GET, maxDuration } from "./route";

describe("GET /api/interactions", () => {
  // Five posts x five replies used to run 25 Claude calls one after another inside a 15s function.
  it("drafts replies for the five posts in parallel and keeps five drafts per post", async () => {
    const response = await GET(new NextRequest("http://localhost/api/interactions?brandId=b1"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { posts: Array<{ postId: string; replies: Array<{ draftReply: string }> }> };
    expect(body.posts.map((post) => post.postId)).toEqual(["p0", "p1", "p2", "p3", "p4"]);
    expect(body.posts.every((post) => post.replies.length === 5 && post.replies.every((reply) => reply.draftReply === "draft"))).toBe(true);
    expect(state.maxRunning).toBe(5);
    expect(maxDuration).toBeGreaterThanOrEqual(60);
  });
});
