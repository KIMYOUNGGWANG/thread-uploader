import { PrismaClient } from "@prisma/client";

// Adds year-end season topics to the cosmicpath brand and points its campaign link at the 2027 calendar.
// Keeps existing topics; refill links still get utm_* on top of ?source=threads.
// Dry-run by default; pass --apply to write.
const prisma = new PrismaClient();

const NEW_YEAR_URL = "https://www.cosmicpath.app/2027?source=threads";
const CAMPAIGN_ID = "cosmicpath_viral_reset_v1";
// Two relationship + two other topics, so planTopicQuota keeps the axes balanced.
const YEAR_END_TOPICS = [
  "연말 평가·연봉협상 시즌, 이직/퇴사를 지금 움직일지 평가 끝나고 움직일지",
  "2027 신년 흐름 미리보기 (내년에 움직일 달과 버틸 달)",
  "연말에 먼저 연락할까 말까 (해 넘기기 전 연락해도 되는 관계와 참아야 하는 관계)",
  "연말 재회 신호 (연말에 다시 연락 오는 사람, 붙잡을지 놓을지)",
];

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const brand = await prisma.brand.findFirst({ where: { slug: "cosmicpath" } });
  if (!brand) throw new Error("Brand 'cosmicpath' not found");

  const parsed: unknown = JSON.parse(brand.brandConfig);
  if (!isRecord(parsed)) throw new Error("brandConfig is not an object");
  const config = parsed;

  const campaigns = Array.isArray(config.campaigns) ? config.campaigns : [];
  const campaign = campaigns.find((item): item is Json => isRecord(item) && item.id === CAMPAIGN_ID);
  if (!campaign) throw new Error(`Campaign '${CAMPAIGN_ID}' not found`);
  const topics = Array.isArray(config.topics) ? config.topics.filter((topic): topic is string => typeof topic === "string") : [];
  const nextTopics = [...new Set([...topics, ...YEAR_END_TOPICS])];

  console.log(`campaign ${CAMPAIGN_ID}.landingUrl:`, campaign.landingUrl, "->", NEW_YEAR_URL);
  console.log("topics (before):", topics);
  console.log("topics (after): ", nextTopics);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write.");
    return;
  }

  campaign.landingUrl = NEW_YEAR_URL;
  config.topics = nextTopics;
  await prisma.brand.update({ where: { id: brand.id }, data: { brandConfig: JSON.stringify(config) } });
  console.log("\nApplied.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
