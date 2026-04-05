# Viral Engine — Design Spec
**Date:** 2026-04-05
**Status:** Approved

---

## 개요

Threads 크리에이터와 앱 마케터를 위한 Claude Code 스킬 세트.
브랜드 정보를 입력하면 → YC/Roy Lee 방식으로 바이럴 전략 수립 → Expert Panel 품질 검증을 거쳐 → threads-uploader에 바로 투입 가능한 포스트 MD 파일을 출력한다.

**참조 레포:**
- `crealwork/go-viral-or-die` — Roy Lee 바이럴 원칙 20개 + 8가지 스턴트 템플릿
- `ericosiu/ai-marketing-skills` — Expert Panel, Growth Engine, AI Slop Detector
- `crealwork/yc-office-hours` — CAMPAIGN 모드 (viral-retro 선택적 활용)

---

## 스킬 구성

| 명령어 | 역할 | 소요 시간 |
|--------|------|----------|
| `/viral-setup` | 브랜드 보이스 최초 설정 (1회) | ~5분 |
| `/viral-engine` | 전략 선택 → 포스트 생성 → 품질 검증 → MD 출력 | ~3~5분 |
| `/viral-retro` | 발행 후 성과 분석 + brand-voice.md 업데이트 | ~5분 |

---

## 데이터 흐름

```
/viral-setup
    → .agent/memory/brand-voice.md (영구 저장)

/viral-engine
    .agent/memory/brand-voice.md 로드
    → go-viral-or-die 스턴트 전략 선택
    → scripts/generate-batch.mjs 실행 (목표 N개 → 2N개 초안 생성)
    → Expert Panel 품질 게이트 (3 페르소나, 90점 통과만)
    → output/YYYY-MM-DD-[brand]-posts.md

/viral-retro
    성과 데이터 입력
    → 공식/스턴트/주제별 성과 분석
    → brand-voice.md 히스토리 섹션 업데이트
```

---

## `/viral-setup` 상세

**목적:** `brand-voice.md` 생성. 이후 모든 생성의 기반.

**5개 질문 플로우:**
1. 브랜드명 + 한 줄 설명 (무엇을 하는 제품인가)
2. 타깃 (주로 누가 쓰나, 가능한 구체적으로)
3. 잘 됐던 포스트 예시 (없으면 "없음" 가능)
4. 이 제품을 싫어할 사람이 누구인가 (Roy Lee 50% 혐오 테스트)
5. 절대 하면 안 되는 톤 또는 표현

**출력 — `brand-voice.md` 구조:**
```markdown
# Brand Voice — [브랜드명]

## 한 줄 포지셔닝
## ICP (이상적 고객)
## 핵심 메시지 (단 하나)
## 논란 각도 (싫어할 사람 + 50% 혐오 테스트 결과)
## 추천 스턴트 템플릿 (go-viral-or-die 8종 중 우선순위)
## Roy Scale 기준점
  - 논란도 목표: 🔥🔥🔥 이상
  - 바이럴 잠재력 목표: 🚀🚀🚀 이상
  - 전환 잠재력: 💰💰 이상
  - 리스크 수준: LOW~MEDIUM
## 금지 톤 / 금지 표현
## 성과 히스토리 (viral-retro 후 업데이트)
  - 공식별 평균 성과
  - 가장 잘 된 스턴트 템플릿
  - 가장 반응 좋은 주제
```

---

## `/viral-engine` 상세

### 1단계 — 전략 선택

`brand-voice.md` 로드 후, go-viral-or-die 8개 스턴트 템플릿 중 이번 배치에 쓸 것 자동 추천:

| 스턴트 템플릿 | 특징 |
|--------------|------|
| 논란 데모 | 제품으로 충격적인 것을 해보임 |
| 공공의 적 선언 | 특정 적을 지목해서 편가르기 |
| 스캔들 플립 | 부정적 사건을 역이용 |
| 콘텐츠 군대 | 동일 메시지 다양한 형식으로 대량 배포 |
| 불가능한 주장 | 믿기 어려운 결과 주장 → 증명 |
| 투명성 핵폭탄 | 업계 비밀 공개 |
| 역발상 | 상식을 정면 반박 |
| 비교 도발 | 경쟁자와 직접 비교 |

