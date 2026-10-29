import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createManualReferenceDraft, parseManualReferenceInput } from "@/lib/manual-reference";
import { requireBrandForCurrentUser } from "@/lib/brand-access";

vi.mock("@/lib/brand-access", () => ({ accessErrorResponse: vi.fn(), requireBrandForCurrentUser: vi.fn() }));
vi.mock("@/lib/manual-reference", () => ({ createManualReferenceDraft: vi.fn(), parseManualReferenceInput: vi.fn() }));

import { POST, maxDuration } from "./route";

describe("POST /api/viral/references/manual", () => {
  // One generation with quality retries outlives the platform default, same as /api/generate.
  it("allows the same 300s as /api/generate", () => {
    expect(maxDuration).toBe(300);
  });

  // The card shows { error } as a plain error box, so a brand that cannot generate is not reported as a quality drop.
  it("answers a not_ready brand with 422 and the readiness error", async () => {
    vi.mocked(parseManualReferenceInput).mockReturnValue({ ok: true, value: { content: "x".repeat(30), kind: "info", linkUrl: null, sourceUrl: null } });
    vi.mocked(requireBrandForCurrentUser).mockResolvedValue({ brand: { id: "b1" } } as unknown as Awaited<ReturnType<typeof requireBrandForCurrentUser>>);
    vi.mocked(createManualReferenceDraft).mockResolvedValue({ status: "not_ready", error: "제품에 시스템 프롬프트가 설정되지 않았습니다." });

    const response = await POST(new NextRequest("http://localhost/api/viral/references/manual", { method: "POST", body: JSON.stringify({ brandId: "b1" }) }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "제품에 시스템 프롬프트가 설정되지 않았습니다." });
  });
});
