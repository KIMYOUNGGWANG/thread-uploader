// queue-promo-posts.mjs — upload the PromoViral renders to Vercel Blob and queue them as
// NEEDS_REVIEW Threads video posts (KO → cosmicpath, EN → cosmicpath-global).
// Nothing is published here; approve the posts in the dashboard and the publish cron sends them.
// Idempotent: a brand that already has this promo post is skipped.
// Run from the repo root so the root .env.local is loaded:
//   node --env-file-if-exists=.env --env-file-if-exists=.env.local video/scripts/queue-promo-posts.mjs
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";

const videoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { PrismaClient } = createRequire(path.join(videoDir, "../package.json"))("@prisma/client");

const FORMULA_ID = "video:promo-viral-20261014";
const LANDING = "https://cosmicpath.app/start";

const ITEMS = [
  {
    slug: "cosmicpath",
    file: "out/cosmicpath-promo-ko.mp4",
    topic: "프로모 영상: 유료 리포트 투어 (KO)",
    content: [
      "운세 앱이 \"좋은 흐름이 오고 있어요\" 하면 솔직히 그래서 뭘 하라는 건지 모르겠더라.",
      "그래서 리포트 안을 그냥 다 까봤음.\n사주 4주, 12개월 흐름, 좋은 날·조심할 날, 자미두수 12궁까지. 엔진이 먼저 계산하고 AI는 해석만 함.\n마지막엔 7일 동안 뭘 해볼지, 언제 접을지까지 나옴.",
      "대신 결정해주진 않음. 결정할 기준을 줌.\n(영상 속 인물은 가상, 숫자는 엔진 실제 계산값)",
      "이직할까 버틸까, 너는 지금 뭐 고민 중임?",
    ].join("\n\n"),
    comment: (url) => `무료 진단부터 돌려봐 → ${url}`,
  },
  {
    slug: "cosmicpath-global",
    file: "out/cosmicpath-promo-en.mp4",
    topic: "Promo video: paid report tour (EN)",
    content: [
      "My horoscope app said \"good things are coming.\" Cool. So what do I actually do?",
      "So here's everything inside the report: Four Pillars, a 12-month flow, good days vs risky days, a Ziwei chart. The engines do the math first. AI only interprets.\nIt ends with a 7-day experiment and a stop rule: when to walk away.",
      "It won't decide for you. It gives you the criteria.\n(Fictional person in the video, real engine numbers.)",
      "Quit or stay: what are you stuck on right now?",
    ].join("\n\n"),
    comment: (url) => `Start with the free reading → ${url}`,
  },
];

for (const name of ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN"]) {
  if (!process.env[name]) throw new Error(`${name} is not set (run from the repo root with --env-file)`);
}

const prisma = new PrismaClient();

async function queue(item) {
  const brand = await prisma.brand.findUnique({ where: { slug: item.slug } });
  if (!brand) throw new Error(`brand ${item.slug} not found`);
  const existing = await prisma.post.findFirst({ where: { brandId: brand.id, formulaId: FORMULA_ID } });
  if (existing) return `[${item.slug}] already queued: ${existing.id} (${existing.status})`;

  const blob = await put(`videos/${item.slug}/promo-viral-20261014.mp4`, await readFile(path.join(videoDir, item.file)), {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const post = await prisma.post.create({
    data: {
      brandId: brand.id,
      content: item.content,
      imageUrls: JSON.stringify([blob.url]),
      scheduledAt: new Date(),
      status: "NEEDS_REVIEW",
      formulaId: FORMULA_ID,
      topic: item.topic,
      qualityReasons: JSON.stringify(["영상 포스트: 승인 후 발행"]),
    },
  });
  const linkUrl = `${LANDING}?utm_source=threads&utm_campaign=promo-video-20261014&utm_content=${post.id}`;
  await prisma.post.update({
    where: { id: post.id },
    data: { linkUrl, utmContent: post.id, firstComment: item.comment(linkUrl) },
  });
  return `[${item.slug}] queued ${post.id} → ${blob.url}`;
}

try {
  for (const item of ITEMS) console.log(await queue(item));
} finally {
  await prisma.$disconnect();
}
