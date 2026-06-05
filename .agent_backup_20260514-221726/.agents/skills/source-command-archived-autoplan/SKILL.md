---
name: "source-command-archived-autoplan"
description: "CEO→Design→Eng 3단 자동 리뷰 파이프라인 (Orchestrator 5.3)"
---

# source-command-archived-autoplan

Use this skill when the user asks to run the migrated source command `archived-autoplan`.

## Command Template

> Legacy workflow. Prefer `office-hours -> plan -> review` unless you explicitly want the older auto-review chain.

# 🔄 Autoplan — Auto-Review Pipeline (v5.3 + gstack)

> **원 커맨드, 완전 리뷰된 플랜 아웃.**
> CEO → Design → Eng 리뷰를 순차 실행하고, 맛(Taste) 결정만 사용자에게 제시한다.
> 중간 질문 15~30개를 6가지 의사결정 원칙으로 자동 판단한다.

## 0. [AGENT] Orchestrator: Intelligence Setup

- [ ] **Learnings Preload**: `.agent/memory/learnings.md` 읽기.
- [ ] **Environment Scan**: `bash .agent/scripts/audit-status.sh`
- [ ] **Contract Check**: `docs/api-spec.md` 존재 확인. 없으면 `/plan` 유도.
- [ ] **Base 브랜치 감지**: `bash .agent/scripts/codex-bridge.sh detect-base` (가용 시)
- [ ] **Board Update**: `.agent/memory/task_board.md`에 autoplan 세션 기록.

---

## 1. [AGENT] The 6 Decision Principles (자동 의사결정 원칙)

모든 중간 질문은 아래 6원칙으로 자동 응답한다:

| # | 원칙 | 설명 |
|---|------|------|
| P1 | **완전성 (Completeness)** | 더 많은 엣지 케이스를 커버하는 옵션을 선택한다 |
| P2 | **호수를 끓여라 (Boil Lakes)** | Blast radius 내 + CC 1일 미만이면 자동 승인. 5파일 미만 + 새 인프라 불필요 |
| P3 | **실용적 (Pragmatic)** | 같은 결과라면 더 깔끔한 옵션을 선택. 5초 고민, 5분 고민 금지 |
| P4 | **DRY** | 기존 기능과 중복되면 거부. 재사용 원칙 |
| P5 | **명시적 > 영리한 (Explicit > Clever)** | 10줄 명확한 코드 > 200줄 추상화. 새 기여자가 30초에 읽을 수 있는 것 |
| P6 | **행동 편향 (Bias toward Action)** | 머지 > 리뷰 사이클 > 오래된 논의. 우려를 플래그하되 블로킹은 하지 않음 |

### 충돌 시 타이브레이커
- **CEO 단계**: P1 (완전성) + P2 (호수) 우선
- **Design 단계**: P5 (명시적) + P1 (완전성) 우선
- **Eng 단계**: P5 (명시적) + P3 (실용적) 우선

---

## 2. [AGENT] Decision Classification (결정 분류)

| 분류 | 정의 | 처리 |
|------|------|------|
| **Mechanical** | 정답이 하나인 결정 | 자동 결정, 사용자에게 표시 안 함 |
| **Taste** | 합리적인 사람도 의견이 갈릴 수 있는 결정 | 자동 결정하되, 최종 게이트에서 사용자에게 제시 |

**Taste 결정의 3가지 원천:**
1. **Close approaches** — 상위 2개 옵션이 모두 실행 가능하되 트레이드오프가 다름
2. **Borderline scope** — blast radius 내이지만 3~5개 파일, 또는 모호한 범위
3. **Codex 이견** — Codex가 다른 추천을 하고 타당한 근거가 있음

---

## 3. [AGENT] Sequential Execution — 필수 순서

> ⚠️ 3단계는 반드시 순차 실행. 병렬 실행 금지. 각 단계가 이전 단계 위에 빌드된다.

### Phase 1: CEO 리뷰 (전략 & 스코프)

