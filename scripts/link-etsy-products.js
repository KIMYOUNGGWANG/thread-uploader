const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BIRTH_CHART_URL = "https://www.etsy.com/ca/listing/4564666801/custom-20-page-birth-chart-reading-in";
const COUPLE_SYNASTRY_URL = "https://www.etsy.com/ca/listing/4566328834/couple-synastry-reading-25-page-in-depth";

async function main() {
  const brand = await prisma.brand.findUnique({ where: { slug: "cosmicpath-global" } });
  if (!brand) throw new Error("Brand cosmicpath-global not found");

  const pending = await prisma.post.findMany({
    where: { brandId: brand.id, status: "PENDING" },
    orderBy: { scheduledAt: "asc" }
  });

  console.log(`Analyzing ${pending.length} pending posts for smart Etsy matching...\n`);

  let synastryCount = 0;
  let birthChartCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    const text = (p.content + " " + (p.topic || "")).toLowerCase();

    // Check if relationship / love / partner / synastry / marriage / dating / peach blossom
    const isRelationship = text.includes("relationship") ||
                           text.includes("couple") ||
                           text.includes("synastry") ||
                           text.includes("peach blossom") ||
                           text.includes("partner") ||
                           text.includes("dating") ||
                           text.includes("attract") ||
                           text.includes("situationship") ||
                           text.includes("love") ||
                           text.includes("opposite") ||
                           text.includes("compatibility") ||
                           text.includes("marriage");

    const targetUrl = isRelationship ? COUPLE_SYNASTRY_URL : BIRTH_CHART_URL;
    const productName = isRelationship ? "25-Page Couple Synastry & Compatibility Blueprint" : "20-Page Custom Birth Chart & Saju Blueprint";

    let firstComment = "";
    if (i % 3 === 0) {
      firstComment = `✨ Want your custom ${productName}? (50% Launch Special) → ${targetUrl}`;
    } else if (i % 3 === 1) {
      if (isRelationship) {
        firstComment = `What are your and your partner's Sun/Moon signs? Drop them below to see your core dynamic.\n\n(✨ Full Couple Synastry Blueprint: ${COUPLE_SYNASTRY_URL})`;
      } else {
        firstComment = `What Sun sign and birth year are you? Drop it below if you want to know what season of your 10-year luck pillar you are in.\n\n(✨ 20-Page Custom Reading: ${BIRTH_CHART_URL})`;
      }
    } else {
      if (isRelationship) {
        firstComment = `Save this breakdown before having your next relationship conversation.\n\n(✨ Deep compatibility reading: ${COUPLE_SYNASTRY_URL})`;
      } else {
        firstComment = `Bookmark this breakdown before making your next big career pivot or signing a major contract.\n\n(✨ 20-Page Decision Blueprint: ${BIRTH_CHART_URL})`;
      }
    }

    await prisma.post.update({
      where: { id: p.id },
      data: { firstComment }
    });

    if (isRelationship) {
      synastryCount++;
      console.log(`[#${i + 1}] 💖 Relationship Topic -> Linked to Couple Synastry`);
      console.log(`     Topic: ${p.topic || p.content.slice(0, 45)}...`);
    } else {
      birthChartCount++;
      console.log(`[#${i + 1}] 🧭 Career/Natal Topic -> Linked to 20-Page Birth Chart`);
      console.log(`     Topic: ${p.topic || p.content.slice(0, 45)}...`);
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Complete!`);
  console.log(`- 💖 Couple Synastry (25-Page) Linked Posts: ${synastryCount}개`);
  console.log(`- 🧭 Birth Chart & Timing (20-Page) Linked Posts: ${birthChartCount}개`);
  console.log(`========================================\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
