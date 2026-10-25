export type NewYearModeId = "ny_ranking" | "ny_ipchun" | "ny_monthly" | "ny_pick" | "ny_zodiac";
export type NewYearLang = "ko" | "en";

export const NEW_YEAR_BRANDS: Record<string, NewYearLang> = {
  cosmicpath: "ko",
  "cosmicpath-global": "en",
};

export const NEW_YEAR_MODE_IDS: readonly NewYearModeId[] = ["ny_ranking", "ny_ipchun", "ny_monthly", "ny_pick", "ny_zodiac"];

export function isNewYearModeId(id: string | null | undefined): id is NewYearModeId {
  return id != null && (NEW_YEAR_MODE_IDS as readonly string[]).includes(id);
}

// Window bounds are KST dates as YYYYMMDD, inclusive. `positions` are the
// slotIndex % period values that become New Year slots. Kept as one constant so
// other season checks can reuse the same dates.
export interface NewYearWindow {
  start: number;
  end: number;
  period: number;
  positions: readonly number[];
}

export const NEW_YEAR_WINDOWS: Record<NewYearLang, readonly NewYearWindow[]> = {
  ko: [
    { start: 20261124, end: 20261214, period: 5, positions: [0] },
    { start: 20261215, end: 20270131, period: 5, positions: [0, 2] },
    { start: 20270201, end: 20270206, period: 5, positions: [0] },
  ],
  en: [{ start: 20261215, end: 20270206, period: 4, positions: [0] }],
};

// 20-slot cycle: zodiac 6 / ranking 4 / ipchun 5 / monthly 3 / pick 2 = 30/20/25/15/10%. No adjacent repeats
// (including the wrap-around, and also when pick becomes monthly), zodiac gaps stay 3-5 slots, and positions
// 0 and 1 stay ranking / ipchun.
const MODE_CYCLE: NewYearModeId[] = [
  "ny_ranking", "ny_ipchun", "ny_zodiac", "ny_monthly", "ny_ipchun", "ny_zodiac", "ny_pick", "ny_ranking", "ny_zodiac", "ny_ipchun",
  "ny_monthly", "ny_zodiac", "ny_ranking", "ny_pick", "ny_zodiac", "ny_ipchun", "ny_monthly", "ny_zodiac", "ny_ranking", "ny_ipchun",
];

// EN cycle: zodiac 50%. Ranking and monthly stay out because their checks are Korean-only (day-master and month text).
const EN_MODE_CYCLE: NewYearModeId[] = ["ny_zodiac", "ny_ipchun", "ny_zodiac", "ny_pick"];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstYmd(d: Date): number {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return k.getUTCFullYear() * 10000 + (k.getUTCMonth() + 1) * 100 + k.getUTCDate();
}

// KO season span (first window start .. last window end, KST) minus the kill switch.
export function isKoNewYearSeason(date: Date, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NEW_YEAR_SEASON_DISABLED === "1") return false;
  const wins = NEW_YEAR_WINDOWS.ko;
  const ymd = kstYmd(date);
  return ymd >= wins[0].start && ymd <= wins[wins.length - 1].end;
}

// Daily video season: only brands mapped to "ko" get the 2027 version (its CTA points at the KO site).
export function dailyVideoSeason(brandSlug: string, now: Date, env: NodeJS.ProcessEnv = process.env): "new_year_2027" | undefined {
  const ko = Object.hasOwn(NEW_YEAR_BRANDS, brandSlug) && NEW_YEAR_BRANDS[brandSlug] === "ko";
  return ko && isKoNewYearSeason(now, env) ? "new_year_2027" : undefined;
}

export function newYearSlotMode(input: {
  brandSlug: string;
  plannedAt: Date;
  slotIndex: number;
  choicesCapped: boolean;
  env?: NodeJS.ProcessEnv;
}): NewYearModeId | null {
  const { brandSlug, plannedAt, slotIndex, choicesCapped, env = process.env } = input;
  if (env.NEW_YEAR_SEASON_DISABLED === "1") return null;
  if (!Object.hasOwn(NEW_YEAR_BRANDS, brandSlug)) return null;

  const lang = NEW_YEAR_BRANDS[brandSlug];
  const ymd = kstYmd(plannedAt);
  const win = NEW_YEAR_WINDOWS[lang].find((w) => ymd >= w.start && ymd <= w.end);
  if (!win) return null;

  const pos = win.positions.indexOf(slotIndex % win.period);
  if (pos < 0) return null;

  const nth = Math.floor(slotIndex / win.period) * win.positions.length + pos;
  if (lang === "en") {
    const mode = EN_MODE_CYCLE[nth % EN_MODE_CYCLE.length];
    return choicesCapped && mode === "ny_pick" ? "ny_ipchun" : mode;
  }
  let mode = MODE_CYCLE[nth % MODE_CYCLE.length];
  // Final stretch: lean on the ipchun (start of spring) post.
  if (ymd >= 20270201) mode = nth % 2 === 0 ? "ny_ipchun" : mode === "ny_ipchun" ? "ny_ranking" : mode;
  if (choicesCapped && mode === "ny_pick") mode = "ny_monthly";
  return mode;
}
