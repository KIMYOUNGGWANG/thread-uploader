import { describe, expect, it } from "vitest";
import { coupleCtaToLink, LINK_CTA, shouldLinkAt } from "@/lib/link-cadence";

describe("shouldLinkAt", () => {
  it("links every Nth post counting from the posts the campaign already has", () => {
    // cadence 3, campaign already has 2 posts: the very next post (index 0) is the 3rd → linked
    expect(shouldLinkAt({ index: 0, linkOffset: 2, cadence: 3 })).toBe(true);
    expect(shouldLinkAt({ index: 1, linkOffset: 2, cadence: 3 })).toBe(false);
    expect(shouldLinkAt({ index: 3, linkOffset: 2, cadence: 3 })).toBe(true);
  });

  it("keeps the old behaviour when nothing exists yet", () => {
    expect([0, 1, 2, 3, 4, 5].map((index) => shouldLinkAt({ index, linkOffset: 0, cadence: 3 }))).toEqual([false, false, true, false, false, true]);
  });

  it("links every post at cadence 1 and never below 1", () => {
    expect(shouldLinkAt({ index: 0, linkOffset: 7, cadence: 1 })).toBe(true);
    expect(shouldLinkAt({ index: 0, linkOffset: 7, cadence: 0 })).toBe(true);
  });

  it("stays consistent across request chunks of size 2", () => {
    // Client sends count=6 as three requests of 2; the server passes the growing backlog as offset.
    const linked = [0, 2, 4].flatMap((offset) => [0, 1].map((index) => shouldLinkAt({ index, linkOffset: offset, cadence: 3 })));
    expect(linked.filter(Boolean)).toHaveLength(2);
  });
});

describe("coupleCtaToLink", () => {
  const candidates = ["저장 유도", LINK_CTA, "공유 유도"];

  it("removes the link CTA from posts that carry no link", () => {
    expect(coupleCtaToLink(candidates, false)).toEqual(["저장 유도", "공유 유도"]);
  });

  it("guarantees the link CTA on posts that carry a link", () => {
    expect(coupleCtaToLink(["저장 유도"], true)).toEqual([LINK_CTA]);
    expect(coupleCtaToLink(candidates, true)).toEqual([LINK_CTA]);
  });

  it("falls back to the original candidates when filtering would leave nothing", () => {
    expect(coupleCtaToLink([LINK_CTA], false)).toEqual([LINK_CTA]);
  });
});
