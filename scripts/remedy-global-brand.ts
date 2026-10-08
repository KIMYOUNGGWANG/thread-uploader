import { PrismaClient } from "@prisma/client";
import { checkQuality } from "../src/lib/quality-gate";
import { scoreThreadsPostAlgorithmic } from "../src/lib/threads-algorithm-scorer";

const prisma = new PrismaClient();

interface PostCandidate {
  topic: string;
  formulaId: string;
  postCategory: string;
  content: string;
  firstComment: string | null;
}

const CANDIDATE_POSTS: PostCandidate[] = [
  // ==========================================
  // Category 1: Contrarian Reality (4 posts)
  // ==========================================
  {
    topic: "Why your birth chart feels like a lie vs reality",
    formulaId: "western_debunk_saju_contrast",
    postCategory: "AUTHORITY",
    content: `Why your birth chart feels like a lie vs reality?

Standard time zones are an 1884 railroad compromise—not celestial truth. Most people are 20 to 45 minutes off true solar time.

In Western astrology, your Sun sign shows who you want to be. In Eastern Saju, your Day Master reveals who you actually are at 2 AM.

Which system predicted your biggest turning point?
1. Western birth chart
2. Eastern four pillars`,
    firstComment: "Drop your birth time in minutes if you want to know your true solar offset.",
  },
  {
    topic: "Why your horoscope fails your career vs reality",
    formulaId: "saturn_reboot_timeline",
    postCategory: "AUTHORITY",
    content: `Why your horoscope fails your career vs reality?

Your Sun sign isn't running your business. Your 10th house and decade luck cycles are.

When those systems clash, you get chronic imposter syndrome. Most $15 Etsy astrology readings copy-paste generic AI prompts.

Real mapping calculates planetary angles against exact latitude.

What holds you back more right now?
1. Wrong role vs natural talents
2. Bad timing vs company runway`,
    firstComment: "Timing beats talent every single time when your cycle shifts?",
  },
  {
    topic: "Why your Moon sign falls into the same trap vs truth",
    formulaId: "sun_vs_daymaster_dissonance",
    postCategory: "AUTHORITY",
    content: `Why your Moon sign falls into the same trap vs truth?

A Water Moon seeks deep emotional safety.

If your Day Master element is Fire, you attract partners who confuse your passion with endless emotional support.

This mismatch drains your creative reserves before month six. It is not bad luck—it is unexamined natal geometry.

Which dynamic do you repeat in relationships?
1. Giving until total emotional collapse
2. Pulling away when intimacy gets real`,
    firstComment: "Do you notice this recurring dynamic in your relationships?",
  },
  {
    topic: "The truth about why your Sun sign clashes vs reality",
    formulaId: "sun_vs_daymaster_dissonance",
    postCategory: "AUTHORITY",
    content: `The truth about why your Sun sign clashes vs reality?

You tell people you are an ambitious Capricorn. Yet you spend weekends hiding away like a reclusive Cancer.

In Western astrology, that is an internal opposition aspect. In Eastern Saju, it is a direct stem-branch clash.

Duty and survival fight for control every single day.

Which side of you wins when under acute pressure?
1. The public perfectionist
2. The private escape artist`,
    firstComment: "Which side takes over when you are completely exhausted?",
  },

  // ==========================================
  // Category 2: Algorithmic / System Diagnostic (4 posts)
  // ==========================================
  {
    topic: "Why turning 29 is a Saturn return vs simple burnout",
    formulaId: "saturn_reboot_timeline",
    postCategory: "AUTHORITY",
    content: `Why turning 29 is a Saturn return vs simple burnout?

Every structure built on pleasing others begins to collapse between ages 28 and 30.

Your natal chart literally demands structural realignment. The mistake is treating this as personal failure instead of a mathematical audit.

Where is the pressure hitting hardest right now?
1. Corporate career vs true autonomy
2. Long-term partnership vs personal identity`,
    firstComment: "Where do you feel this structural reset hitting your life?",
  },
  {
    topic: "Why your 2nd house reveals wealth leaks vs abundance",
    formulaId: "western_debunk_saju_contrast",
    postCategory: "AUTHORITY",
    content: `Why your 2nd house reveals wealth leaks vs abundance?

Most wealth readings tell you to visualize abundance. Real astrology inspects the ruler of your 2nd house and your 10-year pillar.

If your chart shows wealth clashes with self-worth, higher income only accelerates unnecessary spending.

Which financial pattern feels uncomfortably familiar?
1. Making great money but leaking it rapidly
2. Undercharging out of fear of rejection`,
    firstComment: "Which financial reflex do you find hardest to break?",
  },
  {
    topic: "Why your 4th house IC wound sabotages your career vs home",
    formulaId: "sun_vs_daymaster_dissonance",
    postCategory: "AUTHORITY",
    content: `Why your 4th house IC wound sabotages your career vs home?

Your IC marks childhood emotional conditioning. When unresolved, it quietly sabotages adult professional boundaries.

You become the team therapist because resting at home never felt safe. Western charts diagnose the wound; Saju shows the decade it unlocks.

Which boundary slips first during peak stress?
1. Saying yes to unreasonable deadlines
2. Absorbing toxic co-worker anxiety`,
    firstComment: "Do you catch yourself becoming the emotional caretaker at work?",
  },
  {
    topic: "Why $15 Etsy birth chart readings fail you vs data",
    formulaId: "western_debunk_saju_contrast",
    postCategory: "AUTHORITY",
    content: `Why $15 Etsy birth chart readings fail you vs data?

Cheap shops feed single-line prompts to language models. They produce poetic horoscopes with zero mathematical ephemeris calculation.

A true dual-engine audit cross-examines Western planetary degrees against Eastern Day Master seasonal strength.

Have you ever paid for an online reading?
1. Yes, and it felt completely generic
2. No, waiting for forensic precision`,
    firstComment: "Have you ever received an astrology reading that felt completely generic?",
  },

  // ==========================================
  // Category 3: Interactive Choice Dilemma (4 posts)
  // ==========================================
  {
    topic: "Which cosmic mismatch drains your energy vs focus",
    formulaId: "sun_vs_daymaster_dissonance",
    postCategory: "ENGAGEMENT",
    content: `Which cosmic mismatch drains your energy vs focus?

Two distinct profiles emerge in every career chart reading:

1. The Overextended Architect: Strong Sun sign ambition, but depleted Water element causing constant cognitive fatigue.
2. The Trapped Strategist: Brilliant Earth Day Master logic, but restless Gemini placement screaming for total disruption.

Which one describes your current work week?
1. Overextended Architect
2. Trapped Strategist`,
    firstComment: "Which archetype describes your day-to-day energy right now?",
  },
  {
    topic: "How your natal chart handles pressure vs confrontation",
    formulaId: "sun_vs_daymaster_dissonance",
    postCategory: "ENGAGEMENT",
    content: `How your natal chart handles pressure vs confrontation?

Your Mars placement dictates your instinctive defense reflex when attacked in high-stakes meetings:

1. Fire/Metal Dominant: Instant counter-strike, sharp logic, zero hesitation.
2. Earth/Water Dominant: Silent poker face in public, intense post-mortem rumination at midnight.

Which archetype is your automatic reflex?
1. The Instant Counter-Striker
2. The Midnight Ruminator`,
    firstComment: "Which defense mechanism is your default setting under attack?",
  },
  {
    topic: "What is your primary relationship clash vs harmony",
    formulaId: "western_debunk_saju_contrast",
    postCategory: "ENGAGEMENT",
    content: `What is your primary relationship clash vs harmony?

Astrological synastry reveals whether tension comes from ego or genuine elemental incompatibility:

1. Communication Gap: Mercury square Moon—you think in spreadsheets, they feel in colors.
2. Pace Mismatch: Cardinal Sun vs Fixed Day Master—one wants instant change, one demands stability.

Which dynamic causes the friction at home?
1. The Communication Gap
2. The Pace Mismatch`,
    firstComment: "Which friction point appears most often in your partnerships?",
  },
  {
    topic: "Why your Saturn transit feels like friction vs progress",
    formulaId: "saturn_reboot_timeline",
    postCategory: "ENGAGEMENT",
    content: `Why your Saturn transit feels like friction vs progress?

When Saturn aspects your natal Midheaven, speed drops to zero. Every easy win becomes an uphill battle.

The universe isn't punishing you—it is testing whether your foundation can support ten times more weight.

How are you navigating this slow season?
1. Forcing momentum and burning out
2. Rebuilding systems and cutting dead weight`,
    firstComment: "How are you handling the friction in your current cycle?",
  },

  // ==========================================
  // Category 4: Conversion Offer (Etsy Bio Bridge) (3 posts)
  // ==========================================
  {
    topic: "Why guess your life timing with horoscopes vs precision",
    formulaId: "d2c_etsy_offer",
    postCategory: "CONVERSION",
    content: `Why guess your life timing with horoscopes vs precision?

A single transit explains why this year felt stagnant while your peers accelerated.

True clarity requires cross-verifying Western birth charts with Eastern BaZi four pillars. Our 20-page forensic reading calculates your exact decade luck transitions, career wealth engines, and relational blindspots.

What is the biggest decision on your plate?
1. Career pivot or new venture
2. Relocation or major relationship shift`,
    firstComment: "📌 Full dual-engine birth chart dossier linked in profile bio: etsy.com/shop/ByYoungStudio (Questions? Drop them below)",
  },
  {
    topic: "What is the difference in generic astrology vs forensic data",
    formulaId: "d2c_etsy_offer",
    postCategory: "CONVERSION",
    content: `What is the difference in generic astrology vs forensic data?

Most pop astrology gives comfortable compliments. A forensic dual-engine audit delivers an architectural blueprint:

- Exact solar time birth chart recalculation
- Eastern Day Master balance and wealth stars
- Critical 10-year cycle inflection dates

Which area needs the most rigorous audit?
1. Professional trajectory & wealth leaks
2. Long-term partnership & compatibility`,
    firstComment: "📌 Explore our deep forensic life blueprint on Etsy via profile bio link: etsy.com/shop/ByYoungStudio (Any questions?)",
  },
  {
    topic: "Why treat your birth chart as fate vs an operating manual",
    formulaId: "d2c_etsy_offer",
    postCategory: "CONVERSION",
    content: `Why treat your birth chart as fate vs an operating manual?

When you know where your natal aspects clash, friction stops feeling like a personal curse. Instead, it becomes a design constraint you can engineer around.

Our custom 20-page dossier synthesizes Western ephemeris precision with Eastern four pillars wisdom. The truth is in the mathematical coordinates.

What would you ask your chart with forensic data?
1. Optimal timing for a major leap
2. Root cause of a recurring bottleneck`,
    firstComment: "📌 Get your personalized dual-engine report on Etsy (link in bio): etsy.com/shop/ByYoungStudio (What question would you ask?)",
  },
];

