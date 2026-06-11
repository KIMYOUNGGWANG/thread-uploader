import { drawTikTokFrame } from "@/lib/tiktok-video-canvas";
import type { TikTokVideoDraftResponse } from "@/types/tiktok-video";

export interface TikTokRenderPlan {
  readonly kicker: string;
  readonly title: string;
  readonly captions: readonly string[];
  readonly bodyLines: readonly string[];
  readonly cta: string;
  readonly hashtags: readonly string[];
  readonly durationSeconds: number;
}

export function buildTikTokRenderPlan(draft: TikTokVideoDraftResponse): TikTokRenderPlan {
  const captions = uniqueNonEmptyText([
    draft.spokenHook,
    ...draft.captionOverlays,
    ...draft.onScreenText,
    draft.title,
  ]).slice(0, 6);
  const bodyLines = uniqueNonEmptyText([
    ...draft.sceneBeats.map((beat) => beat.narration),
    draft.script,
  ]).slice(0, 5);

  return {
    kicker: "커리어 타이밍 체크",
    title: cleanDisplayText(draft.title || draft.spokenHook),
    captions,
    bodyLines,
    cta: cleanDisplayText(draft.cta),
    hashtags: uniqueNonEmptyText(draft.hashtags).slice(0, 4),
    durationSeconds: Math.max(5, draft.durationSeconds),
  };
}

export async function renderTikTokDraftVideo(draft: TikTokVideoDraftResponse): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("이 브라우저는 영상 생성을 지원하지 않습니다");
  }

  const canvas = document.createElement("canvas");
  canvas.width = draft.renderTarget.width;
  canvas.height = draft.renderTarget.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas를 초기화하지 못했습니다");

  const stream = canvas.captureStream(draft.renderTarget.fps);
  const mimeType = pickSupportedVideoMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const plan = buildTikTokRenderPlan(draft);
  const durationMs = plan.durationSeconds * 1000;
  const startTime = performance.now();
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
    };
  });

  recorder.start();
  const draw = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    drawTikTokFrame(context, draft.sceneBeats, plan, progress, elapsed / 1000);
    if (progress < 1) {
      requestAnimationFrame(draw);
    } else {
      recorder.stop();
    }
  };
  draw();
  return stopped;
}

function uniqueNonEmptyText(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = cleanDisplayText(item);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function cleanDisplayText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function pickSupportedVideoMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ] as const;
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}
