---
name: "source-command-archived-learn"
description: "Project Learnings Wiki (Legacy workflow)"
---

# source-command-archived-learn

Use this skill when the user asks to run the migrated source command `archived-learn`.

## Command Template

# Learn (Staff Engineer v5.3)

> [!WARNING]
> Legacy workflow. Prefer capturing lessons during normal work and use `/status` for lightweight recall.

프로젝트 지식 베이스 관리. 과거의 실수로부터 배우고, 팀 지식을 축적하고, 반복 오류를 제거한다.

## 사용법

| 명령 | 설명 |
|------|------|
| `/learn` | 최근 5개 교훈 표시 + 현재 작업과의 연관성 추천 |
| `/learn search <keyword>` | 키워드로 교훈 검색 |
| `/learn add "<learning>"` | 새 교훈 추가 |
| `/learn prune` | 오래되거나 중복된 교훈 정리 |
| `/learn export` | 마크다운 보고서 생성 |
| `/learn stats` | 카테고리별 통계 |

---

## [AGENT] Learn: 기본 실행 (인자 없음)

- [ ] `.agent/memory/learnings.md` 읽기 (없으면 빈 파일 생성)
- [ ] 최근 5개 교훈 날짜순 역순으로 요약 표시
- [ ] 가장 자주 언급된 에러 카테고리 강조 (빈도 기준 top 3)
- [ ] 현재 작업 컨텍스트(task_board.md 참조)와 관련된 교훈 추천
- [ ] 한국어로 보고

---

## [AGENT] Learn: 검색 (`/learn search <keyword>`)

- [ ] `.agent/memory/learnings.md`에서 `<keyword>` 대소문자 무관 검색
- [ ] 관련 교훈 목록 반환: 날짜 · 카테고리 · 내용 · Prevention 포함
- [ ] 유사 키워드 교차 참조 (예: "type" 검색 시 "TypeScript" 관련도 포함)
- [ ] 결과 없을 경우: "관련 교훈 없음. `/learn add`로 추가하세요." 출력

---

## [AGENT] Learn: 추가 (`/learn add "<learning>"`)

- [ ] `.agent/memory/learnings.md` 읽고 기존 교훈과 중복 체크
  - 90% 이상 유사한 교훈이 있으면 사용자에게 알리고 중복 추가 여부 확인
- [ ] 카테고리 자동 분류:
  - `UI` — 컴포넌트, 렌더링, Tailwind, Shadcn 관련
  - `API` — 엔드포인트, 서버 액션, fetch 관련
  - `Security` — 인증, 권한, 노출 위험 관련
  - `DB` — Supabase, 쿼리, RLS, 스키마 관련
  - `Type` — TypeScript, Zod, 타입 에러 관련
  - `Architecture` — 구조, 패턴, 의존성 관련
  - `Workflow` — 에이전트, 스크립트, 자동화 관련
- [ ] 형식에 맞게 추가:
  ```
  ## [YYYY-MM-DD] <카테고리>
  - <교훈 내용>
  - Prevention: <재발 방지 방법>
  ```
- [ ] `.agent/memory/learnings.md` 상단(최신순)에 추가
- [ ] 총 항목 수 확인 — 20개 초과 시 가장 오래된 항목을 `.agent/memory/archives/learnings-archive-$(date +%Y-%m-%d).md`로 이동
- [ ] 추가 완료 후 한국어로 확인 메시지 출력

---

## [AGENT] Learn: 정리 (`/learn prune`)

> [!WARNING]
> 삭제/이동은 반드시 사용자 확인 후 실행한다. 자동 실행 금지.

- [ ] `.agent/memory/learnings.md` 전체 읽기
- [ ] 6개월(180일) 이상 지난 교훈 목록화
- [ ] 내용이 90% 이상 겹치는 중복 교훈 쌍 식별
- [ ] 이미 해결된 이슈로 보이는 교훈 표시 (예: "fix:" 커밋 이후 동일 패턴 없음)
- [ ] **사용자에게 목록 제시하고 확인 요청** — 삭제 대상 명시
- [ ] 승인 후: 대상 항목을 `.agent/memory/archives/learnings-$(date +%Y-%m-%d).md`로 이동
- [ ] 정리 결과 한국어로 보고 (이동된 항목 수, 남은 항목 수)

---

## [AGENT] Learn: 내보내기 (`/learn export`)

- [ ] `.agent/memory/learnings.md` 전체 읽기
- [ ] 카테고리별 그룹화 (UI / API / Security / DB / Type / Architecture / Workflow)
- [ ] 각 카테고리 내 최신순 정렬
- [ ] `docs/team-learnings-$(date +%Y-%m-%d).md` 파일 생성:
  ```markdown
  # Team Learnings — YYYY-MM-DD

  ## 요약
  - 총 교훈 수: N개
  - 가장 많은 카테고리: <카테고리> (N개)

  ## <카테고리>별 교훈
  ...
  ```
- [ ] 생성 경로 한국어로 보고

---

## [AGENT] Learn: 통계 (`/learn stats`)

- [ ] `.agent/memory/learnings.md` 전체 읽기
- [ ] 카테고리별 교훈 수 집계 및 비율 계산
- [ ] 가장 자주 나타나는 에러 카테고리 식별 (top 3)
- [ ] 월별 교훈 추가 트렌드 분석
- [ ] 결과 한국어로 출력:
  ```
  카테고리별 분포:
  - Type: 8개 (40%)
  - API: 5개 (25%)
  - ...

  이번 달 추가: 3개
  가장 위험한 영역: Type (가장 빈번)
  ```

---

## [AGENT] Secretary: Daily Log

- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "LEARN" "[교훈 관리 요약 — 추가/검색/정리 작업 내역]"`
