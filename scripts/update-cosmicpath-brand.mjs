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
    formulaId: "scandal_flip",
    topic: "타로 전면 폐기",
    content: `솔직히 고백하자면, 지난달까지 우리 앱 결제율 1위였던 타로 기능을 전면 삭제하고 쓰레기통에 넣었다.

주변에서는 다 미쳤냐고 말렸다. 제일 돈 잘 벌리는 기능을 왜 지우냐고.

이유는 단순하다.
타로는 불안한 사람에게 두루뭉술한 바넘 효과로 가짜 위로를 팔기 가장 좋은 도구다.
"좋은 인연이 올 거예요", "곧 마음이 편해집니다"
이런 말로 결제는 쉽게 유도하지만, 정작 중요한 이직·퇴사·계약의 골든타임은 날려버린다.

위로가 필요하면 상담실을 찾아가라.
우리는 사주·점성술·자미두수·태국 점성술·수비학 5대 계산 공식으로 교차 검증된 냉혹한 의사결정 판정만 남기기로 했다.

돈보다 소중한 건 당신의 인생 타이밍이다. 이직 전이라면 저장해두고 꺼내봐.
#이직고민`,
    firstComment: `지금 내 이직·퇴사 골든타임 판정 리포트 확인하기:
https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1`,
  },
  {
    formulaId: "industry_secret",
    topic: "진태양시 30분 왜곡 폭로",
    content: `혹시 알고 있어? 한국인 10명 중 7명은 자기가 태어난 시간(시주)을 잘못 알고 있다.

지금 당장 태어난 시간을 30분 빼고 사주를 다시 봐라.
시주가 바뀌면서 평생 알던 사주의 절반이 뒤집힌다.

한국은 1961년부터 일본 동경 135도 표준시(KST)를 쓰고 있다.
실제 서울 기준 태양 남중 시간과 32분 오차가 난다.
11시 10분에 태어났다고 오시(午時)가 아니라, 진태양시로 보정하면 사시(巳時)다.

시주가 틀리면 이직 타이밍, 말년운, 행동 골든타임 계산이 엉터리가 된다.
30분 오차도 안 잡고 수십만 원 복채 받는 철학관을 아직도 믿는가?

사주는 신비주의가 아니라 천문 역학 데이터다. 저장해두고 내 진짜 시주를 확인해봐.
#진태양시`,
    firstComment: `내 진태양시 30분 보정 및 5대 엔진 교차 분석 보기:
https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1`,
  },
  {
    formulaId: "common_enemy",
    topic: "가짜 위로 거르기",
    content: `이직이나 퇴사를 고민할 때 "올해 좋은 기운 온다"고 말하는 곳은 당장 걸러라.

"좋은 기운"이란 말은 아무 책임도 지지 않겠다는 뜻이다.
결정의 기로에 선 사람에게 필요한 건 따뜻한 위로가 아니다.
"이번 달에 움직이면 리스크가 몇 %인지", "지금 버틸지 옮길지"에 대한 명쾌한 판정이다.

CosmicPath는 사주, 점성술, 자미두수, 태국 점성술, 수비학 5개 엔진을 교차 검증한다.
3개 이상 엔진이 불일치하면 가차 없이 "행동 보류" 판정을 내린다.

A. 버팀형 (내부 조건 재정비)
B. 이동형 (골든타임 진입, 즉시 실행)
C. 준비형 (2~4주 리스크 헷징 후 전환)

위로받으려면 타로를 봐라. 결정을 내리려면 CosmicPath를 봐라. 저장해두고 다음 선택 전에 다시 확인해.
#커리어`,
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
      "진태양시 30분 왜곡",
      "5대 계산 엔진 교차 검증",
      "이직·퇴사 골든타임",
      "타로 전면 폐기",
      "의사결정 도시에",
      "사주",
      "자미두수",
      "커리어 리스크 헷징",
    ],
    systemPrompt: brandVoice,
    productProfile: {
      productName: "CosmicPath",
      oneLineDescription:
        "5대 동서양 결정론적 계산 엔진과 진태양시 정밀 보정 기반의 VIP 인생 의사결정 도시에(Executive Decision Dossier)",
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
        "타로 전면 퇴출. 사주·점성술·자미두수·태국왕실·수비학 5대 엔진 및 진태양시 30분 오차 보정. 컨설팅 펌 스타일의 냉철한 인텔리전스.",
    },
    activeExperiment: {
      id: "five_engine_decision_dossier_launch",
      name: "5-Engine VIP Decision Dossier Launch",
      hypothesis:
        "타로 폐기 선언 및 진태양시 30분 왜곡 폭로 스턴트가 의사결정을 앞둔 2542 타깃의 높은 댓글 논쟁과 고관여 유료 전환을 이끌어낸다.",
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
