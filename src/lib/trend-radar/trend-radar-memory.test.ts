import { describe, expect, it } from "vitest";
import { formatTrendRadarContext, readTrendRadar, toTrendRadarMemory } from "./trend-radar-memory";
import type { TransposedViralCandidate } from "./transposition-engine";

const candidate: TransposedViralCandidate = {
  skeletonId: "sk-1",
  targetDomain: "CAREER_CONFLICT",
  hookHeadline: "대기업 이직 1년 만에 퇴사하는 사주 패턴",
  openingNarrative: "간판보다 타이밍",
  domainMapping: { originalConflict: "번아웃", brandEquivalentConcept: "대운 교운기" },
  choiceMatrix: ["A. 버팀", "B. 이동", "C. 준비"],
};

describe("trend radar memory", () => {
  it("round-trips through brandConfig JSON and renders a prompt section", () => {
    const memory = toTrendRadarMemory([candidate], new Date("2026-10-13T00:00:00Z"));
    const stored = readTrendRadar(JSON.stringify({ topics: ["x"], trendRadar: memory }));

    const context = formatTrendRadarContext(stored, new Date("2026-10-14T00:00:00Z"));

    expect(context).toContain("대기업 이직 1년 만에 퇴사하는 사주 패턴");
    expect(context).toContain("A. 버팀 | B. 이동 | C. 준비");
  });

  it("drops stale radars and malformed items", () => {
    const memory = toTrendRadarMemory([candidate], new Date("2026-10-01T00:00:00Z"));
    expect(formatTrendRadarContext(memory, new Date("2026-10-13T00:00:00Z"))).toBe("");

    const broken = readTrendRadar(JSON.stringify({ trendRadar: { harvestedAt: "2026-10-13", items: [{ domain: 1 }] } }));
    expect(broken?.items).toEqual([]);
    expect(readTrendRadar("not json")).toBeNull();
  });
});
