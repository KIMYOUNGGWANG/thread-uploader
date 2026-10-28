import { afterEach, describe, expect, it, vi } from "vitest";
import { approveCommandPlan, requestCommandPlan } from "@/lib/command-client";

const plan = { brandId: "b1", count: 3, hypothesis: "출시 소식" };

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("command client", () => {
  it("sends only text when asking for a plan", async () => {
    const fetchMock = mockFetch(200, { plan, brandSlug: "cosmicpath" });
    const preview = await requestCommandPlan("cosmicpath 3개");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ text: "cosmicpath 3개" });
    expect(preview).toEqual({ plan, brandSlug: "cosmicpath" });
  });

  it("sends approved: true with the plan and returns the summary", async () => {
    const fetchMock = mockFetch(200, { success: true, count: 3, auditSummary: { total: 3, passed: 1, needsReview: 2 } });
    const result = await approveCommandPlan(plan);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ plan, approved: true });
    expect(result).toEqual({ count: 3, auditSummary: { total: 3, passed: 1, needsReview: 2 } });
  });

  it("surfaces the server error message", async () => {
    mockFetch(400, { error: "명령에서 브랜드를 찾을 수 없습니다" });
    await expect(requestCommandPlan("뭔가")).rejects.toThrow("명령에서 브랜드를 찾을 수 없습니다");
  });
});
