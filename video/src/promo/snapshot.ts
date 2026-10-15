// snapshot.ts — the engine output one promo video is rendered from. Produced by
// scripts/extract-report-data.ts from cosmicpath's real engines; validated before rendering.
import type { Persona, PromoFormat, PromoProps, PromoVariant } from "./types.ts";

export interface Pillar { stem: string; branch: string }

export interface PromoSnapshot {
  asOf: string;
  lang: "ko" | "en";
  persona: Persona;
  guest: Persona | null;
  saju: {
    dayMaster: string;
    pillars: { hour: Pillar; day: Pillar; month: Pillar; year: Pillar };
    elements: Array<{ stem: string; branch: string }>; // order: year, month, day, hour
  };
  heatmap: {
    bestDay: { date: string; score: number; reasonKo: string; reasonEn: string } | null;
    months: Array<{ year: number; month: number; nameEn: string; average: number; phase: string }>;
  };
  scenario: {
    headline: string;
    peakLabel: string | null;
    timeline: Array<{ label: string; action: number; best: "A" | "B" | "EQUAL" }>;
  };
  ziwei: {
    mingGongBranch: string;
    wuxingJu: string;
    wuxingJuEn: string;
    quanPalace: string;
    palaces: Array<{ name: string; nameEn: string; branch: string; stars: Array<{ ko: string; en: string; category: string }> }>;
  };
  match: {
    overall: number; saju: number; astro: number; num: number;
    hostElement: string; guestElement: string; hostSign: string; guestSign: string;
    hostDayMaster: string; guestDayMaster: string; tianganHe: boolean; dizhiChong: boolean;
  } | null;
}

const BROKEN_TEXT = /\b\d+M\b|undefined|NaN|\[object/;
const inScore = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;

function timelineProblems(snapshot: PromoSnapshot): string[] {
  const actions = snapshot.scenario.timeline.map((point) => point.action);
  const problems: string[] = [];
  if (actions.length !== 12) problems.push(`timeline has ${actions.length} months, expected 12`);
  if (!actions.every(inScore)) problems.push("timeline action score out of 0-100");
  if (actions.length > 1 && actions.every((action) => action === actions[0])) problems.push("timeline is flat");
  return problems;
}

function textProblems(snapshot: PromoSnapshot): string[] {
  const bestDay = snapshot.heatmap.bestDay;
  const texts = [
    snapshot.scenario.headline,
    snapshot.scenario.peakLabel ?? "",
    ...snapshot.scenario.timeline.map((point) => point.label),
    ...(bestDay ? [bestDay.reasonKo, bestDay.reasonEn] : []),
  ];
  return texts.filter((text) => !text.trim() || BROKEN_TEXT.test(text)).map((text) => `broken text: "${text}"`);
}

function matchProblems(match: PromoSnapshot["match"]): string[] {
  if (!match) return ["match format without match scores"];
  return [match.overall, match.saju, match.astro, match.num].every(inScore) ? [] : ["match score out of 0-100"];
}

export function validateSnapshot(snapshot: PromoSnapshot, format: PromoFormat): string[] {
  const problems = [...timelineProblems(snapshot), ...textProblems(snapshot)];
  const bestDay = snapshot.heatmap.bestDay;
  if (!bestDay) problems.push("no best day");
  else if (bestDay.date < snapshot.asOf) problems.push(`best day ${bestDay.date} is before ${snapshot.asOf}`);
  if (snapshot.ziwei.palaces.length !== 12) problems.push(`ziwei has ${snapshot.ziwei.palaces.length} palaces, expected 12`);
  if (format === "match") problems.push(...matchProblems(snapshot.match));
  return problems;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const hasKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && keys.every((key) => key in value);

function isPromoSnapshot(value: unknown): value is PromoSnapshot {
  if (!hasKeys(value, ["asOf", "lang", "persona", "saju", "heatmap", "scenario", "ziwei", "match"])) return false;
  return typeof value.asOf === "string"
    && hasKeys(value.saju, ["dayMaster", "pillars", "elements"])
    && hasKeys(value.heatmap, ["bestDay", "months"]) && Array.isArray(value.heatmap.months)
    && hasKeys(value.scenario, ["headline", "peakLabel", "timeline"]) && Array.isArray(value.scenario.timeline)
    && hasKeys(value.ziwei, ["palaces", "quanPalace"]) && Array.isArray(value.ziwei.palaces);
}

export function parsePromoSnapshot(value: unknown): PromoSnapshot {
  if (!isPromoSnapshot(value)) throw new Error("not a promo snapshot");
  return value;
}

const FORMATS = new Set(["reportTour", "race", "match", "experiment"]);
const TOPICS = new Set(["contact", "career", "confession", "sideJob", "marriage", "partnership"]);

function isPromoVariant(value: unknown): value is PromoVariant {
  return hasKeys(value, ["date", "lang", "slot", "format", "topic", "hookIndex", "persona", "guest"])
    && FORMATS.has(String(value.format)) && TOPICS.has(String(value.topic))
    && (value.lang === "ko" || value.lang === "en") && typeof value.hookIndex === "number";
}

export function parsePromoProps(value: unknown): PromoProps {
  if (!hasKeys(value, ["lang", "variant", "snapshot"]) || !isPromoVariant(value.variant) || (value.lang !== "ko" && value.lang !== "en")) {
    throw new Error("not promo props");
  }
  return { lang: value.lang, variant: value.variant, snapshot: parsePromoSnapshot(value.snapshot) };
}