**목적**: 문제 정의, 전제 검증, 스코프 최적화, 대안 탐색

- [ ] **전제(Premise) 검증**: 플랜의 기본 가정을 명시적으로 나열하고 각각 검증:
  - 이 가정이 틀렸다면 전체 플랜이 무의미해지는가?
  - 검증할 수 있는 증거가 있는가?
- [ ] **대안 탐색**: 최소 2개 대안 접근법을 제시하고 비교:
  - 현재 방식 vs 대안 A vs 대안 B (effort/risk/pros/cons)
- [ ] **스코프 판단**:
  - Blast radius 내 + < 5 파일 + 새 인프라 불필요 → **자동 승인** (P2)
  - Blast radius 밖 → TODOS.md에 등록 제안 (P3)
  - 기존 기능과 중복 → **자동 거부** (P4)
- [ ] **Codex CEO Voice** (가용 시):
  // turbo
  ```bash
  bash .agent/scripts/codex-bridge.sh consult "You are a CEO/founder advisor. Challenge the strategic foundations of this plan: Are the premises valid? Is this the right problem? What alternatives were dismissed too quickly? Be adversarial. No compliments." --new-session
  ```
- [ ] **CEO Consensus 테이블 출력**:
  ```
  CEO REVIEW — CONSENSUS TABLE:
  ═══════════════════════════════════════
    전제 유효성:          [CONFIRMED/DISAGREE]
    올바른 문제인가:       [CONFIRMED/DISAGREE]
    스코프 적절성:         [CONFIRMED/DISAGREE]
    대안 충분히 탐색:      [CONFIRMED/DISAGREE]
    경쟁/시장 리스크:      [CONFIRMED/DISAGREE]
  ═══════════════════════════════════════
  ```
- [ ] **Phase 전환 요약**:
  > **Phase 1 완료.** Codex: [N개 우려]. 합의: [X/5 확인, Y 이견 → 게이트에서 제시].
  > Phase 2로 전달.

---

### Phase 2: Design 리뷰 (조건부 — UI 스코프 감지 시만 실행)

**목적**: UI/UX 완성도 검증, 빠진 상태 감지, 정보 계층 구조 평가

- [ ] **UI 스코프 감지**: 플랜에서 component/screen/form/button/modal/layout/dashboard 등 2개 이상 매칭 시 실행.
  - 매칭 안 됨 → "UI 스코프 없음 — 디자인 리뷰 생략" 기록 후 Phase 3으로.
- [ ] **DESIGN.md 참조**: 프로젝트에 `DESIGN.md`가 있으면 디자인 시스템 기준으로 검증.
- [ ] **7차원 평가** (각 0-10점):
  1. 정보 계층 구조
  2. 인터랙션 상태 (loading/empty/error/success/partial)
  3. 레이아웃 & 반응형
  4. 접근성
  5. 디자인 시스템 정합성
  6. 사용자 여정의 감정 곡선
  7. 명세의 구체성 vs 모호성
- [ ] **Design Codex Voice** (가용 시):
  // turbo
  ```bash
  bash .agent/scripts/codex-bridge.sh consult "Evaluate this plan's UI/UX. Does the information hierarchy serve the user? Are interaction states specified? Is the responsive strategy intentional? What design decisions will haunt the implementer? Be opinionated." --new-session
  ```
- [ ] **Phase 전환 요약**:
  > **Phase 2 완료.** design score: [X/10]. [Y개 이슈 발견 → N개 자동 결정, M개 taste].
  > Phase 3으로 전달.

---

### Phase 3: Eng 리뷰 (아키텍처 & 테스트)

**목적**: 아키텍처 건전성, 테스트 매트릭스, 보안 표면, 숨은 복잡성 검증

- [ ] **아키텍처 평가**:
  - 컴포넌트 의존성 그래프 (ASCII 다이어그램)
  - 커플링 우려 사항
  - 스케일링 병목
