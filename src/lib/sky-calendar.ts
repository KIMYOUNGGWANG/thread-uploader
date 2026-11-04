// Korean solar-term calendar and moon phases for timely posts. The model never computes dates: posts that mention a
// month change, a full moon or the year turning take them from here.
//
// Source: computed with PyEphem (apparent geocentric solar longitude 15° steps; moon phases), times in KST.
// Checked against KASI: 2025 입춘 23:10 and 2025 입동 13:04 KST reproduced to the minute; 2025-11-05 full moon 22:19 KST.
// Month pillars follow the year stem from 입춘 (병오년 → 경인월 …; 정미년 → 임인월 …; 무신년 → 갑인월 …).
// Coverage ends at the last row: after it the helpers return null and timely modes stay off until the table is extended.

export interface SolarTerm {
  at: string; // ISO with +09:00, the moment the month pillar changes
  ko: string;
  en: string;
  monthPillarKo: string;
  monthPillarHanja: string;
  animalKo: string;
  animalEn: string;
  elementKo: string;
  elementEn: string;
}

export interface MoonPhase {
  at: string;
  kind: "new" | "full";
}

export const SOLAR_TERMS: readonly SolarTerm[] = [
  { at: "2026-10-08T15:29:00+09:00", ko: "한로", en: "Hallo", monthPillarKo: "무술", monthPillarHanja: "戊戌", animalKo: "개", animalEn: "Dog", elementKo: "토", elementEn: "Earth" },
  { at: "2026-11-07T18:51:00+09:00", ko: "입동", en: "Ipdong (Start of Winter)", monthPillarKo: "기해", monthPillarHanja: "己亥", animalKo: "돼지", animalEn: "Pig", elementKo: "수", elementEn: "Water" },
  { at: "2026-12-07T11:52:00+09:00", ko: "대설", en: "Daeseol", monthPillarKo: "경자", monthPillarHanja: "庚子", animalKo: "쥐", animalEn: "Rat", elementKo: "수", elementEn: "Water" },
  { at: "2027-01-05T23:09:00+09:00", ko: "소한", en: "Sohan", monthPillarKo: "신축", monthPillarHanja: "辛丑", animalKo: "소", animalEn: "Ox", elementKo: "토", elementEn: "Earth" },
  { at: "2027-02-04T10:46:00+09:00", ko: "입춘", en: "Ipchun (Start of Spring)", monthPillarKo: "임인", monthPillarHanja: "壬寅", animalKo: "호랑이", animalEn: "Tiger", elementKo: "목", elementEn: "Wood" },
  { at: "2027-03-06T04:39:00+09:00", ko: "경칩", en: "Gyeongchip", monthPillarKo: "계묘", monthPillarHanja: "癸卯", animalKo: "토끼", animalEn: "Rabbit", elementKo: "목", elementEn: "Wood" },
  { at: "2027-04-05T09:17:00+09:00", ko: "청명", en: "Cheongmyeong", monthPillarKo: "갑진", monthPillarHanja: "甲辰", animalKo: "용", animalEn: "Dragon", elementKo: "토", elementEn: "Earth" },
  { at: "2027-05-06T02:25:00+09:00", ko: "입하", en: "Ipha (Start of Summer)", monthPillarKo: "을사", monthPillarHanja: "乙巳", animalKo: "뱀", animalEn: "Snake", elementKo: "화", elementEn: "Fire" },
  { at: "2027-06-06T06:25:00+09:00", ko: "망종", en: "Mangjong", monthPillarKo: "병오", monthPillarHanja: "丙午", animalKo: "말", animalEn: "Horse", elementKo: "화", elementEn: "Fire" },
  { at: "2027-07-07T16:37:00+09:00", ko: "소서", en: "Soseo", monthPillarKo: "정미", monthPillarHanja: "丁未", animalKo: "양", animalEn: "Goat", elementKo: "토", elementEn: "Earth" },
  { at: "2027-08-08T02:26:00+09:00", ko: "입추", en: "Ipchu (Start of Autumn)", monthPillarKo: "무신", monthPillarHanja: "戊申", animalKo: "원숭이", animalEn: "Monkey", elementKo: "금", elementEn: "Metal" },
  { at: "2027-09-08T05:28:00+09:00", ko: "백로", en: "Baengno", monthPillarKo: "기유", monthPillarHanja: "己酉", animalKo: "닭", animalEn: "Rooster", elementKo: "금", elementEn: "Metal" },
  { at: "2027-10-08T21:16:00+09:00", ko: "한로", en: "Hallo", monthPillarKo: "경술", monthPillarHanja: "庚戌", animalKo: "개", animalEn: "Dog", elementKo: "토", elementEn: "Earth" },
  { at: "2027-11-08T00:38:00+09:00", ko: "입동", en: "Ipdong (Start of Winter)", monthPillarKo: "신해", monthPillarHanja: "辛亥", animalKo: "돼지", animalEn: "Pig", elementKo: "수", elementEn: "Water" },
  { at: "2027-12-07T17:37:00+09:00", ko: "대설", en: "Daeseol", monthPillarKo: "임자", monthPillarHanja: "壬子", animalKo: "쥐", animalEn: "Rat", elementKo: "수", elementEn: "Water" },
  { at: "2028-01-06T04:54:00+09:00", ko: "소한", en: "Sohan", monthPillarKo: "계축", monthPillarHanja: "癸丑", animalKo: "소", animalEn: "Ox", elementKo: "토", elementEn: "Earth" },
  { at: "2028-02-04T16:30:00+09:00", ko: "입춘", en: "Ipchun (Start of Spring)", monthPillarKo: "갑인", monthPillarHanja: "甲寅", animalKo: "호랑이", animalEn: "Tiger", elementKo: "목", elementEn: "Wood" },
  { at: "2028-03-05T10:24:00+09:00", ko: "경칩", en: "Gyeongchip", monthPillarKo: "을묘", monthPillarHanja: "乙卯", animalKo: "토끼", animalEn: "Rabbit", elementKo: "목", elementEn: "Wood" },
];

