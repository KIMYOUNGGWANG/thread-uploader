---
name: critic-gate
description: Reusable Critic gate with WTF-likelihood self-regulation and auto-retry loop. Embeds into any workflow to enforce quality standards with max 2 retries before escalating to user.
---

# 🔁 Critic Gate — Auto-Retry Loop + WTF Self-Regulation

> **Purpose**: Plug-and-play quality gate for any workflow. Prevents shipping substandard work without human intervention.
> **v5.2 NEW**: WTF-likelihood 점수 시스템으로 AI 과잉 수정을 감지하고 자동 중단.

---

## WTF-Likelihood Score System ⚡ (NEW)

> **gstack 원칙**: AI가 "해결"한다고 생각할수록 실제로는 더 많은 버그를 만들 수 있다.
> 위험 신호를 누적 추적하여 임계값에서 자동 중단한다.

### 점수 테이블

| 이벤트 | WTF 점수 | 감지 방법 |
|--------|:--------:|----------|
| 같은 파일 3회 이상 수정 | +2 | 수정 파일 이력 추적 |
| task_board에 없는 파일 수정 | +2 | `task_board.md` vs 수정 파일 비교 |
| revert / undo 발생 | +3 | git revert, 이전 코드로 복원 감지 |
| 5개 이상 파일 동시 수정 | +1 | 단일 스텝에서 수정 파일 수 카운트 |
| 테스트 없이 코드 수정 | +2 | 수정 파일에 대응 테스트 파일 없음 |
| Fix가 새로운 에러 유발 | +3 | Fix 후 다른 테스트 실패 |
| 같은 에러 2회 반복 | +2 | agent_debate.md 에러 패턴 중복 |

### 임계값 및 행동

```
WTF Score: 0-3  → 🟢 정상. 계속 진행.
WTF Score: 4-5  → 🟡 주의. 경고 로그를 남기고 계속.
                   "[WTF][CAUTION] Score=N — 수정 이력이 비정상적으로 누적 중"
WTF Score: 6+   → 🔴 위험. 즉시 HALT.
                   notify_user: "⚠️ 과잉 수정 감지 (WTF Score: N/10).
                   현재 접근 방식이 근본적으로 잘못되었을 가능성이 높습니다.
                   A) 현재 상태에서 계속 (리스크 수용)
                   B) 모든 변경 revert 후 재시작
                   C) 아키텍처 레벨에서 재설계"
```

### WTF 점수 기록 형식

```
[WTF][+2] 같은 파일 수정 3회: src/services/auth.ts (누적: 4/10)
[WTF][+3] Fix가 새 에러 유발: payment.test.ts 실패 (누적: 7/10)
[WTF][HALT] Score=7 — 자동 중단 트리거
```

---

## Gate Protocol

```
[OUTPUT READY]
      ↓
[WTF SCORE CHECK] → Score ≥ 6? → HALT (notify_user)
      ↓
[CRITIC EVALUATION]
      ↓
  PASS? ─── YES ──→ [PROCEED TO NEXT STEP]
    │
   NO
    │
  Retry #1 ──→ [RE-IMPLEMENT] ──→ [WTF +1 if same file] ──→ [CRITIC RE-EVALUATION]
                                                                       ↓
                                                                   PASS? ─── YES ──→ [PROCEED]
                                                                     │
                                                                    NO
                                                                     │
                                                                Retry #2 ──→ [WTF +1] ──→ [RE-EVALUATION]
                                                                                                  ↓
                                                                                              PASS? ─── YES ──→ [PROCEED]
                                                                                                │
                                                                                               NO
                                                                                                │
                                                                                 [ESCALATE TO USER] ←── Max retries hit
```

---

## Evaluation Criteria (Ordered by Priority)

| Priority | Category | Criteria | Gate |
|:---:|:---|:---|:---:|
| 🔴 Critical | Security | No XSS, injection, exposed secrets | MUST PASS |
| 🔴 High | Contract | Actual API output matches `docs/api-spec.md` | MUST PASS |
| 🟡 Medium | Quality | No `any` types, all errors handled | SHOULD PASS |
| 🟡 Medium | Design | Anti-AI design rules applied | SHOULD PASS |
| 🟢 Low | Style | Lint passes, naming conventions met | NICE TO PASS |

## Verification of Claims (합리화 방지) ⚡ (NEW)

> **gstack 원칙**: "아마 괜찮을 것"은 평가가 아니다.

PASS 판정 전에 다음을 확인:

| 주장 | 필요한 증거 |
|------|------------|
| "이 패턴은 안전하다" | 안전성을 증명하는 **구체적 라인 번호** 인용 |
| "다른 곳에서 처리됨" | 해당 코드를 **읽고 인용** |
| "테스트가 커버함" | **테스트 파일명과 메서드명** 명시 |
| "이건 영향 없다" | 영향 없음을 증명하는 **실행 결과** 제시 |

증거를 제시할 수 없으면 → **UNVERIFIED로 표시**하고 FAIL 처리.

## Cross-Model Verification Mode ⚡ (v5.3)

