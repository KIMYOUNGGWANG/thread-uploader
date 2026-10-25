import { ZODIAC_ANIMAL_PATTERNS } from "@/lib/domain-registry";
import { buildTrackedUrl } from "@/lib/tracking-url";
import {
  DAY_MASTER_2027, IPCHUN_2027, MONTHS_2027, NEW_YEAR_ALLOWED_DATES, NEW_YEAR_TAG_KEYWORDS, NEW_YEAR_TAGS, type NewYearTag,
  YEAR_ANIMAL_2027, ZODIAC_2027, ZODIAC_TOPICS, type ZodiacTopic,
} from "./new-year-2027-data";
import type { NewYearLang, NewYearModeId } from "./new-year-season";

const TAG_ORDER: readonly NewYearTag[] = ["express", "peers", "learn", "role", "money"];
const DAY_MASTERS = Object.keys(DAY_MASTER_2027);

// English readers do not know the hangul stem names, so each gets an element gloss.
const DAY_MASTER_EN: Record<string, string> = {
  갑목: "Yang Wood", 을목: "Yin Wood", 병화: "Yang Fire", 정화: "Yin Fire", 무토: "Yang Earth",
  기토: "Yin Earth", 경금: "Yang Metal", 신금: "Yin Metal", 임수: "Yang Water", 계수: "Yin Water",
};

// People / work / money axes of ny_pick, each mapped to one of the five themes.
const PICK_AXES: ReadonlyArray<{ ko: string; en: string; tag: NewYearTag }> = [
  { ko: "사람", en: "People", tag: "peers" },
  { ko: "일", en: "Work", tag: "role" },
  { ko: "돈", en: "Money", tag: "money" },
];

// The home page records the visit's pid/ref before the reader moves on to the 2027 banner, so attribution survives.
const LINK_BASE: Record<NewYearLang, string> = {
  ko: "https://www.cosmicpath.app/",
  en: "https://www.cosmicpath.app/?lang=en",
};

const dayMastersOf = (tag: NewYearTag) => DAY_MASTERS.filter((dm) => DAY_MASTER_2027[dm].tag === tag);

