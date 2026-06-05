---
name: "source-command-archived-research"
description: "Multi-Source Deep Research & Market Intelligence (Orchestrator 5.3)"
---

# source-command-archived-research

Use this skill when the user asks to run the migrated source command `archived-research`.

## Command Template

> Legacy workflow. Prefer `brainstorm` and `office-hours` for default discovery unless a dedicated research artifact is explicitly required.

# 🔬 Research (Deep Researcher v5.3)

멀티소스 심층 리서치 전용 워크플로우. 시장 조사, 경쟁사 분석, 기술 평가, TAM/SAM/SOM 산출.
`deep-research` Plugin + `market-research.md` + `startup-business-analyst` 방법론 융합.

> [!IMPORTANT]
> **모든 주장에는 출처가 필요하다.** 출처 없는 주장은 할루시네이션이다.
> 보고서는 의사결정을 도와야 하며, 단순 요약이 아니다.

---

## Phase 0: [AGENT] Intelligence Setup

- [ ] **Model Router**: Research is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Smart Skill Discovery** ⚡: Run `bash .agent/scripts/smart-skill-loader.sh "deep-research market-research competitive-analysis startup-business-analyst strategy" --concat --strict` → read `.agent/memory/current_loaded_skills.md`.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it.
- [ ] **Brainstorm Preload**: If `.agent/memory/brainstorm/` exists → read prior brainstorm results for context.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.

---

## Phase 1: [AGENT] Query Scoping

### 1.1 Research Type Detection
- [ ] **Ask User**: "어떤 리서치가 필요한가요?"
  - **시장 분석** → 경쟁사 분석 + TAM/SAM/SOM + 페르소나
  - **기술 평가** → 프레임워크/도구 비교 + 트레이드오프 + 도입 신호
  - **트렌드 리서치** → 최신 동향 + 미래 예측
  - **종합 리서치** → 모든 측면 포함

### 1.2 Sub-Question Decomposition
- [ ] 리서치 토픽을 **3~5개 서브 질문**으로 분해.
- [ ] 각 서브 질문에 대해 **2~3 키워드 변형** 생성.
- [ ] **날짜 인식 쿼리**: 모든 검색어에 현재 연도 포함.
  - BAD: `"AI social apps market"`
  - GOOD: `"AI social apps market 2026 latest trends"`

### 1.3 Research Plan Presentation
- [ ] 리서치 계획을 사용자에게 간략히 제시:
  ```
  리서치 계획:
  - 서브 질문 1: [질문] → 키워드: [A, B, C]
  - 서브 질문 2: [질문] → 키워드: [D, E, F]
  - ...
  예상 소요 시간: ~15분
  ```
- [ ] 사용자 승인 후 실행.

---

## Phase 2: [AGENT] Multi-Source Search

### 2.1 Search Execution
- [ ] 각 서브 질문당 `search_web` **2~3회** 호출 (키워드 변형별).
- [ ] 총 목표: **10~20개 고유 소스** 수집.

### 2.2 Source Priority
```
1. 공식 문서, 정부 데이터 (Census, BLS)     → 최우선
2. 산업 보고서 (Gartner, Forrester, Statista) → 높음
3. 뉴스, 전문 매체                            → 중간
4. 전문가 블로그, 컨퍼런스 발표              → 보통
5. 소셜 미디어, 포럼                          → 최소
```

### 2.3 Source Logging
- [ ] 각 소스의 URL, 제목, 발행일, 핵심 스니펫을 내부 메모에 기록.

---

## Phase 3: [AGENT] Deep Read

- [ ] 검색 결과 중 가장 유망한 **3~5개 URL**을 `read_url_content`로 **정독**.
- [ ] 스니펫이 아닌 **전문** 기반 분석 — 맥락과 뉘앙스 파악.
- [ ] 핵심 데이터 포인트, 통계, 인용문 추출.

---

## Phase 4: [AGENT] Source Triangulation

### 4.1 Cross-Verification
- [ ] 핵심 주장(key claims)에 대해 **최소 2개 소스** 교차 검증.
- [ ] 단일 소스만 주장하는 내용은 `[UNVERIFIED]` 태그.
- [ ] 소스 간 모순 발견 시 명시적으로 기록.

### 4.2 Source Quality Rating

