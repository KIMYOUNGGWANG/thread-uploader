# Viral Content Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Threads 텍스트 콘텐츠의 바이럴 도달률을 높이기 위해 생성 모델 업그레이드, 바이럴 공식 3개 추가, 트렌딩 토픽 주입 시스템을 구현한다.

**Architecture:** `BrandConfig` 타입에 `trendingTopics` 필드를 추가하고, Generate API에서 기존 topics + trendingTopics를 합산해 풀을 구성한다. 모델을 Haiku에서 Sonnet으로 교체하고, DB 마이그레이션 스크립트로 3개 바이럴 공식을 CosmicPath에 추가한다. 브랜드 설정 UI에 트렌딩 토픽 탭을 추가해 주 1회 수동 운영을 지원한다.

**Tech Stack:** Next.js App Router · TypeScript · Prisma (PostgreSQL) · Anthropic SDK · React (Tailwind + Shadcn/UI)

---

## File Map

| 파일 | 변경 유형 | 역할 |
|------|----------|------|
| `src/types/brand.ts` | 수정 | `trendingTopics?: string[]` 필드 추가 |
| `src/app/api/generate/route.ts` | 수정 | 모델 교체 + trendingTopics 토픽 풀 합산 |
| `scripts/add-viral-formulas.js` | 생성 | 3개 바이럴 공식을 DB에 추가하는 일회성 스크립트 |
| `src/components/BrandSettingsForm.tsx` | 수정 | 트렌딩 탭 + trendingTopics 상태 + 저장 |

---

## Task 1: BrandConfig 타입에 trendingTopics 추가

**Files:**
- Modify: `src/types/brand.ts`

- [ ] **Step 1: BrandConfig 인터페이스에 trendingTopics 추가**

`src/types/brand.ts`의 BrandConfig 인터페이스를 다음과 같이 수정한다:

```typescript
export interface BrandConfig {
  systemPrompt: string;
  topics: string[];
  targets: string[];
  situations: string[];
  websiteUrl: string;
  formulas: BrandFormula[];
  qualityRules?: BrandQualityRules;
  trendingTopics?: string[];
}
```

- [ ] **Step 2: DEFAULT_BRAND_CONFIG에 trendingTopics 추가**

```typescript
export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  systemPrompt: "",
  topics: [],
  targets: [],
  situations: [],
  websiteUrl: "",
  formulas: [],
  trendingTopics: [],
};
```

- [ ] **Step 3: parseBrandConfig에 trendingTopics 파싱 추가**

```typescript
export function parseBrandConfig(raw: string): BrandConfig {
  try {
    const parsed = JSON.parse(raw) as Partial<BrandConfig>;
    return {
      systemPrompt: parsed.systemPrompt ?? DEFAULT_BRAND_CONFIG.systemPrompt,
      topics: parsed.topics ?? DEFAULT_BRAND_CONFIG.topics,
      targets: parsed.targets ?? DEFAULT_BRAND_CONFIG.targets,
      situations: parsed.situations ?? DEFAULT_BRAND_CONFIG.situations,
      websiteUrl: parsed.websiteUrl ?? DEFAULT_BRAND_CONFIG.websiteUrl,
      formulas: parsed.formulas ?? DEFAULT_BRAND_CONFIG.formulas,
      qualityRules: parsed.qualityRules,
      trendingTopics: parsed.trendingTopics ?? [],
    };
  } catch {
    return DEFAULT_BRAND_CONFIG;
  }
}
```

- [ ] **Step 4: 타입 체크 확인**

```bash
pnpm typecheck
```

오류 없음 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/types/brand.ts
git commit -m "feat: add trendingTopics field to BrandConfig"
```

---

## Task 2: Generate API — 모델 업그레이드 + trendingTopics 합산

**Files:**
- Modify: `src/app/api/generate/route.ts` (line 50, line 142)

- [ ] **Step 1: 모델을 Sonnet으로 교체**

`src/app/api/generate/route.ts` 50번째 줄:

```typescript
// 변경 전
model: "claude-haiku-4-5-20251001",

// 변경 후
model: "claude-sonnet-4-6",
```

- [ ] **Step 2: trendingTopics를 토픽 풀에 합산**

같은 파일에서 `const topics = shuffleTopics(config.topics, count);` 라인을 찾아 다음으로 교체:

```typescript
const allTopics = [...config.topics, ...(config.trendingTopics ?? [])];
if (allTopics.length === 0) {
  return NextResponse.json({ error: "토픽이 없습니다. 브랜드 설정에서 주제 또는 트렌딩 토픽을 추가하세요." }, { status: 400 });
}
const topics = shuffleTopics(allTopics, count);
```

- [ ] **Step 3: 타입 체크 및 빌드 확인**

```bash
pnpm typecheck && pnpm build
```

오류 없음 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: upgrade model to Sonnet + merge trendingTopics into topic pool"
```

---

## Task 3: 바이럴 공식 3개 DB 추가 스크립트

**Files:**
- Create: `scripts/add-viral-formulas.js`

