import { describe, expect, it } from "vitest";
import {
  analyzeViralText,
  buildViralMemory,
  calculateConfidence,
  keepFeedbackFields,
  calculateSearchSignalScore,
  mergeStoredRawMetrics,
  readRankHistory,
} from "@/lib/viral-analysis";

describe("analyzeViralText", () => {
  it("detects self-classification mechanics distinctly", () => {
    const analysis = analyzeViralText(
      "지금 연락해도 될지 모르겠다면\nA. 연락 B. 대기 C. 축소 D. 보류 중 가까운 쪽만 체크해."
    );

    expect(analysis.structureType).toBe("자기분류");
    expect(analysis.ctaType).toBe("자기분류 셀프체크");
    expect(analysis.keyTakeaway).toContain("자기분류");
  });

  it("detects saveable tools distinctly", () => {
    const analysis = analyzeViralText(
      "이직 밀기 전 3가지만 체크해.\n1. 에너지 2. 조건 3. 다음 선택지. 저장해두고 흔들릴 때 다시 봐."
    );

    expect(analysis.structureType).toBe("저장형 도구");
    expect(analysis.ctaType).toBe("저장 유도");
    expect(analysis.keyTakeaway).toContain("저장형 도구");
  });
});

describe("buildViralMemory", () => {
  it("recommends participatory mechanics from learned examples", () => {
    const memory = buildViralMemory([
      {
        id: "example_1",
        source: "manual",
        content: "지금 연락 고민이면 A/B/C/D 중 하나만 체크해.",
        viralScore: 90,
        hookType: "질문형 훅",
        topic: "연락",
        emotionalDriver: "불안",
        structureType: "자기분류",
        ctaType: "자기분류 셀프체크",
      },
    ]);

    expect(memory.topPatterns[0]?.recommendation).toContain("자기분류");
    expect(memory.recommendations.join(" ")).toContain("자기분류");
  });

  it("applies Laplace smoothing to calculateConfidence reliably", () => {
    // 1 sample with 100 score should not dominate 10 samples with 80 score
    const oneSampleConfidence = calculateConfidence(1, 100);
    const tenSamplesConfidence = calculateConfidence(10, 80);

    expect(oneSampleConfidence).toBeLessThan(tenSamplesConfidence);
    expect(oneSampleConfidence).toBeGreaterThan(0);
    expect(tenSamplesConfidence).toBeLessThanOrEqual(100);
  });
});

describe("keepFeedbackFields", () => {
  it("keeps feedback-owned hooks when the hourly learner rebuilds memory", () => {
    const previous = JSON.stringify({
      topPerformers: [{ postId: "p1", hook: "로또 1등 되면 뭐 할 거야?", score: 900, views: 299073 }],
      nextHookCandidates: [{ parentPostId: "p1", nextHeadlineHook: "퇴사 vs 존버", objectionCore: "세금" }],
    });
    const rebuilt = buildViralMemory([]);

    const merged = keepFeedbackFields(rebuilt, previous);

    expect(merged.topPerformers?.[0]?.hook).toBe("로또 1등 되면 뭐 할 거야?");
    expect(merged.nextHookCandidates).toHaveLength(1);
    expect(merged.sampleSize).toBe(rebuilt.sampleSize);
  });

  it("tolerates missing or broken previous memory", () => {
    expect(keepFeedbackFields(buildViralMemory([]), null).topPerformers).toEqual([]);
    expect(keepFeedbackFields(buildViralMemory([]), "not json").topPerformers).toEqual([]);
  });
});

describe("calculateSearchSignalScore", () => {
  it("ranks a top-1 post seen across keywords and runs above a rank-10 one-off", () => {
    const strong = calculateSearchSignalScore({ searchRank: 1, keywordHits: 3, timesSeen: 12 });
    const weak = calculateSearchSignalScore({ searchRank: 10, keywordHits: 1, timesSeen: 1 });
    expect(strong).toBe(28 + 40 + 22);
    expect(weak).toBe(1);
  });

  it("scores zero without any search signal and caps persistence", () => {
    expect(calculateSearchSignalScore({})).toBe(0);
    expect(calculateSearchSignalScore({ timesSeen: 500 })).toBe(48);
  });
});

