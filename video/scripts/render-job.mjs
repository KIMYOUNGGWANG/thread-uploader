// CI renderer: claim a draft from the app, render it with Remotion, upload to Vercel Blob, report back.
// The runner never touches the database; the app routes own all state transitions.
// Env: APP_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN, VIDEO_BRAND_SLUGS (comma-separated)
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";

const run = promisify(execFile);
const videoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { APP_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN } = process.env;
const slugs = (process.env.VIDEO_BRAND_SLUGS || "cosmicpath").split(",").map((slug) => slug.trim()).filter(Boolean);

for (const [name, value] of Object.entries({ APP_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN })) {
  if (!value) throw new Error(`${name} is not set`);
}

const appUrl = APP_URL.replace(/\/$/, "");
const authHeaders = { Authorization: `Bearer ${CRON_SECRET}` };

async function callApp(route, init = {}) {
  const response = await fetch(`${appUrl}${route}`, { ...init, headers: { ...authHeaders, ...init.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${route} → ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function renderAndUpload(job) {
  const workDir = await mkdtemp(path.join(tmpdir(), "render-"));
  const specPath = path.join(workDir, "render-spec.json");
  const outputPath = path.join(workDir, `${job.draftId}.mp4`);
  await writeFile(specPath, JSON.stringify(job.renderSpec));
  await run(path.join(videoDir, "node_modules/.bin/remotion"),
    ["render", "src/index.ts", job.renderSpec.composition, outputPath, `--props=${specPath}`],
    { cwd: videoDir, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const blob = await put(`videos/${job.brandSlug}/${job.draftId}.mp4`, await readFile(outputPath), {
    access: "public",
    contentType: "video/mp4",
    token: BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

let failed = false;
for (const slug of slugs) {
  const { job } = await callApp(`/api/cron/video-jobs/next?brands=${encodeURIComponent(slug)}`);
  if (!job) {
    console.log(`[${slug}] no video job today`);
    continue;
  }
  console.log(`[${slug}] rendering draft ${job.draftId}`);
  try {
    const videoUrl = await renderAndUpload(job);
    const result = await callApp("/api/cron/video-jobs/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: job.draftId, videoUrl }),
    });
    console.log(`[${slug}] ✅ ${videoUrl} → review post ${result.postId}`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${slug}] ❌ ${message}`);
    await callApp("/api/cron/video-jobs/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: job.draftId, error: message.slice(0, 500) }),
    }).catch((reportError) => console.error(`[${slug}] could not report failure: ${reportError.message}`));
  }
}

process.exit(failed ? 1 : 0);
