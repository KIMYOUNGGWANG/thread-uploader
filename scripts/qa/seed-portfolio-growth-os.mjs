import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv();

export const QA_IDS = {
  mainUser: "ulw_qa_user_portfolio",
  emptyUser: "ulw_qa_user_empty_portfolio",
  cosmicPathProduct: "ulw_qa_product_cosmicpath",
  missingPromptProduct: "ulw_qa_product_missing_prompt",
  noPostsProduct: "ulw_qa_product_no_posts",
};

const QA_EMAILS = {
  mainUser: "ulw-qa@example.test",
  emptyUser: "ulw-qa-empty@example.test",
};

const TOKEN_EXPIRY = new Date("2035-01-01T00:00:00.000Z");
const PRODUCT_GROWTH_BASELINE = {
  id: "product_growth_baseline",
  name: "제품 성장 baseline",
  mode: "landing-test",
  qualityProfile: "product_growth",
  landingUrl: "",
  utmSource: "threads",
  utmCampaign: "product_growth_baseline",
  utmContentTemplate: "{{postId}}",
  dailyPostTarget: 3,
  linkCadenceEvery: 3,
  linkPlacement: "firstComment",
  formulas: [
    {
      id: "comment_diagnosis",
      name: "고객 문제 진단형",
      weight: 3,
      instruction: "타깃 고객이 겪는 문제를 묻고 댓글로 현재 상황을 남기게 만든다.",
    },
    {
      id: "friend_tag",
      name: "상황 공유형",
      weight: 2,
      instruction: "같은 문제를 겪는 사람에게 공유하고 싶게 만드는 제품 문제/오퍼 구조로 작성한다.",
    },
    {
      id: "self_confession",
      name: "운영자 관찰형",
      weight: 2,
      instruction: "제품을 만들며 관찰한 고객 문제에서 시작해 오퍼 약속으로 연결한다.",
    },
  ],
  replyPlaybook: {
    stay: "지금 겪는 상황을 조금 더 알려주시면 어떤 흐름에서 막히는지 같이 정리해볼게요.",
    move: "그 문제라면 지금 쓰는 방식보다 제품으로 줄일 수 있는 시간이 클 수 있어요.",
    prepare: "바로 바꾸기 어렵다면 가장 자주 반복되는 작업 하나부터 적어보세요.",
    cta: "자세히 확인하려면 링크에서 제품 흐름을 먼저 확인해보세요.",
  },
};

function buildProductConfig(input) {
  const productCampaign = {
    ...PRODUCT_GROWTH_BASELINE,
    landingUrl: input.landingUrl,
    utmCampaign: input.experimentId,
  };

  return {
    systemPrompt: input.systemPrompt,
    topics: input.topics,
    targets: [input.targetCustomer],
    situations: [],
    websiteUrl: input.landingUrl,
    formulas: [],
    productProfile: {
      productName: input.productName,
      oneLineDescription: input.oneLineDescription,
      targetCustomer: input.targetCustomer,
      offerPromise: input.offerPromise,
      landingUrl: input.landingUrl,
      primaryChannel: "threads",
      primaryMetric: "views",
      conversionMetric: "conversions",
      positioningNotes: input.positioningNotes,
    },
    activeExperiment: {
      id: input.experimentId,
      name: input.experimentName,
      hypothesis: input.hypothesis,
      stage: "content",
      startedAt: "2026-06-04T00:00:00.000Z",
      durationDays: 7,
      primaryMetric: "views",
      guardrailMetric: "quality_pass_rate",
      status: "active",
    },
    ...(input.useCareerPreset ? {} : {
      campaigns: [productCampaign],
      activeCampaignId: productCampaign.id,
      qualityProfile: "product_growth",
      tiktokVideo: {
        enabled: false,
        parentCampaignId: productCampaign.id,
        defaultDurationSeconds: 25,
        landingUrl: "",
        qualityProfile: "tiktok_career_timing",
        formats: [],
      },
    }),
  };
}

