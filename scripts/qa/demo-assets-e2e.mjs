import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}

async function main() {
  console.log("=== Demo Assets E2E Integration Test ===");

  // 1. Seed brand and user
  console.log("1. Seeding database...");
  await runCommand("node", ["scripts/qa/seed-demo-assets.mjs", "--apply"]);
  console.log("   Seeding done.");

  // 2. Start the fixture server
  console.log("2. Starting fixture server...");
  const fixtureProcess = spawn("node", ["scripts/qa/demo-assets-fixtures.mjs", "--seed-job", "invoiceflow"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let fixturePort = null;
  let jobId = null;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      fixtureProcess.kill();
      reject(new Error("Timeout waiting for fixture server start"));
    }, 15000);

    fixtureProcess.stdout.on("data", (data) => {
      const text = data.toString();
      console.log(`   [fixture server] ${text.trim()}`);
      
      const portMatch = text.match(/FIXTURE_PORT=(\d+)/);
      if (portMatch) {
        fixturePort = parseInt(portMatch[1], 10);
      }

      const jobMatch = text.match(/JOB_ID=([a-zA-Z0-9_-]+)/);
      if (jobMatch) {
        jobId = jobMatch[1].trim();
      }

      if (fixturePort && jobId) {
        clearTimeout(timeout);
        resolve();
      }
    });

    fixtureProcess.stderr.on("data", (data) => {
      console.error(`   [fixture server error] ${data.toString()}`);
    });
  });

  console.log(`   Fixture server running on port: ${fixturePort}`);
  console.log(`   Created test Job ID: ${jobId}`);

  // 3. Run worker on target job
  console.log(`3. Running worker for job ${jobId}...`);
  try {
    const { stdout } = await runCommand(
      "npx",
      ["tsx", "scripts/demo-assets-worker.mjs", "--job-id", jobId],
      { DEMO_ASSETS_ALLOW_LOCAL_FIXTURES: "1", NODE_ENV: "development" }
    );
    console.log("   Worker output completed.");
  } catch (err) {
    console.error("   Worker failed!", err);
    fixtureProcess.kill("SIGINT");
    process.exit(1);
  }

  // 4. Verify results in DB and disk
  console.log("4. Verifying outputs...");
  const job = await prisma.demoAssetJob.findUnique({
    where: { id: jobId },
    include: {
      captureArtifacts: true,
      renderedAssets: true,
    },
  });

  if (!job) {
    fixtureProcess.kill("SIGINT");
    throw new Error("Job record disappeared from DB!");
  }

  console.log(`   Job Status: ${job.status}`);
  if (job.status !== "READY") {
    fixtureProcess.kill("SIGINT");
    throw new Error(`Job status is ${job.status}, expected READY. Reason: ${job.errorReason}`);
  }

  console.log(`   Capture Artifacts count: ${job.captureArtifacts.length}`);
  if (job.captureArtifacts.length < 3) {
    fixtureProcess.kill("SIGINT");
    throw new Error("Expected at least 3 capture artifacts (initial screenshot, full screenshot, metadata)");
  }

  console.log(`   Rendered Assets count: ${job.renderedAssets.length}`);
  if (job.renderedAssets.length === 0) {
    fixtureProcess.kill("SIGINT");
    throw new Error("No rendered assets found!");
  }

  // Verify files exist on disk
  for (const asset of job.renderedAssets) {
    try {
      await fs.access(asset.filePath);
      console.log(`   [Pass] File exists: ${path.basename(asset.filePath)} (${asset.fileSize} bytes)`);
    } catch {
      fixtureProcess.kill("SIGINT");
      throw new Error(`Rendered asset file not found on disk: ${asset.filePath}`);
    }
  }

  console.log("5. Cleaning up...");
  // Clean up assets from DB and disk
  await prisma.demoAssetJob.delete({ where: { id: jobId } });
  
  const assetDir = path.join(process.cwd(), ".data/demo-assets", jobId);
  try {
    await fs.rm(assetDir, { recursive: true, force: true });
    console.log(`   Removed local directory: ${assetDir}`);
  } catch (err) {
    console.warn(`   Failed to clean up directory ${assetDir}:`, err.message);
  }

  fixtureProcess.kill("SIGINT");
  console.log("\n=== E2E Integration Test PASSED Successfully! ===");
}

main()
  .catch(async (err) => {
    console.error("\n=== E2E Integration Test FAILED! ===");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
