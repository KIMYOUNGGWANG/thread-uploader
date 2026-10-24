import { buildTrackedUrl } from "@/lib/tracking-url";
import { DAY_MASTER_2027, IPCHUN_2027, MONTHS_2027, NEW_YEAR_TAGS, type NewYearTag } from "./new-year-2027-data";
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

const LINK_BASE: Record<NewYearLang, string> = {
  ko: "https://www.cosmicpath.app/2027/sample",
  en: "https://www.cosmicpath.app/en/2027/sample",
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
  return rotate(PICK_AXES, slotIndex).map((axis) => {
    const names = dayMastersOf(axis.tag).join("·");
    return lang === "ko"
      ? `- ${axis.ko}: ${NEW_YEAR_TAGS[axis.tag].ko} (참고 일간: ${names})`
      : `- ${axis.en}: ${NEW_YEAR_TAGS[axis.tag].en} (day masters: ${names})`;
  });
}

// The brief is the only source of saju values the model may use; checkNewYearFacts verifies the output against it.
export function buildNewYearBrief(modeId: NewYearModeId, lang: NewYearLang, slotIndex: number): string {
  const header = lang === "ko" ? "[2027 신년 자료] 아래 값만 쓰고 다른 간지·날짜·순위를 만들지 않는다." : "[2027 New Year brief] Use only these values; never invent ganji, dates or ranks.";
  const body = {
    ny_ranking: () => rankingBrief(lang, slotIndex),
    ny_ipchun: () => ipchunBrief(lang),
    ny_monthly: () => monthlyBrief(lang),
    ny_pick: () => pickBrief(lang, slotIndex),
  }[modeId]();
  return [header, ...body].join("\n");
}

// Returns problems found in the draft; an empty array means it passes.
export function checkNewYearFacts(post: string, modeId: NewYearModeId, lang: NewYearLang): string[] {
  const problems: string[] = [];

  for (const [, year] of post.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)) {
    if (year !== "2026" && year !== "2027") problems.push(`허용되지 않은 연도: ${year}`);
  }

  if (modeId === "ny_ipchun") {
    const ok = lang === "ko" ? /입춘|2월\s*4일/.test(post) : /Feb(?:ruary)?\.?\s*4|Lichun/i.test(post);
    if (!ok) problems.push("입춘(또는 2월 4일) 언급이 없다");
  }

  if (lang !== "ko") return problems;

  // The pillar must be attached to its month ("5월 을사는", "5월(을사)", "7월 정미월"). Looser matching
  // flags ordinary words (갑자기, 정해진, 임신) and year ganji (병오년, 병오해), and each false positive
  // silently drops a good draft, so an ambiguous mention is skipped rather than rejected.
  // After the pair: 월, a particle, ")", "," or end of text. Whitespace, "·" and any other hangul do not count.
  const MONTH_PILLAR = /(\d{1,2})월(?:은|에|엔|의|이|도)?[ (]?([갑을병정무기경신임계][자축인묘진사오미신유술해])(?=월|[은는이가](?![가-힣])|[),]|$)/gm;
  for (const m of post.matchAll(MONTH_PILLAR)) {
    const entry = MONTHS_2027.find((x) => x.month === Number(m[1]));
    if (entry && m[2] !== entry.pillar) problems.push(`${m[1]}월 월주가 틀림: ${m[2]} (정답 ${entry.pillar})`);
  }

  if (modeId === "ny_ranking") {
    for (const line of post.split("\n")) {
      const mentioned = DAY_MASTERS.filter((dm) => line.includes(dm));
      if (mentioned.length < 2) continue;
      if (new Set(mentioned.map((dm) => DAY_MASTER_2027[dm].tag)).size > 1) {
        const odd = mentioned.find((dm) => DAY_MASTER_2027[dm].tag !== DAY_MASTER_2027[mentioned[0]].tag) ?? mentioned[1];
        problems.push(`한 줄에 다른 결의 일간이 섞임: ${odd} (${line.trim()})`);
      }
    }
  }

  return problems;
}

export function buildNewYearLink(postId: string, modeId: NewYearModeId, lang: NewYearLang): string {
  const url = new URL(buildTrackedUrl(LINK_BASE[lang], { postId, formulaId: modeId, utmCampaign: "new_year_2027" }));
  url.searchParams.set("source", "threads");
  return url.toString();
}

export function newYearFirstComment(lang: NewYearLang, shortLink: string): string {
  return `${lang === "ko" ? "내 2027 캘린더, 샘플 먼저 보기:" : "See a sample 2027 calendar first:"}\n${shortLink}`;
}
