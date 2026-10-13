# Viral Engine v2 — 측정 → 도달 → 전환 → 운영

Date: 2026-10-13
Scope: 모든 브랜드. 신규 DB 컬럼 없음, 신규 의존성 없음.
Goal: 1단계 "내 제품의 Threads 바이럴 성과 극대화". 2단계(SaaS 제품화)는 별도 spec.

## 현재 상태 (코드 분석 결과)

루프는 이미 닫혀 있다 (생성 → 발행 → 지표 수집 → learn/feedback → 트렌드 → refill).
그러나 네 지점에서 새고 있다.

| 병목 | 근거 |
|---|---|
| 학습 | 주간 집계가 없다. `computeWeeklyLift`는 응답에만 실리고 저장·표시되지 않는다. breakout율, 주간 퍼널이 없다. `formulaWeights`는 같은 300개 창을 매일 ±1 해서 상위 공식이 10으로 수렴한다 (priors에서 2026-10-08에 고친 것과 같은 버그). feedback cron은 clicks/paid를 select하지 않아 점수가 어긋난다. |
| 도달 | 30만 뷰 검증 공식 `imagination_dilemma`는 "자, 상상해봐" 도입을 요구하는데 편집장 평가기(`expert-panel-evaluator.ts:63`)와 생성 프롬프트(`generate-posts.ts:489`)가 같은 문구를 금지한다. `fact_bomb_incumbent_attack`은 instruction이 "1961년 32분 오차"를 강제해 learnings의 과적합 가드레일과 충돌한다. 토픽 포화를 막는 코드 게이트가 없다(프롬프트 문구뿐). remediation 리라이트 결과는 품질 게이트를 다시 통과하지 않는다. lean 4모드 중 `identity_profile`, `relationship_tension`은 기본 prior가 없어 5/5로 시작한다. |
| 전환 | `shouldLink = (index+1) % cadence === 0`에서 index가 요청마다 0부터라 클라이언트 청크(2개)에서는 cadence 3일 때 링크가 0개다. webhook은 `signup`, `checkout_intent`를 버린다. CTA 타입은 링크 여부와 무관하게 랜덤이라 링크 없는 글에 "링크 확인"이 붙는다. |
| 운영 | `isAutopilotFormula`는 전 차원 혼합 top-5 winners만 보므로 공식이 hook/topic 패턴에 밀리면 모두 NEEDS_REVIEW다. established 등급 일일 쿼터 3 < KR 슬롯 5개라 하루 2개가 자동으로 NEEDS_REVIEW로 강등되고 승인이 증발한다. `auditSummary.needsReview`는 algorithmicPass 기준이라 실제 리뷰 수와 다르다. |

## Phase A — 측정·학습 (Weekly Scorecard)

### A1. `src/lib/weekly-scorecard.ts` (순수 함수)

```ts
export const BREAKOUT_VIEWS = 10_000;
export const MATURITY_HOURS = 72;

export interface ScorecardPostInput {
  publishedAt: Date | null; metricsAt: Date | null; status: string;
  views: number | null; replies: number | null; reposts: number | null;
  clicks: number | null; conversions: number | null; manualPaidConversions: number | null;
  formulaId: string | null; linkUrl: string | null;
}

export interface WeekBucket {
  label: string;            // "최근 7일", "8~14일 전", ...
  startsAt: string; endsAt: string;
  published: number; measured: number;   // measured = metricsAt ≥ publishedAt + 72h && views != null
  medianViews: number | null;
  breakoutCount: number; breakoutRate: number;   // views ≥ BREAKOUT_VIEWS among measured
  funnel: { views: number; clicks: number; conversions: number; paid: number };
  clicksPer1kViews: number | null; conversionsPerClickPct: number | null;
  linked: { posts: number; medianViews: number | null; clicks: number };
  unlinked: { posts: number; medianViews: number | null };
}

export interface FormulaRow {
  formulaId: string; posts: number; medianViews: number | null;
  breakoutRate: number; clicks: number; conversions: number; paid: number;
}

export type Bottleneck = "sample" | "reach" | "conversion" | "ops" | "none";

export interface WeeklyScorecard {
  generatedAt: string; weeks: WeekBucket[]; formulas: FormulaRow[];   // formulas: posts ≥ 2, 전체 창
  bottleneck: Bottleneck; nextAction: string;
}

export function buildWeeklyScorecard(posts: ScorecardPostInput[], options: { now: Date; weeks?: number; reviewQueue: number; pendingQueue: number }): WeeklyScorecard;
```

