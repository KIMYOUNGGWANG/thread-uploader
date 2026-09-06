import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function parseSprintMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const postBlocks = raw.split(/---\s*\n##\s+Post\s+\d+:\s+/).slice(1);

  const posts = [];
  for (const block of postBlocks) {
    const lines = block.split("\n");
    const title = lines[0].trim();
    
    // Extract metadata
    const formulaMatch = block.match(/\*\*Formula\*\*:\s*`([^`]+)`/);
    const formulaId = formulaMatch ? formulaMatch[1] : "d2c_etsy_offer";
    
    const trackMatch = block.match(/\*\*Track\*\*:\s*`([^`]+)`/);
    const track = trackMatch ? trackMatch[1] : "track_a";

    // Split content and first comment
    const commentSplit = block.split(/>\s*\*\*💬 First Comment:\*\*\s*\n/);
    const contentBlock = commentSplit[0];
    const commentBlock = commentSplit[1] || "";

    // Clean content lines: skip meta lines (starting with >)
    const contentLines = contentBlock
      .split("\n")
      .slice(1) // skip title
      .filter((l) => !l.trim().startsWith(">"))
      .join("\n")
      .trim();

    // Clean comment lines: strip leading '> '
    const firstComment = commentBlock
      .split("\n")
      .map((l) => l.replace(/^>\s*/, ""))
      .join("\n")
      .trim();

    posts.push({
      title,
      formulaId,
      track,
      content: contentLines,
      firstComment,
    });
  }

  return posts;
}

async function main() {
  console.log("🚀 Applying CosmicPath Global PRD v4.0 Sprint Batch to Database...\n");

  const sprintPath = path.resolve(root, "output/2026-09-03-cosmicpath-global-sprint.md");
  if (!fs.existsSync(sprintPath)) {
    throw new Error(`File not found: ${sprintPath}`);
  }

  const posts = parseSprintMarkdown(sprintPath);
  console.log(`📋 Parsed ${posts.length} posts from ${path.basename(sprintPath)}`);

  // 1. Find or verify cosmicpath-global brand
  let brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath-global" },
  });

  if (!brand) {
    console.log("⚠️ Brand 'cosmicpath-global' not found. Checking fallback or creating from cosmicpath...");
    const baseBrand = await prisma.brand.findFirst({
      where: { slug: "cosmicpath" },
    });
    if (!baseBrand) {
      throw new Error("Neither cosmicpath-global nor cosmicpath brand found in database.");
    }
    
    brand = await prisma.brand.create({
      data: {
        name: "CosmicPath Global",
        slug: "cosmicpath-global",
        threadsUserId: baseBrand.threadsUserId,
        accessToken: baseBrand.accessToken,
        tokenExpiry: baseBrand.tokenExpiry,
        ownerId: baseBrand.ownerId,
        brandConfig: JSON.stringify({
          qualityProfile: "ecommerce_d2c",
          productProfile: {
            productName: "CosmicPath Global",
            oneLineDescription: "Eastern BaZi ✕ Western Astrology Dual-Cosmic Intelligence System",
            targetCustomer: "Western 22-36 Gen Z & Millennials (US, CA, UK, AU)",
            landingUrl: "https://www.etsy.com/shop/ByYoungStudio",
            primaryChannel: "threads",
          },
        }),
      },
    });
    console.log(`✅ Created brand cosmicpath-global: ${brand.id}`);
  } else {
    console.log(`✅ Found brand cosmicpath-global: ${brand.id}`);
  }

  // 2. Update brand config with PRD v4.0 specs
  const existingConfig = JSON.parse(brand.brandConfig || "{}");
  const updatedConfig = {
    ...existingConfig,
    qualityProfile: "ecommerce_d2c",
    voiceProfile: {
      tone: "analytical",
      perspective: "Forensic Astrological Strategist",
      sentenceLength: "short_punchy",
      paragraphStyle: "compact_blocks",
      admissionStyle: "📌 Honestly, I used to fall for this exact pattern every single time.",
      forbiddenPhrases: ["unlock your potential", "sugar-coated", "10-year luck pillar", "saju", "bazi"],
      language: "en",
    },
    productProfile: {
      productName: "CosmicPath Global",
      oneLineDescription: "Eastern BaZi ✕ Western Astrology Mathematical Synthesis (PRD v4.0)",
      targetCustomer: "Western 22-36 Gen Z & Millennials (US, CA, UK, AU, West Europe)",
      offerPromise: "Zero-sugar-coating dual-engine cross-verified life intelligence dossier ($29.99 - $44.99)",
      landingUrl: "https://www.etsy.com/shop/ByYoungStudio",
      primaryChannel: "threads",
      primaryMetric: "views",
      conversionMetric: "etsy_sales",
    },
    topics: [
      "Why your Moon sign keeps falling for emotionally unavailable partners (Avoidant Trap)",
      "The real reason you feel like two different people: Sun vs Moon vs Rising internal clash",
      "Saturn return at 29: why your corporate job feels like a slow existential death",
      "Why 90% of $15 Etsy astrology readings are copy-pasted ChatGPT prompts lacking dual precision",
      "The hidden financial leak in your 2nd house of income and capital defense",
      "How unhealed childhood emotional karma (4th House IC) secretly sabotages your adult dating life",
    ],
  };

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      brandConfig: JSON.stringify(updatedConfig),
    },
  });
  console.log("✅ Brand config successfully updated with PRD v4.0 specs!");

  // 3. Queue the 7 posts into DB with staggered schedule
  const now = Date.now();
  const INTERVAL_MS = 6 * 3600 * 1000; // 4 posts a day (every 6 hours)

  let insertedCount = 0;
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const scheduledAt = new Date(now + (i + 1) * INTERVAL_MS);

    // Prevent duplicate content if already queued
    const existing = await prisma.post.findFirst({
      where: {
        brandId: brand.id,
        content: p.content,
      },
    });

    if (existing) {
      console.log(`ℹ️ Post #${i + 1} (${p.formulaId}) already queued (ID: ${existing.id}, Status: ${existing.status})`);
      continue;
    }

    const created = await prisma.post.create({
      data: {
        brandId: brand.id,
        content: p.content,
        firstComment: p.firstComment,
        formulaId: p.formulaId,
        topic: p.title,
        targetAudience: updatedConfig.productProfile.targetCustomer,
        scheduledAt,
        status: "PENDING",
      },
    });

    insertedCount++;
    console.log(`✅ Queued Post #${i + 1} [${p.formulaId}] -> ID: ${created.id} (Scheduled: ${scheduledAt.toISOString()})`);
  }

  console.log(`\n🎉 Sprint batch apply completed! ${insertedCount}/${posts.length} new posts queued for cosmicpath-global.`);
}

main()
  .catch((e) => {
    console.error("❌ Execution failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
