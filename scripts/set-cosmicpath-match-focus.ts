import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";

// Points the cosmicpath brand at the compatibility funnel (/match/new) and a relationship topic axis.
// Dry-run by default; pass --apply to write.
const prisma = new PrismaClient();
const require = createRequire(import.meta.url);

const MATCH_URL = "https://www.cosmicpath.app/match/new";
const CAMPAIGN_ID = "cosmicpath_viral_reset_v1";
const TOPICS = [
  "썸 상대에게 지금 고백할지 기다릴지 판정",
  "헤어진 사람에게 먼저 연락해도 되는 시기 판정",
  "결혼 얘기가 나올 때 둘의 일간 궁합이 갈리는 지점",
  "연락 속도가 다른 두 사람의 관계 타이밍",
  "동업 제안을 받았을 때 둘의 기질 궁합 체크",
  "재회 후 다시 흔들릴 때 밀어붙일지 접을지 기준",
  "좋은 사람인데 나랑은 안 맞는 사람의 궁합 신호",
  "장거리 연애에서 둘의 흐름이 어긋나는 구간",
];

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readHierarchyInstruction(): string {
  const resetConfig: unknown = require("./cosmicpath-viral-reset-config.js");
  if (!isRecord(resetConfig) || typeof resetConfig.CONCEPT_HIERARCHY_INSTRUCTION !== "string") {
    throw new Error("cosmicpath-viral-reset-config.js must export CONCEPT_HIERARCHY_INSTRUCTION");
  }
  return resetConfig.CONCEPT_HIERARCHY_INSTRUCTION;
}

function findHierarchyFormula(campaign: Json): Json {
  const formulas = Array.isArray(campaign.formulas) ? campaign.formulas : [];
  const formula = formulas.find((item): item is Json => isRecord(item) && item.id === "concept_hierarchy");
  if (!formula) throw new Error(`Campaign '${CAMPAIGN_ID}' has no concept_hierarchy formula`);
  return formula;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const brand = await prisma.brand.findFirst({ where: { slug: "cosmicpath" } });
  if (!brand) throw new Error("Brand 'cosmicpath' not found");

  const parsed: unknown = JSON.parse(brand.brandConfig);
  if (!isRecord(parsed)) throw new Error("brandConfig is not an object");
  const config = parsed;

  const profile = isRecord(config.productProfile) ? config.productProfile : {};
  const campaigns = Array.isArray(config.campaigns) ? config.campaigns : [];
  const campaign = campaigns.find((item): item is Json => isRecord(item) && item.id === CAMPAIGN_ID);
  if (!campaign) throw new Error(`Campaign '${CAMPAIGN_ID}' not found`);
  const hierarchyFormula = findHierarchyFormula(campaign);
  const hierarchyInstruction = readHierarchyInstruction();

  console.log("productProfile.landingUrl:", profile.landingUrl, "->", MATCH_URL);
  console.log(`campaign ${CAMPAIGN_ID}.landingUrl:`, campaign.landingUrl, "->", MATCH_URL);
  console.log("topics (before):", config.topics);
  console.log("topics (after): ", TOPICS);
  // Career-era targets/situations got glued onto relationship topics; empty lets the relationship matrix supply them.
  console.log("targets/situations (before):", config.targets, config.situations, "-> []");
  console.log("concept_hierarchy.instruction:", hierarchyFormula.instruction, "->", hierarchyInstruction);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write.");
    return;
  }

  config.productProfile = { ...profile, landingUrl: MATCH_URL };
  campaign.landingUrl = MATCH_URL;
  config.topics = TOPICS;
  config.targets = [];
  config.situations = [];
  hierarchyFormula.instruction = hierarchyInstruction;
  await prisma.brand.update({ where: { id: brand.id }, data: { brandConfig: JSON.stringify(config) } });
  console.log("\nApplied.");
}

main().finally(() => prisma.$disconnect());