> 동일 모델의 편향을 제거하기 위해 다른 모델/에이전트의 시각으로 검증.

### `[CROSS-VERIFY]` 플래그

| 자동 트리거 조건 | 근거 |
|:----------------|:-----|
| Security 관련 코드 변경 | 보안 취약점은 편향 리뷰로 놓치기 쉬움 |
| Architecture 변경 (새 모듈/스키마) | 구조적 결정은 다각도 리뷰 필수 |
| 수정 파일 10+ 개 | 대규모 변경은 영향 범위 예측이 어려움 |

### 교차 검증 기록 형식

```
[CROSS-VERIFY][REQUEST] Phase B 보안 결과 → Antigravity 교차 검증 요청
[CROSS-VERIFY][COMMON] XSS 취약점 — 양쪽 감지 (확신도: HIGH)
[CROSS-VERIFY][UNIQUE] CSRF 토큰 누락 — Claude만 감지 (추가 검증 필요)
[CROSS-VERIFY][DONE] 공통 2건, 고유 1건 → 모두 수정 완료
```

---

## Usage in Workflows

Add this block at the end of any implementation step:

```markdown
### [AGENT] Critic Gate — Auto-Retry
- [ ] **WTF Check**: Current WTF Score를 확인. ≥6이면 즉시 HALT.
- [ ] **Evaluate**: Review output against Critic Gate criteria above.
- [ ] **PASS** → Proceed to next step.
- [ ] **FAIL** → Log failure reason to `agent_debate.md` (format: `[CRITIC][FAIL][retry=N]`).
  - Retry #1: Re-implement with critique notes. WTF +1 if same file.
  - Retry #2: Re-implement with stricter constraints. WTF +1.
  - Retry #3 (Escalate): Print `⚠️ CRITIC ESCALATION: [failure reason]` and pause for user.
```

## Format for agent_debate.md

```
[WTF][+2] 같은 파일 수정 3회: src/services/auth.ts (누적: 4/10)
[CRITIC][FAIL][retry=1] Thread A: /api/users returns 500 — missing try-catch in handler
[WTF][+3] Fix가 새 에러 유발: payment.test.ts 실패 (누적: 7/10)
[WTF][HALT] Score=7 — 자동 중단 트리거
[CRITIC][PASS][retry=2] Thread A: /api/users returns 200 with correct schema
```

---

## WTF-Likelihood Self-Regulation

모든 Critic Gate 평가에서 **WTF Score**를 체크리스트로 계산하라:

### 범위 점수 (0~10) — 가중치 30%
다음 중 해당하는 항목 수 × 2:
- [ ] 3개 이상의 파일을 수정해야 한다
- [ ] 공유 유틸리티나 공통 컴포넌트가 변경된다
- [ ] DB 스키마나 API 응답 형식이 바뀐다
- [ ] 다른 팀원/에이전트가 의존하는 인터페이스가 변경된다
- [ ] 테스트 파일도 함께 수정해야 한다

### 불확실성 점수 (0~10) — 가중치 40%
다음 중 해당하는 항목 수 × 2:
- [ ] 에러가 처음 발생한 시점을 모른다
- [ ] 같은 증상의 다른 원인이 2가지 이상 있다
- [ ] 수정 전 로컬에서 재현이 안 된다
- [ ] 외부 서비스(API, DB, 브라우저)가 관여한다
- [ ] 최근 다른 사람/에이전트가 같은 파일을 수정했다

### 부작용 점수 (0~10) — 가중치 30%
다음 중 해당하는 항목 수 × 2:
- [ ] 수정 후 어떤 테스트가 깨질지 모른다
- [ ] 프로덕션 데이터에 영향을 줄 수 있다
- [ ] 롤백이 어렵다 (마이그레이션, 외부 서비스 호출 등)
- [ ] 성능에 영향을 줄 수 있다
- [ ] 인증/권한 로직이 포함된다

### WTF Score 계산
```
WTF Score = (범위점수 × 0.3) + (불확실성점수 × 0.4) + (부작용점수 × 0.3)
```

### 자동 중단 규칙
| WTF Score | 행동 |
|-----------|------|
| 0 ~ 3 | ✅ 진행 |
| 4 ~ 5 | ⚠️ `/investigate` 실행 권장 후 진행 |
| 6 ~ 7 | 🔴 **HALT** — 사용자 승인 요청 |
| 8 ~ 10 | 🚨 **HALT** — `/investigate` 필수 후 재설계 |

추가 자동 중단 조건:
- 연속 수정 횟수 > 10회 → **PAUSE**. 접근법 재평가
- 동일 파일 3회 이상 수정 → **STOP**. `/investigate` 강제 실행

### HALT 보고 형식
```
⚠️ WTF HALT [score=7.2]
범위: 6 (파일 4개 수정, 공통 컴포넌트 변경)
불확실성: 8 (재현 불가, 외부 API 관여)
부작용: 6 (테스트 영향 불명확)
→ 다음 단계: /investigate 실행 후 재접근
```
