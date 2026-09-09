import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

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

const MODULAR_FORMULA = {
  id: "modular_audit",
  name: "7단계 모듈러 감사형",
  weight: 3,
  instruction: `이직/퇴사/커리어 의사결정의 딜레마를 '7단계 모듈러 엔진 감사' 프레임으로 분해하여 독자에게 강력한 실용성과 저장 가치를 제공하는 포스트.

구조:
- 훅: 타깃의 현실적인 불안(결산 직후 입사, 사내정치 스케이프고트, 3달 뒤 카드값, 번아웃)을 1~2줄 대담한 단언과 반전으로 찌른다.
- 본문 (1~5단계): 누구나 본인 상황을 대조해볼 수 있는 구체적인 5개 체크 포인트 (진태양시 보정, 10년 대운 변곡점, 식상/관성 마찰지수, 통장 잔고 런웨이, 경영진 궁합 리스크)를 간결하게 제시.
- 결핍과 행동선 (6~7단계): 핵심 결론인 6단계(의사결정 모드 판정: 버팀/이동/준비)와 7단계(개인별 탈출 골든타임 윈도우)는 "각자 데이터에 따라 완전히 갈린다"는 결핍(Curiosity Gap)을 남긴다.
- 마무리: "저장해두고 다음 선택 전에 기준 삼아봐." 형식으로 저장 유도. (댓글에 특정 단어 남기라는 Reply-Burden 절대 금지!)
- 첫 댓글: "내 7단계 정밀 진단 리포트가 필요하면 프로필 링크에서 확인해봐" 형식의 자연스러운 연결.`,
};

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: "cosmicpath" } });
  if (!brand) {
    console.error("❌ CosmicPath 브랜드를 찾을 수 없습니다.");
    process.exit(1);
  }

  const config = JSON.parse(brand.brandConfig || "{}");
  if (!Array.isArray(config.formulas)) {
    config.formulas = [];
  }

  const existingIdx = config.formulas.findIndex((f) => f.id === MODULAR_FORMULA.id);
  if (existingIdx >= 0) {
    console.log("ℹ️  modular_audit 공식이 이미 존재하여 업데이트합니다.");
    config.formulas[existingIdx] = MODULAR_FORMULA;
  } else {
    config.formulas.push(MODULAR_FORMULA);
    console.log("✅ modular_audit 공식이 새롭게 추가되었습니다.");
  }

  // Also add to active campaigns if available
  if (Array.isArray(config.campaigns)) {
    for (const campaign of config.campaigns) {
      if (Array.isArray(campaign.formulas) && !campaign.formulas.some((f) => f.id === MODULAR_FORMULA.id)) {
        campaign.formulas.push(MODULAR_FORMULA);
      }
    }
  }

  await prisma.brand.update({
    where: { id: brand.id },
    data: { brandConfig: JSON.stringify(config) },
  });

  console.log("🎉 brandConfig 업데이트 완료!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
