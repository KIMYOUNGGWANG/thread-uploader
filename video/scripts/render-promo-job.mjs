// render-promo-job.mjs — twice-weekly promo rotation (render-promo.yml):
// pick variant → cosmicpath engines → validate → Remotion render → normalize → Blob → queue NEEDS_REVIEW posts.
// Like render-job.mjs, the runner never touches the database; /api/cron/promo-posts owns all writes.
// Imports the pure TS modules in src/promo directly (Node 22.18+ type stripping).
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { put } from "@vercel/blob";
import { pickPromoVariant } from "../src/promo/rotation.ts";
import { TOPIC_COPY, buildCaption, buildCommentTemplate, landingPathFor } from "../src/promo/copy.ts";
import { parsePromoSnapshot, validateSnapshot } from "../src/promo/snapshot.ts";
import { COMPOSITION_ID } from "../src/promo/types.ts";

const run = promisify(execFile);
const videoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_BY_LANG = { ko: "cosmicpath", en: "cosmicpath-global" };
const EXEC = { maxBuffer: 32 * 1024 * 1024, timeout: 10 * 60 * 1000 };

const { values } = parseArgs({
  options: {
    date: { type: "string", default: "" },
    format: { type: "string", default: "" },
    topic: { type: "string", default: "" },
    lang: { type: "string", default: "" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"];
const date = values.date || new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // KST today
const overrides = { ...(values.format && { format: values.format }), ...(values.topic && { topic: values.topic }) };
const langs = values.lang ? [values.lang] : ["ko", "en"];
const cosmicpathDir = process.env.COSMICPATH_DIR || path.resolve(videoDir, "../../cosmicpath");

if (!dryRun) {
  for (const name of ["APP_URL", "CRON_SECRET", "BLOB_READ_WRITE_TOKEN"]) {
    if (!process.env[name]) throw new Error(`${name} is not set`);
  }
}

async function extractSnapshot(variant, workDir) {
  const topic = TOPIC_COPY[variant.lang][variant.topic];
  const inputPath = path.join(workDir, `${variant.lang}-input.json`);
  const outputPath = path.join(workDir, `${variant.lang}-snapshot.json`);
  await writeFile(inputPath, JSON.stringify({ variant, scenarioA: topic.forkA, scenarioB: topic.forkB, question: topic.question }));
  await run(process.execPath, ["--no-warnings", path.join(videoDir, "scripts/extract-report-data.ts"), "--input", inputPath, "--out", outputPath],
    { ...EXEC, cwd: cosmicpathDir, env: { ...process.env, TZ: "UTC" } }); // production engines run on UTC
  const snapshot = parsePromoSnapshot(JSON.parse(await readFile(outputPath, "utf8")));
  const problems = validateSnapshot(snapshot, variant.format);
  if (problems.length > 0) throw new Error(`snapshot rejected: ${problems.join("; ")}`);
  return snapshot;
}

async function renderVideo(variant, snapshot, workDir) {
  const propsPath = path.join(workDir, `${variant.lang}-props.json`);
  const rawPath = path.join(workDir, `${variant.lang}-raw.mp4`);
  const finalPath = path.join(dryRun ? path.join(videoDir, "out") : workDir, `promo-${date}-${variant.lang}-${variant.format}.mp4`);
  await writeFile(propsPath, JSON.stringify({ lang: variant.lang, variant, snapshot }));
  await run(path.join(videoDir, "node_modules/.bin/remotion"),
    ["render", "src/index.ts", COMPOSITION_ID[variant.format], rawPath, `--props=${propsPath}`, "--log=error"], { ...EXEC, cwd: videoDir });
  // Remotion's JPEG frames come out as full-range yuvj420p; Threads wants plain yuv420p + AAC 48kHz.
  await run("ffmpeg", ["-loglevel", "error", "-y", "-i", rawPath, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-color_range", "tv", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", finalPath], EXEC);
  return finalPath;
}

async function uploadVideo(variant, file) {
  const blob = await put(`videos/${BRAND_BY_LANG[variant.lang]}/promo-${date}-${variant.format}.mp4`, await readFile(file), {
    access: "public", contentType: "video/mp4", addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

async function queuePosts(items) {
  const response = await fetch(`${process.env.APP_URL.replace(/\/$/, "")}/api/cron/promo-posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ date, items }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`/api/cron/promo-posts → ${response.status} ${JSON.stringify(body)}`);
  return body.results;
}

async function produce(lang, workDir) {
  const variant = pickPromoVariant(date, lang, overrides);
  console.log(`[${lang}] slot ${variant.slot} · ${variant.format} · ${variant.topic} · hook ${variant.hookIndex} · ${variant.persona.birthDate}`);
  const snapshot = await extractSnapshot(variant, workDir);
  const file = await renderVideo(variant, snapshot, workDir);
  if (dryRun) {
    console.log(`[${lang}] dry run → ${file}\n${buildCaption(variant)}`);
    return null;
  }
  return {
    brandSlug: BRAND_BY_LANG[lang], videoUrl: await uploadVideo(variant, file), content: buildCaption(variant),
    commentTemplate: buildCommentTemplate(lang, variant.format), landingPath: landingPathFor(variant.format),
    format: variant.format, topic: variant.topic,
  };
}

const workDir = await mkdtemp(path.join(tmpdir(), "promo-"));
const items = [];
let failed = false;
for (const lang of langs) {
  try {
    const item = await produce(lang, workDir);
    if (item) items.push(item);
  } catch (error) {
    failed = true;
    console.error(`[${lang}] ❌ ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (items.length > 0) {
  try {
    console.log(JSON.stringify(await queuePosts(items)));
  } catch (error) {
    failed = true;
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(failed ? 1 : 0);