| 등급 | 설명 | 예시 |
|:-----|:-----|:-----|
| **A** | 피어리뷰 논문, 메타분석, 체계적 리뷰 | Nature, IEEE, Lancet |
| **B** | 공식 문서, 산업 보고서, 가이드라인 | Gartner, W3C, FDA |
| **C** | 전문가 의견, 케이스 스터디 | 컨퍼런스, 전문 블로그 |
| **D** | 프리프린트, 화이트페이퍼 | arXiv, 회사 블로그 |
| **E** | 소셜 미디어, 포럼, 비검증 | Reddit, Twitter |

- [ ] 각 소스에 등급 부여. **B 이상**을 주력으로 사용.

---

## Phase 5: [AGENT] Synthesis & Report

### 5.1 Report Structure
```markdown
# [Topic]: 리서치 보고서
*Generated: [date] | Sources: [N]개 | Confidence: [High/Medium/Low]*

## Executive Summary
[3~5문장 핵심 발견 요약]

## 1. [핵심 테마 1]
[발견 사항 + 인라인 인용]
- 핵심 데이터 ([소스명](url))
- 뒷받침 증거 ([소스명](url))

## 2. [핵심 테마 2]
...

## 경쟁사 분석 (해당 시)
| 경쟁사 | 강점 | 약점 | 포지셔닝 갭 |
|--------|------|------|------------|
| [A] | [..] | [..] | [..] |

## 시장 규모 (해당 시)
### TAM (Total Addressable Market)
- Bottom-up: [계산식 + 출처]
- Top-down: [계산식 + 출처]
- 교차 검증: [차이 ≤30%?]

### SAM (Serviceable Available Market)
- TAM × 지역% × 제품적합% × 시장준비%

### SOM (Serviceable Obtainable Market)
- 3년: SAM의 2~3%
- 5년: SAM의 4~6%

## Key Takeaways
- [액션 가능한 인사이트 1]
- [액션 가능한 인사이트 2]
- [액션 가능한 인사이트 3]

## 리스크 & 주의사항
- [리스크 1]
- [반대 증거]

## Sources
1. [제목](url) — [A-E 등급] — [1줄 요약]
2. ...

## Methodology
검색 [N]건 실행. [M]개 소스 분석.
서브 질문: [리스트]
```

### 5.2 Quality Gate
- [ ] 모든 주장에 출처가 있는가?
- [ ] 오래된 데이터(12개월+)가 표시되었는가?
- [ ] 반대 증거가 포함되었는가?
- [ ] 추정치는 명시적으로 가정을 밝혔는가?
- [ ] 보고서가 의사결정을 쉽게 만드는가?

### Output
- [ ] 보고서 저장: `docs/research/market-{topic}.md`
- [ ] 요약 저장: `.agent/memory/brainstorm/research-summary.md` (있으면)

---

## Phase 6: [AGENT] Delivery & Next Steps

- [ ] `notify_user` with `BlockedOnUser: true`:
  - Executive Summary + Key Takeaways 제시.
  - 전체 보고서 파일 경로 안내.
- [ ] **PathsToReview**: `["docs/research/market-{topic}.md"]`
- [ ] **다음 단계 제안**:
  ```
  리서치 완료! 다음 중 선택해주세요:

  1. /brainstorm → 리서치 기반으로 아이디어 구체화
  2. /plan       → 풀 기획 시작 (PRD + TRD + API Spec)
  3. /mvp        → 빠른 MVP 빌드 (PRD-Lite + TRD-Lite)
  4. 추가 리서치  → 다른 소스 확보 또는 더 깊은 분석
  ```

---

> [!IMPORTANT]
> **리서치 품질 원칙** (deep-research 방법론):
> 1. 모든 주장에는 출처가 필수.
> 2. 교차 검증 — 단일 소스만의 주장은 `[UNVERIFIED]`.
> 3. 최신성 — 12개월 내 소스 우선. 오래된 데이터는 플래그.
> 4. 반대 증거 포함 — 낙관적 데이터만 cherry-pick하지 않음.
> 5. 사실과 추론 분리 — 추정, 예측, 의견은 명시적으로 라벨.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "RESEARCH" "[Summary of research session]"`
> Legacy workflow. Prefer `brainstorm` and `office-hours` for default discovery unless a dedicated research artifact is explicitly required.
