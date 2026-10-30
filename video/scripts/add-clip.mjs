// Add a hook clip: upload a local image/video to Vercel Blob and register it as a ClipAsset.
// Usage: node --env-file=.env --env-file=.env.local video/scripts/add-clip.mjs \
//   --brand cosmicpath --mood 붓,탁자 --license https://... [--source stock|ai|own] [--dry-run] <file>
// Env: BLOB_READ_WRITE_TOKEN (not needed for --dry-run), DATABASE_URL (brand lookup + row creation)
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { del, put } from "@vercel/blob";

const execFileAsync = promisify(execFile);
const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { PrismaClient } = createRequire(import.meta.url)(path.join(repoDir, "node_modules/@prisma/client"));

const HOOK_SEC = 1.7;
const TYPES = {
  ".png": ["image", "image/png"],
  ".jpg": ["image", "image/jpeg"],
  ".jpeg": ["image", "image/jpeg"],
  ".webp": ["image", "image/webp"],
  ".mp4": ["video", "video/mp4"],
  ".webm": ["video", "video/webm"],
  ".mov": ["video", "video/quicktime"],
};
const SOURCES = ["stock", "ai", "own"];

// Every validation failure throws; the one catch below prints it and sets the exit code,
// so the `finally` (Prisma disconnect) always runs.
function fail(message) {
  throw new Error(message);
}

const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      brand: { type: "string" },
      mood: { type: "string" },
      license: { type: "string" },
      source: { type: "string", default: "stock" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const [file] = positionals;
  if (positionals.length !== 1) fail("로컬 파일 1개를 인자로 줘야 해");
  if (!values.brand) fail("--brand 필요");
  if (!values.license || !/^https?:\/\/\S+$/.test(values.license)) fail("--license 는 출처 http(s) URL 이어야 해");
  const mood = (values.mood ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (mood.length < 1) fail("--mood 에 태그 1개 이상 필요 (예: 붓,탁자)");
  if (!SOURCES.includes(values.source)) fail(`--source 는 ${SOURCES.join("|")} 중 하나`);

  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext];
  if (!type) fail(`지원하지 않는 확장자 ${ext || "(없음)"} (허용: ${Object.keys(TYPES).join(" ")})`);
  const [kind, contentType] = type;
  const size = (await stat(file).catch(() => fail(`파일을 읽을 수 없어: ${file}`))).size;

  let durationSec = null;
  if (kind === "video") {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
    ]);
    durationSec = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(durationSec)) fail("ffprobe 로 영상 길이를 못 읽었어");
    if (durationSec < HOOK_SEC) fail(`영상이 ${HOOK_SEC}초보다 짧아 (${durationSec.toFixed(2)}초)`);
  }

  const blobPath = `clips/${values.brand}/${randomUUID()}${ext}`;
  const dryRun = values["dry-run"];
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const brand = prisma ? await prisma.brand.findUnique({ where: { slug: values.brand } }) : null;
  if (prisma && !brand) fail(`브랜드 '${values.brand}' 가 없어`);
  if (!prisma && !dryRun) fail("DATABASE_URL 이 없어");

  const row = { source: values.source, kind, license: values.license, mood: JSON.stringify(mood), durationSec };

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true, file, bytes: size, blobPath, contentType,
      brand: brand ? { slug: brand.slug, id: brand.id } : `${values.brand} (DATABASE_URL 없어서 확인 안 함)`,
      clipAsset: { ...row, fileUrl: `<blob url of ${blobPath}>` },
    }, null, 2));
  } else {
    if (!token) fail("BLOB_READ_WRITE_TOKEN 이 없어");
    const blob = await put(blobPath, await readFile(file), {
      access: "public",
      contentType,
      allowOverwrite: false,
      token,
    });
    let clip;
    try {
      clip = await prisma.clipAsset.create({ data: { brandId: brand.id, fileUrl: blob.url, ...row } });
    } catch (createError) {
      // Compensate: the row was not created, so the uploaded file would be an orphan.
      try {
        await del(blob.url, { token });
      } catch (delError) {
        console.error(`add-clip: Blob 삭제 실패, 수동 정리 필요 → ${new URL(blob.url).host}/${blobPath} (${delError instanceof Error ? delError.message : String(delError)})`);
      }
      throw createError;
    }
    console.log(JSON.stringify({ id: clip.id, kind: clip.kind, source: clip.source, mood, durationSec, fileUrlHost: new URL(clip.fileUrl).host, blobPath }, null, 2));
  }
} catch (error) {
  console.error(`add-clip: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
}