async function main() {
  const isApply = process.argv.includes("--apply");
  console.log(`[CosmicPath Global 파이프라인 복구] 모드: ${isApply ? "실제 적용 (APPLY)" : "사전 검증 (DRY-RUN)"}`);

  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath-global" },
  });

  if (!brand) {
    throw new Error("cosmicpath-global 브랜드를 찾을 수 없습니다.");
  }

  // 1단계: 기존 락 걸린 PENDING 포스트 수 파악
  const stuckPending = await prisma.post.findMany({
    where: { brandId: brand.id, status: "PENDING" },
  });
  console.log(`\n1. 불량 큐 상태: 현재 ${stuckPending.length}개의 PENDING 포스트 발견`);

  // 2단계: 신규 15개 포스트 사전 검증 (Quality Gate & Algo Scorer)
  console.log("\n2. 신규 15개 포스트 검증 시작 (Quality Gate + Algorithmic Scorer)...");
  const validatedPosts: Array<PostCandidate & { qualityScore: number; algoScore: number; algoDimensions: unknown }> = [];

  for (let i = 0; i < CANDIDATE_POSTS.length; i++) {
    const post = CANDIDATE_POSTS[i];
    const qRes = checkQuality(post.content, "ecommerce_d2c");
    const aRes = scoreThreadsPostAlgorithmic(post.content, post.firstComment);

    console.log(
      `  [#${(i + 1).toString().padStart(2)}] ${post.topic.slice(0, 36).padEnd(36)} | Q-Pass: ${qRes.pass ? "✅" : "❌"} (${qRes.score}점) | Algo-Pass: ${aRes.pass ? "✅" : "❌"} (${aRes.totalScore}점)`
    );

    if (!qRes.pass) {
      console.error(`    ⚠️ Quality Gate 실패 이유:`, qRes.reasons);
    }
    if (!aRes.pass) {
      console.error(`    ⚠️ Algo Scorer 실패 수정안:`, aRes.actionableFixes);
    }

    if (!qRes.pass || !aRes.pass) {
      throw new Error(`포스트 #${i + 1} 검증 실패! 실행을 중단합니다.`);
    }

    validatedPosts.push({
      ...post,
      qualityScore: qRes.score >= 2 ? 95 : 50,
      algoScore: aRes.totalScore,
      algoDimensions: aRes.dimensions,
    });
  }
  console.log(`\n✅ 15개 전수 검증 통과 (Zero Hangul, Anti-Slop, High-Retention 구조 일치)`);

  if (!isApply) {
    console.log("\n[DRY RUN 완료] 실제 변경을 적용하려면 --apply 플래그를 추가하십시오.");
    return;
  }

  // 3단계: 불량 PENDING 포스트 13건 ARCHIVED 처리
  if (stuckPending.length > 0) {
    const archivedResult = await prisma.post.updateMany({
      where: { brandId: brand.id, status: "PENDING" },
      data: { status: "ARCHIVED" },
    });
    console.log(`\n3. 불량 큐 격리 완료: ${archivedResult.count}건 PENDING -> ARCHIVED`);
  }

  // 4단계: 15개 포스트 DB 삽입 (현재 시각 + 2시간부터 5시간 간격 스케줄링)
  console.log("\n4. 신규 15개 포스트 DB 큐 등록 시작...");
  const baseTime = Date.now() + 2 * 60 * 60 * 1000; // 2시간 뒤 시작
  const INTERVAL_MS = 5 * 60 * 60 * 1000; // 5시간 간격

  let insertedCount = 0;
  for (let i = 0; i < validatedPosts.length; i++) {
    const p = validatedPosts[i];
    const scheduledAt = new Date(baseTime + i * INTERVAL_MS);

    const created = await prisma.post.create({
      data: {
        brandId: brand.id,
        content: p.content,
        firstComment: p.firstComment,
        formulaId: p.formulaId,
        topic: p.topic,
        targetAudience: "Western 22-36 Gen Z & Millennials (US, CA, UK, AU)",
        scheduledAt,
        status: "PENDING",
        qualityPass: true,
        qualityScore: p.qualityScore,
        qualityProfile: "ecommerce_d2c",
        algorithmicPass: true,
        algorithmicScore: p.algoScore,
        algorithmicDimensions: JSON.stringify(p.algoDimensions),
        algorithmicFixes: "[]",
        rewriteCount: 0,
        postCategory: p.postCategory,
      },
    });

    insertedCount++;
    console.log(`  ✅ 등록 [#${insertedCount.toString().padStart(2)}] ID: ${created.id} | 예정: ${scheduledAt.toISOString()} | [${p.formulaId}]`);
  }

  console.log(`\n🎉 CosmicPath Global 파이프라인 복구 완료! 총 ${insertedCount}개 포스트 큐 스케줄링 완료.`);
}

main()
  .catch((e) => {
    console.error("실행 중 오류 발생:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
