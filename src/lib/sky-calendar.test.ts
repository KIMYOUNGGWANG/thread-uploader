import { describe, expect, it } from "vitest";
import { MOON_PHASES, SOLAR_TERMS, skyBriefEn, skyBriefKo, skySnapshot } from "@/lib/sky-calendar";

const NOW = new Date("2026-11-04T08:00:00Z"); // 2026-11-04 17:00 KST

describe("sky-calendar", () => {
  it("keeps terms and moons in time order, about a month apart", () => {
    const times = SOLAR_TERMS.map((term) => Date.parse(term.at));
    times.slice(1).forEach((t, i) => {
      const gapDays = (t - times[i]) / 86_400_000;
      expect(gapDays).toBeGreaterThan(28);
      expect(gapDays).toBeLessThan(33);
    });
    const moons = MOON_PHASES.map((moon) => Date.parse(moon.at));
    moons.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(moons[i]));
  });

  it("cycles the 60-pillar months: stems step by one, branches follow the solar term", () => {
    const STEMS = "갑을병정무기경신임계";
    SOLAR_TERMS.slice(1).forEach((term, i) => {
      const prev = STEMS.indexOf(SOLAR_TERMS[i].monthPillarKo[0]);
      expect(STEMS.indexOf(term.monthPillarKo[0])).toBe((prev + 1) % 10);
    });
    expect(SOLAR_TERMS.find((term) => term.at.startsWith("2026-12-07"))?.monthPillarKo).toBe("경자");
    expect(SOLAR_TERMS.find((term) => term.at.startsWith("2027-02-04"))?.monthPillarKo).toBe("임인");
  });

  it("describes the current month and the next turns on 2026-11-04", () => {
    const sky = skySnapshot(NOW);
    expect(sky?.year.ko).toBe("병오");
    expect(sky?.month.monthPillarKo).toBe("무술");
    expect(sky?.upcomingTerms[0].ko).toBe("입동");
    expect(sky?.nextYear?.ko).toBe("정미");
    const ko = skyBriefKo(NOW) ?? "";
    expect(ko).toContain("11월 7일(토) 18:51 입동 → 기해월");
    expect(ko).toContain("3일 뒤");
    expect(ko).toContain("11월 24일(화) 23:53 보름달");
    const en = skyBriefEn(NOW) ?? "";
    expect(en).toContain("Sat Nov 7: Ipdong (Start of Winter) → the Pig month begins (Water energy), in 3 days");
    expect(en).toContain("Fire Goat year");
  });

  it("returns null past the table so timely prompts never run without real dates", () => {
    expect(skySnapshot(new Date("2028-06-01T00:00:00Z"))).toBeNull();
    expect(skyBriefKo(new Date("2028-06-01T00:00:00Z"))).toBeNull();
  });
});

describe("findDatesOutsideCalendar", () => {
  it("accepts table dates and today, rejects made-up days", async () => {
    const { findDatesOutsideCalendar } = await import("@/lib/sky-calendar");
    expect(findDatesOutsideCalendar("11월 7일 입동부터 흐름 바뀌는 띠\n12월 7일 대설까지", NOW)).toEqual([]);
    expect(findDatesOutsideCalendar("11월 24일 보름 전에", NOW)).toEqual([]);
    expect(findDatesOutsideCalendar("오늘 11월 4일", NOW)).toEqual([]);
    expect(findDatesOutsideCalendar("11월 15일 귀인 날", NOW)).toEqual(["11월 15일"]);
    expect(findDatesOutsideCalendar("11월에 풀리는 띠", NOW)).toEqual([]);
  });
});