- [ ] **Step 1: 스크립트 생성**

`scripts/add-viral-formulas.js` 파일을 다음 내용으로 생성:

```javascript
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
```

- [ ] **Step 2: 스크립트 실행**

```bash
node scripts/add-viral-formulas.js
```

예상 출력:
```
✅ 3개 공식 추가 완료: tag_friend, prophecy, insider
```

- [ ] **Step 3: DB 확인**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.brand.findFirst({ where: { slug: 'cosmicpath' } })
  .then(b => {
    const c = JSON.parse(b.brandConfig);
    console.log('공식 목록:', c.formulas.map(f => f.id).join(', '));
    console.log('총', c.formulas.length, '개');
  })
  .finally(() => prisma.\$disconnect());
"
```

예상 출력에 `tag_friend, prophecy, insider` 포함 확인.

- [ ] **Step 4: 커밋**

```bash
git add scripts/add-viral-formulas.js
git commit -m "feat: add tag_friend/prophecy/insider viral formulas to CosmicPath DB"
```

---

## Task 4: BrandSettingsForm — 트렌딩 토픽 탭 추가

**Files:**
- Modify: `src/components/BrandSettingsForm.tsx`

- [ ] **Step 1: lucide-react import에 TrendingUp 추가**

파일 상단 import를 다음으로 교체:

```typescript
import {
  ArrowLeft, Save, Plus, Trash2, RefreshCw, Settings,
  Sparkles, FileText, Users, MessageSquare, Zap, Key, TrendingUp,
} from "lucide-react";
```

- [ ] **Step 2: Tab 타입에 "trending" 추가**

```typescript
type Tab = "basic" | "ai" | "topics" | "targets" | "situations" | "formulas" | "trending";
```

- [ ] **Step 3: trendingTopics 상태 추가**

기존 `const [formulas, setFormulas] = ...` 라인 바로 아래에 추가:

```typescript
const [trendingTopics, setTrendingTopics] = useState<string[]>(
  initialData.config.trendingTopics ?? []
);
```

- [ ] **Step 4: handleSave의 brandConfig에 trendingTopics 추가**

`handleSave` 내부의 brandConfig 객체를 다음으로 교체:

```typescript
brandConfig: {
  systemPrompt,
  websiteUrl,
  topics,
  targets,
  situations,
  formulas,
  trendingTopics,
} satisfies BrandConfig,
```

- [ ] **Step 5: useCallback 의존성 배열에 trendingTopics 추가**

`handleSave`의 useCallback 의존성 배열을 다음으로 교체:

```typescript
}, [brandId, name, accessToken, threadsUserId, tokenExpiry, systemPrompt, websiteUrl, topics, targets, situations, formulas, trendingTopics, router]);
```

- [ ] **Step 6: TABS 배열에 트렌딩 탭 추가**

TABS 배열 마지막 항목 뒤에 추가:

```typescript
{ id: "trending", label: "트렌딩", icon: <TrendingUp className="w-4 h-4" />, badge: trendingTopics.length },
```

- [ ] **Step 7: main content에 TrendingTab 렌더 추가**

`{activeTab === "formulas" && ...}` 블록 바로 아래에 추가:

```tsx
{activeTab === "trending" && (
  <ListTab
    label="트렌딩 토픽"
    description="이번 주 핫한 시즌/이슈 키워드. 콘텐츠 생성 시 기존 주제와 함께 랜덤으로 사용됩니다. 매주 1회 업데이트하세요."
    placeholder="예: 수성 역행 2026년 5월"
    items={trendingTopics}
    setItems={setTrendingTopics}
  />
)}
```

- [ ] **Step 8: 타입 체크 및 빌드 확인**

```bash
pnpm typecheck && pnpm build
```

오류 없음 확인.

- [ ] **Step 9: 커밋**

```bash
git add src/components/BrandSettingsForm.tsx
git commit -m "feat: add trending topics tab to BrandSettingsForm"
```

---

## Task 5: 검증

- [ ] **Step 1: 전체 빌드 통과 확인**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

세 커맨드 모두 오류 없음.

- [ ] **Step 2: 개발 서버 실행**

```bash
pnpm dev
```

- [ ] **Step 3: 트렌딩 탭 UI 확인**

브라우저에서 `/brands/cosmicpath/settings` 접속 → "트렌딩" 탭 클릭 → 토픽 추가/삭제/저장 동작 확인.

- [ ] **Step 4: 콘텐츠 생성 품질 확인**

브랜드 대시보드에서 포스트 3개 생성 (count: 3). 생성된 포스트에서 다음을 육안 확인:
- Sonnet 업그레이드로 formula instruction 구조가 더 정확히 반영됨
- "보내줘" / "태그" / "저장해" / "스크린샷" CTA 포함 비율 증가
- `tag_friend` / `prophecy` / `insider` 공식이 사용됨 (formulaId 컬럼 확인)

- [ ] **Step 5: 최종 커밋 없음** (각 태스크에서 이미 커밋 완료)
