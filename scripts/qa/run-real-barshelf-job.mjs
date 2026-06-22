import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";

const prisma = new PrismaClient();

async function runWorker(jobId) {
  return new Promise((resolve, reject) => {
    console.log(`[Scratch] Spawning worker for job ${jobId}...`);
    // Run worker WITHOUT local fixtures so it fetches the live App Store page
    const proc = spawn("npx", ["tsx", "scripts/demo-assets-worker.mjs", "--job-id", jobId], {
      env: {
        ...process.env,
        NODE_ENV: "development",
        DEMO_ASSETS_ALLOW_LOCAL_FIXTURES: "0", // Visit the live App Store page
      },
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log("=== Creating Real Demo Asset Job ===");

  const brandId = "ulw_qa_demo_assets_brand_id";
  const productUrl = "https://apps.apple.com/ca/app/barshelf-home-bar-ai/id6754469129";

  // Confirm brand exists
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    throw new Error(`Brand ${brandId} not found. Please run seed script first!`);
  }

  // Create job
  const job = await prisma.demoAssetJob.create({
    data: {
      brandId,
      productUrl,
      productContext: "A beautiful bookmarking app for mixologists and bartenders. Discover and save cocktail recipes.",
      style: "both",
      videoCount: 1,
      imageCount: 2,
      status: "QUEUED",
    },
  });

  console.log(`Created Job ID: ${job.id}`);

  // Run the worker
  try {
    await runWorker(job.id);
    console.log("\n=== Job processing finished successfully! ===");
    
    // Fetch and show results
    const finishedJob = await prisma.demoAssetJob.findUnique({
      where: { id: job.id },
      include: { renderedAssets: true },
    });
    
    console.log(`Finished job status: ${finishedJob.status}`);
    console.log("Rendered Assets:");
    for (const asset of finishedJob.renderedAssets) {
      console.log(` - [${asset.type}] ${asset.filePath} (${asset.fileSize} bytes)`);
    }
  } catch (err) {
    console.error("\n=== Job processing failed! ===");
    console.error(err);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
