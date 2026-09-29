// tiktok-audio-aligner.ts — Builds timestamp timing and SRT subtitle tracks for Remotion.
import type { TikTokSceneBeat } from "./tiktok-script-engine";

export interface SubtitleCue {
  id: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface AlignmentResult {
  fps: number;
  totalFrames: number;
  totalDurationMs: number;
  srtContent: string;
  cues: SubtitleCue[];
  sceneTimings: Array<{
    sceneId: string;
    fromFrame: number;
    durationInFrames: number;
    startMs: number;
    endMs: number;
  }>;
}

function formatSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

export function alignTikTokScenes(
  scenes: TikTokSceneBeat[],
  fps: number = 30
): AlignmentResult {
  let currentMs = 0;
  let currentFrame = 0;
  const cues: SubtitleCue[] = [];
  const sceneTimings: Array<{
    sceneId: string;
    fromFrame: number;
    durationInFrames: number;
    startMs: number;
    endMs: number;
  }> = [];

  scenes.forEach((scene, index) => {
    const durationMs = Math.round(scene.durationSeconds * 1000);
    const durationFrames = Math.round(scene.durationSeconds * fps);

    sceneTimings.push({
      sceneId: scene.sceneId,
      fromFrame: currentFrame,
      durationInFrames: durationFrames,
      startMs: currentMs,
      endMs: currentMs + durationMs,
    });

    // Generate subtitle cue for the spoken line
    cues.push({
      id: index + 1,
      startMs: currentMs + 100, // slight 100ms padding for smooth entrance
      endMs: currentMs + durationMs - 100,
      text: scene.spokenLine,
    });

    currentMs += durationMs;
    currentFrame += durationFrames;
  });

  const srtContent = cues
    .map(
      (cue) =>
        `${cue.id}\n${formatSrtTime(cue.startMs)} --> ${formatSrtTime(cue.endMs)}\n${cue.text}\n`
    )
    .join("\n");

  return {
    fps,
    totalFrames: currentFrame,
    totalDurationMs: currentMs,
    srtContent,
    cues,
    sceneTimings,
  };
}