진단 규칙 (`diagnoseBottleneck`, 순서대로 첫 매치):
1. 최근 2주 measured 합 < 5 → `sample` ("표본 부족: 발행 유지, 72시간 후 다시 확인")
2. `reviewQueue ≥ 10` → `ops` ("리뷰 큐 N개 적체: 승인 또는 자동 승인 기준 완화")
3. 최근 2주 breakoutRate = 0 이고 medianViews < 300 → `reach` ("도달 병목: 상위 공식 비중 확대, 훅 실험")
4. 최근 2주 views ≥ 1,000 이고 (clicksPer1kViews < 5 또는 (clicks ≥ 10 이고 conversions = 0)) → `conversion` ("전환 병목: CTA·링크 목적지·링크 비율 점검")
5. 그 외 `none` ("정상: 현재 배분 유지, 승자 공식 20~30% 증량")

### A2. API `GET /api/growth/scorecard?brandId=&weeks=4`
- 인증: `requireBrandForCurrentUser` (기존 `/api/growth`와 동일).
- 입력: `status=PUBLISHED`, `publishedAt ≥ now − weeks·7d`. 큐 카운트는 `NEEDS_REVIEW`, `PENDING` count 2개.
- 응답: `{ brandId, ...WeeklyScorecard, queue: { review, pending } }`.
- `weeks`는 1~12, 기본 4.

### A3. 대시보드
- `src/components/WeeklyScorecardPanel.tsx` (새 파일, `brandId` 받아 자체 fetch, 기존 useState+fetch+toast 패턴).
- 피드 탭 기본 화면 `FormulaConversionTable` 위에 배치. Labs 밖.
- 구성: next action 배너(병목 라벨) → 주차별 표(발행/측정/중앙값 뷰/1만뷰 돌파/클릭/전환/유료) → 공식 표(최대 8행) → 링크 vs 무링크 중앙값.
- loading / error / empty(발행 0) 상태 처리.

### A4. 학습 버그 수정
- `growth-service.ts`: `computeAdaptiveFormulaWeights({}, …)` — 저장값이 아니라 빈 객체(기본 3)에서 매번 재계산. 주석으로 이유 명시.
- `cron/feedback/route.ts`: select에 `clicks`, `manualPaidConversions` 추가.
- `campaigns/summary/route.ts`: `scoreWeights`를 `PERFORMANCE_SCORE_WEIGHTS` 상수(growth-learning export)로 교체. 대시보드 라벨은 "점/단위"로 표시.

## Phase B — 도달 (Breakout)

### B1. 게이트 모순 제거
- `expert-panel-evaluator.ts:63` "자, 상상해봐" 페널티 삭제.
- `generate-posts.ts:489` AI Slop 금지 목록에서 '자, 상상해봐' 제거.
- `viral-intent-modes.ts:214` 지시는 "'자, 상상해봐' 또는 '만약 ~라면'처럼 1초 안에 머릿속 시뮬레이션이 도는 상황 제시"로 완화(동일 문구 반복 자체는 안티리핏이 잡는다).

### B2. 토픽 포화 가드 `src/lib/topic-saturation-guard.ts`
```ts
export const SATURATION_MARKER_GROUPS: Array<{ id: string; markers: string[]; maxInRecent: number }> = [
  { id: "birth_time_offset", markers: ["진태양시", "30분 오차", "32분", "동경시", "서머타임"], maxInRecent: 1 },
];
export const SATURATION_WINDOW = 10;
export function findSaturatedTopics(candidate: string, recentContents: string[]): string[];  // 반환: 포화 그룹 id
```
- 최근 10개 글 중 해당 그룹 마커가 `maxInRecent`개 이상 등장하고 후보 글에도 등장하면 포화.
- `generate-posts.ts` `generateWithQuality`에서 `withProhibitedPhraseCheck` 옆에 동일 패턴으로 추가. 실패 사유 `토픽 포화: birth_time_offset (최근 10개 중 N개)`. 재시도 프롬프트에 사유가 들어가므로 LLM이 다른 소재로 쓴다.
- `recentPosts` select에 content가 이미 포함되어 있으므로 추가 쿼리 없음.

### B3. 과적합 지시 제거
- `domain-registry.ts` `fact_bomb_incumbent_attack.instruction`: "1961년 동경시 32분 오차, 서머타임 오차 등" → "검증 가능한 역사·천문·법적 사실 하나(매번 다른 사실)". 
- `src/data/advanced-creator-patterns.json` 같은 id의 instruction 동일 수정.
- `brand-profile.ts:118` 기본 coreTopics "진태양시 30분 오차" → "태어난 시간과 실제 사주 차이".
- `charlie-viral-skills.ts:179` igniter 문구는 저장되지 않으므로 유지.

### B4. remediation 후 재검증
- `generate-posts.ts` 저장 직전: `remediation.content !== rawPostContent`이면 `checkQuality` + `enforceGeneratedSurfaceSafety` 재실행. 실패하면 원문(`rawPostContent`, 이미 게이트 통과)으로 되돌리고 `algorithmicPass`는 원문 점수 기준으로 재계산(`scoreThreadsPostAlgorithmic`). `qualityReasons`에 `remediation_reverted: …` 기록.
- `generateWithQuality` 안의 게이트 호출을 `runQualityGate(post, firstComment, experiment, config, isEnglish, prohibitedPhrases, recentPosts)` 헬퍼로 뽑아 재사용(동작 동일).