export const QA_PRODUCTS = [
  {
    id: QA_IDS.cosmicPathProduct,
    name: "CosmicPath",
    slug: "ulw-qa-cosmicpath",
    threadsUserId: "ulw_qa_threads_cosmicpath",
    ownerId: QA_IDS.mainUser,
    brandConfig: buildProductConfig({
      productName: "CosmicPath",
      oneLineDescription: "Career timing insight product for decision anxiety.",
      targetCustomer: "20-35 career decision makers",
      offerPromise: "Clarify whether to stay, move, or prepare before making a career decision.",
      landingUrl: "/career/uncertainty",
      positioningNotes: "Use CosmicPath as one owned product, not the whole app identity.",
      systemPrompt: "You write concise Korean Threads posts for CosmicPath career timing experiments.",
      topics: ["퇴사 타이밍", "이직 고민", "번아웃 신호"],
      experimentId: "career_timing_wedge_399",
      experimentName: "Career timing wedge",
      hypothesis: "Career timing posts with comment diagnosis will drive qualified attention.",
      useCareerPreset: true,
    }),
  },
  {
    id: QA_IDS.missingPromptProduct,
    name: "Missing Prompt Product",
    slug: "ulw-qa-missing-prompt",
    threadsUserId: "ulw_qa_threads_missing_prompt",
    ownerId: QA_IDS.mainUser,
    brandConfig: buildProductConfig({
      productName: "Missing Prompt Product",
      oneLineDescription: "QA product with no system prompt.",
      targetCustomer: "QA operator",
      offerPromise: "Trigger missing prompt validation.",
      landingUrl: "/qa/missing-prompt",
      positioningNotes: "This fixture must keep systemPrompt empty.",
      systemPrompt: "",
      topics: ["QA topic"],
      experimentId: "missing_prompt_validation",
      experimentName: "Missing prompt validation",
      hypothesis: "Generate should reject this fixture before calling an LLM.",
    }),
  },
  {
    id: QA_IDS.noPostsProduct,
    name: "No Posts Product",
    slug: "ulw-qa-no-posts",
    threadsUserId: "ulw_qa_threads_no_posts",
    ownerId: QA_IDS.mainUser,
    brandConfig: buildProductConfig({
      productName: "No Posts Product",
      oneLineDescription: "QA product with no generated posts.",
      targetCustomer: "QA operator",
      offerPromise: "Verify empty learning states.",
      landingUrl: "/qa/no-posts",
      positioningNotes: "Seed apply removes posts for this fixed product.",
      systemPrompt: "You write concise Korean Threads posts for a generic owned product.",
      topics: ["제품 포지셔닝", "고객 문제", "랜딩 페이지"],
      experimentId: "no_posts_learning_state",
      experimentName: "No posts learning state",
      hypothesis: "The dashboard should show a learning state before posts exist.",
    }),
  },
];

export async function applySeed(prisma) {
  await prisma.user.upsert({
    where: { id: QA_IDS.mainUser },
    update: { email: QA_EMAILS.mainUser, name: "ULW QA Portfolio User" },
    create: { id: QA_IDS.mainUser, email: QA_EMAILS.mainUser, password: "qa-cookie-auth-only", name: "ULW QA Portfolio User" },
  });

  await prisma.user.upsert({
    where: { id: QA_IDS.emptyUser },
    update: { email: QA_EMAILS.emptyUser, name: "ULW QA Empty Portfolio User" },
    create: { id: QA_IDS.emptyUser, email: QA_EMAILS.emptyUser, password: "qa-cookie-auth-only", name: "ULW QA Empty Portfolio User" },
  });

  await prisma.brand.deleteMany({ where: { ownerId: QA_IDS.emptyUser } });

  for (const product of QA_PRODUCTS) {
    await prisma.brand.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        slug: product.slug,
        threadsUserId: product.threadsUserId,
        tokenExpiry: TOKEN_EXPIRY,
        brandConfig: JSON.stringify(product.brandConfig),
        ownerId: product.ownerId,
      },
      create: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        accessToken: "qa-token",
        threadsUserId: product.threadsUserId,
        tokenExpiry: TOKEN_EXPIRY,
        brandConfig: JSON.stringify(product.brandConfig),
        ownerId: product.ownerId,
      },
    });
  }

  await prisma.post.deleteMany({ where: { brandId: QA_IDS.noPostsProduct } });
  await prisma.accountPattern.deleteMany({
    where: {
      brandId: {
        in: QA_PRODUCTS.map((product) => product.id),
      },
    },
  });
  await prisma.discoveredAccount.deleteMany({
    where: {
      brandId: {
        in: QA_PRODUCTS.map((product) => product.id),
      },
    },
  });
  await prisma.tikTokVideoDraft.deleteMany({
    where: {
      brandId: {
        in: [QA_IDS.missingPromptProduct, QA_IDS.noPostsProduct],
      },
    },
  });
}

function printPlan(mode) {
  console.log(`Mode: ${mode}`);
  console.log(`Users: ${QA_IDS.mainUser}, ${QA_IDS.emptyUser}`);
  console.log(`Emails: ${QA_EMAILS.mainUser}, ${QA_EMAILS.emptyUser}`);
  console.log(`Products: ${QA_PRODUCTS.map((product) => product.id).join(", ")}`);
  console.log("Cookies:");
  console.log(`  Cookie: auth_session=${QA_IDS.mainUser}`);
  console.log(`  Cookie: auth_session=${QA_IDS.emptyUser}`);
  console.log("No-posts URL: http://127.0.0.1:3107/brands/ulw-qa-no-posts");
}

export function parseArgs(values) {
  return {
    apply: values.includes("--apply"),
    dryRun: values.includes("--dry-run") || !values.includes("--apply"),
  };
}

function loadEnv() {
  const root = path.resolve(__dirname, "../..");
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(root, envFile);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
    return;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  printPlan(args.apply ? "apply" : "dry-run");

  if (args.dryRun) {
    console.log("Dry run only. No database writes performed.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    await applySeed(prisma);
    console.log("Upserted fixed QA users and products.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
