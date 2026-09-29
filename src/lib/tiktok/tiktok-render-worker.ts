// tiktok-render-worker.ts — Assembles Remotion RenderSpec and executes video rendering.
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import type { TikTokScriptResult } from "./tiktok-script-engine";
import { alignTikTokScenes } from "./tiktok-audio-aligner";
import type { RenderSpec } from "../../../.agent/skills/oma-video/resources/remotion/src/render-spec";

const execAsync = promisify(exec);

export interface RenderJobResult {
  success: boolean;
  outputPath?: string;
  renderDurationMs?: number;
  error?: string;
  renderSpec: RenderSpec;
}

export function buildTikTokRenderSpec(
  script: TikTokScriptResult,
  options: {
    audioNarrationPath?: string;
    musicPath?: string;
    captionsSrtPath?: string;
  } = {}
): RenderSpec {
  const alignment = alignTikTokScenes(script.scenes, 30);

  const scenes = script.scenes.map((scene, idx) => {
    const timing = alignment.sceneTimings[idx];

    let visualType: "saju-card" | "kinetic-card" | "placeholder" | "image" = "placeholder";
    let visualSrc = "#0b0d14";
    let cardData: Record<string, any> | undefined = undefined;

    if (scene.type === "saju-card") {
      visualType = "saju-card";
      visualSrc = "saju-chart";
      cardData = scene.visualProps?.sajuData;
    } else if (scene.type === "kinetic-card") {
      visualType = "kinetic-card";
      visualSrc = scene.visualProps?.hookText ?? scene.onScreenText[0] ?? "주목";
      cardData = {
        subText: scene.visualProps?.subText,
        badge: scene.visualProps?.badge,
        colorScheme: scene.visualProps?.colorScheme,
      };
    }

    return {
      id: scene.sceneId,
      fromFrame: timing?.fromFrame ?? 0,
      durationInFrames: timing?.durationInFrames ?? 90,
      visual: {
        type: visualType,
        src: visualSrc,
        kenBurns: scene.type !== "saju-card",
        cardData,
      },
      onScreenText: scene.onScreenText,
    };
  });

  return {
    schemaVersion: "1.0",
    compositor: "remotion",
    composition: "TikTokExplainer",
    fps: 30,
    dimensions: { width: 1080, height: 1920 },
    durationInFrames: alignment.totalFrames,
    audio: {
      narration: options.audioNarrationPath,
      music: options.musicPath,
      musicGainDb: -18,
    },
    scenes,
    captions: {
      file: options.captionsSrtPath,
      style: "tiktok",
      fontFamily: "Pretendard",
      maxWidthPct: 86,
      safeArea: { topPct: 8, bottomPct: 18, leftPct: 6, rightPct: 16 },
    },
    background: { type: "color", src: "#0b0d14" },
    seed: 42,
  };
}

export async function executeTikTokRender(
  renderSpec: RenderSpec,
  options: {
    runDir?: string;
    outputFileName?: string;
    dryRun?: boolean;
  } = {}
): Promise<RenderJobResult> {
  const startAt = Date.now();
  const runDir = options.runDir ?? path.join(process.cwd(), ".agents/results/videos", `tiktok-${Date.now()}`);
  const outputFileName = options.outputFileName ?? "tiktok-explainer.mp4";
  const outputPath = path.join(runDir, outputFileName);

  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  const specFilePath = path.join(runDir, "render-spec.json");
  fs.writeFileSync(specFilePath, JSON.stringify(renderSpec, null, 2), "utf8");

  if (options.dryRun) {
    return {
      success: true,
      outputPath,
      renderDurationMs: Date.now() - startAt,
      renderSpec,
    };
  }

  const remotionDir = path.join(process.cwd(), ".agent/skills/oma-video/resources/remotion");

  try {
    const cmd = `npx remotion render src/index.ts TikTokExplainer "${outputPath}" --props="${specFilePath}"`;
    await execAsync(cmd, {
      cwd: remotionDir,
      timeout: 180000, // 3 minutes timeout
    });

    return {
      success: true,
      outputPath,
      renderDurationMs: Date.now() - startAt,
      renderSpec,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
      renderDurationMs: Date.now() - startAt,
      renderSpec,
    };
  }
}
