import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const prisma = new PrismaClient();

const STUNT_POSTS = [
  {
    formulaId: "career_mismatch",
    topic: "식상 vs 관성 기질 미스매치",
    content: `네가 지난 이직에서 1년 만에 번아웃 온 건 노력이 부족해서가 아니다.

넌 실행력과 독창성(식상)이 80%인 기질인데, 보고 체계만 5단계인 꼰대 위계 조직(관성)에 들어갔기 때문이다.
내부 기질과 조직 아키텍처가 정면 충돌하는데 어떻게 버티겠는가?

주변에서는 "너 사회성 부족하다", "조금만 더 참아라" 위로랍시고 훈수 둘 거다.
다 헛소리다. 성격 문제가 아니라 기질과 환경 설계의 수학적 미스매치다.

이 상태에서 포지션 안 바꾸고 회사만 옮겨봤자 똑같은 이유로 1년 뒤 퇴사한다.
자책하지 마라. 네 기질에 맞는 승부처를 먼저 계산해라. 이직 전이라면 저장해두고 꺼내봐.
#이직고민`,
    firstComment: `내 기질과 조직 적합도 5대 엔진 판정 리포트 확인하기:
https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1`,
  },
  {
    formulaId: "energy_reset_cycle",
    topic: "10년 대운 교운기 번아웃",
    content: `멀쩡히 잘 다니던 회사에서 갑자기 모든 의욕이 사라지고 출근길에 눈물이 난다면?

우울증이나 슬럼프를 의심하기 전에 네 10년 대운 주기부터 확인해라.
대운이 바뀌기 직전 1~2년(교운기)은 기존의 인간관계, 직장, 판이 통째로 리셋되는 구간이다.

이 타이밍에 홧김에 사표 던지거나 무리하게 창업 베팅하면 100% 물린다.
판이 흔들릴 때는 새로운 패를 쥐는 게 아니라, 기존 리스크를 헷징하고 현금을 쥐고 방어해야 한다.

운이 나쁜 게 아니라 리셋 타이밍이다. 결정 내리기 전에 네 진짜 교운기부터 계산해봐.
#퇴사고민`,
    firstComment: `10년 대운 교체기 리스크 방어 판정 보기:
https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1`,
  },
  {
    formulaId: "multi_engine_audit",
    topic: "단일 사주의 맹점 폭로",
    content: `철학관에서 "올해 대박 난다"는 말 믿고 사업 확장했다가 빚더미 앉은 사람들 공통점이 있다.

동양 사주 하나만 보고 베팅했다는 점이다.
사주에서는 세운이 좋아 보여도, 서양 점성술 트랜짓(Transit)에서는 토성이 직업궁을 정면 강타하고 있는 경우가 태반이다.

비행기 조종사가 계기판 딱 하나만 보고 야간 비행을 하겠는가?
인생의 중대 결정을 내리면서 단일 도구의 말장난에 기대는 건 자살행위다.

사주, 점성술, 자미두수, 태국 점성술, 수비학 5개 엔진을 교차 검증해라.
3개 이상 일치하지 않으면 무조건 "행동 보류"다. 저장해두고 다음 베팅 전에 확인해.
#의사결정`,
    firstComment: `위로 대신 5대 엔진 냉혹한 의사결정 도시에 바로가기:
https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1`,
  },
];

async function main() {
  console.log("🚀 Updating CosmicPath brand for 5-Engine VIP Dossier...");

  const brand = await prisma.brand.findUnique({
    where: { slug: "cosmicpath" },
  });

  if (!brand) {
    throw new Error("CosmicPath brand not found in database!");
  }

  const brandVoicePath = path.resolve(root, ".agents/memory/brand-voice.md");
  const brandVoice = fs.existsSync(brandVoicePath)
    ? fs.readFileSync(brandVoicePath, "utf-8")
    : "";

  const existingConfig = JSON.parse(brand.brandConfig || "{}");

  const updatedConfig = {
    ...existingConfig,
    topics: [
      "식상 vs 관성 기질 미스매치",
      "10년 대운 교운기 번아웃",
      "5대 계산 엔진 교차 검증",
      "이직·퇴사 골든타임",
      "의사결정 도시에",
      "사주와 점성술 교차 판정",
      "자미두수 리스크 분석",
      "커리어 리스크 헷징",
    ],
    systemPrompt: brandVoice,
    productProfile: {
      productName: "CosmicPath",
      oneLineDescription:
        "5대 동서양 결정론적 계산 엔진 교차 검증 기반의 VIP 인생 의사결정 도시에(Executive Decision Dossier)",
      targetCustomer:
        "25-42세 이직·퇴사·창업·투자·결혼의 중대 갈림길에 선 결정권자",
      offerPromise:
        "위로 대신 5대 엔진 교차 검증으로 인생 골든타임과 리스크 방어 판정(Verdict) 제공",
      landingUrl:
        "https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1",
      primaryChannel: "threads",
      primaryMetric: "views",
      conversionMetric: "dossier_conversions",
      positioningNotes:
        "사주·점성술·자미두수·태국왕실·수비학 5대 엔진 교차 분석. 단일 도구 맹신과 무속적 위로 배제. 컨설팅 펌 스타일의 냉철한 인텔리전스.",
    },
    activeExperiment: {
      id: "five_engine_decision_dossier_launch",
      name: "5-Engine VIP Decision Dossier Launch",
      hypothesis:
        "기질 미스매치, 대운 교운기 리스크, 5대 엔진 교차 분석 웻지가 의사결정을 앞둔 2542 타깃의 높은 저장과 고관여 유료 전환을 이끌어낸다.",
      stage: "content",
      startedAt: "2026-08-27T00:00:00.000Z",
      durationDays: 7,
      primaryMetric: "views",
      guardrailMetric: "quality_pass_rate",
      status: "active",
    },
    campaign: {
      id: "five_engine_decision_dossier_launch",
      name: "5-Engine VIP Decision Dossier Launch",
      mode: "landing-test",
      qualityProfile: "saju_viral",
      landingUrl:
        "https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1",
      utmSource: "threads",
      utmCampaign: "decision_timing_rebuild_v1",
      utmContentTemplate: "{{postId}}",
      dailyPostTarget: 3,
      linkCadenceEvery: 1,
      linkPlacement: "firstComment",
    },
  };

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      brandConfig: JSON.stringify(updatedConfig),
    },
  });

  console.log("✅ Brand config successfully updated!");

  // Check if stunt posts are already queued
  const now = new Date();
  for (let i = 0; i < STUNT_POSTS.length; i++) {
    const stunt = STUNT_POSTS[i];
    const existing = await prisma.post.findFirst({
      where: {
        brandId: brand.id,
        formulaId: stunt.formulaId,
      },
    });

    if (existing) {
      console.log(`ℹ️ Post for ${stunt.formulaId} already exists (id: ${existing.id}, status: ${existing.status})`);
    } else {
      const scheduledAt = new Date(now.getTime() + (i + 1) * 3600 * 1000);
      const post = await prisma.post.create({
        data: {
          brandId: brand.id,
          content: stunt.content,
          firstComment: stunt.firstComment,
          formulaId: stunt.formulaId,
          topic: stunt.topic,
          targetAudience: updatedConfig.productProfile.targetCustomer,
          scheduledAt,
          status: "PENDING",
        },
      });
      console.log(`✅ Created stunt post ${i + 1} (${stunt.formulaId}) -> Post ID: ${post.id}`);
    }
  }

  console.log("🎉 All 3 CosmicPath launch stunt posts queued successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
