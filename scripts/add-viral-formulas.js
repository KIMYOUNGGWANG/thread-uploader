/**
 * add-viral-formulas.js
 *
 * CosmicPath 브랜드에 바이럴 공식 3개를 추가하는 일회성 마이그레이션.
 * 실행: node scripts/add-viral-formulas.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const NEW_FORMULAS = [
  {
    id: "tag_friend",
    name: "태그유도형",
    weight: 3,
    instruction: `특정 사주/별자리 유형의 사람을 너무 정확하게 묘사해서 "이거 완전 내 친구 얘기다" 반응을 유발하는 포스트.

구조:
- 오프닝: "[특정 유형] 사람들 있잖아. 이거 들으면 알 거야." 또는 유사한 방식으로 특정 유형을 지목
- 본문: 그 유형 특유의 행동 패턴 3-4가지를 아주 구체적으로 묘사. "이럴 때 이렇게 한다" 장면 묘사 필수. 추상적 설명 금지.
- 마무리: "주변에 이런 사람 있으면 몰래 보내줘" 또는 "이거 해당되는 사람 태그하고 싶어졌지?"

핵심: 묘사가 충격적으로 정확해야 함. 독자가 자기 자신 또는 아는 사람을 즉시 떠올릴 수 있을 것.
태그/공유 유도가 마무리에 자연스럽게 녹아야 함.`,
  },
  {
    id: "prophecy",
    name: "예언형",
    weight: 3,
    instruction: `"이번 [달/주/시기]에 [특정 사주/별자리 유형]에게 반드시 일어날 일" 구조로 시간 제한 긴박감을 만드는 포스트.

구조:
- 오프닝: "이번 달 [타입]들한테 무조건 생기는 일 알아?" 또는 "지금 이 글 보이면 이유 있는 거야"
- 본문: 구체적 상황 2-3가지 예언. 막연한 "좋은 일이 생긴다" 금지. "갑자기 연락이 오거나", "결정을 강요받는 상황", "오래된 감정이 다시 올라오는" 등 구체적 장면 묘사.
- 마무리: "저장해두고 월말에 확인해봐" 형식으로 저장 유도.

핵심: 저장 CTA가 자연스러워야 함. 시간이 지나면 확인할 수 있다는 구조가 저장 동기를 만듦.`,
  },
  {
    id: "insider",
    name: "내부자폭로형",
    weight: 3,
    instruction: `"사주를 많이 본 사람만 아는 것", "점집에서 말 안 해주는 이유" 구조로 독자를 희귀 정보의 수혜자로 만드는 포스트.

구조:
- 오프닝: "사주 오래 본 사람들은 다 아는데" 또는 "이거 아무도 대놓고 말 안 해줌"
- 본문: 일반적으로 알려지지 않은 사주/점성술 인사이트 2-3가지. 각 항목은 "표면적 설명 → 진짜 이유" 구조로.
- 마무리: "알면 알수록 신기한 게 사주야" 또는 "이거 스크린샷 해두면 나중에 써먹음"

핵심: "내가 특별한 정보를 먼저 알게 됐다"는 느낌을 줘야 함. 스크린샷/저장/공유 동기는 여기서 발생.`,
  },
];

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: "cosmicpath" } });
  if (!brand) {
    console.error("❌ CosmicPath 브랜드를 찾을 수 없습니다.");
    process.exit(1);
  }

  const config = JSON.parse(brand.brandConfig);
  const existingIds = config.formulas.map((f) => f.id);

  const toAdd = NEW_FORMULAS.filter((f) => !existingIds.includes(f.id));
  if (toAdd.length === 0) {
    console.log("ℹ️  이미 모든 공식이 추가되어 있습니다.");
    return;
  }

  config.formulas = [...config.formulas, ...toAdd];

  await prisma.brand.update({
    where: { id: brand.id },
    data: { brandConfig: JSON.stringify(config) },
  });

  console.log(`✅ ${toAdd.length}개 공식 추가 완료: ${toAdd.map((f) => f.id).join(", ")}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
