/**
 * update-global-brand-config.js
 *
 * CosmicPath Global 브랜드의 brandConfig를 3대 킬러 포뮬러와
 * 순수 영문 토픽/상황/가이드라인으로 정규화한다.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath-global" }
  });

  if (!brand) {
    console.error("cosmicpath-global 브랜드를 찾을 수 없습니다.");
    return;
  }

  const currentConfig = JSON.parse(brand.brandConfig);

  const updatedConfig = {
    ...currentConfig,
    qualityProfile: "ecommerce_d2c",
    targets: [
      "Western 22-36 Gen Z & Millennials (US, CA, UK, AU, West Europe)",
      "Tech, creative, and finance professionals navigating quarter-life crisis",
      "Spiritual skeptics seeking mathematical precision beyond pop astrology"
    ],
    situations: [
      "Questioning why surface Western horoscopes fail to give concrete life answers",
      "Turning 28-32 and experiencing an intense Saturn Return career or relationship audit",
      "Curious why their Sun sign contradicts their true internal Day Master behavior",
      "Frustrated by generic AI readings on Etsy and seeking cross-verified depth"
    ],
    trendingTopics: [
      "astrology",
      "birth chart",
      "natal chart",
      "saju",
      "bazi",
      "saturn return",
      "synastry",
      "day master"
    ],
    hookTypes: [
      "Contrarian Reality Hook",
      "Curiosity Gap Hook",
      "2-Line Contrast Hook",
      "Self-Classification Hook",
      "Problem Cost Hook",
      "Pattern Recognition Hook"
    ],
    ctaTypes: [
      "Save for Reference",
      "Which Type Are You",
      "Check Your Placement",
      "Share with a Friend",
      "Profile Link Check"
    ],
    formulas: [
      {
        id: "western_debunk_saju_contrast",
        name: "Western Astrology Debunk vs Saju Mathematical Precision",
        weight: 5,
        instruction: "Deconstruct why generic Western sun-sign horoscopes fail: they miss true solar time and 4-pillar balance. Contrast the illusion with Korean Saju / Eastern ephemeris precision. 2-line contrast opening under 40 chars each. Highly contrarian, zero mysticism."
      },
      {
        id: "sun_vs_daymaster_dissonance",
        name: "Sun Sign vs Day Master Internal Conflict",
        weight: 4,
        instruction: "Call out the cognitive dissonance between who the world thinks you are (Sun sign) and who you are when alone at 2 AM (Day Master). Shockingly relatable psychological portrait."
      },
      {
        id: "saturn_reboot_timeline",
        name: "Saturn Return & 10-Year Pillar Reset",
        weight: 4,
        instruction: "Expose why turning 29 feels like a complete career and life collapse: it is not burnout, but a mandatory 10-year architectural system reboot. Provide a forensic, clinical audit."
      }
    ],
    voiceProfile: {
      tone: "forensic_analytical",
      perspective: "Forensic Metaphysical Strategist",
      sentenceLength: "short_punchy",
      paragraphStyle: "compact_blocks",
      admissionStyle: "Honestly, I used to check daily horoscopes until I saw the actual astronomical ephemeris offset.",
      forbiddenPhrases: [
        "unlock your potential",
        "sugar-coated",
        "10-year luck pillar",
        "자수 체크",
        "본문",
        "스레드 포스트"
      ],
      language: "en"
    },
    viralDiscovery: {
      keywords: ["astrology", "birth chart", "saju", "bazi", "saturn return"],
      competitorHandles: [],
      excludedTerms: ["당신", "사주", "팔자"],
      maxExamplesPerRun: 15,
      minViralScore: 86,
      adapters: [
        { id: "owned_posts", enabled: true },
        { id: "threads_keyword", enabled: true }
      ]
    },
    // 80/20 Link cadence (1 link post every 5 posts)
    linkCadenceEvery: 5
  };

  await prisma.brand.update({
    where: { slug: "cosmicpath-global" },
    data: {
      brandConfig: JSON.stringify(updatedConfig, null, 2)
    }
  });

  console.log("✅ CosmicPath Global brandConfig가 3대 킬러 포뮬러 및 영문 전용으로 정규화되었습니다.");
  console.log("포뮬러 3종:");
  updatedConfig.formulas.forEach(f => console.log(` - [Weight ${f.weight}] ${f.id}: ${f.name}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