브랜드 성과 히스토리가 있으면 → 잘 된 템플릿 우선 추천.

### 2단계 — 포스트 초안 생성

`scripts/generate-batch.mjs` 실행:
- 브랜드 파라미터 + 선택된 스턴트 전략 주입
- 9가지 포스트 공식(warning/contrarian/choice/reveal/thisorthat/check/save/humor/truth) 가중치 적용
- 목표 N개 → 2N개 생성 (품질 게이트 탈락분 감안, 기본값 N=30)
- Claude Haiku 사용 (비용 효율)

### 3단계 — Expert Panel 품질 게이트

3개 페르소나가 각 포스트를 0~100점 채점:

| 페르소나 | 채점 기준 |
|---------|----------|
| **Roy Lee** | 논란도 있나? 50% 혐오 테스트 통과? 공유 욕구 유발? |
| **타깃 유저** | 나라면 저장/공유할 것 같나? 내 얘기 같은 느낌? |
| **편집장** | AI 냄새 나는 표현 없나? (24패턴 체크) 자연스러운 문체? |

**판정 로직:**
- 3명 평균 90점 이상 → 통과
- 미달 → 1회 자동 재작성 후 재채점
- 재작성 후도 미달 → 폐기
- 최종 N개 통과 시 출력 (미달 시 경고 메시지 + 현재 통과분만 출력)

### 4단계 — 출력

파일: `output/YYYY-MM-DD-[brand]-posts.md`

포맷: 기존 threads-uploader `/api/posts/upload` 투입 가능한 구조 유지.
각 포스트에 메타데이터 태그 추가:
```
<!-- formula: warning | stunt: 역발상 | roy_score: 🔥🔥🔥🚀🚀💰💰 -->
```

---

## `/viral-retro` 상세

**입력:** 유저가 성과 데이터 붙여넣기 (수치, 스크린샷 설명, 느낌 모두 가능)

**분석 항목:**
- 공식별 평균 조회수/저장수/공유수
- 스턴트 템플릿별 성과
- 주제별 댓글/반응 비교
- 탈락했어야 했는데 의외로 터진 것 (역학습)
- 다음 배치 전략 추천

**출력:** `brand-voice.md`의 `## 성과 히스토리` 섹션 업데이트

**권장 실행 주기:** 2주 1회

---

## 파일 구조

```
.claude/skills/viral-engine/
  SKILL.md                    ← 메인 오케스트레이터
  viral-setup.md              ← 브랜드 설정 플로우
  viral-engine.md             ← 생성→검증→출력 플로우
  viral-retro.md              ← 성과 회고 플로우
  references/
    viral-principles.md       ← go-viral-or-die 20원칙 + 8 스턴트 템플릿
    expert-panel.md           ← 3 페르소나 채점 기준 + 24 AI slop 패턴
    post-formulas.md          ← 9가지 포스트 공식 (범용화)

.agent/memory/
  brand-voice.md              ← /viral-setup 결과 (영구 저장)

scripts/
  generate-batch.mjs          ← generate-posts.mjs 확장
                                 (브랜드 파라미터 주입 + 품질 루프)
```

---

## 기존 코드 재사용

| 기존 | 재사용 방식 |
|------|-----------|
| `scripts/generate-posts.mjs` | `generate-batch.mjs`로 확장 — 브랜드 파라미터, 스턴트 전략 주입 추가 |
| `src/app/api/posts/upload` | 출력 MD 그대로 투입, 변경 없음 |
| Threads 발행 파이프라인 | 변경 없음 |

---

## 미포함 (의도적 제외)

- **웹 UI** — Claude Code에서만 사용, 불필요
- **YC 심문 플로우** — 이미 운영 중인 브랜드에 불필요한 오버헤드
- **통계적 A/B 테스트 자동화** — viral-retro에서 수동 분석으로 충분 (현 단계)
- **멀티테넌트/인증** — 개인 사용 도구

---

## 성공 기준

- `/viral-setup` 5분 내 완료, `brand-voice.md` 생성
- `/viral-engine` 5분 내 N개 포스트 MD 파일 출력
- 출력 파일이 threads-uploader에 수정 없이 업로드 가능
- Expert Panel 90점 통과율 70% 이상 (2N 초안 기준)