- [ ] **테스트 매트릭스**:
  - 새 UX 플로우 / 데이터 플로우 / 코드 경로 / 분기 나열
  - 각각에 대해: 단위 테스트 or E2E or EVAL 필요 판단
  - 커버리지 갭 식별
- [ ] **보안 표면 분석**:
  - 새 공격 표면 감지
  - 인증/권한 경계
  - 입력 검증
- [ ] **Eng Codex Voice** (가용 시):
  // turbo
  ```bash
  bash .agent/scripts/codex-bridge.sh consult "Review this plan for architectural issues, missing edge cases, and hidden complexity. What breaks under 10x load? What's the nil/empty/error path? What looks simple but isn't? Be adversarial." --new-session
  ```
- [ ] **Eng Consensus 테이블 출력**:
  ```
  ENG REVIEW — CONSENSUS TABLE:
  ═══════════════════════════════════════
    아키텍처 건전성:       [CONFIRMED/DISAGREE]
    테스트 커버리지 충분:   [CONFIRMED/DISAGREE]
    성능 리스크 대응:      [CONFIRMED/DISAGREE]
    보안 위협 대응:        [CONFIRMED/DISAGREE]
    에러 경로 처리:        [CONFIRMED/DISAGREE]
    배포 리스크 관리:      [CONFIRMED/DISAGREE]
  ═══════════════════════════════════════
  ```

---

## 4. [AGENT] Decision Audit Trail (의사결정 감사 로그)

각 자동 결정 후 아래 형식으로 플랜 파일 또는 `.agent/memory/` 에 기록:

```markdown
## Decision Audit Trail

| # | Phase | 결정 | 원칙 | 근거 | 거부된 옵션 |
|---|-------|------|------|------|------------|
```

---

## 5. [AGENT] Final Approval Gate (최종 승인 게이트)

모든 Phase 완료 후, **Taste 결정만** 묶어서 사용자에게 한 번에 제시:

```
/autoplan 리뷰 완료. [N]개 결정 중 [M]개는 자동 처리됨.
[K]개 맛(Taste) 결정이 승인을 기다립니다:

1. [Phase] [결정 내용]
   자동 판단: [선택한 옵션] (원칙: P#)
   대안: [거부된 옵션]
   → A) 자동 판단 수용  B) 대안 선택  C) 직접 지정

RECOMMENDATION: 모든 자동 판단 수용 (이유: ...)
```

---

## 6. [AGENT] Review Report 생성

- [ ] 플랜 파일 또는 `.agent/memory/`에 아래 형식으로 리뷰 보고서 추가:

```markdown
## AUTOPLAN REVIEW REPORT

| Review | Trigger | Runs | Status | Findings |
|--------|---------|------|--------|----------|
| CEO Review | Phase 1 | 1 | [status] | [findings] |
| Design Review | Phase 2 | [0/1] | [status] | [findings] |
| Eng Review | Phase 3 | 1 | [status] | [findings] |
| Codex Cross-Verify | `/codex` | [0/1] | [status] | [findings] |

**VERDICT:** [모든 리뷰 CLEAR 시: "ALL CLEAR — 구현 준비 완료"]
```

---

## 7. [AGENT] Workflow Transition

- [ ] **ALL CLEAR** → `/develop`로 구현 시작 제안.
- [ ] **이슈 존재** → 수정 후 `/autoplan` 재실행 또는 개별 리뷰 실행 제안.

---

> [!IMPORTANT]
> **Sequential execution is mandatory.** CEO → Design → Eng 순서는 반드시 지켜야 한다.
> **Auto-decide replaces USER judgment, NOT analysis.** 분석은 전체 수행하되, 결정만 원칙으로 대체한다.
> **"No issues found" requires evidence.** "이슈 없음"도 무엇을 검토했고 왜 이슈가 없는지 1-2문장은 필수.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "AUTOPLAN" "[Summary of auto-review session]"`
> Legacy workflow. Prefer `office-hours -> plan -> review` unless you explicitly want the older auto-review chain.
