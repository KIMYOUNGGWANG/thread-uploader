// queue-reels.mjs — 로컬에서 렌더한 릴스 mp4를 Vercel Blob에 올리고 /api/cron/promo-posts로
// NEEDS_REVIEW Threads 영상 글로 등록한다. 발행은 대시보드 승인 후 publish cron이 한다.
//   node --env-file=../.env --env-file=../.env.local scripts/queue-reels.mjs <manifest.json> [--dry-run]
// manifest: [{ "date": "YYYY-MM-DD", "file": "out/reels/x.mp4", "content": "캡션", "format": "ig_rank_10s", "topic": "..." }]
// date는 브랜드당 하루 한 편만 허용되는 중복 키라서, 편마다 올릴 날짜를 다르게 적는다.
import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";

const BRAND = "cosmicpath";
const APP_URL = (process.env.APP_URL ?? "https://thread-uploader.vercel.app").replace(/\/$/, "");
const COMMENT_TEMPLATE = "내 일간·카드 해석은 맛보기 리포트에서 1분이면 나와: {{link}}";

const [manifestPath, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
if (!manifestPath) throw new Error("manifest.json 경로가 필요해");

const items = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(items) || items.length === 0) throw new Error("manifest는 비어 있지 않은 배열이어야 해");

async function uploadVideo(item) {
  if (dryRun) return `https://blob.example/videos/${BRAND}/reels-${item.date}-${item.format}.mp4`;
  const blob = await put(`videos/${BRAND}/reels-${item.date}-${item.format}.mp4`, await readFile(item.file), {
    access: "public", contentType: "video/mp4", addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

async function queueOne(item, videoUrl) {
  const body = {
    date: item.date,
    items: [{ brandSlug: BRAND, videoUrl, content: item.content, commentTemplate: COMMENT_TEMPLATE, landingPath: "/start", format: item.format, topic: item.topic }],
  };
  if (dryRun) return { dryRun: true, ...body };
  const response = await fetch(`${APP_URL}/api/cron/promo-posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`/api/cron/promo-posts → ${response.status} ${JSON.stringify(json)}`);
  return json.results;
}

if (!dryRun && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN이 없어 (.env.local)");
if (!dryRun && !process.env.CRON_SECRET) throw new Error("CRON_SECRET이 없어");

for (const item of items) {
  const videoUrl = await uploadVideo(item);
  const result = await queueOne(item, videoUrl);
  console.log(`[${item.date}] ${item.format} → ${videoUrl}`);
  console.log("  ", JSON.stringify(result));
}
