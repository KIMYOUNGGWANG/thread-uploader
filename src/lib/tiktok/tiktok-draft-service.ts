import type { TikTokVideoDraft } from "@prisma/client";
import type { TikTokSceneBeat, TikTokScriptResult } from "@/lib/tiktok/tiktok-script-engine";

const DAY_MASTERS = ["갑목", "을목", "병화", "정화", "무토", "기토", "경금", "신금", "임수", "계수"];

// One stem per day so the daily promo video rotates through all ten day masters.
export function pickDailyDayMaster(date: Date): string {
  const dayIndex = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
  return DAY_MASTERS[dayIndex % DAY_MASTERS.length];
}

export function buildTikTokDraftCreateData(brandId: string, script: TikTokScriptResult, status: string) {
  return {
    brandId,
    campaignId: "saju_tiktok_campaign",
    formatId: "tiktok_explainer_vertical",
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
