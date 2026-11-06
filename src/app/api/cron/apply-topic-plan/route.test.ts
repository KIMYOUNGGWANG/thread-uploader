import { beforeEach, describe, expect, it, vi } from "vitest";
import { COSMICPATH_TOPICS } from "@/lib/topic-plans";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), findBrand: vi.fn(), updateBrand: vi.fn(async () => ({})) }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mocks.verify }));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: mocks.findBrand, update: mocks.updateBrand } } }));

const call = async (query: string) => {
  const { GET } = await import("@/app/api/cron/apply-topic-plan/route");
  const response = await GET({ headers: new Headers(), nextUrl: new URL(`http://localhost/api/cron/apply-topic-plan?${query}`) } as never);
  return { status: response.status, body: await response.json() };
};

describe("GET /api/cron/apply-topic-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue(true);
    mocks.findBrand.mockResolvedValue({ id: "b1", brandConfig: JSON.stringify({ topics: ["이직/퇴사 타이밍 판정"], other: 1 }) });
  });

  it("rejects a missing secret and a brand without a plan", async () => {
    mocks.verify.mockReturnValueOnce(false);
    expect((await call("brand=cosmicpath")).status).toBe(401);
    expect((await call("brand=catchdex")).status).toBe(400);
  });

  it("previews without writing", async () => {
    const { body } = await call("brand=cosmicpath");
    expect(body).toMatchObject({ apply: false, written: false, previous: ["이직/퇴사 타이밍 판정"], next: [...COSMICPATH_TOPICS] });
    expect(mocks.updateBrand).not.toHaveBeenCalled();
  });

  it("writes the plan and keeps the previous list and other fields", async () => {
    const { body } = await call("brand=cosmicpath&apply=true");
    expect(body.written).toBe(true);
    const written = JSON.parse((mocks.updateBrand.mock.calls[0] as unknown as [{ data: { brandConfig: string } }])[0].data.brandConfig);
    expect(written).toMatchObject({ topics: [...COSMICPATH_TOPICS], previousTopics: ["이직/퇴사 타이밍 판정"], other: 1 });
  });

  it("does not write when the plan is already in place", async () => {
    mocks.findBrand.mockResolvedValueOnce({ id: "b1", brandConfig: JSON.stringify({ topics: [...COSMICPATH_TOPICS] }) });
    expect((await call("brand=cosmicpath&apply=true")).body.written).toBe(false);
    expect(mocks.updateBrand).not.toHaveBeenCalled();
  });
});
