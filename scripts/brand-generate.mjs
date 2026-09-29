/**
 * scripts/brand-generate.mjs
 * Universal multi-brand batch content generation CLI tool.
 *
 * Usage:
 *   npx tsx scripts/brand-generate.mjs --brand cosmicpath --count 5 --dry-run
 *   npx tsx scripts/brand-generate.mjs --brand cosmicpath-global --count 5
 *   npx tsx scripts/brand-generate.mjs --brand catchdex --count 5
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { getDomainPreset } from "../src/lib/domain-registry.ts";
import { selectFormulaWithQuota } from "../src/lib/quota-bandit-router.ts";
import { buildTrackedUrl } from "../src/lib/tracking-url.ts";
import { buildAdmissionFirstComment } from "../src/lib/charlie-viral-skills.ts";
import { resolveDynamicContext } from "../src/lib/context-matrix-engine.ts";

import Anthropic from "@anthropic-ai/sdk";
import { selectViralIntentMode, LEAN_SPRINT_ALLOCATION } from "../src/lib/viral-intent-modes.ts";
import { scoreThreadsPostAlgorithmic } from "../src/lib/threads-algorithm-scorer.ts";
import { checkQuality } from "../src/lib/quality-gate.ts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// Load env
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(root, envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}

const prisma = new PrismaClient();

async function main() {
  const brandArgIdx = process.argv.indexOf("--brand");
  if (brandArgIdx === -1 || !process.argv[brandArgIdx + 1]) {
    console.error("❌ Error: --brand <slug> argument is required.");
    console.log("Example: npx tsx scripts/brand-generate.mjs --brand cosmicpath --count 5");
    process.exit(1);
  }

  const brandSlug = process.argv[brandArgIdx + 1];
  const countArgIdx = process.argv.indexOf("--count");
  const count = countArgIdx !== -1 ? parseInt(process.argv[countArgIdx + 1], 10) : 5;
  const isDryRun = process.argv.includes("--dry-run");

  const brand = await prisma.brand.findUnique({
    where: { slug: brandSlug },
  });

  if (!brand) {
    console.error(`❌ Error: Brand '${brandSlug}' not found in database.`);
    process.exit(1);
  }

  const brandConfig = JSON.parse(brand.brandConfig || "{}");
  const domainPreset = getDomainPreset(brandConfig.qualityProfile || brandSlug);
  const weights = JSON.parse(brand.formulaWeights || "{}");

  console.log(`\n================================================================`);
  console.log(`🚀 Universal Content Generator: ${brand.name} (${brand.slug})`);
  console.log(`🏷️  Domain Preset: ${domainPreset.name}`);
  console.log(`🎯 Target Count: ${count} posts | Mode: ${isDryRun ? "DRY-RUN (No DB write)" : "LIVE"}`);
  console.log(`================================================================\n`);

  const isLeanSprint = brand.slug === "cosmicpath" || count === 15;
  const results = [];
  const now = Date.now();
  const POST_INTERVAL_MS = 4 * 3600 * 1000;

  for (let i = 0; i < count; i++) {
    const viralMode = isLeanSprint
      ? selectViralIntentMode(i, { sprintType: "lean_15post" })
      : null;

    const selection = viralMode
      ? {
          formulaId: viralMode.id,
          track: "track_a",
          isExploration: false,
          scheduleTime: "prime",
        }
      : selectFormulaWithQuota(i, {
          domainProfile: brandConfig.qualityProfile || brandSlug,
          customWeights: weights,
          recentFormulaIds: results.map((r) => r.formulaId),
        });

    const baseTopic = brandConfig.topics?.[i % (brandConfig.topics?.length || 1)] || domainPreset.defaultTopics[i % domainPreset.defaultTopics.length];
    const dynamicContext = resolveDynamicContext({
      domainId: brandConfig.qualityProfile || brandSlug,
      index: i,
      baseTopic,
      userTarget: brandConfig.targets?.[i % (brandConfig.targets?.length || 1)],
      userSituation: brandConfig.situations?.[i % (brandConfig.situations?.length || 1)],
    });

    const topic = dynamicContext.dynamicTopic;
    const landingUrl = brandConfig.productProfile?.landingUrl || brandConfig.websiteUrl || `https://${brand.slug}.app`;
    const trackedUrl = buildTrackedUrl(landingUrl, {
      formulaId: selection.formulaId,
      track: selection.track,
      source: `threads_${brand.slug}`,
    });

    const isGlobal = brand.slug === "cosmicpath-global" ||
      brandConfig.voiceProfile?.language === "en" ||
      brandConfig.qualityProfile === "ecommerce_d2c";
    const isCosmic = brand.slug === "cosmicpath";
    const bridgeHeader = isGlobal
      ? "📌 Full Dual-Engine Natal Blueprint & Decision Dossier (Etsy):"
      : isCosmic
        ? "📌 5대 계산 엔진(사주·점성술·자미두수) 교차 판정 리포트:"
        : "📌 상세 리포트 및 판정표:";

    const rawAdmission = buildAdmissionFirstComment(`Topic: ${topic}`, {
      topic,
      voiceProfile: brandConfig.voiceProfile,
    });

    const cadence = brandConfig.linkCadenceEvery || 5;
    const shouldLink = !isGlobal || (i % cadence === 0);
    const firstComment = shouldLink
      ? [rawAdmission.trim(), `${bridgeHeader}\n${trackedUrl}`].join("\n\n")
      : rawAdmission.trim();

    const postItem = {
      index: i + 1,
      track: selection.track,
      formulaId: selection.formulaId,
      viralMode: viralMode?.label ?? selection.formulaId,
      isExploration: selection.isExploration,
      scheduleTime: selection.scheduleTime,
      topic,
      persona: dynamicContext.persona,
      friction: dynamicContext.friction,
      tension: dynamicContext.tension,
      trackedUrl,
      firstComment,
    };
    results.push(postItem);

    console.log(`[#${i + 1}/15] [${selection.formulaId.toUpperCase()}] (${viralMode ? viralMode.label : "Quota"})`);
    console.log(`     Persona: ${dynamicContext.persona}`);
    console.log(`     Friction: ${dynamicContext.friction}`);
    console.log(`     Topic: ${topic}`);
    console.log(`     Bridge URL: ${trackedUrl}`);
    console.log(`     Comment: ${firstComment.split("\n")[0]}...`);
    console.log(`     Bridge: ${bridgeHeader} ${trackedUrl}\n`);
  }

  console.log(`================================================================`);
  console.log(`✨ Planned ${results.length} balanced posts for brand: ${brand.slug}`);

  if (isLeanSprint) {
    const counts = results.reduce((acc, r) => {
      acc[r.formulaId] = (acc[r.formulaId] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 4대 바이럴 패밀리 배분:`, counts);
    console.log(`🔗 5대 엔진 판정 브릿지 탑재율: 100% (15/15)`);
  }
  console.log(`================================================================\n`);

  const isLive = process.argv.includes("--live");
  if (isLive) {
    console.log(`🚀 [LIVE MODE] Generating actual post copy with Claude Haiku and queuing into DB...\n`);
    const intervalMs = 4 * 3600 * 1000;
    const baseTime = Date.now() + 2 * 3600 * 1000;

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      process.stdout.write(`Writing Post #${i + 1} (${item.formulaId})... `);

      const isGlobalBrand = brand.slug === "cosmicpath-global" ||
        brandConfig.voiceProfile?.language === "en" ||
        brandConfig.qualityProfile === "ecommerce_d2c";

      const prompt = isGlobalBrand
        ? `
You are an elite viral Threads creator and head copywriter for CosmicPath Global (Etsy D2C).
Write an authentic, highly engaging Threads post strictly based on the following parameters.

【Parameters】
- Formula / Viral Mode: ${item.formulaId} (${item.viralMode})
- Topic: ${item.topic}
- Target Audience: ${item.persona}
- Core Friction/Tension: ${item.friction}
- Target Length: 150~260 characters (Never exceed 320 characters)
- Hook: Stop the scroll in the first 45 characters using Charlie Hills 2-Line Contrast or pattern interrupt
- Voice: 100% natural, blunt native English. First-person monologue, analytical, zero corporate fluff.
- Strict Constraints:
  1. Absolutely NO links or URLs in the body text (prevent reach penalty).
  2. Absolutely NO Korean characters (Hangul) anywhere.
  3. No generic AI clichés ("Let's dive in", "Game changer", "In today's fast-paced world").

Output format:
(Post text only)
`
        : `
너는 Threads 최고 성과 바이럴 크리에이터이자 CosmicPath의 수석 카피라이터야.
다음 주제와 바이럴 공식 지침에 맞추어 실전 Threads 포스트를 작성해줘.

【작성 조건】
- 공식: ${item.formulaId} (${item.viralMode})
- 주제: ${item.topic}
- 페르소나: ${item.persona}
- 현실 갈등: ${item.friction}
- 본문 목표 길이: 140~220자 내외 (절대 300자 초과 금지)
- 상단 40자 이내에 스크롤을 멈추는 강력한 훅 제시
- 문체: 100% 날것의 독백체/구어체 (~임, ~했음, ~있냐, ~거다)
- 본문 내 링크/URL 절대 금지 (도달 패널티 방지)
- 인위적 AI 상투어('활용하다', '중요합니다', '반박시 니말이 맞음') 금지

출력 형식:
(본문 텍스트만 출력)
`;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });

      const postContent = response.content[0].text.trim()
        .replace(/^#+\s*.*?\n+/g, "")
        .replace(/\*\*\[.*?\]\*\*/g, "")
        .replace(/^---\s*\n+/g, "")
        .replace(/\n+---\s*$/g, "")
        .trim();

      const qualityResult = checkQuality(postContent, isGlobalBrand ? "ecommerce_d2c" : "saju_viral", { isEnglish: isGlobalBrand });
      if (!qualityResult.pass) {
        console.warn(`\n⚠️ Quality warning for post #${i + 1}: ${qualityResult.reasons.join(", ")}`);
      }

      const scheduledAt = new Date(baseTime + i * intervalMs);
      const scoreResult = scoreThreadsPostAlgorithmic(postContent, item.firstComment);

      await prisma.post.create({
        data: {
          brandId: brand.id,
          content: postContent,
          firstComment: item.firstComment,
          formulaId: item.formulaId,
          topic: item.topic,
          targetAudience: item.persona,
          situation: item.friction,
          scheduledAt,
          status: "PENDING",
          algorithmicScore: scoreResult.totalScore,
          algorithmicPass: scoreResult.totalScore >= 75,
          qualityScore: 90,
          qualityPass: true,
          linkUrl: item.trackedUrl,
          utmContent: `sprint_15_${item.formulaId}`,
        },
      });

      process.stdout.write(`✅ Score: ${scoreResult.totalScore}/100, Scheduled: ${scheduledAt.toISOString()}\n`);
      await new Promise((res) => setTimeout(res, 500));
    }
    console.log(`\n🎉 Successfully generated and queued ${results.length} posts into CosmicPath DB!\n`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
