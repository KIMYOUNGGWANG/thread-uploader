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

/**
 * Builds RenderSpec from script scenes for Remotion
 */
export function buildTikTokRenderSpec(scriptResult) {
  const fps = 30;
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
      onScreenText: scene.onScreenText || [],
    };
  });

  return {
    schemaVersion: "1.0",
    compositor: "remotion",
    composition: "TikTokExplainer",
    fps: 30,
    dimensions: { width: 1080, height: 1920 },
    durationInFrames: currentFrame,
    scenes,
    captions: {
      style: "tiktok",
      fontFamily: "Pretendard",
      maxWidthPct: 86,
      safeArea: { topPct: 8, bottomPct: 18, leftPct: 6, rightPct: 16 },
    },
    background: { type: "color", src: "#0b0d14" },
    seed: 42,
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
    const scenes = JSON.parse(draft.sceneBeats || "[]");
    const scriptResult = {
      title: draft.title,
      spokenHook: draft.spokenHook,
      fullScript: draft.script,
      totalDurationSeconds: draft.durationSeconds,
      scenes,
      cta: draft.cta,
    };

    const renderSpec = buildTikTokRenderSpec(scriptResult);
    const specFilePath = path.join(runDir, "render-spec.json");
    fs.writeFileSync(specFilePath, JSON.stringify(renderSpec, null, 2), "utf8");

    if (options.dryRun) {
      console.log(`   [DRY-RUN] RenderSpec generated at: ${specFilePath}`);
      await db.tikTokVideoDraft.update({
        where: { id: draft.id },
        data: {
          status: "COMPLETED",
          utmContent: outputPath,
        },
      });
      console.log(`   ✅ Job ${draft.id} completed (Dry Run) in ${Date.now() - startAt}ms`);
      return { success: true, draftId: draft.id, outputPath, durationMs: Date.now() - startAt };
    }

    const remotionDir = path.join(process.cwd(), ".agent/skills/oma-video/resources/remotion");
    console.log(`   ⚡ Executing Remotion Render (timeout: 180s)...`);

    const cmd = `npx remotion render src/index.ts TikTokExplainer "${outputPath}" --props="${specFilePath}"`;
    await execAsync(cmd, {
      cwd: remotionDir,
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
