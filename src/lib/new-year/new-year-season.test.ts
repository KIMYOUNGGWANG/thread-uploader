import { describe, it, expect } from "vitest";
import { isNewYearModeId, newYearSlotMode } from "./new-year-season";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const slot = (brandSlug: string, at: string, slotIndex: number, choicesCapped = false) =>
  newYearSlotMode({ brandSlug, plannedAt: kst(at), slotIndex, choicesCapped, env: {} as NodeJS.ProcessEnv });

describe("newYearSlotMode", () => {
  it("KST 경계: 11/23 23:30은 밖, 11/24 00:10은 안", () => {
    expect(slot("cosmicpath", "2026-11-23T23:30:00", 0)).toBeNull();
    expect(slot("cosmicpath", "2026-11-24T00:10:00", 0)).not.toBeNull();
  });
  it("2/6 23:59 KST는 안, 2/7 00:00 KST는 밖", () => {
    expect(slot("cosmicpath", "2027-02-06T23:59:00", 0)).not.toBeNull();
    expect(slot("cosmicpath", "2027-02-07T00:00:00", 0)).toBeNull();
  });
  it("KO 비율: 초반 5칸 중 1, 정점 5칸 중 2, 끝 5칸 중 1", () => {
    const count = (at: string) => [0, 1, 2, 3, 4].filter((i) => slot("cosmicpath", at, i)).length;
    expect(count("2026-12-01T12:00:00")).toBe(1);
    expect(count("2027-01-10T12:00:00")).toBe(2);
    expect(count("2027-02-03T12:00:00")).toBe(1);
  });
  it("EN은 12/15부터 4칸 중 1", () => {
    const count = (at: string) => [0, 1, 2, 3].filter((i) => slot("cosmicpath-global", at, i)).length;
    expect(count("2026-12-01T12:00:00")).toBe(0);
    expect(count("2027-01-10T12:00:00")).toBe(1);
  });
  it("EN은 값 검사가 없는 ny_ranking·ny_monthly를 쓰지 않고, 연속 신년 칸 유형이 다르다", () => {
    for (const at of ["2027-01-10T12:00:00", "2027-02-03T12:00:00"]) {
      for (const capped of [false, true]) {
        const modes = Array.from({ length: 200 }, (_, i) => slot("cosmicpath-global", at, i, capped)).filter(Boolean);
        expect(modes.length).toBe(50);
        expect(new Set(modes)).not.toContain("ny_ranking");
        expect(new Set(modes)).not.toContain("ny_monthly");
        if (!capped) modes.slice(1).forEach((mode, i) => expect(mode).not.toBe(modes[i]));
      }
    }
  });
  it("다른 브랜드는 시즌 중에도 null", () => {
    expect([0, 1, 2, 3, 4].map((i) => slot("other-brand", "2027-01-10T12:00:00", i))).toEqual([null, null, null, null, null]);
  });
  it("NEW_YEAR_SEASON_DISABLED=1이면 null", () => {
    expect(
      newYearSlotMode({
        brandSlug: "cosmicpath",
        plannedAt: kst("2027-01-10T12:00:00"),
        slotIndex: 0,
        choicesCapped: false,
        env: { ...process.env, NEW_YEAR_SEASON_DISABLED: "1" },
      }),
    ).toBeNull();
  });
  it("정점 구간 신년 칸 100개의 유형 비율이 35/30/20/15", () => {
    const modes = Array.from({ length: 250 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i)).filter(Boolean);
    const share = (id: string) => modes.filter((m) => m === id).length / modes.length;
    expect(share("ny_ranking")).toBeCloseTo(0.35, 2);
    expect(share("ny_ipchun")).toBeCloseTo(0.3, 2);
    expect(share("ny_monthly")).toBeCloseTo(0.2, 2);
    expect(share("ny_pick")).toBeCloseTo(0.15, 2);
  });
  it("연속한 두 신년 칸은 유형이 다르다 (같은 날 같은 유형 두 번 없음)", () => {
    const modes = Array.from({ length: 100 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i)).filter(Boolean);
    modes.slice(1).forEach((mode, i) => expect(mode).not.toBe(modes[i]));
  });
  it("2/1~2/6에는 신년 칸의 절반 이상이 ny_ipchun", () => {
    const modes = Array.from({ length: 40 }, (_, i) => slot("cosmicpath", "2027-02-03T12:00:00", i)).filter(Boolean);
    expect(modes.filter((m) => m === "ny_ipchun").length).toBeGreaterThanOrEqual(modes.length / 2);
  });
  it("번호 선택지 상한이 차면 ny_pick 대신 다른 유형", () => {
    const modes = Array.from({ length: 100 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i, true)).filter(Boolean);
    expect(modes).not.toContain("ny_pick");
  });
});

describe("isNewYearModeId", () => {
  it("신년 유형 ID만 true", () => {
    expect(isNewYearModeId("ny_pick")).toBe(true);
    expect(isNewYearModeId("other")).toBe(false);
    expect(isNewYearModeId(null)).toBe(false);
    expect(isNewYearModeId(undefined)).toBe(false);
  });
});