describe("mergeStoredRawMetrics", () => {
  it("starts at one sighting for a new post", () => {
    const stored = mergeStoredRawMetrics(null, { searchRank: 3, keywordHits: 1 });
    expect(stored.signal).toEqual({ searchRank: 3, keywordHits: 1, timesSeen: 1 });
    expect(stored.isLlmAnalyzed).toBe(false);
  });

  it("counts repeat sightings and keeps the Claude analysis markers", () => {
    const previous = JSON.stringify({ timesSeen: 4, llmAnalyzedAt: "2026-10-13T00:00:00Z", whyItWorks: "양자택일" });
    const stored = mergeStoredRawMetrics(previous, { searchRank: 2 });
    expect(stored.merged).toMatchObject({ timesSeen: 5, llmAnalyzedAt: "2026-10-13T00:00:00Z", whyItWorks: "양자택일", searchRank: 2 });
    expect(stored.isLlmAnalyzed).toBe(true);
  });

  it("keeps replayAttemptedAt across a re-harvest without marking the post as Claude-analyzed", () => {
    const previous = JSON.stringify({ timesSeen: 2, replayAttemptedAt: "2026-10-26T00:00:00.000Z" });
    const stored = mergeStoredRawMetrics(previous, { searchRank: 1 });
    expect(stored.merged).toMatchObject({ timesSeen: 3, replayAttemptedAt: "2026-10-26T00:00:00.000Z", searchRank: 1 });
    expect(stored.isLlmAnalyzed).toBe(false);
  });

  it("stamps firstSeenAt on the first save and keeps it across re-harvests", () => {
    const first = mergeStoredRawMetrics(null, { searchRank: 1 }, new Date("2026-10-27T00:00:00.000Z"));
    expect(first.merged.firstSeenAt).toBe("2026-10-27T00:00:00.000Z");
    const again = mergeStoredRawMetrics(JSON.stringify(first.merged), { searchRank: 2 }, new Date("2026-10-27T12:00:00.000Z"));
    expect(again.merged.firstSeenAt).toBe("2026-10-27T00:00:00.000Z");
  });

  it("treats a legacy row without timesSeen as one prior sighting", () => {
    expect(mergeStoredRawMetrics("{}", {}).signal.timesSeen).toBe(2);
  });

  it("appends one rankHistory entry per sighting, newest last", () => {
    const first = mergeStoredRawMetrics(null, { searchRank: 5, keywordHits: 1 }, new Date("2026-10-28T00:00:00.000Z"));
    const second = mergeStoredRawMetrics(JSON.stringify(first.merged), { searchRank: 2, keywordHits: 2 }, new Date("2026-10-28T04:00:00.000Z"));
    expect(second.merged.rankHistory).toEqual([
      { at: "2026-10-28T00:00:00.000Z", rank: 5, hits: 1 },
      { at: "2026-10-28T04:00:00.000Z", rank: 2, hits: 2 },
    ]);
  });

  it("keeps only the last 12 rankHistory entries", () => {
    let raw: string | null = null;
    for (let i = 0; i < 14; i++) raw = JSON.stringify(mergeStoredRawMetrics(raw, { searchRank: i + 1, keywordHits: 1 }, new Date(Date.UTC(2026, 9, 28, i))).merged);
    const history = readRankHistory(JSON.parse(raw ?? "{}"));
    expect(history).toHaveLength(12);
    expect(history[0].rank).toBe(3);
    expect(history[11].rank).toBe(14);
  });

  it("starts a fresh rankHistory when the stored one is invalid and skips sightings without a rank", () => {
    const broken = JSON.stringify({ timesSeen: 1, rankHistory: "nope" });
    const stored = mergeStoredRawMetrics(broken, { searchRank: 4, keywordHits: 1 }, new Date("2026-10-28T00:00:00.000Z"));
    expect(stored.merged.rankHistory).toEqual([{ at: "2026-10-28T00:00:00.000Z", rank: 4, hits: 1 }]);
    const noRank = mergeStoredRawMetrics(JSON.stringify(stored.merged), { keywordHits: 1 }, new Date("2026-10-28T04:00:00.000Z"));
    expect(noRank.merged.rankHistory).toEqual(stored.merged.rankHistory);
    expect(readRankHistory({ rankHistory: [{ at: "x", rank: "1", hits: 1 }, { at: "y", rank: 2, hits: 1 }] })).toEqual([{ at: "y", rank: 2, hits: 1 }]);
  });
});
