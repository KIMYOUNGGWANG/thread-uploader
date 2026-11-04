import { describe, expect, it } from "vitest";
import { resolvePublishSlots } from "@/lib/publish-slots";

describe("resolvePublishSlots", () => {
  it("pins cosmicpath to KST 11/22/01 whatever list the scheduler sent", () => {
    expect(resolvePublishSlots("cosmicpath", [0, 3, 9, 12, 14])).toEqual([2, 13, 16]);
    expect(resolvePublishSlots("cosmicpath-global", [3])).toEqual([0, 12]);
  });

  it("keeps the caller's list for an unpinned brand", () => {
    expect(resolvePublishSlots("other-product", [5, 17])).toEqual([5, 17]);
    expect(resolvePublishSlots(undefined, [5])).toEqual([5]);
  });

  it("stays ungated when the caller sent no slots", () => {
    expect(resolvePublishSlots("cosmicpath", null)).toBeNull();
  });
});