function rotate<T>(items: readonly T[], by: number): T[] {
  const n = ((by % items.length) + items.length) % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

function rankingBrief(lang: NewYearLang, slotIndex: number): string[] {
  // slotIndex only rotates group order so consecutive posts do not read the same.
  return rotate(TAG_ORDER, slotIndex).map((tag) => {
    const names = dayMastersOf(tag);
    return lang === "ko"
      ? `- ${names.join("·")}: ${NEW_YEAR_TAGS[tag].ko}`
      : `- ${names.map((n) => `${n} (${DAY_MASTER_EN[n]})`).join(" · ")}: ${NEW_YEAR_TAGS[tag].en}`;
  });
}

function ipchunBrief(lang: NewYearLang): string[] {
  const { date, timeKst } = IPCHUN_2027;
  return lang === "ko"
    ? [
        `- 2027년 입춘: ${date} ${timeKst} (KST)`,
        "- 사주의 해는 1월 1일이 아니라 입춘부터 바뀐다. 1월 1일~입춘 전까지는 아직 2026년(병오년) 사주의 해다.",
        "- 입춘 전에 태어난 사람은 사주에서 전년생으로 본다.",
      ]
    : [
        `- Lichun (start of spring) 2027: ${date} ${timeKst} KST (Feb 4)`,
        "- The saju year turns at Lichun, not on January 1. From January 1 until Lichun it is still the 2026 (Fire Horse) saju year.",
        "- People born before Lichun count as the previous year's birth in saju.",
      ];
}

function monthlyBrief(lang: NewYearLang): string[] {
  return MONTHS_2027.map((m) =>
    lang === "ko"
      ? `- ${m.month}월 ${m.pillar}(${m.pillarHanja}) — ${m.startsOn}부터`
      : `- Month ${m.month}: ${m.pillar} (${m.pillarHanja}) — from ${m.startsOn}`,
  );
}

function pickBrief(lang: NewYearLang, slotIndex: number): string[] {
  // EN gets no day masters: they are hangul, and EN posts have no day-master value check.
  return rotate(PICK_AXES, slotIndex).map((axis) =>
    lang === "ko"
      ? `- ${axis.ko}: ${NEW_YEAR_TAGS[axis.tag].ko} (참고 일간: ${dayMastersOf(axis.tag).join("·")})`
      : `- ${axis.en}: ${NEW_YEAR_TAGS[axis.tag].en}`,
  );
}

// The brief is the only source of saju values the model may use; checkNewYearFacts verifies the output against it.
export function buildNewYearBrief(modeId: NewYearModeId, lang: NewYearLang, slotIndex: number): string {
  const header = lang === "ko" ? "[2027 신년 자료] 아래 값만 쓰고 다른 간지·날짜·순위를 만들지 않는다." : "[2027 New Year brief] Use only these values; never invent ganji, dates or ranks.";
  const body = {
    ny_ranking: () => rankingBrief(lang, slotIndex),
    ny_ipchun: () => ipchunBrief(lang),
    ny_monthly: () => monthlyBrief(lang),
    ny_pick: () => pickBrief(lang, slotIndex),
    ny_zodiac: () => buildZodiacBrief(lang, slotIndex),
  }[modeId]();
  return [header, ...body].join("\n");
}

const GANJI = "[갑을병정무기경신임계][자축인묘진사오미신유술해]";
// "5월", "5·6월", "5~7월": a list, or an inclusive range with "~"/"-".
const MONTH_GROUP = /(?<!\d)(\d{1,2}(?:\s*[·,~\-–]\s*\d{1,2})*)월/g;
// Only the 12 month pillars, so ordinary words (갑자기, 정해진, 임신) never match; 년/해 marks a year ganji.
const MONTH_PILLAR_WORD = new RegExp(`(${MONTHS_2027.map((m) => m.pillar).join("|")})(?![년해])`, "g");
// A particle or separator may sit between the year and its ganji ("2027년은 병오년", "2027년, 병오년", "2027 병오의 해").
const YEAR_GANJI_2027 = new RegExp(
  `(?<!\\d)2027(?!\\d)\\s*년?\\s*(?:[은는도이가]|[,:=]|→)?\\s*[(（]?\\s*(${GANJI})(?:[년해]|의\\s*해)|(${GANJI})[년해]\\s*[(（]\\s*2027(?!\\d)`,
  "g",
);
const DATE = /(?<!\d)(\d{1,2})월\s*(\d{1,2})일/g;

const pillarOf = (month: number) => MONTHS_2027.find((m) => m.month === month)?.pillar;

function monthsOf(group: string): number[] {
  const nums = group.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 2 && /[~\-–]/.test(group)) return Array.from({ length: Math.max(0, nums[1] - nums[0] + 1) }, (_, i) => nums[0] + i);
  return nums;
}

function strayYearMentions(post: string): string[] {
  return [...post.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].filter(([, year]) => year !== "2026" && year !== "2027").map(([, year]) => `허용되지 않은 연도: ${year}`);
}

function ipchunDateProblems(post: string): string[] {
  return [...post.matchAll(IPCHUN_DATE)]
    .filter((m) => (m[3] ? m[3] !== "4" : m[1] !== "2" || m[2] !== "4"))
    .map((m) => `입춘 날짜가 틀림: ${m[0]} (정답 2월 4일)`);
}

