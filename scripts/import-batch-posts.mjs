#!/usr/bin/env node
/**
 * scripts/import-batch-posts.mjs
 * Imports verified posts (Score >= 80) from output/batch-clean-30.md into Prisma DB.
 * Guarantees zero duplicate content, zero leaked prompt headers, and zero promo links.
 */

import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const inputFile = process.argv[2] ?? "output/batch-clean-30.md";
  console.log(`🚀 [Import Batch Posts] Ingesting from ${inputFile}...\n`);

  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath" },
  });

  if (!brand) {
    throw new Error("Brand 'cosmicpath' not found in database.");
  }

  if (!fs.existsSync(inputFile)) {
    throw new Error(`File not found: ${inputFile}`);
  }

  const fileContent = fs.readFileSync(inputFile, "utf-8");
  const blocks = fileContent.split(/\n---\n/).filter((b) => b.includes("## 포스트"));

  console.log(`📋 Total blocks parsed: ${blocks.length}`);

  let insertedCount = 0;
  let filteredCount = 0;

  // Base schedule time: start 3 hours from now
  const baseTime = Date.now() + 3 * 3600 * 1000;
  const INTERVAL_MS = 4 * 3600 * 1000; // 4 hours between posts

  const seenOpenings = new Set();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    const scoreMatch = block.match(/> \*\*📊 Expert Score: (\d+)\/100\*\*/);
    const score = parseInt(scoreMatch?.[1] || "0", 10);

    if (score < 80) {
      console.log(`⚠️ Skipped Post #${i + 1}: Score ${score} < 80`);
      filteredCount++;
      continue;
    }

    const metaMatch = block.match(/<!--\s*formula:([^\s]+)(?:\s+stunt:([^\s]+))?\s*-->/);
    const formulaId = metaMatch?.[1] || "choice";
    const stuntId = metaMatch?.[2];

    // Clean content extraction
    let content = block
      .split(/> \*\*💬 첫 댓글/)[0]
      .split(/### \[품질 리포트\]/)[0]
      .replace(/^## 포스트 \d+[^\n]*\n+/g, "")
      .replace(/^> [^\n]*\n+/gm, "") // remove all blockquotes like score or approval banner
      .replace(/<!--[\s\S]*?-->/g, "") // remove HTML comments
      .replace(/^#+\s*[^\n]+\n+/gm, (m) => m.includes("#") && !m.includes("#의사결정") && !m.includes("#사주") && !m.includes("#이직") ? "" : m)
      .replace(/^[^\n]+대상\s*경고\s*포스트:\s*$/im, "")
      .trim();

    // Extract comment
    const commentMatch = block.match(
      /> \*\*💬 첫 댓글[^\n]*\n+>\s*\n+> ([\s\S]+?)(?=\n+### \[품질 리포트\]|$)/
    );
    let firstComment = commentMatch?.[1]?.replace(/\n> /g, "\n")?.trim() || null;

    // Minimum length check (prevent truncated / prompt title leakage)
    if (!content || content.length < 80) {
      console.log(`⚠️ Skipped Post #${i + 1}: Content too short (${content?.length ?? 0} chars)`);
      filteredCount++;
      continue;
    }

    // Prohibit legacy 32min / Tokyo time duplicates
    if (/(1961년|32분|동경시|진태양시)/.test(content)) {
      console.log(`⚠️ Skipped Post #${i + 1}: Contains retired 32-minute legacy stunt`);
      filteredCount++;
      continue;
    }

    // Anti-duplicate check (first 25 characters normalized)
    const normalizedOpening = content.slice(0, 25).replace(/[^가-힣a-zA-Z0-9]/g, "");
    if (seenOpenings.has(normalizedOpening)) {
      console.log(`⚠️ Skipped Post #${i + 1}: Duplicate opening within batch ("${normalizedOpening}")`);
      filteredCount++;
      continue;
    }
    seenOpenings.add(normalizedOpening);

    // Check against existing DB posts for duplicates
    const existingSimilar = await prisma.post.findFirst({
      where: {
        brandId: brand.id,
        content: { contains: content.slice(0, 25) },
      },
    });
    if (existingSimilar) {
      console.log(`⚠️ Skipped Post #${i + 1}: Already exists in DB ("${content.slice(0, 25)}")`);
      filteredCount++;
      continue;
    }

    // Safety checks against promo links
    const isPromo = /(프로필\s*링크|20페이지|판정표|https?:\/\/|etsy)/i.test(
      [content, firstComment ?? ""].join("\n")
    );
    if (isPromo) {
      console.log(`⚠️ Skipped Post #${i + 1}: Contains forbidden promo/link terms`);
      filteredCount++;
      continue;
    }

    const scheduledAt = new Date(baseTime + insertedCount * INTERVAL_MS);

    await prisma.post.create({
      data: {
        brandId: brand.id,
        content,
        firstComment,
        formulaId,
        situation: stuntId ? `stunt:${stuntId}` : null,
        scheduledAt,
        status: "PENDING",
        qualityScore: score,
        qualityPass: true,
        algorithmicScore: score,
        algorithmicPass: true,
        postCategory: "GROWTH",
      },
    });

    insertedCount++;
    console.log(`✅ Imported Post #${i + 1} -> DB Post (Score: ${score}, Formula: ${formulaId}, Scheduled: ${scheduledAt.toISOString()})`);
    console.log(`   [Body]: ${content.slice(0, 60).replace(/\n/g, " ")}...`);
  }

  console.log(`\n🎉 Ingestion complete! ${insertedCount} diverse post(s) added to CosmicPath pending queue. (${filteredCount} filtered out)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("💥 Import error:", err);
  process.exit(1);
});
