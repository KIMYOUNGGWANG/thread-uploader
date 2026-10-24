// Single source of 2027 (丁未 year) saju values. The LLM never decides ranks, months or ganji.
//
// Verified 2026-10-24 against the cosmicpath engine (read-only; no files created there):
// the cosmicpath checkout has no tsx/vitest runner, so a scratch script reused the engine's own
// algorithm (saju-daeun.ts findSolarTermInstant/bisectSolarTerm over astronomy-engine
// SunPosition().elon, minute resolution, KST = UT+9) for the 절입 instants, and the
// getMonthlyPillar (calendar-context.ts, used by timing-heatmap.ts buildMonth) formula for
// the month pillars. Month N = pillar in effect on the 15th, so month 1 is still 辛丑 of the
// 丙午 year, starting at 소한.

export type NewYearTag = "express" | "peers" | "learn" | "role" | "money";

// Ten gods relative to the 2027 year stem 丁 (fire, yin).
export const DAY_MASTER_2027: Record<string, { tenGod: string; tag: NewYearTag }> = {
  갑목: { tenGod: "상관", tag: "express" },
  을목: { tenGod: "식신", tag: "express" },
  병화: { tenGod: "겁재", tag: "peers" },
  정화: { tenGod: "비견", tag: "peers" },
  무토: { tenGod: "정인", tag: "learn" },
  기토: { tenGod: "편인", tag: "learn" },
  경금: { tenGod: "정관", tag: "role" },
  신금: { tenGod: "편관", tag: "role" },
  임수: { tenGod: "정재", tag: "money" },
  계수: { tenGod: "편재", tag: "money" },
};

export const NEW_YEAR_TAGS: Record<NewYearTag, { ko: string; en: string; videoSubject: string; videoMeaning: string }> = {
  express: {
    ko: "하고 싶은 말·재주를 밖으로 꺼내기 쉬운 해",
    en: "A year when it is likely easier to put your words and talents out in the open.",
    videoSubject: "2027년 할 말이 많아지는 사람",
    videoMeaning: "생각과 재주를 밖으로 꺼내기 쉬운 해예요.",
  },
  peers: {
    ko: "나와 닮은 사람·경쟁자가 늘기 쉬운 해",
    en: "A year when people like you, and rivals, are likely to show up more.",
    videoSubject: "2027년 닮은 사람이 늘어나는 사람",
    videoMeaning: "나와 닮은 사람과 경쟁자가 늘어나기 쉬운 해예요.",
  },
  learn: {
    ko: "배우고 채우며 기반을 다지기 쉬운 해",
    en: "A year that likely suits learning, refilling and building a base.",
    videoSubject: "2027년 배울 게 많아지는 사람",
    videoMeaning: "배우고 채우며 기반을 다지기 쉬운 해예요.",
  },
  role: {
    ko: "책임과 자리가 생기기 쉬운 해",
    en: "A year when responsibility and a clearer role are likely to come your way.",
    videoSubject: "2027년 맡는 일이 늘어나는 사람",
    videoMeaning: "책임과 자리가 생기기 쉬운 해예요.",
  },
  money: {
    ko: "돈이 들고 나는 흐름이 바빠지기 쉬운 해",
    en: "A year when money coming in and going out is likely to get busier.",
    videoSubject: "2027년 돈 흐름이 바빠지는 사람",
    videoMeaning: "돈이 들어오고 나가는 흐름이 바빠지기 쉬운 해예요.",
  },
};

// startsOn = KST date of the 절입 that begins the pillar (month 1: 소한, month 2: 입춘, ...).
export const MONTHS_2027: ReadonlyArray<{ month: number; pillar: string; pillarHanja: string; startsOn: string }> = [
  { month: 1, pillar: "신축", pillarHanja: "辛丑", startsOn: "2027-01-05" },
  { month: 2, pillar: "임인", pillarHanja: "壬寅", startsOn: "2027-02-04" },
  { month: 3, pillar: "계묘", pillarHanja: "癸卯", startsOn: "2027-03-06" },
  { month: 4, pillar: "갑진", pillarHanja: "甲辰", startsOn: "2027-04-05" },
  { month: 5, pillar: "을사", pillarHanja: "乙巳", startsOn: "2027-05-06" },
  { month: 6, pillar: "병오", pillarHanja: "丙午", startsOn: "2027-06-06" },
  { month: 7, pillar: "정미", pillarHanja: "丁未", startsOn: "2027-07-07" },
  { month: 8, pillar: "무신", pillarHanja: "戊申", startsOn: "2027-08-08" },
  { month: 9, pillar: "기유", pillarHanja: "己酉", startsOn: "2027-09-08" },
  { month: 10, pillar: "경술", pillarHanja: "庚戌", startsOn: "2027-10-08" },
  { month: 11, pillar: "신해", pillarHanja: "辛亥", startsOn: "2027-11-08" },
  { month: 12, pillar: "임자", pillarHanja: "壬子", startsOn: "2027-12-07" },
];

export const IPCHUN_2027: { date: string; timeKst: string } = { date: "2027-02-04", timeKst: "10:46" };
