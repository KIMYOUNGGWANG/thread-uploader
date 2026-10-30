// Video factory CI runner: take today's kinetic-list job from the app, render it with HyperFrames,
// run the quality gate, upload passing renders to Vercel Blob, and report back.
// The runner never touches the database; the app routes own all state transitions.
// Env: APP_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN, VIDEO_FACTORY_BRANDS (comma-separated), VIDEO_FACTORY_FORCE=1
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import {
  judge,
  parseBlackIntervals,
  parseDuration,
  parseMeanVolumeDb,
  parsePsnrAverage,
} from "../../scripts/video-factory/qc-rules.mjs";

const execFileAsync = promisify(execFile);
const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const templateDir = path.join(repoDir, "hyperframes/templates/kinetic-list");
const HYPERFRAMES = "hyperframes@0.8.210";
const { APP_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN } = process.env;
const brands = process.env.VIDEO_FACTORY_BRANDS || "cosmicpath";
const force = process.env.VIDEO_FACTORY_FORCE === "1" || process.argv.includes("--force");

for (const [name, value] of Object.entries({ APP_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN })) {
  if (!value) throw new Error(`${name} is not set`);
}

const appUrl = APP_URL.replace(/\/$/, "");

async function callApp(route, init = {}) {
  const response = await fetch(`${appUrl}${route}`, {
    ...init,
    headers: { Authorization: `Bearer ${CRON_SECRET}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${route} → ${response.status} ${JSON.stringify(body)}`);
  return body;
}

// Child processes (npx-fetched hyperframes and its unlocked deps, ffmpeg) never need the secrets; only fetch/put use them.
const SECRET_ENV = ["CRON_SECRET", "BLOB_READ_WRITE_TOKEN", "ANTHROPIC_API_KEY", "DATABASE_URL", "DIRECT_URL"];
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !SECRET_ENV.includes(key)));

const run = (cmd, args, cwd) =>
  execFileAsync(cmd, args, { cwd, env: childEnv, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });

/** ffmpeg filters report on stderr; a missing stream fails the command but its stderr is still the answer. */
async function ffmpegStderr(args) {
  try {
    return (await run("ffmpeg", ["-hide_banner", "-nostats", ...args])).stderr;
  } catch (error) {
    if (typeof error?.stderr === "string") return error.stderr;
    throw error;
  }
}

/** Copy the template and bake this job's values into data-composition-variables defaults, so `check` sees the real text. */
async function prepareProject(job, workDir) {
  const projectDir = path.join(workDir, "project");
  await cp(templateDir, projectDir, { recursive: true });
  const variables = { ...job.variables };

  if (/^https:\/\//.test(variables.hookSrc)) {
    const response = await fetch(variables.hookSrc);
    if (!response.ok) throw new Error(`hook download ${response.status}: ${variables.hookSrc}`);
    const ext = path.extname(new URL(variables.hookSrc).pathname) || (variables.hookKind === "video" ? ".mp4" : ".jpg");
    variables.hookSrc = `assets/img/hook${ext}`;
    await writeFile(path.join(projectDir, variables.hookSrc), Buffer.from(await response.arrayBuffer()));
  }

  const indexPath = path.join(projectDir, "index.html");
  const html = await readFile(indexPath, "utf8");
  const match = html.match(/data-composition-variables='([^']*)'/);
  if (!match) throw new Error("template has no data-composition-variables");
  const declared = JSON.parse(match[1]).map((v) => (v.id in variables ? { ...v, default: variables[v.id] } : v));
  const attr = JSON.stringify(declared).replace(/&/g, "&amp;").replace(/'/g, "&#39;");
  await writeFile(indexPath, html.replace(match[0], () => `data-composition-variables='${attr}'`));
  return { projectDir, variables };
}

function countCheckErrors(report) {
  const count = Object.values(report).reduce((n, section) => n + (section?.errorCount ?? 0), 0);
  return report.ok === false ? Math.max(count, 1) : count;
}