### B5. 기본 prior 보강
- `DEFAULT_INFORMATIVE_PRIORS`에 `identity_profile: {12, 8}`, `relationship_tension: {12, 8}` 추가 (2.2만/2.3만 뷰 검증 사례, learnings 2026-09-03).

## Phase C — 전환

### C1. 링크 cadence 수정
- `generatePostsForBrand`: `linkOffset = await prisma.post.count({ where: { brandId, campaignId: activeCampaign.id } })` (캠페인 없으면 0).
- `buildExperiment(…, linkOffset)` 파라미터 추가, `shouldLink = ((linkOffset + index + 1) % cadence) === 0`.
- 테스트: offset 2, cadence 3, index 0 → true; offset 0, index 0 → false.

### C2. webhook 이벤트 확장
- `CONVERSION_EVENTS`에 `signup`, `checkout_intent`, `match_created`, `match_create` 추가 (handoff 지표 "궁합 생성 수").

### C3. CTA ↔ 링크 결합
- `buildExperiment`: `shouldLink`를 먼저 계산하고, false면 후보에서 "링크 확인"을 제외. true면 "링크 확인"을 후보에 반드시 포함(없으면 추가).

## Phase D — 운영

### D1. 자동 승인 기준
- `GrowthMemory`에 `formulaWinners?: string[]` 추가 (optional, version 1 유지, `parseGrowthMemory` 문자열 배열 정규화).
- `buildGrowthMemory`: formula 차원 패턴 중 `count ≥ 2 && avgScore ≥ memory.avgScore`인 id 목록.
- `isAutopilotFormula`: `formulaWinners` 포함 또는 기존 winners 조건.

### D2. 쿼터 강등 → 건너뛰기
- `account-trust-ramp.ts` `TIER_DAILY_QUOTAS`: established 3 → 5, authority 5 → 8 (슬롯 계획과 일치).
- `cron/publish/route.ts`: 게이트 호출 전에 `publishedTodayCount ≥ TIER_DAILY_QUOTAS[tier]`이면 글을 건드리지 않고 `skipped.reason = "daily_quota_reached"`로 continue. 일일 경계는 KST(`Asia/Seoul`) 자정. `CronPublishResponse.skipped.reason` 유니온에 추가.

### D3. 카운트 정정
- `generatePostsForBrand` 반환 `auditSummary.needsReview`를 `status === "NEEDS_REVIEW"` 개수로.

## 테스트
- `weekly-scorecard.test.ts`: 버킷 경계, measured 판정, breakout율, 퍼널 합계, 공식 표 정렬·최소 표본, 진단 5규칙.
- `topic-saturation-guard.test.ts`: 포화/비포화/후보 미포함.
- `generate-posts` 관련: `buildExperiment` 링크 offset·CTA 결합(export 후 단위 테스트).
- `growth-learning.test.ts`: `formulaWinners`, `isAutopilotFormula` 신규 경로.
- `growth-feedback-loop` 호출부: weights가 저장값에 누적되지 않음(growth-service 단위 테스트, prisma mock).
- `expert-panel-evaluator.test.ts`: "자, 상상해봐."가 감점되지 않음.
- `thompson-sampling-router.test.ts`: 두 모드 prior 존재.
- `conversion route.test.ts`: `signup` → conversion.
- `cron/publish/route.test.ts`: 쿼터 초과 시 `daily_quota_reached`, 글 상태 불변.
- `account-trust-ramp.test.ts`: 쿼터 상수 갱신.
- 전체 `npm run test`, `typecheck`, `lint` 통과.

## 문서
- `docs/api-spec.md`: Growth Learning API에 scorecard, Cron publish skip reason, webhook 이벤트 목록.
- `README.md`: Weekly Scorecard 한 줄, 쿼터 변경.
- `.agent/memory/task_board.md`: 미션 갱신.

## Out of scope
- SaaS 제품화(2단계), 결제·테넌트.
- `generation-engine.ts` 중복본 제거(테스트 16개가 의존, 별도 작업).
- 댓글 자동화, 섀도우밴 프로브 cron, 알림 웹훅.
- 주간 스코어카드 DB 저장(요청 시 계산으로 충분).

## 성공 기준 (4주)
- 스코어카드에서 병목이 수치로 식별된다 (매주 1개 next action).
- `imagination_dilemma` 글이 게이트에서 "상상해봐"로 탈락하지 않는다.
- 캠페인 배치에서 링크 글 비율이 1/cadence ± 1개.
- 하루 5슬롯 중 쿼터로 NEEDS_REVIEW 강등되는 글 0개.
