#!/usr/bin/env node
// scripts/render-tiktok-worker.mjs — Asynchronous CLI/Background Worker for TikTok Video Rendering.
// Usage:
//   node scripts/render-tiktok-worker.mjs --once
//   node scripts/render-tiktok-worker.mjs --daemon
//   node scripts/render-tiktok-worker.mjs --dry-run

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Vendored Remotion compositor (same one CI uses for promo renders).
export const REMOTION_COMPOSITOR_DIR = path.join(process.cwd(), "video");

// Mirror of FORMAT_COMPOSITIONS in src/lib/tiktok/tiktok-draft-service.ts (keep in sync).
const FORMAT_COMPOSITIONS = {
  tiktok_explainer_vertical: "TikTokExplainer",
  ig_rank_10s: "IgRank10s",
  ig_pickcard_16s: "IgPickCard16s",
};

/**
 * Builds RenderSpec from script scenes for Remotion
 */
export function buildTikTokRenderSpec(scriptResult) {
  const fps = 30;
  const formatId = scriptResult.formatId in FORMAT_COMPOSITIONS ? scriptResult.formatId : "tiktok_explainer_vertical";
  const isReels = formatId !== "tiktok_explainer_vertical";
  let currentFrame = 0;
  let currentMs = 0;

  const sceneTimings = scriptResult.scenes.map((scene) => {
    const durationMs = Math.round(scene.durationSeconds * 1000);
    const durationFrames = Math.round(scene.durationSeconds * fps);
    const timing = {
      sceneId: scene.sceneId,
      fromFrame: currentFrame,
      durationInFrames: durationFrames,
      startMs: currentMs,
      endMs: currentMs + durationMs,
    };
    currentMs += durationMs;
    currentFrame += durationFrames;
    return timing;
  });

  const scenes = scriptResult.scenes.map((scene, idx) => {
    const timing = sceneTimings[idx];
    let visualType = "placeholder";
    let visualSrc = "#0b0d14";
    let cardData = undefined;

    if (scene.type === "saju-card") {
      visualType = "saju-card";
      visualSrc = "saju-chart";
      cardData = scene.visualProps?.sajuData;
    } else if (scene.type === "kinetic-card") {
      visualType = "kinetic-card";
      visualSrc = scene.visualProps?.hookText ?? scene.onScreenText?.[0] ?? "주목";
      cardData = {
        subText: scene.visualProps?.subText,
        badge: scene.visualProps?.badge,
        colorScheme: scene.visualProps?.colorScheme,
      };
    } else if (scene.type === "rank-card") {
      visualType = "rank-card";
      visualSrc = "rank-card";
      cardData = scene.visualProps?.rankCard;
    } else if (scene.type === "pick-card") {
      visualType = "pick-card";
      visualSrc = "pick-card";
      cardData = scene.visualProps?.pickCard;
    }

    const staticCard = ["saju-card", "rank-card", "pick-card"].includes(scene.type);
    return {
      id: scene.sceneId,
      fromFrame: timing?.fromFrame ?? 0,
      durationInFrames: timing?.durationInFrames ?? 90,
      visual: {
        type: visualType,
        src: visualSrc,
        kenBurns: !staticCard,
        cardData,
      },
      onScreenText: scene.onScreenText || [],
    };
  });

  return {
    schemaVersion: "1.0",
    compositor: "remotion",
    composition: FORMAT_COMPOSITIONS[formatId],
    fps: 30,
    dimensions: { width: 1080, height: 1920 },
    durationInFrames: currentFrame,
    scenes,
    captions: {
      style: isReels ? "none" : "tiktok",
      fontFamily: "Pretendard",
      maxWidthPct: 86,
      safeArea: { topPct: 8, bottomPct: 18, leftPct: 6, rightPct: 16 },
    },
    background: { type: "color", src: "#0b0d14" },
    seed: 42,
  };
}

// Mirror of draftToScriptResult in src/lib/tiktok/tiktok-draft-service.ts (plain node can't import the TS module).
// buildTikTokRenderSpec falls back to the default format for unknown ids, like parseFormatId.
export function draftToScriptResult(draft) {
  return {
    formatId: draft.formatId,
    title: draft.title,
    spokenHook: draft.spokenHook,
    fullScript: draft.script,
    totalDurationSeconds: draft.durationSeconds,
    scenes: JSON.parse(draft.sceneBeats || "[]"),
    cta: draft.cta,
  };
}

/**
 * Recovers any jobs stuck in RENDERING state for > 10 minutes
 */