async function measure(projectDir, videoPath, workDir) {
  // check exits non-zero when it finds errors; the JSON on stdout is still the report
  const check = await run("npx", ["--yes", HYPERFRAMES, "check", "--json"], projectDir).catch((error) => {
    if (typeof error?.stdout === "string" && error.stdout.trim().startsWith("{")) return error;
    throw error;
  });
  const checkErrors = countCheckErrors(JSON.parse(check.stdout));

  const probe = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", videoPath]);
  const black = await ffmpegStderr(["-i", videoPath, "-vf", "blackdetect=d=0.03", "-an", "-f", "null", "-"]);
  const volume = await ffmpegStderr(["-i", videoPath, "-af", "volumedetect", "-vn", "-f", "null", "-"]);

  const frames = [];
  for (let s = 0; s <= 8; s++) {
    const frame = path.join(workDir, `f${s}.png`);
    await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(s), "-i", videoPath, "-frames:v", "1", frame]);
    frames.push(frame);
  }
  const framePsnrs = [];
  for (let s = 0; s < 8; s++) {
    framePsnrs.push(parsePsnrAverage(await ffmpegStderr(["-i", frames[s], "-i", frames[s + 1], "-lavfi", "psnr", "-f", "null", "-"])));
  }

  return {
    checkErrors,
    durationSec: parseDuration(probe.stdout),
    blackIntervals: parseBlackIntervals(black),
    meanVolumeDb: parseMeanVolumeDb(volume),
    framePsnrs,
  };
}

async function upload(pathname, file, contentType) {
  const blob = await put(pathname, await readFile(file), {
    access: "public",
    contentType,
    token: BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true, // path is per draft; a re-claimed (stale) draft re-uploads to the same path
  });
  return blob.url;
}

async function renderJob(job) {
  const workDir = await mkdtemp(path.join(tmpdir(), "factory-"));
  const { projectDir, variables } = await prepareProject(job, workDir);
  const videoPath = path.join(workDir, "out.mp4");
  await run("npx", ["--yes", HYPERFRAMES, "render", "--strict-variables", "--variables", JSON.stringify(variables), "-o", videoPath], projectDir);

  const metrics = await measure(projectDir, videoPath, workDir);
  const verdict = judge(metrics);
  console.log(`[${job.brandSlug}] qc ${JSON.stringify({ ...metrics, ...verdict })}`);
  if (!verdict.pass) return { draftId: job.draftId, errors: verdict.errors };

  const coverPath = path.join(workDir, "cover.jpg");
  await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "1.5", "-i", videoPath, "-frames:v", "1", "-q:v", "2", coverPath]);
  const videoUrl = await upload(`${job.blobPrefix}.mp4`, videoPath, "video/mp4");
  const coverUrl = await upload(`${job.blobPrefix}.jpg`, coverPath, "image/jpeg");
  return { draftId: job.draftId, videoUrl, coverUrl };
}

const { job } = await callApp(`/api/cron/video-factory/next?brands=${encodeURIComponent(brands)}${force ? "&force=1" : ""}`);
if (!job) {
  console.log(`[${brands}] no video factory job today`);
  process.exit(0);
}

console.log(`[${job.brandSlug}] rendering draft ${job.draftId}`);
let result;
try {
  result = await renderJob(job);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${job.brandSlug}] runner error: ${message}`);
  await callApp("/api/cron/video-factory/complete", {
    method: "POST",
    body: JSON.stringify({ draftId: job.draftId, errors: [`runner: ${message.slice(0, 500)}`] }),
  }).catch((reportError) => console.error(`[${job.brandSlug}] could not report failure: ${reportError.message}`));
  process.exit(1);
}

await callApp("/api/cron/video-factory/complete", { method: "POST", body: JSON.stringify(result) });
console.log(result.errors ? `[${job.brandSlug}] FAILED qc: ${result.errors.join("; ")}` : `[${job.brandSlug}] COMPLETED ${result.videoUrl}`);
