# Viral Engine v2 Implementation Plan

Spec: `docs/superpowers/specs/2026-10-13-viral-engine-v2-design.md`
Branch: `feat/viral-engine`. 각 Phase 끝에 `npm run test && npm run typecheck && npm run lint`, 통과 시 커밋.
Rule: 테스트 먼저(FAIL 확인) → 구현 → PASS.

## Phase A — 측정·학습

### A1 weekly-scorecard
- [ ] `src/lib/weekly-scorecard.test.ts`: 버킷/measured/breakout/funnel/formulas/진단 5규칙
- [ ] `src/lib/weekly-scorecard.ts` 구현
### A2 API
- [ ] `src/app/api/growth/scorecard/route.ts` (`requireBrandForCurrentUser`, weeks 1~12)
### A3 대시보드
- [ ] `src/components/WeeklyScorecardPanel.tsx`
- [ ] `Dashboard.tsx` 피드 탭 `FormulaConversionTable` 위에 삽입
### A4 학습 버그
- [ ] `growth-feedback-loop.test.ts` 또는 신규 `growth-service.test.ts`: weights 비누적
- [ ] `growth-service.ts` `computeAdaptiveFormulaWeights({}, …)`
- [ ] `cron/feedback/route.ts` select clicks/manualPaidConversions
- [ ] `growth-learning.ts` `PERFORMANCE_SCORE_WEIGHTS` export, `campaigns/summary/route.ts`·`Dashboard.tsx` 표시 교체
- [ ] 커밋 `feat(growth): 주간 스코어카드와 병목 진단 추가`

## Phase B — 도달

- [ ] `expert-panel-evaluator.test.ts`: "자, 상상해봐." 무감점 → 패턴 삭제
- [ ] `generate-posts.ts:489` 문구 제거, `viral-intent-modes.ts:214` 완화
- [ ] `topic-saturation-guard.test.ts` → `topic-saturation-guard.ts`
- [ ] `generate-posts.ts` `generateWithQuality`에 포화 체크 결합
- [ ] `domain-registry.ts`·`advanced-creator-patterns.json`·`brand-profile.ts` 과적합 문구 제거 (`domain-registry.test.ts` 기존 테스트 유지 확인)
- [ ] remediation 후 재검증 (`runQualityGate` 헬퍼 추출)
- [ ] `thompson-sampling-router.test.ts`: identity_profile/relationship_tension prior → 추가
- [ ] 커밋 `fix(generate): 바이럴 공식 게이트 모순 제거와 토픽 포화 가드`

## Phase C — 전환

- [ ] `generate-posts.ts` `buildExperiment` export + `linkOffset` 파라미터 + CTA 결합, 단위 테스트
- [ ] `generatePostsForBrand` linkOffset count 쿼리
- [ ] `webhooks/conversion/route.ts` 이벤트 추가 + route.test
- [ ] 커밋 `fix(conversion): 링크 cadence 오프셋과 signup 이벤트 수집`

## Phase D — 운영

- [ ] `growth-learning.test.ts`: formulaWinners/isAutopilotFormula → `types/growth-memory.ts`, `growth-learning.ts`
- [ ] `account-trust-ramp.test.ts` 쿼터 갱신 → `TIER_DAILY_QUOTAS`
- [ ] `cron/publish/route.test.ts` `daily_quota_reached` → route 수정(KST 자정)
- [ ] `generate-posts.ts` needsReview 카운트
- [ ] 커밋 `feat(ops): 승자 공식 자동 승인과 쿼터 건너뛰기`

## 문서
- [ ] `docs/api-spec.md`, `README.md`, `.agent/memory/task_board.md`
- [ ] 커밋 `docs: viral engine v2 계약 갱신`
