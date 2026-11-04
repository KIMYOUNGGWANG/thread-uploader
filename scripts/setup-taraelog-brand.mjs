import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";

// 타래로그를 포트폴리오 제품(Brand)으로 등록하거나, 이미 있으면 제품 프로필·첫 실험 설정을 갱신한다.
// 기본은 dry-run이다. 실제로 쓰려면 --apply를 붙인다.
//
// 1) 등록 (실험은 paused, 시작 시각 없음)
//    node --env-file=.env scripts/setup-taraelog-brand.mjs --apply [--owner-email=me@example.com]
// 2) /brands/taraelog/settings에서 타래로그용 Threads 계정 연결
// 3) 실험 시작 (startedAt을 지금으로 기록, status active)
//    node --env-file=.env scripts/setup-taraelog-brand.mjs --apply --start
//
// 소유자를 지정하지 않으면 cosmicpath 제품의 소유자를 쓴다.
// 이미 시작한 실험에 --start를 다시 붙여도 시작 시각은 바뀌지 않는다.

const require = createRequire(import.meta.url);
const {
  TARAELOG_SLUG,
  TARAELOG_NAME,
  CAMPAIGN_ID,
  buildTaraelogBrandConfig,
} = require("./taraelog-brand-config.js");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const start = args.includes("--start");
const ownerEmail = readArg("--owner-email");
const prisma = new PrismaClient();

function readArg(name) {
  const prefix = `${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : undefined;
}

function parseStoredConfig(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function existingStartedAt(stored) {
  const experiment = stored.activeExperiment;
  if (!experiment || experiment.id !== CAMPAIGN_ID) return "";
  return typeof experiment.startedAt === "string" ? experiment.startedAt : "";
}

async function resolveOwnerId() {
  if (ownerEmail) {
    const user = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
    if (!user) throw new Error(`User not found: ${ownerEmail}`);
    return user.id;
  }
  const reference = await prisma.brand.findUnique({ where: { slug: "cosmicpath" }, select: { ownerId: true } });
  if (!reference) throw new Error("cosmicpath 제품이 없어 소유자를 정할 수 없습니다. --owner-email=로 지정하세요.");
  return reference.ownerId;
}

function describe(config) {
  const experiment = config.activeExperiment;
  console.log(`  landing: ${config.productProfile.landingUrl}`);
  console.log(`  campaign: ${config.activeCampaignId}, trust ${config.accountTrustTier}`);
  console.log(`  formulas: ${config.campaigns.find((c) => c.id === CAMPAIGN_ID).formulas.map((f) => `${f.id}:${f.weight}`).join(", ")}`);
  console.log(`  experiment: ${experiment.id} ${experiment.status} startedAt=${experiment.startedAt || "(미시작)"}`);
}

async function main() {
  const existing = await prisma.brand.findUnique({ where: { slug: TARAELOG_SLUG } });
  const now = new Date().toISOString();

  if (existing) {
    const stored = parseStoredConfig(existing.brandConfig);
    const previousStart = existingStartedAt(stored);
    if (start && !existing.threadsUserId) {
      throw new Error("Threads 계정이 아직 연결되지 않았습니다. 연결한 뒤 --start 하세요.");
    }
    const next = buildTaraelogBrandConfig(stored, {
      startedAt: previousStart || (start ? now : ""),
      accountTrustTier: typeof stored.accountTrustTier === "string" ? stored.accountTrustTier : undefined,
    });
    console.log(`[taraelog] 기존 제품 갱신: ${existing.name} (${existing.id})`);
    if (start && previousStart) console.log(`  이미 ${previousStart}에 시작한 실험이라 시작 시각을 유지합니다.`);
    describe(next);
    if (!apply) {
      console.log("[taraelog] dry-run입니다. 쓰려면 --apply를 붙이세요.");
      return;
    }
    await prisma.brand.update({ where: { id: existing.id }, data: { brandConfig: JSON.stringify(next) } });
    console.log("[taraelog] 갱신 완료.");
    return;
  }

  if (start) {
    throw new Error("타래로그 제품이 아직 없습니다. 먼저 --start 없이 등록하고 Threads 계정을 연결하세요.");
  }
  const ownerId = await resolveOwnerId();
  const config = buildTaraelogBrandConfig({});
  console.log(`[taraelog] 새 제품 생성: ${TARAELOG_NAME} (slug ${TARAELOG_SLUG}, owner ${ownerId})`);
  describe(config);
  if (!apply) {
    console.log("[taraelog] dry-run입니다. 쓰려면 --apply를 붙이세요.");
    return;
  }
  const brand = await prisma.brand.create({
    data: { name: TARAELOG_NAME, slug: TARAELOG_SLUG, ownerId, brandConfig: JSON.stringify(config) },
  });
  console.log(`[taraelog] 생성 완료: ${brand.id}`);
  console.log("다음 단계: /brands/taraelog/settings에서 Threads 계정을 연결한 뒤 --apply --start로 실험을 시작하세요.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
