// rotation.ts — date → promo variant. Pure and deterministic: the same KST date always yields the
// same format, topic, persona and hook, so a re-run of a failed slot reproduces the same video.
import { RELATION_TOPICS } from "./types.ts";
import type { Gender, Persona, PromoFormat, PromoLang, PromoTopic, PromoVariant } from "./types.ts";

export const ROTATION_START = "2026-10-19"; // a Monday
export const FORMATS: readonly PromoFormat[] = ["reportTour", "race", "match", "experiment"];
export const TOPICS: readonly PromoTopic[] = ["contact", "career", "confession", "sideJob", "marriage", "partnership"];
const DAY_MS = 86_400_000;
const SLOT_WEEKDAYS = new Set([1, 4]); // Monday, Thursday (UTC weekday of the KST calendar date)
const HOOK_COUNT = 3;

export interface VariantOverrides {
  format?: PromoFormat;
  topic?: PromoTopic;
}

function toUtcDay(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new Error(`invalid date: "${date}"`);
  }
  return ms;
}

// ponytail: linear day walk, ~100 iterations per year of rotation; switch to arithmetic if it ever matters
export function slotFor(date: string): number {
  const target = toUtcDay(date);
  let count = 0;
  for (let day = toUtcDay(ROTATION_START); day <= target; day += DAY_MS) {
    if (SLOT_WEEKDAYS.has(new Date(day).getUTCDay())) count += 1;
  }
  return Math.max(0, count - 1);
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function personaFor(seed: string, gender: Gender): Persona {
  const next = seededRandom(seed);
  const year = 1990 + Math.floor(next() * 12);
  const month = 1 + Math.floor(next() * 12);
  const day = 1 + Math.floor(next() * 28);
  const hour = Math.floor(next() * 24);
  const minute = next() < 0.5 ? 0 : 30;
  return { birthDate: `${year}-${pad(month)}-${pad(day)}`, birthTime: `${pad(hour)}:${pad(minute)}`, gender };
}

function pickTopic(slot: number, format: PromoFormat, override?: PromoTopic): PromoTopic {
  if (format !== "match") return override ?? TOPICS[slot % TOPICS.length] ?? "career";
  if (override && !RELATION_TOPICS.includes(override)) {
    throw new Error(`match format needs a relation topic, got "${override}"`);
  }
  return override ?? RELATION_TOPICS[Math.floor(slot / FORMATS.length) % RELATION_TOPICS.length] ?? "contact";
}

export function pickPromoVariant(date: string, lang: PromoLang, overrides: VariantOverrides = {}): PromoVariant {
  const slot = slotFor(date);
  const picked = overrides.format ?? FORMATS[slot % FORMATS.length] ?? "reportTour";
  const format: PromoFormat = lang === "en" && picked === "match" ? "race" : picked; // match screens are Korean-only
  const gender: Gender = slot % 2 === 0 ? "female" : "male";
  return {
    date,
    lang,
    slot,
    format,
    topic: pickTopic(slot, format, overrides.topic),
    hookIndex: Math.floor(slot / FORMATS.length) % HOOK_COUNT,
    persona: personaFor(date, gender),
    guest: personaFor(`${date}:guest`, gender === "female" ? "male" : "female"),
  };
}
