import { describe, it, expect } from "vitest";
import {
  identifyBottomPerformingPosts,
  readProhibitedPhrases,
  findProhibitedPhrases,
  extractNegativeCliches,
  mergeNegativePhrasesIntoBrandConfig,
  type BottomPostSample,
} from "./negative-pattern-learner";

describe("negative-pattern-learner", () => {
  it("identifies bottom 10% posts sorted by lowest performance score", () => {
    const posts: BottomPostSample[] = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      content: `Post ${i} content`,
      views: (i + 1) * 100,
      replies: i,
      reposts: 0,
    }));

    // Bottom 10% of 20 posts is 2 posts
    const bottomPosts = identifyBottomPerformingPosts(posts, 0.1);
    expect(bottomPosts.length).toBe(2);
    expect(bottomPosts[0].id).toBe("p0"); // views 100
    expect(bottomPosts[1].id).toBe("p1"); // views 200
  });

  it("extracts common weak opening cliches and formal phrases from bottom posts", () => {
    const bottomPosts: BottomPostSample[] = [
      {
        id: "p1",
        content: "결론부터 말씀드리자면 누구나 살면서 고민을 합니다.\n열심히 살아야 합니다.",
        views: 10,
        replies: 0,
        reposts: 0,
      },
      {
        id: "p2",
        content: "오늘은 대운에 대해 알아보도록 하겠습니다.\n모두 힘내세요.",
        views: 15,
        replies: 0,
        reposts: 0,
      },
    ];

    const cliches = extractNegativeCliches(bottomPosts);
    expect(cliches.length).toBeGreaterThanOrEqual(1);
    expect(cliches.some((c) => c.includes("말씀드리자면") || c.includes("알아보도록"))).toBe(true);
  });

  it("merges newly discovered negative phrases into brandConfig prohibitedPhrases without duplicates", () => {
    const existingConfig = {
      fidelity: {
        prohibitedPhrases: ["좋은 일이 올 거예요", "스스로를 믿으세요"],
      },
    };

    const newPhrases = ["결론부터 말씀드리자면", "좋은 일이 올 거예요", "알아보도록 하겠습니다"];

    const updated = mergeNegativePhrasesIntoBrandConfig(existingConfig, newPhrases);
    expect(updated.fidelity.prohibitedPhrases).toContain("결론부터 말씀드리자면");
    expect(updated.fidelity.prohibitedPhrases).toContain("알아보도록 하겠습니다");
    expect(updated.fidelity.prohibitedPhrases).toContain("좋은 일이 올 거예요");
    // Duplicate prevented
    const count = updated.fidelity.prohibitedPhrases.filter((p: string) => p === "좋은 일이 올 거예요").length;
    expect(count).toBe(1);
  });
});

describe("prohibited phrase readback", () => {
  it("reads learned phrases from stored fidelity and finds them in a post", () => {
    const raw = JSON.stringify({ fidelity: { prohibitedPhrases: ["포기하지 마세요", "", 3] } });
    const phrases = readProhibitedPhrases(raw);
    expect(phrases).toEqual(["포기하지 마세요"]);
    expect(findProhibitedPhrases("오늘도 포기하지 마세요!", phrases)).toEqual(["포기하지 마세요"]);
    expect(findProhibitedPhrases("담담하게 버텨", phrases)).toEqual([]);
    expect(readProhibitedPhrases("broken")).toEqual([]);
  });
});
