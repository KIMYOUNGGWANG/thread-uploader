import type { TikTokVideoDraft } from "@prisma/client";
import type { TikTokSceneBeat, TikTokScriptResult } from "@/lib/tiktok/tiktok-script-engine";

const DAY_MASTERS = ["갑목", "을목", "병화", "정화", "무토", "기토", "경금", "신금", "임수", "계수"];

// formatId는 Remotion 컴포지션과 한 몸이다. 새 포맷은 여기와 video/src/Root.tsx에 같이 등록한다.
export const TIKTOK_FORMAT_IDS = ["tiktok_explainer_vertical", "ig_rank_10s", "ig_pickcard_16s"] as const;
export type TikTokFormatId = (typeof TIKTOK_FORMAT_IDS)[number];
export const DEFAULT_FORMAT_ID: TikTokFormatId = "tiktok_explainer_vertical";

export const FORMAT_COMPOSITIONS: Record<TikTokFormatId, string> = {
  tiktok_explainer_vertical: "TikTokExplainer",
  ig_rank_10s: "IgRank10s",
  ig_pickcard_16s: "IgPickCard16s",
};

export function parseFormatId(raw: string): TikTokFormatId {
  return (TIKTOK_FORMAT_IDS as readonly string[]).includes(raw) ? (raw as TikTokFormatId) : DEFAULT_FORMAT_ID;
}

// One stem per day so the daily promo video rotates through all ten day masters.
export function pickDailyDayMaster(date: Date): string {
  const dayIndex = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
  return DAY_MASTERS[dayIndex % DAY_MASTERS.length];
}

// After each full ten-day pass the hook variant moves on, so the same video does not return every ten days.
export function pickDailyHookVariant(date: Date): number {
  const dayIndex = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
  return Math.floor(dayIndex / DAY_MASTERS.length);
}

export function buildTikTokDraftCreateData(brandId: string, script: TikTokScriptResult, status: string) {
  return {
    brandId,
    campaignId: "saju_tiktok_campaign",
    formatId: script.formatId ?? DEFAULT_FORMAT_ID,
    status,
    title: script.title,
    spokenHook: script.spokenHook,
    script: script.fullScript,
    sceneBeats: JSON.stringify(script.scenes),
    captionOverlays: JSON.stringify(script.scenes.map((scene) => scene.spokenLine)),
    onScreenText: JSON.stringify(script.scenes.flatMap((scene) => scene.onScreenText)),
    hashtags: JSON.stringify(script.hashtags),
    cta: script.cta,
    qualityProfile: "tiktok_saju_retention",
    qualityPass: script.qualityPass,
    qualityScore: script.qualityScore,
    qualityReasons: JSON.stringify(script.qualityReasons ?? []),
    durationSeconds: Math.round(script.totalDurationSeconds),
  };
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function draftToScriptResult(draft: TikTokVideoDraft): TikTokScriptResult {
  return {
    formatId: parseFormatId(draft.formatId),
    title: draft.title,
    spokenHook: draft.spokenHook,
    fullScript: draft.script,
    totalDurationSeconds: draft.durationSeconds,
    scenes: parseJsonArray<TikTokSceneBeat>(draft.sceneBeats),
    cta: draft.cta,
    hashtags: parseJsonArray<string>(draft.hashtags),
    qualityScore: draft.qualityScore,
    qualityPass: draft.qualityPass,
  };
}

// Threads caption for the video post; the operator can edit it before approving.
export function buildVideoPostCaption(draft: Pick<TikTokVideoDraft, "spokenHook" | "cta">): string {
  return [draft.spokenHook.trim(), draft.cta.trim()].filter(Boolean).join("\n\n");
}
