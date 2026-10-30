// tiktok-render-worker.ts — Assembles Remotion RenderSpec and executes video rendering.
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import type { TikTokSceneBeat, TikTokScriptResult } from "./tiktok-script-engine";
import { alignTikTokScenes } from "./tiktok-audio-aligner";
import { DEFAULT_FORMAT_ID, FORMAT_COMPOSITIONS } from "./tiktok-draft-service";
import type { RenderSpec, RenderSpecScene } from "./render-spec-types";

const execAsync = promisify(exec);

// Vendored Remotion compositor (same one CI uses for promo renders).
export const REMOTION_COMPOSITOR_DIR = path.join(process.cwd(), "video");

export interface RenderJobResult {
  success: boolean;
  outputPath?: string;
  renderDurationMs?: number;
  error?: string;
  renderSpec: RenderSpec;
}

function toVisual(scene: TikTokSceneBeat): RenderSpecScene["visual"] {
  const props = scene.visualProps;
  if (scene.type === "saju-card") {
    return { type: "saju-card", src: "saju-chart", kenBurns: false, cardData: props?.sajuData };
  }
  if (scene.type === "kinetic-card") {
    const src = props?.hookText ?? scene.onScreenText[0] ?? "주목";
    const cardData = { subText: props?.subText, badge: props?.badge, colorScheme: props?.colorScheme };
    return { type: "kinetic-card", src, kenBurns: true, cardData };
  }
  if (scene.type === "rank-card") {
    return { type: "rank-card", src: "rank-card", kenBurns: false, cardData: props?.rankCard };
  }
  if (scene.type === "pick-card") {
    return { type: "pick-card", src: "pick-card", kenBurns: false, cardData: props?.pickCard };
  }
  return { type: "placeholder", src: "#0b0d14", kenBurns: true };
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
  const formatId = script.formatId ?? DEFAULT_FORMAT_ID;
  // 릴스 포맷은 음악·내레이션·자막 없이 카드 컴포넌트가 화면을 전부 그린다.
  const isReels = formatId !== DEFAULT_FORMAT_ID;

  const scenes = script.scenes.map((scene, idx) => {
    const timing = alignment.sceneTimings[idx];
    return {
      id: scene.sceneId,
      fromFrame: timing?.fromFrame ?? 0,
      durationInFrames: timing?.durationInFrames ?? 90,
      visual: toVisual(scene),
      onScreenText: scene.onScreenText,
    };
  });

  return {
    schemaVersion: "1.0",
    compositor: "remotion",
    composition: FORMAT_COMPOSITIONS[formatId],
    fps: 30,
    dimensions: { width: 1080, height: 1920 },
    durationInFrames: alignment.totalFrames,
    audio: isReels
      ? {}
      : { narration: options.audioNarrationPath, music: options.musicPath, musicGainDb: -18 },
    scenes,
    captions: {
      file: isReels ? undefined : options.captionsSrtPath,
      style: isReels ? "none" : "tiktok",
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

  try {
    const cmd = `npx remotion render src/index.ts ${renderSpec.composition} "${outputPath}" --props="${specFilePath}"`;
    await execAsync(cmd, {
      cwd: REMOTION_COMPOSITOR_DIR,
      timeout: 180000, // 3 minutes timeout
    });

    return {
      success: true,
      outputPath,
      renderDurationMs: Date.now() - startAt,
      renderSpec,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      renderDurationMs: Date.now() - startAt,
      renderSpec,
    };
  }
}
