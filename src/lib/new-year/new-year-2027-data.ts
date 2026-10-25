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

// A ranking line naming a day master must use its own theme's words, not another theme's.
export const NEW_YEAR_TAG_KEYWORDS: Record<NewYearTag, RegExp> = {
  express: /말|재주|꺼내/,
  peers: /닮은|경쟁/,
  learn: /배우|채우|기반/,
  role: /책임|자리|맡/,
  money: /돈/,
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

// The only "N월 D일" dates a New Year post may state, as "month-day": Jan 1 and each month's 절입 day.
export const NEW_YEAR_ALLOWED_DATES: ReadonlySet<string> = new Set([
  "1-1",
  ...MONTHS_2027.map((m) => `${Number(m.startsOn.slice(5, 7))}-${Number(m.startsOn.slice(8, 10))}`),
]);

// 띠 (ny_zodiac). tag = 丁(음화) 기준 지지 대표 오행의 십신, 지장간 무시한 단순화.
export interface Zodiac2027 {
  ko: string;
  aliases: readonly string[];
  branch: string;
  en: string;
  tag: NewYearTag;
  birthYears: readonly number[];
}

const BIRTH_YEAR_FROM = 1968;
const BIRTH_YEAR_TO = 2007;

function birthYearsOf(index: number): number[] {
  const years: number[] = [];
  for (let y = BIRTH_YEAR_FROM; y <= BIRTH_YEAR_TO; y++) if ((y - 4) % 12 === index) years.push(y);
  return years;
}

// Index = 지지 번호 (子丑寅卯辰巳午未申酉戌亥).
const ZODIAC_BASE: ReadonlyArray<Omit<Zodiac2027, "birthYears">> = [
  { ko: "쥐", aliases: [], branch: "子", en: "Rat", tag: "money" },
  { ko: "소", aliases: [], branch: "丑", en: "Ox", tag: "learn" },
  { ko: "호랑이", aliases: ["범"], branch: "寅", en: "Tiger", tag: "express" },
  { ko: "토끼", aliases: [], branch: "卯", en: "Rabbit", tag: "express" },
  { ko: "용", aliases: [], branch: "辰", en: "Dragon", tag: "learn" },
  { ko: "뱀", aliases: [], branch: "巳", en: "Snake", tag: "peers" },
  { ko: "말", aliases: [], branch: "午", en: "Horse", tag: "peers" },
  { ko: "양", aliases: [], branch: "未", en: "Goat", tag: "learn" },
  { ko: "원숭이", aliases: [], branch: "申", en: "Monkey", tag: "role" },
  { ko: "닭", aliases: [], branch: "酉", en: "Rooster", tag: "role" },
  { ko: "개", aliases: [], branch: "戌", en: "Dog", tag: "learn" },
  { ko: "돼지", aliases: [], branch: "亥", en: "Pig", tag: "money" },
];

export const ZODIAC_2027: readonly Zodiac2027[] = ZODIAC_BASE.map((z, i) => ({ ...z, birthYears: birthYearsOf(i) }));

export type ZodiacTopicId = NewYearTag | "harmony" | "clash" | "own_year";
export interface ZodiacTopic {
  id: ZodiacTopicId;
  ko: string;
  en: string;
  animals: readonly string[];
}

export const YEAR_ANIMAL_2027 = "양";

function tagTopic(tag: NewYearTag): ZodiacTopic {
  const { ko, en } = NEW_YEAR_TAGS[tag];
  return { id: tag, ko, en, animals: ZODIAC_2027.filter((z) => z.tag === tag).map((z) => z.ko) };
}

export const ZODIAC_TOPICS: readonly ZodiacTopic[] = [
  tagTopic("money"),
  {
    id: "harmony",
    ko: "사람이 들어오기 쉬운 해",
    en: "A year when new people are likely to come your way.",
    animals: ["돼지", "토끼", "말"],
  },
  tagTopic("express"),
  {
    id: "clash",
    ko: "자리나 관계가 바뀌기 쉬운 해",
    en: "A year when your place or relationships are likely to shift.",
    animals: ["소", "개"],
  },
  tagTopic("peers"),
  {
    id: "own_year",
    ko: "자기 띠의 해를 맞는 해",
    en: "A year that is your own zodiac year.",
    animals: [YEAR_ANIMAL_2027],
  },
  tagTopic("role"),
  tagTopic("learn"),
];