export const MOON_PHASES: readonly MoonPhase[] = [
  { at: "2026-10-26T13:11:00+09:00", kind: "full" },
  { at: "2026-11-09T16:02:00+09:00", kind: "new" },
  { at: "2026-11-24T23:53:00+09:00", kind: "full" },
  { at: "2026-12-09T09:51:00+09:00", kind: "new" },
  { at: "2026-12-24T10:28:00+09:00", kind: "full" },
  { at: "2027-01-08T05:24:00+09:00", kind: "new" },
  { at: "2027-01-22T21:17:00+09:00", kind: "full" },
  { at: "2027-02-07T00:56:00+09:00", kind: "new" },
  { at: "2027-02-21T08:23:00+09:00", kind: "full" },
  { at: "2027-03-08T18:29:00+09:00", kind: "new" },
  { at: "2027-03-22T19:43:00+09:00", kind: "full" },
  { at: "2027-04-07T08:51:00+09:00", kind: "new" },
  { at: "2027-04-21T07:27:00+09:00", kind: "full" },
  { at: "2027-05-06T19:58:00+09:00", kind: "new" },
  { at: "2027-05-20T19:58:00+09:00", kind: "full" },
  { at: "2027-06-05T04:40:00+09:00", kind: "new" },
  { at: "2027-06-19T09:44:00+09:00", kind: "full" },
  { at: "2027-07-04T12:01:00+09:00", kind: "new" },
  { at: "2027-07-19T00:44:00+09:00", kind: "full" },
  { at: "2027-08-02T19:05:00+09:00", kind: "new" },
  { at: "2027-08-17T16:28:00+09:00", kind: "full" },
  { at: "2027-09-01T02:41:00+09:00", kind: "new" },
  { at: "2027-09-16T08:03:00+09:00", kind: "full" },
  { at: "2027-09-30T11:35:00+09:00", kind: "new" },
  { at: "2027-10-15T22:46:00+09:00", kind: "full" },
  { at: "2027-10-29T22:36:00+09:00", kind: "new" },
  { at: "2027-11-14T12:25:00+09:00", kind: "full" },
  { at: "2027-11-28T12:24:00+09:00", kind: "new" },
  { at: "2027-12-14T01:08:00+09:00", kind: "full" },
  { at: "2027-12-28T05:12:00+09:00", kind: "new" },
  { at: "2028-01-12T13:02:00+09:00", kind: "full" },
  { at: "2028-01-27T00:12:00+09:00", kind: "new" },
  { at: "2028-02-11T00:03:00+09:00", kind: "full" },
  { at: "2028-02-25T19:37:00+09:00", kind: "new" },
  { at: "2028-03-11T10:05:00+09:00", kind: "full" },
];

