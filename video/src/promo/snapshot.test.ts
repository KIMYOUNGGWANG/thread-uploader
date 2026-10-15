import { describe, expect, it } from "vitest";
import { parsePromoProps, parsePromoSnapshot, timelineExtremes, validateSnapshot, type PromoSnapshot } from "./snapshot.ts";
import { pickPromoVariant } from "./rotation.ts";

const months = Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1, nameEn: "Jan", average: 40 + i * 3, phase: "NEGOTIATE" }));

function makeSnapshot(overrides: Partial<PromoSnapshot> = {}): PromoSnapshot {
  return {
    asOf: "2026-10-19",
    lang: "ko",
    persona: { birthDate: "1996-03-14", birthTime: "10:30", gender: "female" },
    guest: { birthDate: "1994-11-02", birthTime: "07:00", gender: "male" },
    saju: {
      dayMaster: "경",
      pillars: { hour: { stem: "신", branch: "사" }, day: { stem: "경", branch: "술" }, month: { stem: "신", branch: "묘" }, year: { stem: "병", branch: "자" } },
      elements: [{ stem: "fire", branch: "water" }, { stem: "metal", branch: "wood" }, { stem: "metal", branch: "earth" }, { stem: "metal", branch: "fire" }],
    },
    heatmap: { bestDay: { date: "2026-10-25", score: 90, reasonKo: "임신일 식신", reasonEn: "Ren Shen day" }, months },
    scenario: {
      headline: "지금 이직 준비 시작 쪽 흐름이 우세 — 내년 9월 구간 주목",
      peakLabel: "9월 ('27)",
      timeline: months.map((m, i) => ({ label: `${m.month}월`, action: m.average, best: i === 11 ? "A" : "EQUAL" })),
    },
    ziwei: {
      mingGongBranch: "酉", wuxingJu: "화육국", wuxingJuEn: "Fire", quanPalace: "관록궁",
      palaces: Array.from({ length: 12 }, (_, i) => ({ name: `궁${i}`, nameEn: `P${i}`, branch: "子", stars: [{ ko: "천기", en: "Tian Ji", category: "main" }] })),
    },
    match: { overall: 66, saju: 55, astro: 80, num: 60, hostElement: "금", guestElement: "금", hostSign: "Pisces", guestSign: "Scorpio", hostDayMaster: "경", guestDayMaster: "신", tianganHe: false, dizhiChong: false },
    ...overrides,
  };
}

describe("validateSnapshot", () => {
  it("accepts a healthy snapshot", () => {
    expect(validateSnapshot(makeSnapshot(), "match")).toEqual([]);
  });

  it("rejects a flat or short timeline", () => {
    const flat = makeSnapshot({ scenario: { ...makeSnapshot().scenario, timeline: months.map((m) => ({ label: `${m.month}월`, action: 55, best: "EQUAL" as const })) } });
    expect(validateSnapshot(flat, "race")).toContain("timeline is flat");
    const short = makeSnapshot({ scenario: { ...makeSnapshot().scenario, timeline: [] } });
    expect(validateSnapshot(short, "race").join()).toMatch(/expected 12/);
  });

  it("rejects a best day that is already in the past", () => {
    const stale = makeSnapshot({ heatmap: { ...makeSnapshot().heatmap, bestDay: { date: "2026-10-01", score: 90, reasonKo: "x", reasonEn: "x" } } });
    expect(validateSnapshot(stale, "reportTour").join()).toMatch(/before 2026-10-19/);
  });

  it("rejects broken engine text such as 'Next year 9M'", () => {
    const broken = makeSnapshot({ scenario: { ...makeSnapshot().scenario, headline: "Option A shows the stronger flow — watch Next year 9M" } });
    expect(validateSnapshot(broken, "race").join()).toMatch(/broken text/);
  });

  it("requires in-range match scores only for the match format", () => {
    const noMatch = makeSnapshot({ match: null });
    expect(validateSnapshot(noMatch, "race")).toEqual([]);
    expect(validateSnapshot(noMatch, "match")).toContain("match format without match scores");
    const bad = makeSnapshot({ match: { ...makeSnapshot().match!, astro: 140 } });
    expect(validateSnapshot(bad, "match")).toContain("match score out of 0-100");
  });
});

describe("parse guards", () => {
  it("round-trips a snapshot through JSON", () => {
    expect(parsePromoSnapshot(JSON.parse(JSON.stringify(makeSnapshot())))).toEqual(makeSnapshot());
  });

  it("throws on a non-snapshot", () => {
    expect(() => parsePromoSnapshot({ asOf: "2026-10-19" })).toThrow(/snapshot/);
    expect(() => parsePromoSnapshot(null)).toThrow(/snapshot/);
  });

  it("parses full props and rejects an unknown format", () => {
    const variant = pickPromoVariant("2026-10-19", "ko");
    expect(parsePromoProps({ lang: "ko", variant, snapshot: makeSnapshot() }).variant.format).toBe(variant.format);
    expect(() => parsePromoProps({ lang: "ko", variant: { ...variant, format: "vlog" }, snapshot: makeSnapshot() })).toThrow(/props/);
  });
});

describe("timelineExtremes", () => {
  it("returns the index of the highest and lowest action month", () => {
    const timeline = [44, 76, 30, 94, 51].map((action, i) => ({ label: `m${i}`, action, best: "EQUAL" as const }));
    expect(timelineExtremes(timeline)).toEqual({ strongest: 3, weakest: 2 });
  });

  it("keeps the first month on ties", () => {
    const timeline = [60, 60, 40, 40].map((action, i) => ({ label: `m${i}`, action, best: "EQUAL" as const }));
    expect(timelineExtremes(timeline)).toEqual({ strongest: 0, weakest: 2 });
  });
});
