import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, ResourceNotFoundError, requireBrandForCurrentUser } from "@/lib/brand-access";
import { createDraftFromReference, type CreateDraftFromReferenceResult } from "@/lib/reference-review";

vi.mock("@/lib/brand-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/brand-access")>()),
  requireBrandForCurrentUser: vi.fn(),
}));
vi.mock("@/lib/reference-review", () => ({ createDraftFromReference: vi.fn() }));

import { POST, maxDuration } from "./route";

const call = (body: unknown) => POST(
  new NextRequest("http://localhost/api/viral/references/e1/draft", { method: "POST", body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: "e1" }) },
);

describe("POST /api/viral/references/[id]/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireBrandForCurrentUser).mockResolvedValue({ brand: { id: "b1" } } as never);
  });

  it("allows the same 300s as /api/generate", () => {
    expect(maxDuration).toBe(300);
  });

  it("rejects a missing brandId or an unknown kind before any paid call", async () => {
    expect((await call({ kind: "story" })).status).toBe(400);
    expect((await call({ brandId: "b1", kind: "news" })).status).toBe(400);
    expect((await call({ brandId: "b1" })).status).toBe(400);
    expect(createDraftFromReference).not.toHaveBeenCalled();
  });

  it("does not generate when the user does not own the brand, and answers 404 for a foreign example", async () => {
    vi.mocked(requireBrandForCurrentUser).mockRejectedValueOnce(new ForbiddenError());
    expect((await call({ brandId: "b1", kind: "story" })).status).toBe(403);
    expect(createDraftFromReference).not.toHaveBeenCalled();

    vi.mocked(createDraftFromReference).mockRejectedValueOnce(new ResourceNotFoundError("Reference not found"));
    expect((await call({ brandId: "b1", kind: "story" })).status).toBe(404);
  });

  it("answers 409 for a rejected reference and 422 for a brand that cannot generate", async () => {
    vi.mocked(createDraftFromReference).mockResolvedValueOnce({ status: "rejected" });
    const rejected = await call({ brandId: "b1", kind: "story" });
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toEqual({ error: expect.stringContaining("제외한") });

    vi.mocked(createDraftFromReference).mockResolvedValueOnce({ status: "not_ready", error: "시스템 프롬프트가 없어요" });
    const notReady = await call({ brandId: "b1", kind: "info" });
    expect(notReady.status).toBe(422);
    expect(await notReady.json()).toEqual({ error: "시스템 프롬프트가 없어요" });
  });

  it("returns created, dropped and duplicate as 200 with the id and kind passed through", async () => {
    const results: CreateDraftFromReferenceResult[] = [{ status: "created", postId: "p1" }, { status: "dropped", reasons: ["유사도 탈락"] }, { status: "duplicate" }];
    for (const result of results) {
      vi.mocked(createDraftFromReference).mockResolvedValueOnce(result);
      const response = await call({ brandId: "b1", kind: "info" });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(result);
    }
    expect(createDraftFromReference).toHaveBeenLastCalledWith({ id: "b1" }, "e1", "info", expect.any(Date));
  });
});