export interface YearPillar {
  from: string;
  ko: string;
  hanja: string;
  nameKo: string;
  nameEn: string;
}

// The saju year turns at 입춘, not on January 1 or Lunar New Year.
export const YEAR_PILLARS: readonly YearPillar[] = [
  { from: "2026-02-04T05:01:00+09:00", ko: "병오", hanja: "丙午", nameKo: "붉은 말의 해", nameEn: "Fire Horse" },
  { from: "2027-02-04T10:46:00+09:00", ko: "정미", hanja: "丁未", nameKo: "붉은 양의 해", nameEn: "Fire Goat" },
  { from: "2028-02-04T16:30:00+09:00", ko: "무신", hanja: "戊申", nameKo: "노란 원숭이의 해", nameEn: "Earth Monkey" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function kstParts(iso: string | Date): { y: number; m: number; d: number; wd: number; hm: string; dayIndex: number } {
  const shifted = new Date((typeof iso === "string" ? Date.parse(iso) : iso.getTime()) + KST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    wd: shifted.getUTCDay(),
    hm: `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`,
    dayIndex: Math.floor(shifted.getTime() / DAY_MS),
  };
}

// KST calendar days from now until the event (0 = today in Korea).
export function kstDaysUntil(iso: string, now: Date): number {
  return kstParts(iso).dayIndex - kstParts(now).dayIndex;
}

const lastAtOrBefore = <T extends { at?: string; from?: string }>(rows: readonly T[], now: Date): T | null =>
  [...rows].reverse().find((row) => Date.parse((row.at ?? row.from) as string) <= now.getTime()) ?? null;
const nextAfter = <T extends { at?: string; from?: string }>(rows: readonly T[], now: Date): T[] =>
  rows.filter((row) => Date.parse((row.at ?? row.from) as string) > now.getTime());

export interface SkySnapshot {
  year: YearPillar;
  month: SolarTerm;
  upcomingTerms: SolarTerm[];
  nextYear: YearPillar | null;
  upcomingMoons: MoonPhase[];
}

// null outside the table: timely prompts must not run without real dates.
export function skySnapshot(now: Date, horizonDays = 45): SkySnapshot | null {
  const year = lastAtOrBefore(YEAR_PILLARS, now);
  const month = lastAtOrBefore(SOLAR_TERMS, now);
  const upcomingTerms = nextAfter(SOLAR_TERMS, now).slice(0, 2);
  if (!year || !month || upcomingTerms.length === 0) return null;
  return {
    year,
    month,
    upcomingTerms,
    nextYear: nextAfter(YEAR_PILLARS, now)[0] ?? null,
    upcomingMoons: nextAfter(MOON_PHASES, now).filter((moon) => kstDaysUntil(moon.at, now) <= horizonDays).slice(0, 3),
  };
}

function inDaysKo(days: number): string {
  return days === 0 ? "오늘" : days === 1 ? "내일" : `${days}일 뒤`;
}
function inDaysEn(days: number): string {
  return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

export function skyBriefKo(now: Date): string | null {
  const sky = skySnapshot(now);
  if (!sky) return null;
  const date = (iso: string) => {
    const p = kstParts(iso);
    return `${p.m}월 ${p.d}일(${WEEKDAY_KO[p.wd]}) ${p.hm}`;
  };
  const since = kstParts(sky.month.at);
  const lines = [
    "[달력 데이터 — 날짜·간지·띠는 여기 적힌 것만 쓴다. 다른 날짜나 행성 이벤트를 지어내지 않는다]",
    `- 지금: ${sky.year.ko}년(${sky.year.hanja}, ${sky.year.nameKo}) ${sky.month.monthPillarKo}월(${sky.month.monthPillarHanja}, ${sky.month.animalKo}의 달, ${sky.month.elementKo} 기운) — ${since.m}월 ${since.d}일 ${sky.month.ko}부터`,
    ...sky.upcomingTerms.map((term) =>
      `- ${date(term.at)} ${term.ko} → ${term.monthPillarKo}월(${term.monthPillarHanja}, ${term.animalKo}의 달, ${term.elementKo} 기운) 시작 · ${inDaysKo(kstDaysUntil(term.at, now))}`),
    ...(sky.nextYear
      ? [`- 해 바뀜: ${kstParts(sky.nextYear.from).y}년 ${date(sky.nextYear.from)} 입춘 → ${sky.nextYear.ko}년(${sky.nextYear.hanja}, ${sky.nextYear.nameKo}) · ${inDaysKo(kstDaysUntil(sky.nextYear.from, now))}. 사주의 해는 1월 1일이나 설날이 아니라 입춘에 바뀐다.`]
      : []),
    ...sky.upcomingMoons.map((moon) => `- ${date(moon.at)} ${moon.kind === "full" ? "보름달" : "그믐(새 달)"} · ${inDaysKo(kstDaysUntil(moon.at, now))}`),
  ];
  return lines.join("\n");
}

export function skyBriefEn(now: Date): string | null {
  const sky = skySnapshot(now);
  if (!sky) return null;
  const date = (iso: string) => {
    const p = kstParts(iso);
    return `${WEEKDAY_EN[p.wd]} ${MONTH_EN[p.m - 1]} ${p.d}`;
  };
  const since = kstParts(sky.month.at);
  const lines = [
    "[Sky data: use only these dates and names. Never invent other dates, retrogrades or planetary events. Dates are Korea time; in the US the moment can fall on the evening before.]",
    `- Now: ${sky.year.nameEn} year (${sky.year.ko}, ${sky.year.hanja}), ${sky.month.animalEn} month (${sky.month.elementEn} energy) since ${MONTH_EN[since.m - 1]} ${since.d}`,
    ...sky.upcomingTerms.map((term) =>
      `- ${date(term.at)}: ${term.en} → the ${term.animalEn} month begins (${term.elementEn} energy), ${inDaysEn(kstDaysUntil(term.at, now))}`),
    ...(sky.nextYear
      ? [`- Year turn: ${date(sky.nextYear.from)}, ${kstParts(sky.nextYear.from).y}, Ipchun → ${sky.nextYear.nameEn} year, ${inDaysEn(kstDaysUntil(sky.nextYear.from, now))}. In Korean saju the year turns at Ipchun, not on January 1 or Lunar New Year.`]
      : []),
    ...sky.upcomingMoons.map((moon) => `- ${date(moon.at)}: ${moon.kind === "full" ? "full moon" : "new moon"}, ${inDaysEn(kstDaysUntil(moon.at, now))}`),
  ];
  return lines.join("\n");
}

// "11월 7일" style dates in a Korean post that match no row of the table (term change, moon, year turn).
// Only month-day pairs are checked; a bare "11월" or "연말" is a period, not a claim about a day.
export function findDatesOutsideCalendar(post: string, now: Date): string[] {
  const known = new Set(
    [...SOLAR_TERMS.map((term) => term.at), ...MOON_PHASES.map((moon) => moon.at), ...YEAR_PILLARS.map((year) => year.from)]
      .map((iso) => {
        const p = kstParts(iso);
        return `${p.m}-${p.d}`;
      }),
  );
  const today = kstParts(now);
  known.add(`${today.m}-${today.d}`);
  const outside: string[] = [];
  for (const match of post.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
    if (!known.has(`${Number(match[1])}-${Number(match[2])}`)) outside.push(match[0]);
  }
  return [...new Set(outside)];
}
