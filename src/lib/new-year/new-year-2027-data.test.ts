import { describe, expect, it } from "vitest";
import { DAY_MASTER_2027, IPCHUN_2027, MONTHS_2027, NEW_YEAR_TAGS } from "./new-year-2027-data";

describe("2027 정미년 사주 데이터", () => {
  it("일간별 십신(연간 丁 기준)과 태그", () => {
    expect(Object.fromEntries(Object.entries(DAY_MASTER_2027).map(([k, v]) => [k, v.tenGod]))).toEqual({
      갑목: "상관", 을목: "식신", 병화: "겁재", 정화: "비견", 무토: "정인",
      기토: "편인", 경금: "정관", 신금: "편관", 임수: "정재", 계수: "편재",
    });
    expect(DAY_MASTER_2027.갑목.tag).toBe("express");
    expect(DAY_MASTER_2027.정화.tag).toBe("peers");
    expect(DAY_MASTER_2027.무토.tag).toBe("learn");
    expect(DAY_MASTER_2027.신금.tag).toBe("role");
    expect(DAY_MASTER_2027.계수.tag).toBe("money");
  });

  it("모든 태그에 문구가 있다", () => {
    for (const { tag } of Object.values(DAY_MASTER_2027)) {
      const t = NEW_YEAR_TAGS[tag];
      expect(t.ko && t.en && t.videoSubject && t.videoMeaning).toBeTruthy();
    }
  });

  it("월주 12개와 입춘", () => {
    expect(MONTHS_2027.map((m) => m.pillar)).toEqual(["신축", "임인", "계묘", "갑진", "을사", "병오", "정미", "무신", "기유", "경술", "신해", "임자"]);
    expect(MONTHS_2027.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(MONTHS_2027.every((m) => m.pillarHanja.length === 2)).toBe(true);
    expect(MONTHS_2027.every((m) => m.startsOn.startsWith(`2027-${String(m.month).padStart(2, "0")}-`))).toBe(true);
    expect(MONTHS_2027[1].startsOn).toBe(IPCHUN_2027.date);
    expect(IPCHUN_2027.date).toBe("2027-02-04");
    expect(IPCHUN_2027.timeKst).toBe("10:46");
  });
});
