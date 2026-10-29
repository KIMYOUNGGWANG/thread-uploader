import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/brand-access", () => ({ accessErrorResponse: vi.fn(), requireBrandForCurrentUser: vi.fn() }));
vi.mock("@/lib/manual-reference", () => ({ createManualReferenceDraft: vi.fn(), parseManualReferenceInput: vi.fn() }));

import { maxDuration } from "./route";

describe("POST /api/viral/references/manual", () => {
  // One generation with quality retries outlives the platform default, same as /api/generate.
  it("allows the same 300s as /api/generate", () => {
    expect(maxDuration).toBe(300);
  });
});
