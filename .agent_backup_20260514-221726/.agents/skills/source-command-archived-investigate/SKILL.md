---
name: "source-command-archived-investigate"
description: "Root-Cause Investigation Protocol (Legacy workflow)"
---

# source-command-archived-investigate

Use this skill when the user asks to run the migrated source command `archived-investigate`.

## Command Template

# Investigate (Detective v5.3)

> [!WARNING]
> Legacy workflow. Prefer `/fix` with a concise root-cause analysis unless a dedicated investigation track is explicitly needed.

체계적 근본 원인 분석(RCA). 빠른 수정이 아닌 진짜 원인을 찾는다.
증상을 치료하는 것은 재발을 보장한다. 원인을 치료하면 문제가 사라진다.

---

## 0. [AGENT] Orchestrator: Intelligence Setup

- [ ] **Smart Skill Discovery**: Run `bash .agent/scripts/smart-skill-loader.sh "systematic-debugging debugging error root-cause" --concat --strict` → read `.agent/memory/current_loaded_skills.md`
- [ ] **Learnings Preload**: `.agent/memory/learnings.md` 읽기 — 유사한 에러 패턴이 과거에 기록됐는지 확인
- [ ] **WTF Pre-check**: 문제의 초기 WTF Score 추정 (critic-gate.md의 WTF 공식 참조)
  - WTF Score > 6이면 사용자에게 미리 알리고 단계적 접근 협의

---

## 1. [AGENT] Detective: 증상 수집 Phase

- [ ] **Reproduce**: 버그를 일관되게 재현하는 최소 케이스(Minimal Reproduction) 작성
  - 재현이 불가능하면 다음 단계 전에 사용자에게 추가 정보 요청
- [ ] **Timeline**: 언제 처음 발생했는가? 발생 직전 변경사항(git log)은?
- [ ] **Scope**: 영향받는 컴포넌트 · 라우트 · 사용자 유형 · 환경(dev/prod) 범위 파악
- [ ] **Evidence 수집**:
  - 에러 메시지 + 스택 트레이스 전문
  - 네트워크 응답 (상태 코드, 헤더, 바디)
  - 관련 Supabase 쿼리 또는 서버 액션 결과
  - 브라우저/서버 콘솔 에러

---

## 2. [AGENT] Analyst: 가설 생성 Phase

- [ ] **Brainstorm**: 가능한 원인 5개 목록 작성 — 판단 유보, 모두 나열
- [ ] **Rank**: 가능성(발생 확률) + 단순성(Occam's razor) 순으로 정렬
  - 가장 단순하고 가능성 높은 것 먼저
- [ ] **Test Design**: 각 가설을 반증 또는 확증할 구체적 테스트 방법 설계
  - "이것이 원인이라면 X를 확인하면 Y가 나와야 한다"

---

## 3. [AGENT] Tester: 가설 검증 Phase

- [ ] **Test #1**: 1순위 가설 검증
  - 확인됨 → 4단계(해결책 설계)로
  - 기각됨 → 다음 순위 가설로
- [ ] **Test #2 ~ #5**: 순서대로 검증 진행
- [ ] **WTF Check**: 5개 가설 모두 기각되면:
  - Race condition 가능성 검토
  - 외부 의존성(Supabase, 외부 API, CDN) 상태 확인
  - 환경 차이(Node 버전, env 변수, 배포 설정) 점검
  - 사용자에게 현황 보고 + 심층 조사 필요성 알림
- [ ] **Root Cause Confirmed**: 원인 한 문장으로 명확히 기술
  - 형식: "X 조건에서 Y 함수가 Z를 하지 않아 A 증상이 발생한다"

---

## 4. [AGENT] Architect: 해결책 설계 Phase

- [ ] **Options**: 해결 방법 2~3가지 제안
- [ ] **Trade-offs 분석**:
  | 방법 | 구현 시간 | 근본 해결 여부 | 부작용 위험 | WTF Score |
  |------|-----------|---------------|------------|-----------|
  | 빠른 수정 | 짧음 | 부분적 | 낮음 | — |
  | 근본 해결 | 길음 | 완전 | 중간 | — |
- [ ] **Recommendation**: 추천 방법 + 선택 근거 명시
- [ ] **Impact Assessment**: 수정이 영향을 미치는 다른 모듈/컴포넌트 목록
- [ ] **WTF Gate**: 추천 해결책의 WTF Score 계산
  - Score > 6 → **HALT**. 사용자 승인 후 진행

---

## 5. [AGENT] Secretary: 결과 문서화

- [ ] **RCA Report** 형식으로 기록:
  ```
  ## RCA: [버그 제목] — [YYYY-MM-DD]
  - 증상: <사용자가 겪은 문제>
  - 근본 원인: <한 문장>
  - 해결책: <선택한 방법>
  - 예방법: <재발 방지>
  - 영향 범위: <수정된 파일/모듈>
  ```
- [ ] **Learning 등록**: `/learn add "<재발 방지 교훈>"` 로직 실행
  - 형식: `[카테고리] 원인 — Prevention: 예방법`
- [ ] **History**: Run `bash .agent/scripts/logger.sh ".agent/memory/feature_history_en.md" "INVESTIGATE" "[RCA Summary in English]"`

---

## 6. [AGENT] Workflow Transition

- [ ] **Present**: 조사 결과 한국어로 보고
  - 근본 원인 (1문장)
  - 추천 해결책 + 근거
  - WTF Score + 사용자 승인 필요 여부
- [ ] **Next**: 수정 필요 시 → `/fix` 실행 안내

---

## [AGENT] Secretary: Daily Log

- [ ] Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "INVESTIGATE" "[조사 요약 — 버그명, 근본 원인, 해결 방향]"`
