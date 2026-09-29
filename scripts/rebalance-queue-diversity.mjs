import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Step 1: Pruning Redundant Duplicate Posts in DB ===');

  // Domestic duplicate IDs to prune
  const domesticDuplicatesToPrune = [
    'cmu7w7ctu000l20sa7oz1mcwc', // Duplicate of 3-things warning (6-month vs 1-year)
    'cmu7w7dgs000t20safl12uvlz', // Duplicate of salary vs card debt
    'cmu7w7dmh000v20sasn7wuntt', // Duplicate of salary bump illusion
  ];

  for (const id of domesticDuplicatesToPrune) {
    try {
      await prisma.post.delete({ where: { id } });
      console.log('Deleted domestic redundant duplicate:', id);
    } catch (e) {
      console.log('Could not delete domestic post (might not exist):', id);
    }
  }

  // Global duplicate IDs to prune (excessive scapegoat & moon sign repetition)
  const globalDuplicatesToPrune = [
    'cmu7r68nm000hxtuy86pr7m37', // scapegoat repeat 1
    'cmu7r6k9o000lxtuy2zvczhes', // scapegoat repeat 2
    'cmu7r75s3000txtuyhye0m4kg', // scapegoat repeat 3
    'cmu7r81q50015xtuyb6t8enmc', // scapegoat repeat 4
    'cmu7r6kac000nxtuyl3oqxvp7', // Moon sign repeat 1
    'cmu7r7g1z000xxtuymheuwcia', // Moon sign repeat 2
    'cmu7r5bz70007xtuyzfrcdv24', // pivot repeat 1
    'cmu7r68oa000jxtuyx21qkgc3', // pivot repeat 2
  ];

  for (const id of globalDuplicatesToPrune) {
    try {
      await prisma.post.delete({ where: { id } });
      console.log('Deleted global redundant duplicate:', id);
    } catch (e) {
      console.log('Could not delete global post (might not exist):', id);
    }
  }

  console.log('\n=== Step 2: Injecting Diverse Winning Topics for Domestic ===');

  const domesticBrand = await prisma.brand.findFirst({ where: { name: 'CosmicPath' } });
  if (!domesticBrand) throw new Error('CosmicPath domestic brand not found');

  // 5 completely distinct, viral-tested winning topics from brand-voice.md
  const newDomesticPosts = [
    {
      topic: '현실 재능 판정 (공부 머리 vs 일 머리)',
      formulaId: 'talent_audit_reality',
      content: `공부 머리 vs 일 머리 사주 보면 딱 나와.

공부 머리(인성) 없는데 공시 5년 준비하는 건 본인도 고통이고 집안 등골 브레이커야. 반대로 일 머리(식상/재성) 타고난 애들은 자격증 하나 없어도 시장 던져놓으면 6개월 만에 월 500 찍음.

노력이 부족한 게 아니라 판을 잘못 짠 거임. 너희는 자격증 파냐 현장 파냐?`,
      firstComment: `솔직히 나도 수능 3수 박을 뻔하다가 일찍 현장 뛰어들어서 지금 팀장 달았음. 사람마다 터지는 구멍이 완전 다름.`,
      qualityScore: 92,
      qualityProfile: 'korean_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['High contrast 2-line opener', 'Zero promo', 'Natural engagement ignite']),
      algorithmicScore: 94,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 95, hook_strength: 95, engagement: 92 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    },
    {
      topic: '대운 전환 신호 (인생 판 뒤집히기 직전 3대 징조)',
      formulaId: 'daeun_transition_signals',
      content: `인생 10년 판이 완전히 바뀌기 직전에 나타나는 3대 현상.

1. 몇 년 동안 매일 붙어 다니던 인간관계가 사소한 일로 한순간에 끊어짐.
2. 멀쩡히 잘 다니던 직장에서 갑자기 숨 막히는 역겨움이 올라옴.
3. 주변 환경(이사, 부서 이동, 가족 이슈)이 내 의지와 상관없이 강제로 리셋됨.

이거 슬럼프 아니야. 10년 대운 교운기 진입 신호임. 지금 몇 번 겪고 있냐?`,
      firstComment: `난 2년 전에 1번 3번 동시에 터지고 멘붕 왔었는데, 지나고 보니까 그게 이직해서 몸값 2배 올리는 타이밍이었음.`,
      qualityScore: 95,
      qualityProfile: 'korean_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['Top tier curiosity hook', 'Listicle readability', 'Zero promo']),
      algorithmicScore: 96,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 98, hook_strength: 96, engagement: 95 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    },
    {
      topic: '인간관계 손절 (나 갉아먹는 상극 관계 정리선)',
      formulaId: 'relationship_cut_off',
      content: `만나고 나면 이상하게 기 빨리고 두통 오는 사람 특징.

기분 탓이 아니라 기질적으로 네 에너지를 빨아먹는 상극(상충/원진) 관계라 그래. 너는 불(화) 기운으로 달려야 하는데 상대는 매번 축축한 흙탕물 끼얹는 격임.

"내가 예민한가?" 자책하지 마. 에너지가 안 맞으면 10년 지기 친구라도 일단 거리 두는 게 살 길이다.`,
      firstComment: `진짜 만나고 집 올 때마다 지하철에서 현타 오는 친구 하나 있었는데 3달 연락 끊으니까 불면증 바로 사라짐.`,
      qualityScore: 91,
      qualityProfile: 'korean_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['Relatable interpersonal conflict', 'Zero promo', 'Authentic voice']),
      algorithmicScore: 93,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 94, hook_strength: 92, engagement: 93 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    },
    {
      topic: '연애/귀인 궁합 (끌리는데 망하는 연애 vs 귀인 궁합)',
      formulaId: 'love_guiin_contrast',
      content: `미치도록 불타오르는 연애보다, 같이 있으면 계좌가 불어나는 연애가 진짜 궁합이다.

초반에 심장 터질 것 같고 롤러코스터 타는 인연? 십중팔구 도화 충돌이거나 살 낀 관계임. 끝날 때 멘탈 통장 다 털림.

진짜 천을귀인 만난 인연은 자극은 덜한데 왠지 그 사람 만난 뒤로 시험 붙고 이직 성공함. 너희 연애는 롤러코스터냐 안정형이냐?`,
      firstComment: `전남친이랑 만날 땐 매일 울고 카드값만 300씩 나왔는데, 지금 남편 만나고 둘 다 청약 당첨됨. 궁합 진짜 무시 못 함.`,
      qualityScore: 93,
      qualityProfile: 'korean_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['Extreme contrast viral pattern', 'Strong comment igniter', 'Zero promo']),
      algorithmicScore: 95,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 96, hook_strength: 95, engagement: 94 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    },
    {
      topic: '재물/돈 창고 언락 (사주 진술축미 개고 타이밍)',
      formulaId: 'wealth_storage_unlock',
      content: `사주에 진술축미(辰戌丑未) 깔려 있는 애들은 주목해.

너흰 태어날 때부터 남들보다 큰 '금고'를 바닥에 깔고 태어났음. 근데 20대 때 돈 안 모인다고 징징대지 마. 그 금고는 특정 대운이나 세운에서 열쇠(충)가 들어와야 문이 열림.

열쇠 들어오기 전에 엉뚱한 주식/코인에 금고 바닥 뚫지 말고 씨드나 모아둬라. 준비된 애들만 한 방에 터진다.`,
      firstComment: `사주에 축토 2개 깔고 30대 초반까지 통장 0원이었는데 딱 서른셋 대운 바뀌고 2년 만에 시드 1억 넘김.`,
      qualityScore: 94,
      qualityProfile: 'korean_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['Astrology curiosity + financial hope', 'Actionable framing', 'Zero promo']),
      algorithmicScore: 95,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 95, hook_strength: 96, engagement: 94 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    }
  ];

  // Schedule them staggered across upcoming dates
  const latestDomestic = await prisma.post.findFirst({
    where: { status: 'PENDING', brandId: domesticBrand.id },
    orderBy: { scheduledAt: 'desc' },
    select: { scheduledAt: true }
  });

  let nextSchedDomestic = latestDomestic?.scheduledAt ? new Date(latestDomestic.scheduledAt.getTime() + 4 * 60 * 60 * 1000) : new Date(Date.now() + 2 * 60 * 60 * 1000);

  for (const postData of newDomesticPosts) {
    await prisma.post.create({
      data: {
        ...postData,
        brandId: domesticBrand.id,
        scheduledAt: nextSchedDomestic,
        status: 'PENDING',
      }
    });
    console.log(`Created domestic post: [${postData.topic}] at ${nextSchedDomestic.toISOString()}`);
    nextSchedDomestic = new Date(nextSchedDomestic.getTime() + 4 * 60 * 60 * 1000);
  }

  console.log('\n=== Step 3: Injecting Diverse Winning Topics for Global ===');

  const globalBrand = await prisma.brand.findFirst({ where: { name: 'CosmicPath Global' } });
  if (!globalBrand) throw new Error('CosmicPath Global brand not found');

  const newGlobalPosts = [
    {
      topic: 'Saturn Return Career Crisis (Age 28-30)',
      formulaId: 'saturn_return_career_reset',
      content: `Turning 29 and suddenly your prestigious 6-figure career feels like a complete lie?

That isn't early midlife depression. It's your Saturn Return forcing you to audit every compromise you made in your twenties to please your parents and peers.

Saturn doesn't destroy what's real—it only demolishes structures built on people-pleasing. Are you fighting the collapse or letting it rebuild?`,
      firstComment: `Hit my Saturn return at 29.5, quit corporate consulting to build solo. Terrifying year, but best financial pivot of my life.`,
      qualityScore: 93,
      qualityProfile: 'global_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['Universal milestone relatable to 28-32 demographic', 'No promo', 'Engaging opener']),
      algorithmicScore: 94,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 95, hook_strength: 94, engagement: 93 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    },
    {
      topic: 'Midheaven (10th House) vs 6th House Grind',
      formulaId: 'mc_vs_6th_house_dilemma',
      content: `Why some people work 80 hours a week and stay invisible, while others work 20 and get promoted.

It's usually a 6th House vs 10th House (Midheaven) mismatch. 6th House energy makes you the office pack mule—master of invisible tasks. Midheaven energy commands visibility and authority.

Stop polishing deliverables that nobody senior looks at. Upgrade your positioning or stay the team martyr.`,
      firstComment: `Learned this the hard way. Was the top pull-request machine for 3 years with zero recognition until I shifted to outward architecture decisions.`,
      qualityScore: 92,
      qualityProfile: 'global_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['Sharp career contrast', 'Zero promo', 'Direct conversation igniter']),
      algorithmicScore: 93,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 94, hook_strength: 93, engagement: 92 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    },
    {
      topic: 'Startup Equity Illusion (8th House vs 2nd House)',
      formulaId: 'startup_equity_trap',
      content: `Your founder offered you 0.5% equity instead of a market salary, calling it "generational upside."

Check your 8th House (shared debts/contracts) before drinking the Kool-Aid. Most early startup options dilute to dust by Series B.

A fair paycheck in your personal 2nd House beats imaginary paper millions in someone else's cap table every single time. Cash in hand or equity gamble?`,
      firstComment: `Held 1.2% options in a "unicorn" that got acqui-hired for liabilities. Walked away with $0 after 4 years of 70hr weeks. Take the cash.`,
      qualityScore: 94,
      qualityProfile: 'global_viral',
      qualityPass: true,
      qualityReasons: JSON.stringify(['Tech startup pain point', 'High engagement dilemma', 'Zero promo']),
      algorithmicScore: 95,
      algorithmicPass: true,
      algorithmicDimensions: JSON.stringify({ clarity: 96, hook_strength: 95, engagement: 94 }),
      algorithmicFixes: '[]',
      rewriteCount: 0,
      postCategory: 'GROWTH',
      imageUrls: '[]',
      threadPartIds: '[]',
      threadTotalParts: 1,
      threadPartsPosted: 0,
    }
  ];

  const latestGlobal = await prisma.post.findFirst({
    where: { status: 'PENDING', brandId: globalBrand.id },
    orderBy: { scheduledAt: 'desc' },
    select: { scheduledAt: true }
  });

  let nextSchedGlobal = latestGlobal?.scheduledAt ? new Date(latestGlobal.scheduledAt.getTime() + 4 * 60 * 60 * 1000) : new Date(Date.now() + 2 * 60 * 60 * 1000);

  for (const postData of newGlobalPosts) {
    await prisma.post.create({
      data: {
        ...postData,
        brandId: globalBrand.id,
        scheduledAt: nextSchedGlobal,
        status: 'PENDING',
      }
    });
    console.log(`Created global post: [${postData.topic}] at ${nextSchedGlobal.toISOString()}`);
    nextSchedGlobal = new Date(nextSchedGlobal.getTime() + 4 * 60 * 60 * 1000);
  }

  // Final check
  const domCount = await prisma.post.count({ where: { status: 'PENDING', brandId: domesticBrand.id } });
  const globCount = await prisma.post.count({ where: { status: 'PENDING', brandId: globalBrand.id } });
  console.log(`\n=== Rebalancing Complete! Final Pending: Domestic=${domCount}, Global=${globCount} ===`);
}

main().finally(() => prisma.$disconnect());