// Returns problems found in the draft; an empty array means it passes. Every check runs on every post
// whatever its language: the Korean patterns are inert on English text.
export function checkNewYearFacts(post: string, modeId: NewYearModeId, slotIndex: number): string[] {
  const problems: string[] = [];

  // Zodiac posts list birth years (2007, 2002...), so checkZodiacFacts owns their year rules.
  problems.push(...(modeId === "ny_zodiac" ? checkZodiacFacts(post, slotIndex) : strayYearMentions(post)));

  for (const m of post.matchAll(YEAR_GANJI_2027)) {
    const ganji = m[1] ?? m[2];
    if (ganji !== "정미") problems.push(`2027년 연간지가 틀림: ${ganji} (정답 정미)`);
  }

  if (modeId === "ny_ipchun" && !/입춘|2월\s*4일|Feb(?:ruary)?\.?\s*4|Lichun|Ipchun/i.test(post)) {
    problems.push("입춘(또는 2월 4일) 언급이 없다");
  }

  // Runs for every mode; ny_ipchun/ny_monthly's own date check below skips dates already reported here.
  const ipchunProblems = ipchunDateProblems(post);
  problems.push(...ipchunProblems);

  if (modeId === "ny_ipchun" || modeId === "ny_monthly") {
    for (const [date, month, day] of post.matchAll(DATE)) {
      if (!NEW_YEAR_ALLOWED_DATES.has(`${Number(month)}-${Number(day)}`) && !ipchunProblems.some((p) => p.includes(date))) problems.push(`허용되지 않은 날짜: ${date}`);
    }
  }

  // The pillar must be attached to its month ("5월 을사는", "5월(을사)", "7월 정미월"). Looser matching
  // flags ordinary words (갑자기, 정해진, 임신) and year ganji (병오년, 병오해), and each false positive
  // silently drops a good draft, so an ambiguous mention is skipped rather than rejected.
  // Between month and pair: a particle, then a space, "(" or a ":" / "=" / "→" separator (the brief's own
  // "- 5월 을사(乙巳) — ..." shape). After the pair: 월, a particle, or ")", "(", ":", ".", "!", "?", "—"
  // (a space is fine only before "—"). Bare whitespace, "·", "~" and other hangul do not count.
  const MONTH_PILLAR = /(\d{1,2})월(?:은|에|엔|의|이|도)?(?:\s*[:=→]\s*|[ (])?([갑을병정무기경신임계][자축인묘진사오미신유술해])(?=월|[은는이가](?![가-힣])|[):(.!?,—]|\s+—|$)/gm;
  for (const m of post.matchAll(MONTH_PILLAR)) {
    const pillar = pillarOf(Number(m[1]));
    if (pillar && m[2] !== pillar) problems.push(`${m[1]}월 월주가 틀림: ${m[2]} (정답 ${pillar})`);
  }

  // A monthly post is one line per month in any layout ("5월 갑진 - ...", "5월은 갑진 흐름"), so there any
  // month pillar on a line must belong to the month group before it (or the line's first group).
  if (modeId === "ny_monthly") {
    for (const line of post.split("\n")) {
      const groups = [...line.matchAll(MONTH_GROUP)].map((g) => ({ at: g.index, months: monthsOf(g[1]).filter((n) => pillarOf(n)) }));
      if (groups.length === 0) continue;
      for (const p of line.matchAll(MONTH_PILLAR_WORD)) {
        const group = groups.filter((g) => g.at < p.index).at(-1) ?? groups[0];
        const allowed = group.months.map((n) => pillarOf(n));
        if (allowed.length > 0 && !allowed.includes(p[1])) {
          problems.push(`${group.months.join("·")}월 월주가 틀림: ${p[1]} (정답 ${allowed.join("·")})`);
        }
      }
    }
  }

  if (modeId === "ny_ranking") {
    for (const line of post.split("\n")) {
      const mentioned = DAY_MASTERS.filter((dm) => line.includes(dm));
      if (mentioned.length === 0) continue;
      const tag = DAY_MASTER_2027[mentioned[0]].tag;
      if (mentioned.some((dm) => DAY_MASTER_2027[dm].tag !== tag)) {
        const odd = mentioned.find((dm) => DAY_MASTER_2027[dm].tag !== tag) ?? mentioned[1];
        problems.push(`한 줄에 다른 결의 일간이 섞임: ${odd} (${line.trim()})`);
      } else if (!NEW_YEAR_TAG_KEYWORDS[tag].test(line) && TAG_ORDER.some((t) => t !== tag && NEW_YEAR_TAG_KEYWORDS[t].test(line))) {
        problems.push(`${mentioned.join("·")} 줄이 다른 결을 말함 (${line.trim()})`);
      }
    }
  }

  return [...new Set(problems)];
}

// Zodiac posts name one theme's animals; the topic rotates over the 8 ZODIAC_TOPICS by slotIndex.
// Within one window's steady cycle (KO early, KO peak, EN) consecutive zodiac posts get different topics: they
// fall in different 5-slot blocks (block step 1-3), and the floor(slotIndex / 80) drift (0 below slot 80) keeps
// EN's 8-slot spacing from cycling through only 5 topics. The tests cover exactly those windows.
// ponytail: at KO window switches (12/14 to 12/15, 1/31 to 2/1) and inside 2/1~2/6 (block gap 8) two consecutive
// zodiac posts can share a topic; if that shows up in practice, key topics on a season-wide zodiac ordinal.
export function zodiacTopicFor(slotIndex: number): ZodiacTopic {
  return ZODIAC_TOPICS[(Math.floor(slotIndex / 5) + Math.floor(slotIndex / 80)) % ZODIAC_TOPICS.length];
}

const topicZodiacs = (topic: ZodiacTopic) => ZODIAC_2027.filter((z) => topic.animals.includes(z.ko));
const twoDigit = (year: number) => String(year % 100).padStart(2, "0");

// Header-less lines; buildNewYearBrief adds the header.
export function buildZodiacBrief(lang: NewYearLang, slotIndex: number): string[] {
  const topic = zodiacTopicFor(slotIndex);
  const animals = topicZodiacs(topic);
  if (lang === "ko") {
    return [
      `- 주제: ${topic.ko}`,
      ...animals.map((z) => `- ${z.ko}띠 (${z.birthYears.map((y) => twoDigit(y)).sort((a, b) => Number(b) - Number(a)).join("·")}년생)`),
      `- 2027년은 ${YEAR_ANIMAL_2027}띠 해(정미년)`,
      "- 사주에선 입춘(2월 4일)부터 띠를 바꿔 본다. 1월~2월 초생은 앞 해 띠일 수 있다.",
    ];
  }
  return [
    `- Theme: ${topic.en}`,
    ...animals.map((z) => `- ${z.en} (born ${z.birthYears.join(", ")})`),
    "- 2027 is the Year of the Fire Goat",
    "- In saju the zodiac year turns at Ipchun (Feb 4), not Lunar New Year, so early-February birthdays may count as the year before.",
  ];
}

// Year-name phrases ("말띠 해", "Fire Horse year") are not an animal mention. A bare "Horse" still counts.
const KO_YEAR_NAME = /(말|양)[ \t]?띠\s*(의\s*)?해/g;
// No 1968-2007 Horse is a Fire Horse, so "Fire Horse" alone is always the 2026 year name.
const EN_YEAR_NAME = /\byear\s+of\s+the\s+(?:fire\s+)?(?:horse|goat)\b|\b(?:fire\s+)?(?:horse|goat)\s+year\b|\bfire\s+horse\b/gi;
// One space or tab may split "말 띠", but not a line break ("…소\n띠로"); "두 개 띠" is a count, not 개띠.
const KO_ANIMAL = /(쥐|소|호랑이|범|토끼|용|뱀|말|양|원숭이|닭|(?<!(?:한|두|세|네|몇|여러)[ \t]?)개|돼지)[ \t]?띠/g;
const GUIDE_NOTE = /입춘|2월\s*4일|Feb(?:ruary)?\.?\s*4|Lichun|Ipchun/i;
const RANK_WORD = /\d위|\bTOP\s*\d|(?<!우선)순위|#\s*1\b|\bNo\.?\s*1\b/i;
// 2-digit list: "95·83·71·07", "96, 84 그리고 07". Counted before "년생", or inside "(…)" right after a 띠.
const TWO_DIGIT_LIST = String.raw`(?<!\d)\d{2}(?!\d)(?:[ \t]*(?:[·,/]|그리고|및)?[ \t]*\d{2}(?!\d))*`;
const KO_BIRTH_YEARS = new RegExp(`(${TWO_DIGIT_LIST})[ \\t]*년생`, "g");
const KO_PAREN_YEARS = new RegExp(String.raw`띠[ \t]*[(（][ \t]*(${TWO_DIGIT_LIST})`, "g");
const FOUR_DIGIT_YEAR = /(?<!\d)(19\d{2}|20\d{2})(?!\d)/g;
// EN apostrophe years ('97, ’85), only on lines with no hangul so Korean quotes like '25년 are left alone.
const EN_SHORT_YEAR = /(?<!\w)['’](\d{2})\b/g;
const HANGUL = /[가-힣]/;
const NON_BIRTH_YEARS = new Set([2026, 2027]);
// IPCHUN_2027 is Feb 4: a KO "입춘(2월 3일)" or EN "Ipchun (Feb 3)" is wrong wherever it appears.
const IPCHUN_DATE = /입춘\s*(?:은|이|인)?\s*[(（]?\s*(\d{1,2})월\s*(\d{1,2})일|(?:Ipchun|Lichun)\s*\(?\s*(?:on\s+)?Feb(?:ruary)?\.?\s*(\d{1,2})/gi;

// Indexes into ZODIAC_2027 (子→亥), found by Korean "X띠" and by the English animal patterns.
function animalsIn(text: string): Set<number> {
  const clean = text.replace(KO_YEAR_NAME, "").replace(EN_YEAR_NAME, "");
  const found = new Set<number>();
  for (const [, word] of clean.matchAll(KO_ANIMAL)) found.add(ZODIAC_2027.findIndex((z) => z.ko === word || z.aliases.includes(word)));
  ZODIAC_ANIMAL_PATTERNS.forEach((pattern, i) => { if (pattern.test(clean)) found.add(i); });
  return found;
}

// 2-digit years (KO list, EN apostrophe): 68 and up are 19xx, below are 20xx. 2026/2027 are year mentions.
const fullYear = (twoDigit: number) => (twoDigit >= 68 ? 1900 : 2000) + twoDigit;

function birthYearsIn(line: string): number[] {
  const ko = [...line.matchAll(KO_BIRTH_YEARS), ...line.matchAll(KO_PAREN_YEARS)].flatMap((m) => m[1].match(/\d{2}/g) ?? []).map((n) => fullYear(Number(n)));
  const short = HANGUL.test(line) ? [] : [...line.matchAll(EN_SHORT_YEAR)].map((m) => fullYear(Number(m[1])));
  const en = [...line.matchAll(FOUR_DIGIT_YEAR)].map((m) => Number(m[1]));
  return [...ko, ...short, ...en].filter((y) => !NON_BIRTH_YEARS.has(y));
}

// A line with years but no animal inherits the animals of the latest 띠 line that had no years of its own
// ("돼지띠" then "96·84·72년생" on the next line); a 띠 line that carries its years is checked alone.
function lineYearProblems(post: string): string[] {
  let pending: number[] = [];
  return post.split("\n").flatMap((line) => {
    const own = [...animalsIn(line)];
    const years = birthYearsIn(line);
    const animals = own.length > 0 ? own : pending;
    pending = own.length > 0 ? (years.length === 0 ? own : []) : years.length > 0 ? [] : pending;
    if (animals.length === 0 || years.length === 0) return [];
    const ok = years.every((y) => animals.some((i) => ZODIAC_2027[i].birthYears.includes(y)));
    return ok ? [] : [`띠와 출생년도 불일치: ${line.trim()}`];
  });
}

function strayYearProblems(post: string, allowed: ReadonlySet<number>): string[] {
  return birthYearsIn(post).filter((y) => !NON_BIRTH_YEARS.has(y) && !allowed.has(y)).map((y) => `허용되지 않은 연도: ${y}`);
}

// Returns problems found in the draft; an empty array means it passes. Detection runs both KO and EN patterns.
export function checkZodiacFacts(post: string, slotIndex: number): string[] {
  const topicIdx = new Set(topicZodiacs(zodiacTopicFor(slotIndex)).map((z) => ZODIAC_2027.indexOf(z)));
  const found = animalsIn(post);
  const problems = [...found].filter((i) => !topicIdx.has(i) && ZODIAC_2027[i].ko !== YEAR_ANIMAL_2027).map((i) => `다른 주제의 띠: ${ZODIAC_2027[i].ko}`);
  if (![...found].some((i) => topicIdx.has(i))) problems.push("주제 띠가 없음");
  problems.push(...lineYearProblems(post));
  // Years of any named animal are allowed (an off-topic one is already reported above), except the year animal:
  // its birth years only count when it is one of the topic's animals.
  const yearAnimal = ZODIAC_2027.findIndex((z) => z.ko === YEAR_ANIMAL_2027);
  const named = [...found].filter((i) => i !== yearAnimal || topicIdx.has(i));
  problems.push(...strayYearProblems(post, new Set([...topicIdx, ...named].flatMap((i) => ZODIAC_2027[i].birthYears))));
  if (animalsIn(post.split("\n")[0]).size > 0) problems.push("첫 줄에 띠 이름");
  if (!GUIDE_NOTE.test(post)) problems.push("띠 기준 안내 없음");
  if (RANK_WORD.test(post)) problems.push("순위 표현");
  return [...new Set(problems)];
}

export function buildNewYearLink(postId: string, modeId: NewYearModeId, lang: NewYearLang): string {
  return buildTrackedUrl(LINK_BASE[lang], { postId, formulaId: modeId, utmCampaign: "new_year_2027" });
}

export function newYearFirstComment(lang: NewYearLang, shortLink: string): string {
  return `${lang === "ko" ? "내 2027 캘린더는 홈 맨 위에서:" : "Your 2027 calendar is at the top of the home page:"}\n${shortLink}`;
}
