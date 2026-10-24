export type NewYearModeId = "ny_ranking" | "ny_ipchun" | "ny_monthly" | "ny_pick";
export type NewYearLang = "ko" | "en";

export const NEW_YEAR_BRANDS: Record<string, NewYearLang> = {
  cosmicpath: "ko",
  "cosmicpath-global": "en",
};

export const NEW_YEAR_MODE_IDS: readonly NewYearModeId[] = ["ny_ranking", "ny_ipchun", "ny_monthly", "ny_pick"];

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

// 20-slot cycle: 7/6/4/3 = 35/30/20/15%, no adjacent repeats (including the
// wrap-around, hence the trailing ny_monthly).
const MODE_CYCLE: NewYearModeId[] = [
  "ny_ranking", "ny_ipchun", "ny_monthly", "ny_ranking", "ny_pick", "ny_ipchun", "ny_ranking", "ny_monthly", "ny_ipchun", "ny_ranking",
  "ny_pick", "ny_ipchun", "ny_ranking", "ny_monthly", "ny_ipchun", "ny_ranking", "ny_pick", "ny_ipchun", "ny_ranking", "ny_monthly",
];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstYmd(d: Date): number {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return k.getUTCFullYear() * 10000 + (k.getUTCMonth() + 1) * 100 + k.getUTCDate();
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

  const ymd = kstYmd(plannedAt);
  const win = NEW_YEAR_WINDOWS[NEW_YEAR_BRANDS[brandSlug]].find((w) => ymd >= w.start && ymd <= w.end);
  if (!win) return null;

  const pos = win.positions.indexOf(slotIndex % win.period);
  if (pos < 0) return null;

  const nth = Math.floor(slotIndex / win.period) * win.positions.length + pos;
  let mode = MODE_CYCLE[nth % MODE_CYCLE.length];
  // Final stretch: lean on the ipchun (start of spring) post.
  if (ymd >= 20270201) mode = nth % 2 === 0 ? "ny_ipchun" : mode === "ny_ipchun" ? "ny_ranking" : mode;
  if (choicesCapped && mode === "ny_pick") mode = "ny_monthly";
  return mode;
}
