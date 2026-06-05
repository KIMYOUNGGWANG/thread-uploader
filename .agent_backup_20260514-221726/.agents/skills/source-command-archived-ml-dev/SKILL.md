---
name: "source-command-archived-ml-dev"
description: "ML/AI Development Loop — Data Pipeline + AI App Integration (Orchestrator 5.3)"
---

# source-command-archived-ml-dev

Use this skill when the user asks to run the migrated source command `archived-ml-dev`.

## Command Template

> Legacy workflow. Prefer the core `plan -> develop -> review` loop unless this repository is intentionally using the older ML-specialized path.

# 🤖 ML Dev (AI Factory v5.3)

**데이터 분석 파이프라인** 및 **LLM 기반 AI 앱 통합**을 위한 전용 엔진.
두 가지 모드로 작동한다:

| 모드 | 키워드 | 출력 |
|------|--------|------|
| **Data** | pandas, 분석, 시각화, 전처리, EDA | Python 분석 스크립트 + 리포트 |
| **AI App** | OpenAI, Codex API, LLM, RAG, 챗봇, 임베딩 | AI 기능이 통합된 앱 코드 |

---

## 0. [AGENT] Orchestrator: Intelligence Setup

- [ ] **Mode Detection**: 사용자 요청에서 모드 판별.
    - `data` 키워드 감지 → Data 모드.
    - `AI/LLM/API/RAG/챗봇` 키워드 감지 → AI App 모드.
    - 둘 다 감지 → 혼합 모드 (Data → AI App 순서).
- [ ] **Smart Skill Discovery**: Run `bash .agent/scripts/smart-skill-loader.sh "python data analysis llm ai api integration" --concat`.
- [ ] **Learnings Preload**: `.agent/memory/learnings.md` 존재 시 읽기.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.
- [ ] **Constitution Check**: `GEMINI.md` 존재 확인.
- [ ] **Board Init**: `.agent/memory/task_board.md` 업데이트.

---

## Mode A: 데이터 파이프라인 (Python)

### A1. [AGENT] Data Architect: 환경 & 스키마 파악
- [ ] **Stack Detection**: `requirements.txt` 또는 `pyproject.toml` 스캔 → pandas/polars/numpy 여부 확인.
- [ ] **Data Contract**: 입력 데이터 스키마 정의 → `docs/data-spec.md`에 기록.
- [ ] **Output Definition**: 분석 목표와 최종 출력물 형태 명확화 (CSV, 차트, 대시보드 등).

### A2. [AGENT] Data Engineer: 파이프라인 구현
- [ ] **EDA**: 기초 통계, null 체크, 분포 분석 스크립트 작성.
- [ ] **Preprocessing**: 결측치 처리, 타입 변환, 정규화 — 각 단계를 함수로 분리 (< 20줄).
- [ ] **Analysis / Modeling**: 목적에 따라 집계, 통계 검정, 또는 sklearn 모델 적용.
- [ ] **Visualization**: matplotlib/seaborn/plotly — 결과 차트 저장.
- [ ] **Report**: `docs/analysis-report.md` 자동 생성.

### A2-Critic. [AGENT] Critic Gate ♻️
- [ ] **Evaluate**: 파이프라인이 데이터 컨트랙트(`docs/data-spec.md`)를 준수하는가?
- [ ] **Data Leak Check**: train/test split 전에 전처리가 적용됐는가?
- [ ] **PASS** → A3로.
- [ ] **FAIL** → 재설계. 최대 2회.

### A3. [AGENT] Workflow Transition
- [ ] **Next**: AI App 모드가 필요하면 Mode B로 연결. 아니면 `/ship` 또는 `/review` 추천.

---

## Mode B: AI 앱 통합 (LLM / Codex API / OpenAI)

### B1. [AGENT] AI Architect: 아키텍처 설계
- [ ] **API Selection**: Codex API vs OpenAI vs 로컬 모델 — 요구사항 기반 결정.
    - 한국어 특화, 안전성 중요 → Codex API (`Codex-sonnet-4-6` 기본)
    - GPT-4o 필요 → OpenAI API
- [ ] **Pattern Selection**: 목적에 맞는 패턴 선택.
    | 패턴 | 용도 | 예시 |
    |------|------|------|
    | Simple Prompt | 단발성 생성 | 텍스트 요약, 분류 |
    | Conversation | 멀티턴 챗봇 | 고객 서비스 |
    | RAG | 지식 기반 Q&A | 문서 검색 + 생성 |
    | Tool Use / Function Call | 외부 도구 연동 | DB 조회, API 호출 |
    | Agent Loop | 자율 실행 | 멀티스텝 작업 자동화 |
- [ ] **Cost Estimate**: 예상 토큰 사용량 계산 → `docs/ai-cost-estimate.md`.

### B2. [AGENT] AI Engineer: 구현
- [ ] **Client Setup**: API 클라이언트 초기화 — API 키는 반드시 환경변수(`process.env` / `os.environ`).
- [ ] **Prompt Engineering**: 시스템 프롬프트와 유저 프롬프트 분리. 하드코딩 금지 — `prompts/` 디렉토리 관리.
- [ ] **Error Handling**: rate limit, timeout, API 오류 → 재시도 로직 + 사용자 알림.
- [ ] **Streaming**: UX가 중요한 경우 스트리밍 응답 구현.
- [ ] **RAG (해당 시)**: 임베딩 생성 → 벡터 DB 저장(Supabase pgvector 또는 로컬) → 유사도 검색 → 컨텍스트 주입.

### B2-Critic. [AGENT] Critic Gate ♻️
- [ ] **Security**: API 키 하드코딩 없는지 확인. Prompt Injection 가능성 체크.
- [ ] **Cost Guard**: 토큰 사용량이 예상 범위 내인가? 무한 루프 가능성?
- [ ] **Fallback**: AI 응답 실패 시 fallback 처리가 있는가?
- [ ] **PASS** → B3로.
- [ ] **FAIL** → 재설계.

### B3. [AGENT] Workflow Transition
- [ ] **Next**: `/review` (보안 감사 필수 — AI 앱은 Prompt Injection 위험) → `/ship`.

---

## [AGENT] Secretary: Daily Log
- [ ] Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "ML-DEV" "[Summary of ML/AI changes]"`

---
> [!IMPORTANT]
> **AI App Rule**: API 키는 절대 코드에 하드코딩하지 않는다. 프롬프트는 `prompts/` 디렉토리에 버전 관리한다.
> **Data Rule**: 전처리 함수는 단일 책임. 데이터 변환 각 단계를 로깅한다.
> Legacy workflow. Prefer the core plan/develop/review loop unless this repository is intentionally running the older ML-specialized path.
