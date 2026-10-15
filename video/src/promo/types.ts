// types.ts — shared vocabulary for the promo rotation (pure TS: no remotion/React imports,
// because scripts/render-promo-job.mjs imports this directly under Node type stripping).
import type { PromoSnapshot } from "./snapshot.ts";

export type PromoLang = "ko" | "en";
export type PromoFormat = "reportTour" | "race" | "match" | "experiment";
export type PromoTopic = "contact" | "career" | "confession" | "sideJob" | "marriage" | "partnership";
export type Gender = "female" | "male";

export interface Persona {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: Gender;
}

export interface PromoVariant {
  date: string; // slot date (latest Mon/Thu, KST), YYYY-MM-DD — run identity, not the engine as-of date
  lang: PromoLang;
  slot: number;
  format: PromoFormat;
  topic: PromoTopic;
  hookIndex: number;
  persona: Persona;
  guest: Persona;
}

// Type alias (not interface) so Remotion accepts it as Record<string, unknown> props.
export type PromoProps = { lang: PromoLang; variant: PromoVariant; snapshot: PromoSnapshot };

export const RELATION_TOPICS: readonly PromoTopic[] = ["contact", "confession", "marriage", "partnership"];

export const COMPOSITION_ID: Record<PromoFormat, string> = {
  reportTour: "PromoReportTour",
  race: "PromoRace",
  match: "PromoMatch",
  experiment: "PromoExperiment",
};

export const PROMO_FPS = 30;
export const FORMAT_FRAMES: Record<PromoFormat, number> = { reportTour: 1350, race: 600, match: 600, experiment: 600 };