export async function cleanStaleJobs(db = prisma, timeoutMs = STALE_TIMEOUT_MS) {
  const cutoff = new Date(Date.now() - timeoutMs);
  const staleDrafts = await db.tikTokVideoDraft.findMany({
    where: {
      status: "RENDERING",
      updatedAt: { lt: cutoff },
    },
  });

  if (staleDrafts.length === 0) return 0;

  console.log(`⚠️  Found ${staleDrafts.length} stale RENDERING draft(s). Resetting to TIMEOUT_FAILED...`);

  for (const draft of staleDrafts) {
    await db.tikTokVideoDraft.update({
      where: { id: draft.id },
      data: {
        status: "FAILED",
        qualityReasons: JSON.stringify(["Worker rendering timeout (exceeded 10 minutes)"]),
      },
    });
    console.log(`   - Reset draft ${draft.id} (${draft.title})`);
  }

  return staleDrafts.length;
}

/**
 * Polls and processes one QUEUED job
 */
export async function processNextJob(db = prisma, options = {}) {
  const draft = await db.tikTokVideoDraft.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  if (!draft) return null;

  // Dry run is read-only: no claim, no files, no status change. It only prints the spec the worker would render.
  if (options.dryRun) {
    const renderSpec = buildTikTokRenderSpec(draftToScriptResult(draft));
    console.log(`\n🔍 [DRY-RUN] Next job: ${draft.id} ("${draft.title}") → ${renderSpec.composition}`);
    console.log(JSON.stringify(renderSpec, null, 2));
    return { success: true, dryRun: true, draftId: draft.id, renderSpec };
  }

  console.log(`\n🎬 [WORKER] Claiming job: ${draft.id} ("${draft.title}")`);

  await db.tikTokVideoDraft.update({
    where: { id: draft.id },
    data: { status: "RENDERING" },
  });

  const startAt = Date.now();
  const runDir = path.join(process.cwd(), ".agents/results/videos", `tiktok-${draft.id}`);
  const outputPath = path.join(runDir, `${draft.id}.mp4`);

  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  try {
    const renderSpec = buildTikTokRenderSpec(draftToScriptResult(draft));
    const specFilePath = path.join(runDir, "render-spec.json");
    fs.writeFileSync(specFilePath, JSON.stringify(renderSpec, null, 2), "utf8");

    console.log(`   ⚡ Executing Remotion Render (timeout: 180s)...`);

    const cmd = `npx remotion render src/index.ts ${renderSpec.composition} "${outputPath}" --props="${specFilePath}"`;
    await execAsync(cmd, {
      cwd: REMOTION_COMPOSITOR_DIR,
      timeout: 180000,
    });

    await db.tikTokVideoDraft.update({
      where: { id: draft.id },
      data: {
        status: "COMPLETED",
        utmContent: outputPath,
      },
    });

    console.log(`   ✅ Video generated: ${outputPath} (${Date.now() - startAt}ms)`);
    return { success: true, draftId: draft.id, outputPath, durationMs: Date.now() - startAt };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`   ❌ Job ${draft.id} failed: ${errorMessage}`);

    await db.tikTokVideoDraft.update({
      where: { id: draft.id },
      data: {
        status: "FAILED",
        qualityReasons: JSON.stringify([errorMessage]),
      },
    });

    return { success: false, draftId: draft.id, error: errorMessage, durationMs: Date.now() - startAt };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isOnce = args.includes("--once");
  const isDryRun = args.includes("--dry-run");

  console.log("🚀 [TikTok Render Worker] Starting...");
  console.log(`   Mode: ${isOnce ? "Single Pass (--once)" : "Continuous Daemon"}`);
  console.log(`   Dry Run: ${isDryRun ? "YES" : "NO"}\n`);

  // Dry run leaves every draft as it is, so the next QUEUED draft would repeat forever: preview it once and exit.
  if (isDryRun) {
    const result = await processNextJob(prisma, { dryRun: true });
    if (!result) console.log("   No QUEUED drafts.");
    await prisma.$disconnect();
    process.exit(0);
  }

  // First, clean any stale jobs
  await cleanStaleJobs();

  if (isOnce) {
    let processed = 0;
    while (true) {
      const result = await processNextJob(prisma, { dryRun: isDryRun });
      if (!result) break;
      processed++;
    }
    console.log(`🏁 [TikTok Render Worker] Finished single pass. Processed ${processed} job(s).`);
    await prisma.$disconnect();
    process.exit(0);
  }

  // Daemon polling loop
  console.log("👀 Watching for QUEUED rendering jobs (polling every 4s)... Press Ctrl+C to exit.");
  while (true) {
    try {
      await cleanStaleJobs();
      await processNextJob(prisma, { dryRun: isDryRun });
    } catch (loopErr) {
      console.error("⚠️ Worker loop error:", loopErr);
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("💥 Fatal Worker Error:", err);
    process.exit(1);
  });
}
