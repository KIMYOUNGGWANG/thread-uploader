---
name: prd-template
description: "PRD+ (Product Requirements Document) 생성 템플릿. JTBD, Lean Canvas, Assumption Mapping, MoSCoW Scope 포함. /plan 워크플로우에서 docs/prd.md 생성 시 사용."
---

# 📋 PRD+ Template (Product Requirements Document)

`docs/prd.md` 생성 시 이 템플릿을 사용. 모든 섹션을 빠짐없이 채울 것.

---

## Project Info

- **Project**: [Project Name]
- **Version**: v1.0
- **Generated**: [Date]
- **Author**: AI + [User Name]
- **Status**: DRAFT | REVIEW | APPROVED

---

## 1. Problem Statement

> 우리는 **[누가]**가 **[무엇을]** 할 때 **[어떤 문제]**가 있음을 발견했다.
> 이 문제로 인해 **[어떤 결과/비용]**이 발생하고 있다.

### Demand Evidence (수요 증거)

| 질문 | 답변 |
|:-----|:-----|
| **Demand Reality**: 관심이 아닌 실제 수요 증거는? | [구체적 행동, 결제, 사용 패턴] |
| **Status Quo**: 사용자가 지금 이 문제를 어떻게 해결하는가? | [현재 워크플로우, 비용, 도구] |
| **Narrowest Wedge**: 이번 주에 돈을 낼 수 있는 가장 작은 버전은? | [최소 기능 단위] |

> [!IMPORTANT]
> "관심"은 수요가 아니다. 웨이트리스트, 가입, "재밌겠다"는 증거가 아님.
> 누군가 **결제**하거나, **사라지면 불편해하는** 행동이 진짜 수요.

---

## 2. JTBD Value Proposition (6-Part)

| 항목 | 내용 |
|:-----|:-----|
| **Who** (대상) | [구체적 사용자 — "마케터"가 아닌 "매출 200만원 이하 1인 사업자"] |
| **Why** (핵심 Job) | [이 제품을 고용하는 이유 — 핵심 Job-to-be-Done] |
| **What Before** (현재 해결법) | [지금 어떻게 해결하는가 — 대안/현상유지] |
| **How** (우리 솔루션) | [어떻게 더 잘 해결하는가] |
| **What After** (해결 후 상태) | [사용 후 실질적 + 감정적 상태] |
| **Alternatives** (경쟁) | [직/간접 경쟁자 목록] |

---

## 3. Assumption Map (리스크 매트릭스)

| 가정 | 리스크 유형 | 위험도 | 검증 방법 |
|:-----|:-----------|:------:|:---------|
| [사용자가 X를 원한다] | Value | 🔴 High | [인터뷰/설문] |
| [사용자가 Y를 이해할 수 있다] | Usability | 🟡 Med | [프로토타입 테스트] |
| [Z 기술로 구현 가능하다] | Feasibility | 🟢 Low | [POC 구현] |
| [비즈니스 모델이 작동한다] | Viability | 🟡 Med | [가격 테스트] |

> 가장 위험한 가정부터 먼저 검증한다.

---

## 4. Success Metrics (KPI)

### 핵심 지표 (2~3개)

| 지표 | 목표 | 측정 방법 | 기간 |
|:-----|:-----|:---------|:-----|
| [DAU/MAU Ratio] | [> 30%] | [Analytics] | [출시 후 30일] |
| [Conversion Rate] | [> 5%] | [Funnel 추적] | [출시 후 30일] |
| [Retention D7] | [> 40%] | [Cohort 분석] | [출시 후 60일] |

### 실패 기준

이 수치 아래면 **"실패한 것이고 피봇을 고려해야 한다"**:
- [지표 A] < [하한값]
- [지표 B] < [하한값]

---

## 5. Scope — MoSCoW Classification

### ✅ Must Have (MVP 필수)
- [ ] [기능 1 — 이것 없이는 제품이 아님]
- [ ] [기능 2]

### 🟡 Should Have (MVP 가능하면 포함)
- [ ] [기능 3 — 있으면 훨씬 좋지만 없어도 핵심 가치 전달 가능]
- [ ] [기능 4]

### 🔵 Could Have (이후 반복에서 고려)
- [ ] [기능 5]
- [ ] [기능 6]

### ❌ Won't Have (명시적 제외)
- [ ] [기능 7] — 이유: [제외 근거]
- [ ] [기능 8] — 이유: [제외 근거]

---

## 6. Lean Canvas (9-Section Summary)

| # | 섹션 | 내용 |
|:-:|:-----|:-----|
| 1 | **Problem** | [Top 3 문제점] |
| 2 | **Customer Segments** | [초기 타겟 — 비치헤드 마켓] |
| 3 | **Unique Value Proposition** | [한 문장으로 — 왜 이것이 대안보다 나은가] |
| 4 | **Solution** | [Top 3 기능] |
| 5 | **Channels** | [고객 도달 경로] |
| 6 | **Revenue Streams** | [과금 모델] |
| 7 | **Cost Structure** | [주요 비용 항목] |
| 8 | **Key Metrics** | [핵심 KPI — Section 4 참조] |
| 9 | **Unfair Advantage** | [모방 불가능한 이점] |

---

## 7. User Stories (핵심 시나리오)

```
As a [역할],
I want [목표],
So that [이유/가치].

Acceptance Criteria:
- Given [조건], When [행동], Then [결과]
```

### Story 1: [제목]
- **As a** [역할]
- **I want** [목표]
- **So that** [이유]
- **AC**: Given [X], When [Y], Then [Z]

### Story 2: [제목]
- ...

---

## 8. Growth Mechanism (바이럴 루프)

| 단계 | 설명 |
|:-----|:-----|
| **Hook** | [공유할 만한 가치 — 예: "이런 멋진 결과가 나왔어!"] |
| **Incentive** | [공유 동기 — 크레딧, 기능 해제, 소셜 인정] |
| **Mechanic** | [구현 — 공유 버튼, 레퍼럴 링크, SNS 카드] |

---

## Notes

> [!IMPORTANT]
> 이 PRD는 **바인딩 계약**. 모든 설계 및 구현은 이 문서를 기준.
> 변경 시 반드시 버전 업 + 관련자 동의 필요.
