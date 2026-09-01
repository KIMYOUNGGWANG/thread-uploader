/**
 * cron-daemon.mjs
 * Integrated background maintenance worker for Threads Uploader / Portfolio Growth OS
 *
 * Runs:
 * 1. Token refresh (every 6h or when within 14 days of expiry)
 * 2. First comment recovery (every 1h)
 * 3. Growth metrics fetch (every 24h)
 *
 * Usage:
 *   node scripts/cron-daemon.mjs --once     # Run all checks once and exit
 *   node scripts/cron-daemon.mjs --daemon   # Keep running on schedule
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// Load env files
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(root, envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const isDaemon = process.argv.includes("--daemon");

function runScript(scriptRelativePath, args = "") {
  const scriptPath = path.resolve(root, scriptRelativePath);
  const runner = (scriptRelativePath.endsWith(".ts") || scriptRelativePath.endsWith(".mjs")) ? "npx tsx" : "node";
  console.log(`\n[${new Date().toISOString()}] ⏳ Running: ${runner} ${scriptRelativePath} ${args}`);
  try {
    const output = execSync(`${runner} ${scriptPath} ${args}`, {
      cwd: root,
      encoding: "utf-8",
      env: process.env,
      stdio: "pipe",
    });
    console.log(output.trim());
    console.log(`[${new Date().toISOString()}] ✅ Finished: ${scriptRelativePath}`);
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed: ${scriptRelativePath}`);
    if (error.stdout) console.log(error.stdout.toString().trim());
    if (error.stderr) console.error(error.stderr.toString().trim());
    return false;
  }
}

async function runCycle() {
  console.log(`\n========================================`);
  console.log(`🔄 Maintenance Cycle Started: ${new Date().toISOString()}`);
  console.log(`========================================`);

  // 1. Refresh long-lived tokens
  runScript("scripts/refresh-token-standalone.js");

  // 2. Recover missing/failed first comments
  runScript("scripts/retry-first-comments.js");

  // 3. Collect growth metrics
  runScript("scripts/fetch-metrics-standalone.js");

  // 4. Run growth learning loop and update adaptive weights
  runScript("scripts/learn-standalone.mjs");

  // 5. Run viral discovery and pattern learning
  runScript("scripts/discover-viral-standalone.js");

  console.log(`\n========================================`);
  console.log(`🏁 Maintenance Cycle Finished: ${new Date().toISOString()}`);
  console.log(`========================================\n`);
}

async function main() {
  if (!isDaemon) {
    await runCycle();
    process.exit(0);
  }

  console.log("🚀 Starting Threads Maintenance Daemon...");
  console.log("⏰ Schedule: Cycle runs every 1 hour. Token refresh, comment recovery, metrics check.");

  // Run initial cycle
  await runCycle();

  // Run every 1 hour (3600000 ms)
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error("Error in daemon cycle:", err);
    }
  }, ONE_HOUR);
}

main().catch((err) => {
  console.error("Fatal daemon error:", err);
  process.exit(1);
});
