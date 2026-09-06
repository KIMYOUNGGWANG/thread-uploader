import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EN_RELATIONSHIP_ADMISSIONS = [
  "📌 Honestly, I used to fall for this exact pattern every single time.\nNot trying to preach here. I just cataloged this after watching the same dynamic implode for the third time.\nPulled the complete decision framework together so you don't have to guess.\nThe full decision framework is linked at the top of my profile.",
  "📌 Real talk: I ignored these exact relationship signs for three years.\nI only know this because I spent years falling into the exact same trap myself.\nPulled the complete dual-astrology compatibility blueprint together.\nFull breakdown is linked at the top of my profile.",
  "📌 Not claiming to have it all figured out—I learned this the hard way after two painful breakups.\nCataloged the exact boundary shifts needed when dealing with an avoidant partner.\nThe complete relationship decision framework is in my bio.",
];

const EN_CAREER_ADMISSIONS = [
  "📌 Real talk: I wrote this after hitting this exact wall at 28.\nNo guru nonsense—just patterns that kept repeating until I actually mapped them out.\nMapped out the full decision blueprint so you can see your own blind spots.\nThe full decision framework is linked at the top of my profile.",
  "📌 To be completely honest, I ignored these exact structural signs until burning out twice.\nJust sharing the raw architectural notes I wish someone handed me earlier.\nFull life season & natal decision blueprint is linked in my bio.",
  "📌 Not trying to act superior here. I learned this the expensive, exhausting way.\nMapped out the 10-year luck shift framework so you don't have to guess your timing.\nThe complete breakdown is linked at the top of my profile.",
];

async function main() {
  console.log("🧹 Starting CosmicPath Global PENDING Queue Cleansing & Rescheduling...\n");

  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath-global" },
  });

  if (!brand) {
    throw new Error("Brand 'cosmicpath-global' not found in database.");
  }

  // 1. Ensure brandConfig has linkPlacement: 'bio'
  const config = JSON.parse(brand.brandConfig || "{}");
  if (config.linkPlacement !== "bio") {
    config.linkPlacement = "bio";
    await prisma.brand.update({
      where: { id: brand.id },
      data: { brandConfig: JSON.stringify(config) },
    });
    console.log("✅ Brand config updated with linkPlacement: 'bio'");
  }

  // 2. Fetch all PENDING posts
  const pendingPosts = await prisma.post.findMany({
    where: {
      brandId: brand.id,
      status: "PENDING",
    },
    orderBy: { scheduledAt: "asc" },
  });

  console.log(`📦 Found ${pendingPosts.length} PENDING posts for cosmicpath-global.`);

  if (pendingPosts.length === 0) {
    console.log("Nothing to clean.");
    return;
  }

  // 3. 24-hour Cooldown: Start scheduling 24 hours from now
  const now = Date.now();
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const startDate = new Date(now + COOLDOWN_MS);

  // Stagger: 2 posts per day
  // Slot 1: 16:00 UTC (EST 12:00 PM - Lunch Peak)
  // Slot 2: 00:00 UTC (EST 8:00 PM - Evening Peak)
  let cleanedCount = 0;
  let urlStrippedCount = 0;

  for (let i = 0; i < pendingPosts.length; i++) {
    const post = pendingPosts[i];
    const dayOffset = Math.floor(i / 2);
    const isSlotEvening = i % 2 === 1;

    // Calculate scheduled date
    const postDate = new Date(startDate);
    postDate.setUTCDate(postDate.getUTCDate() + dayOffset);
    if (isSlotEvening) {
      postDate.setUTCHours(23, 59, 0, 0); // ~00:00 UTC
    } else {
      postDate.setUTCHours(16, 0, 0, 0); // 16:00 UTC
    }

    // Clean firstComment: Remove raw URLs and replace with bio guidance
    const hadUrl = /(https?:\/\/[^\s]+)/gi.test(post.firstComment || "");
    if (hadUrl) urlStrippedCount++;

    const isRelationship = /synastry|relationship|dating|couple|partner|venus|love|marriage|avoidant/i.test(
      post.content + " " + (post.topic || "")
    );

    const templatePool = isRelationship ? EN_RELATIONSHIP_ADMISSIONS : EN_CAREER_ADMISSIONS;
    const sanitizedFirstComment = templatePool[i % templatePool.length];

    await prisma.post.update({
      where: { id: post.id },
      data: {
        firstComment: sanitizedFirstComment,
        scheduledAt: postDate,
        errorLog: null,
      },
    });

    cleanedCount++;
    console.log(
      `[#${i + 1}] ID: ${post.id} | Scheduled: ${postDate.toISOString()} (UTC) | URL Stripped: ${hadUrl ? "YES" : "NO"}`
    );
  }

  console.log(`\n======================================================`);
  console.log(`🎉 Cleansing Complete!`);
  console.log(`- Total Posts Cleaned: ${cleanedCount}`);
  console.log(`- Posts with Raw URLs Stripped: ${urlStrippedCount}`);
  console.log(`- New Schedule Range: Starting ${startDate.toISOString()} (24h Cooldown applied)`);
  console.log(`- Rate: 2 posts/day (EST 12:00 & 20:00)`);
  console.log(`======================================================\n`);
}

main()
  .catch((err) => {
    console.error("❌ Cleansing error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
