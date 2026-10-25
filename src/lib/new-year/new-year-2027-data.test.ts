import { describe, expect, it } from "vitest";
import { DAY_MASTER_2027, IPCHUN_2027, MONTHS_2027, NEW_YEAR_TAGS, ZODIAC_2027, ZODIAC_TOPICS } from "./new-year-2027-data";

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

describe("2027 띠 데이터", () => {
  it("12띠 태그와 별칭", () => {
    expect(ZODIAC_2027.map((z) => z.ko)).toEqual(["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]);
    expect(ZODIAC_2027.map((z) => z.tag)).toEqual(["money", "learn", "express", "express", "learn", "peers", "peers", "learn", "role", "role", "learn", "money"]);
    expect(ZODIAC_2027[2].aliases).toEqual(["범"]);
    expect(ZODIAC_2027.map((z) => z.en)).toEqual(["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"]);
  });

  it("출생년도는 1968~2007이고 지지 규칙과 맞다", () => {
    expect(ZODIAC_2027[0].birthYears).toEqual([1972, 1984, 1996]);
    expect(ZODIAC_2027[8].birthYears).toEqual([1968, 1980, 1992, 2004]);
    expect(ZODIAC_2027[11].birthYears).toEqual([1971, 1983, 1995, 2007]);
    ZODIAC_2027.forEach((z, i) => z.birthYears.forEach((y) => {
      expect(y >= 1968 && y <= 2007).toBe(true);
      expect((y - 4) % 12).toBe(i);
    }));
    expect(ZODIAC_2027.flatMap((z) => z.birthYears)).toHaveLength(40);
  });

  it("주제 8개와 띠", () => {
    expect(ZODIAC_TOPICS.map((t) => t.id)).toEqual(["money", "harmony", "express", "clash", "peers", "own_year", "role", "learn"]);
    const animals = Object.fromEntries(ZODIAC_TOPICS.map((t) => [t.id, t.animals]));
    expect(animals.harmony).toEqual(["돼지", "토끼", "말"]);
    expect(animals.clash).toEqual(["소", "개"]);
    expect(animals.own_year).toEqual(["양"]);
    expect(animals.learn).toEqual(["소", "용", "양", "개"]);
    expect(new Set(ZODIAC_TOPICS.flatMap((t) => t.animals))).toEqual(new Set(ZODIAC_2027.map((z) => z.ko)));
    expect(ZODIAC_TOPICS.every((t) => t.ko && t.en)).toBe(true);
  });
});
