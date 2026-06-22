import { PrismaClient } from "@prisma/client";
import { runPlaywrightCapture } from "../src/lib/demo-assets/capture-runner.ts";
import { generateCreativePlan } from "../src/lib/demo-assets/creative-planner.ts";
import { runQualityGate } from "../src/lib/demo-assets/quality-gate.ts";
import { buildRenderPlan, buildImageRenderPlan } from "../src/lib/demo-assets/render-plan.ts";
import { renderVideo, renderImage } from "../src/lib/demo-assets/renderer.ts";
import { saveRenderedAsset } from "../src/lib/demo-assets/storage.ts";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Worker configuration
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;
const HEARTBEAT_INTERVAL_MS = 30_000;
const LOCK_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

async function main() {
  const once = process.argv.includes("--once");
  const stageArg = process.argv.indexOf("--stage");
  const stage = stageArg !== -1 ? process.argv[stageArg + 1] : "all";
  const jobIdArg = process.argv.indexOf("--job-id");
  const targetJobId = jobIdArg !== -1 ? process.argv[jobIdArg + 1] : null;

  const workerId = `worker_${process.pid}`;

  // Find a job to process
  let job = null;
  if (targetJobId) {
    job = await prisma.demoAssetJob.findUnique({ where: { id: targetJobId } });
  } else {
    // Claim one job that needs work
    const claimableStatuses = stage === "all"
      ? ["QUEUED", "PLANNING", "RENDERING"]
      : [getStatusForStage(stage)];

    const claimableJob = await prisma.demoAssetJob.findFirst({
      where: {
        status: { in: claimableStatuses },
        attemptCount: { lt: MAX_ATTEMPTS },
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: new Date(Date.now() - LOCK_EXPIRY_MS) } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    if (claimableJob) {
      try {
        job = await prisma.demoAssetJob.update({
          where: { id: claimableJob.id, lockedBy: claimableJob.lockedBy },
          data: {
            lockedBy: workerId,
            lockedAt: new Date(),
            heartbeatAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });
      } catch {
        job = null;
      }
    }
  }

  if (!job) {
    console.log("No jobs to process.");
    return;
  }

  // If manually triggered, claim the lock
  if (targetJobId && job.lockedBy !== workerId) {
    job = await prisma.demoAssetJob.update({
      where: { id: job.id },
      data: {
        lockedBy: workerId,
        lockedAt: new Date(),
        heartbeatAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
  }

  console.log(`[worker] Processing job ${job.id} (status: ${job.status}, stage: ${stage})`);

  const outputDir = path.join(__dirname, "../.data/demo-assets", job.id);

  // Heartbeat interval
  const heartbeat = setInterval(async () => {
    try {
      await prisma.demoAssetJob.update({
        where: { id: job.id },
        data: { heartbeatAt: new Date() },
      });
    } catch {
      // Ignore heartbeat failures
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // =============================================
    // STAGE 1: CAPTURE
    // =============================================
    if (job.status === "QUEUED" || (stage === "all" && job.status === "QUEUED")) {
      await updateStatus(job.id, "CAPTURING");
      console.log(`[worker] Capturing URL: ${job.productUrl}`);

      const captureResult = await runPlaywrightCapture(job.id, job.productUrl, outputDir);

      // Save capture artifacts
      await prisma.demoCaptureArtifact.deleteMany({ where: { jobId: job.id } });
      await prisma.demoCaptureArtifact.createMany({
        data: [
          {
            jobId: job.id,
            type: "SCREENSHOT_INITIAL",
            filePath: captureResult.screenshotInitialPath,
          },
          {
            jobId: job.id,
            type: "SCREENSHOT_FULL",
            filePath: captureResult.screenshotFullPath,
          },
          ...captureResult.sectionScreenshots.map((filePath) => ({
            jobId: job.id,
            type: "SCREENSHOT_ELEMENT",
            filePath,
          })),
          {
            jobId: job.id,
            type: "TEXT_BLOCKS",
            filePath: "",
            metaData: JSON.stringify(captureResult.textBlocks),
          },
          {
            jobId: job.id,
            type: "METADATA",
            filePath: "",
            metaData: JSON.stringify({
              title: captureResult.title,
              description: captureResult.description,
              ctas: captureResult.ctas,
            }),
          },
        ],
      });

      console.log("[worker] CAPTURED");

      if (stage === "capture") {
        await updateStatus(job.id, "PLANNING", { unlock: true });
        return;
      }

      // Fall through to planning
      job = await updateStatus(job.id, "PLANNING");
    }

    const stylesToRender = job.style === "both" ? ["clean-product-demo", "social-proof-teaser"] : [job.style];

    // =============================================
    // STAGE 2: PLANNING
    // =============================================
    if (job.status === "PLANNING") {
      console.log("[worker] Generating creative plan(s)...");

      // Rebuild capture result from DB artifacts
      const captureResult = await rebuildCaptureResult(job.id);

      for (const currentStyle of stylesToRender) {
        const creativePlan = await generateCreativePlan(
          job.id,
          currentStyle,
          captureResult,
          job.productContext || undefined,
        );

        // Quality gate
        const qualityResult = runQualityGate(creativePlan);

        if (!qualityResult.passed) {
          const errorSummary = qualityResult.errors.map((e) => `${e.code}: ${e.message}`).join("; ");
          console.error(`[worker] Quality gate FAILED for ${currentStyle}: ${errorSummary}`);
          continue; // Skip this style but try others
        }

        if (qualityResult.warnings.length > 0) {
          console.warn(`[worker] Quality warnings for ${currentStyle}: ${qualityResult.warnings.map((w) => w.code).join(", ")}`);
        }

        // Save creative plan as metadata artifact
        await prisma.demoCaptureArtifact.create({
          data: {
            jobId: job.id,
            type: "METADATA",
            filePath: "",
            metaData: JSON.stringify({
              type: "creative_plan",
              style: currentStyle,
              plan: creativePlan,
              qualityGate: qualityResult,
            }),
          },
        });

        console.log(`[worker] PLANNED ${currentStyle} (${creativePlan.scenes.length} scenes, ${(creativePlan.totalDurationFrames / creativePlan.fps).toFixed(1)}s)`);
      }

      if (stage === "plan") {
        await updateStatus(job.id, "RENDERING", { unlock: true });
        return;
      }

      // Fall through to rendering
      job = await updateStatus(job.id, "RENDERING");
    }

    // =============================================
    // STAGE 3: RENDERING
    // =============================================
    if (job.status === "RENDERING") {
      console.log("[worker] Rendering assets...");

      // Retrieve creative plans from DB
      const planArtifacts = await prisma.demoCaptureArtifact.findMany({
        where: {
          jobId: job.id,
          type: "METADATA",
          metaData: { contains: "creative_plan" },
        },
      });

      if (planArtifacts.length === 0) {
        throw new Error("MISSING_CREATIVE_PLAN");
      }

      for (const planArtifact of planArtifacts) {
        const planData = JSON.parse(planArtifact.metaData);
        // Ensure we only process creative plans (and handle legacy artifacts)
        if (planData.type !== "creative_plan") continue;
        
        const creativePlan = planData.plan;
        const currentStyle = planData.style || creativePlan.style;

        // Convert local absolute file paths (file://) to base64 Data URIs
        for (const scene of creativePlan.scenes) {
          for (const layer of scene.layers) {
            if (layer.type === "device" && layer.source && layer.source.startsWith("file://")) {
              try {
                const fsPath = layer.source.replace("file://", "");
                // Dynamically import fs to avoid top-level issues, or just use fs (already imported top-level)
                const fileBuffer = await fs.readFile(fsPath);
                const base64 = fileBuffer.toString("base64");
                layer.source = `data:image/png;base64,${base64}`;
              } catch (err) {
                console.error(`[worker] Failed to convert local file to base64: ${layer.source}`, err);
              }
            }
          }
        }

        // Build render plans
        const videoRenderPlan = buildRenderPlan(creativePlan);
        const imageRenderPlans = [];
        for (let sceneIndex = 0; sceneIndex < Math.min(creativePlan.scenes.length, job.imageCount || 3); sceneIndex++) {
          imageRenderPlans.push(buildImageRenderPlan(creativePlan, sceneIndex));
        }

        // Render videos
        const videoCount = job.videoCount || 1;
        for (let videoIndex = 0; videoIndex < videoCount; videoIndex++) {
          console.log(`[worker] Rendering ${currentStyle} video ${videoIndex + 1}/${videoCount}...`);
          try {
            const videoResult = await renderVideo(videoRenderPlan, outputDir, videoIndex);
            await saveRenderedAsset(prisma, {
              jobId: job.id,
              type: "VIDEO",
              style: currentStyle,
              filePath: videoResult.outputPath,
              mimeType: "video/mp4",
              fileSize: videoResult.fileSize,
              sha256: videoResult.sha256,
            });
            console.log(`[worker] Video ${videoIndex + 1} rendered: ${videoResult.outputPath}`);
          } catch (renderError) {
            console.error(`[worker] Video render ${videoIndex + 1} for ${currentStyle} failed:`, renderError);
          }
        }

        // Render images
        for (let imageIndex = 0; imageIndex < imageRenderPlans.length; imageIndex++) {
          console.log(`[worker] Rendering ${currentStyle} image ${imageIndex + 1}/${imageRenderPlans.length}...`);
          try {
            const imageResult = await renderImage(imageRenderPlans[imageIndex], outputDir, imageIndex);
            await saveRenderedAsset(prisma, {
              jobId: job.id,
              type: "IMAGE",
              style: currentStyle,
              filePath: imageResult.outputPath,
              mimeType: "image/png",
              fileSize: imageResult.fileSize,
              sha256: imageResult.sha256,
            });
            console.log(`[worker] Image ${imageIndex + 1} rendered: ${imageResult.outputPath}`);
          } catch (renderError) {
            console.error(`[worker] Image render ${imageIndex + 1} for ${currentStyle} failed:`, renderError);
          }
        }
      } // End of planArtifacts loop

      // Check if at least one asset was rendered
      const renderedAssets = await prisma.demoRenderedAsset.findMany({
        where: { jobId: job.id },
      });

      if (renderedAssets.length === 0) {
        throw new Error("NO_ASSETS_RENDERED");
      }

      console.log(`[worker] READY (${renderedAssets.length} assets rendered)`);
      await updateStatus(job.id, "READY", { unlock: true });
    }
  } catch (error) {
    const failStatus = getFailStatus(job.status);
    console.error(`[worker] ${failStatus}`, error);
    await updateStatus(job.id, failStatus, {
      unlock: true,
      errorReason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearInterval(heartbeat);
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getStatusForStage(stage) {
  switch (stage) {
    case "capture": return "QUEUED";
    case "plan": return "PLANNING";
    case "render": return "RENDERING";
    default: return "QUEUED";
  }
}

function getFailStatus(currentStatus) {
  switch (currentStatus) {
    case "QUEUED":
    case "CAPTURING": return "FAILED_CAPTURE";
    case "PLANNING": return "FAILED_PLAN";
    case "RENDERING": return "FAILED_RENDER";
    default: return "FAILED_CAPTURE";
  }
}

async function updateStatus(jobId, status, options = {}) {
  const data = {
    status,
    heartbeatAt: new Date(),
  };
  if (options.unlock) {
    data.lockedBy = null;
    data.lockedAt = null;
    data.heartbeatAt = null;
  }
  if (options.errorReason) {
    data.errorReason = options.errorReason;
  }
  return prisma.demoAssetJob.update({ where: { id: jobId }, data });
}

async function rebuildCaptureResult(jobId) {
  const artifacts = await prisma.demoCaptureArtifact.findMany({
    where: { jobId },
  });

  let title = "";
  let description = "";
  let textBlocks = [];
  let ctas = [];
  let screenshotInitialPath = "";
  let screenshotFullPath = "";
  const sectionScreenshots = [];

  for (const artifact of artifacts) {
    switch (artifact.type) {
      case "SCREENSHOT_INITIAL":
        screenshotInitialPath = artifact.filePath;
        break;
      case "SCREENSHOT_FULL":
        screenshotFullPath = artifact.filePath;
        break;
      case "SCREENSHOT_ELEMENT":
        sectionScreenshots.push(artifact.filePath);
        break;
      case "TEXT_BLOCKS":
        textBlocks = artifact.metaData ? JSON.parse(artifact.metaData) : [];
        break;
      case "METADATA": {
        if (artifact.metaData && !artifact.metaData.includes("creative_plan")) {
          const meta = JSON.parse(artifact.metaData);
          title = meta.title || "";
          description = meta.description || "";
          ctas = meta.ctas || [];
        }
        break;
      }
    }
  }

  return {
    screenshotInitialPath,
    screenshotFullPath,
    sectionScreenshots,
    textBlocks,
    ctas,
    title,
    description,
    actionLog: [],
  };
}

main()
  .catch((error) => {
    console.error("[worker] Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
