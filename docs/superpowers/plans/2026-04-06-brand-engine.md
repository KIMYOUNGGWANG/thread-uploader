# Brand Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `viral-engine` 스킬을 `threads-engine`으로 이름 변경하고, 어떤 제품에도 적용 가능한 범용 브랜드 전략 스킬 `brand-engine`을 생성한다.

**Architecture:** Claude Code 스킬은 순수 마크다운 파일이다. 스킬은 두 위치에 동기화되어야 한다: orchestrator의 `.agents/skills/`(`.claude/skills/` 심링크 타겟)와 threads-uploader의 `.agent/skills/`(로컬 미러). 코드 컴파일/테스트 없이 파일 검증으로 완료 확인.

**Tech Stack:** Markdown, Bash (mv, git)

---

## 파일 구조

### 변경 대상
```
/Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/
├── viral-engine/          → threads-engine/ (폴더명 변경)
│   ├── SKILL.md           → name/description/커맨드 수정
│   ├── viral-engine.md    그대로 유지
│   ├── viral-retro.md     그대로 유지
│   ├── viral-setup.md     그대로 유지
│   └── references/        그대로 유지
└── brand-engine/          신규 생성
    └── SKILL.md           신규 생성

/Users/kim-young-gwang/Desktop/projects/threads-uploader/.agent/skills/
├── viral-engine/          → threads-engine/ (동일하게 변경)
│   └── SKILL.md           동일하게 수정
└── brand-engine/          신규 생성 (동일 내용)
    └── SKILL.md
```

### 심링크 관계 (수정 불필요)
```
threads-uploader/.claude/skills/
  → /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/
```

---

## Task 1: orchestrator에서 viral-engine → threads-engine 이름 변경

**Files:**
- Rename: `orchestrator/.agents/skills/viral-engine/` → `threads-engine/`
- Modify: `orchestrator/.agents/skills/threads-engine/SKILL.md`

- [ ] **Step 1: orchestrator에서 폴더 이름 변경**

```bash
mv /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/viral-engine \
   /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/threads-engine
```

Expected: 오류 없이 완료

- [ ] **Step 2: SKILL.md 프론트매터 및 커맨드 업데이트**

`/Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/threads-engine/SKILL.md`를 Read 툴로 읽고 Edit 툴로 수정한다.

변경 내용:
- `name: viral-engine` → `name: threads-engine`
- `description: Threads 바이럴 마케팅 스킬. /viral-engine ...` → `description: Threads 바이럴 마케팅 스킬. /threads-engine 하나로 setup/generate/retro 모두 실행. 처음이면 브랜드 설정, 이후엔 포스트 배치 생성 또는 성과 분석.`
- 본문의 `# /viral-engine` → `# /threads-engine`
- `Skill 툴로 viral-engine/viral-setup` → `Skill 툴로 threads-engine/viral-setup`
- `Skill 툴로 viral-engine/viral-engine` → `Skill 툴로 threads-engine/viral-engine`
- `Skill 툴로 viral-engine/viral-retro` → `Skill 툴로 threads-engine/viral-retro`

- [ ] **Step 3: 변경 결과 확인**

Read 툴로 수정된 SKILL.md를 읽고 다음을 확인:
- 프론트매터 name이 `threads-engine`인가
- 본문 헤더가 `# /threads-engine`인가
- 내부 Skill 호출이 모두 `threads-engine/...`인가

- [ ] **Step 4: orchestrator에서 커밋**

```bash
cd /Users/kim-young-gwang/Desktop/projects/orchestrator && git add .agents/skills/threads-engine && git status
```

Expected: `threads-engine/` 파일들이 new file로 표시 (git은 rename을 삭제+추가로 인식)

```bash
cd /Users/kim-young-gwang/Desktop/projects/orchestrator && git add -A .agents/skills/ && git commit -m "refactor: rename viral-engine skill to threads-engine

Threads 포스트 생성 전용임을 명확히 하기 위해 이름 변경.
brand-engine(범용 브랜드 전략)과의 구분을 위함.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: threads-uploader 로컬 미러 업데이트

**Files:**
- Rename: `threads-uploader/.agent/skills/viral-engine/` → `threads-engine/`
- Modify: `threads-uploader/.agent/skills/threads-engine/SKILL.md`

- [ ] **Step 1: threads-uploader에서 폴더 이름 변경**

```bash
mv /Users/kim-young-gwang/Desktop/projects/threads-uploader/.agent/skills/viral-engine \
   /Users/kim-young-gwang/Desktop/projects/threads-uploader/.agent/skills/threads-engine
```

Expected: 오류 없이 완료

- [ ] **Step 2: SKILL.md를 orchestrator 버전과 동일하게 복사**

```bash
cp /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/threads-engine/SKILL.md \
   /Users/kim-young-gwang/Desktop/projects/threads-uploader/.agent/skills/threads-engine/SKILL.md
```

- [ ] **Step 3: threads-uploader에서 커밋**

```bash
cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && git add -A .agent/skills/ && git commit -m "refactor: rename viral-engine skill to threads-engine (local mirror)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: brand-engine SKILL.md 생성 (orchestrator)

**Files:**
- Create: `orchestrator/.agents/skills/brand-engine/SKILL.md`

- [ ] **Step 1: 디렉토리 생성 확인 후 SKILL.md 작성**

Write 툴로 `/Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/brand-engine/SKILL.md`를 생성:

```markdown
---
name: brand-engine
description: 범용 브랜드 전략 스킬. /brand-engine 하나로 포지셔닝 검증 → 바이럴 포지셔닝 → 채널 전략까지 한 사이클 완성. 어떤 제품에도 적용 가능.
---

# /brand-engine

세 가지 프레임워크를 순차 파이프라인으로 통합한 범용 브랜드 전략 스킬.

```
INTAKE → PHASE 1(YC 검증) → PHASE 2(바이럴 포지셔닝) → PHASE 3(채널 전략) → OUTPUT
```

---

## 실행 규칙

- 질문은 반드시 **하나씩** — 복수 질문 금지
- 각 Phase는 이전 Phase 결과를 명시적으로 참조하며 진행
- 완충 표현 금지: "흥미롭네요", "고려해보세요" 등 사용 안 함
- 판정은 반드시 명확한 하나의 레이블로 출력

---

## INTAKE — 제품 정보 수집

아래 7개 질문을 **하나씩** 순서대로 묻는다.
이전 답변을 다음 질문에 반영해서 자연스러운 대화 흐름을 만든다.

**Q1**
> "제품명과 한 줄 설명을 알려줘. 무엇을 하는 제품인가?"

**Q2**
> "지금 어떻게 자신을 소개하고 있어? 현재 슬로건이나 브랜딩 문구가 있으면 알려줘."

**Q3**
> "누구를 위한 제품이야? 타겟 오디언스를 가능한 구체적으로 설명해줘."

**Q4**
> "가장 직접적인 경쟁사는 어디야? 없으면 없음이라고 해줘."

**Q5**
> "이 제품을 왜 만들었어? 창업 계기나 origin story를 짧게 알려줘."

**Q6**
> "지금 주로 쓰는 마케팅이나 홍보 채널이 뭐야?"

**Q7**
> "브랜딩에서 가장 불만이거나 개선하고 싶은 점이 뭐야?"

7개 답변 수집 완료 후, 한 줄 요약을 출력한다:

> "정리: [제품명]은 [타겟]을 위한 [핵심 기능] 제품. 현재 [현재 브랜딩]으로 포지셔닝 중. [불만 포인트] 개선 필요. — PHASE 1 시작"

---

## PHASE 1 — YC 검증

**목적:** 현재 포지셔닝의 숨겨진 전제를 드러내고 직접 도전한다.

### 실행 순서

**1. 포지셔닝 전제 추출**

INTAKE 답변에서 포지셔닝 전제 3가지를 추출한다.
형식: "전제 N: [추출된 전제]"

**2. 각 전제에 YC 스타일로 도전**

YC 파트너처럼 말한다. 완충 표현 없이 직접적으로.

도전 형식:
> "전제 [N]은 [도전 이유]. [왜 이게 문제인가]. 실제로는 [대안 관점]일 수 있다."

**3. 타겟 오디언스 검증**

"[현재 타겟]은 충분히 좁은가, 아니면 너무 넓은가?"를 명시적으로 판단.
"모두를 위한 제품"이면 즉시 지적.

**4. 메시지 명확성 평가**

"이 설명을 처음 듣는 사람이 5초 안에 이해하는가?"를 YES/NO로 판단.
NO면 어디서 막히는지 구체적으로 지적.

### 판정 출력 (필수)

아래 셋 중 하나를 반드시 출력:

- `✅ SOLID` — 포지셔닝 전제가 탄탄함. Phase 2에서 강화 방향으로 진행.
- `⚠️ NEEDS_PIVOT` — 일부 전제가 흔들림. Phase 2에서 약한 전제를 재정의.
- `🔴 REBUILD` — 핵심 전제가 잘못됨. Phase 2에서 포지셔닝을 처음부터 재설계.

형식: `[판정 레이블] — [한 줄 근거]`

판정 출력 후 PHASE 2로 진행.

---

## PHASE 2 — 바이럴 포지셔닝

**목적:** 브랜드의 차별화 세계관을 정의한다.

PHASE 1 판정을 참조해서 진행 방향을 결정:
- SOLID → 기존 포지셔닝을 기반으로 강화
- NEEDS_PIVOT → 약한 전제를 재정의하며 진행
- REBUILD → 타겟 오디언스부터 새로 정의하고 전부 재설계

### 1. 브랜드 DNA

제품이 진짜로 싸우고 있는 것을 세계관 수준의 문장으로 정의.
기술적 차별점이 아닌, 믿음의 차이를 드러낸다.

출력 형식:
> "브랜드 DNA: 우리는 [X]가 잘못됐다고 믿는다. 그래서 [Y]를 만든다."

### 2. 공동의 적

고객과 함께 반대편에 세울 대상을 정의.
경쟁사일 수도, 구시대 관행일 수도, 업계의 잘못된 믿음일 수도 있다.

출력 형식:
> "공동의 적: [대상] — [왜 이것이 고객의 적인가]"

### 3. 포지셔닝 슬로건 3개 후보

각 슬로건에 대해 수치 평가를 포함한다.

출력 형식:
```
슬로건 1: "[슬로건]"
  논란도(기억에 남는가): N/5
  명확성(즉시 이해되는가): N/5
  DNA 일치도(브랜드 DNA와 연결되는가): N/5
  → [추천/비추천] — [이유]

슬로건 2: "[슬로건]"
  ... (동일 형식)

슬로건 3: "[슬로건]"
  ... (동일 형식)
```

가장 높은 총점 슬로건을 추천으로 표시.

### 4. 브랜드 페르소나

이 브랜드가 사람이라면 어떤 캐릭터인가.

출력 형식:
```
브랜드 페르소나:
  나이대: [예: 30대 초반]
  말투: [예: 직설적, 유머 있음, 전문적이지만 친근함]
  좋아하는 것: [예: 효율, 자동화, 직접 만들기]
  절대 하지 않는 것: [예: 과장 광고, 모호한 표현, 기업 말투]
```

---

## PHASE 3 — 채널 전략

**목적:** 브랜드 DNA와 메시지가 가장 잘 작동하는 채널을 찾는다.

PHASE 2의 브랜드 DNA와 슬로건을 참조해서 각 채널 적합성을 평가한다.

### 1. 타겟 × 채널 매트릭스

타겟 오디언스가 실제로 있는 채널 vs 현재 사용 중인 채널을 비교.

출력 형식:
```
| 채널 | 타겟 있음? | 현재 사용? | 갭 |
|------|-----------|-----------|-----|
| Threads | Y/N | Y/N | [있음/없음] |
| X(Twitter) | Y/N | Y/N | [있음/없음] |
| LinkedIn | Y/N | Y/N | [있음/없음] |
| YouTube | Y/N | Y/N | [있음/없음] |
| Instagram | Y/N | Y/N | [있음/없음] |
| SEO/블로그 | Y/N | Y/N | [있음/없음] |
```

갭(타겟 있음 + 현재 미사용)이 있으면 별도로 강조.

### 2. 경쟁사 갭 분석

경쟁사가 약하거나 비어있는 채널/메시지 영역을 식별.

출력 형식:
> "공략 포인트: [경쟁사]는 [채널/영역]에서 [약점]. 우리는 [어떻게 치고 들어갈 수 있는가]."

경쟁사가 없으면 카테고리 전체의 공백을 분석.

### 3. 우선순위 채널 3개

각 채널별로 구체적인 방향을 제시.

출력 형식:
```
채널 1: [채널명]
  선택 이유: [타겟 × DNA 적합성]
  메시지 톤: [이 채널에서 어떤 목소리로 말할 것인가]
  첫 번째 실험: [구체적인 첫 액션]

채널 2: [채널명]
  ... (동일 형식)

채널 3: [채널명]
  ... (동일 형식)
```

### 4. 즉시 실행 액션 3개

이번 주 안에 실행 가능한 것만. 분기 목표 금지.
각 액션은 동사로 시작하는 구체적 문장.

출력 형식:
```
즉시 실행 액션:
1. [ ] [동사 + 구체적 행동] — [예상 시간]
2. [ ] [동사 + 구체적 행동] — [예상 시간]
3. [ ] [동사 + 구체적 행동] — [예상 시간]
```

---

## OUTPUT — 브랜드 전략 리포트 저장

모든 Phase 완료 후, Write 툴로 `docs/brand-strategy-{오늘날짜}.md`를 생성.

파일 내용:

```markdown
# Brand Strategy Report — {제품명}
생성일: {YYYY-MM-DD}

---

## 포지셔닝 판정
{SOLID / NEEDS_PIVOT / REBUILD} — {근거}

## 브랜드 DNA
{브랜드 DNA 문장}

## 공동의 적
{공동의 적 + 이유}

## 포지셔닝 슬로건

### 추천 슬로건
**"{추천 슬로건}"** — {선택 이유}

### 후보 전체
| 슬로건 | 논란도 | 명확성 | DNA 일치도 | 총점 |
|--------|--------|--------|------------|------|
| "{슬로건1}" | N/5 | N/5 | N/5 | N/15 |
| "{슬로건2}" | N/5 | N/5 | N/5 | N/15 |
| "{슬로건3}" | N/5 | N/5 | N/5 | N/15 |

## 브랜드 페르소나
- 나이대: {나이대}
- 말투: {말투}
- 좋아하는 것: {좋아하는 것}
- 절대 하지 않는 것: {절대 하지 않는 것}

## 채널 전략

### 우선순위 채널
1. **{채널1}** — {톤 방향} — 첫 실험: {첫 실험}
2. **{채널2}** — {톤 방향} — 첫 실험: {첫 실험}
3. **{채널3}** — {톤 방향} — 첫 실험: {첫 실험}

### 경쟁사 갭
{갭 분석 결과}

### 채널 매트릭스
{채널 매트릭스 표}

## 즉시 실행 액션
1. [ ] {액션1} — {예상 시간}
2. [ ] {액션2} — {예상 시간}
3. [ ] {액션3} — {예상 시간}
```

파일 저장 완료 후 유저에게 알린다:

> "✅ 브랜드 전략 리포트 저장 완료: docs/brand-strategy-{날짜}.md
> 추천 슬로건: '{추천 슬로건}'
> 즉시 실행할 것: {액션1}"
```

- [ ] **Step 2: 파일이 올바르게 생성됐는지 확인**

Read 툴로 생성된 파일을 읽고 다음을 확인:
- 프론트매터에 `name: brand-engine`이 있는가
- INTAKE 섹션에 7개 질문이 모두 있는가
- PHASE 1에 `SOLID / NEEDS_PIVOT / REBUILD` 판정이 있는가
- PHASE 2에 슬로건 수치 평가(논란도/명확성/DNA 일치도)가 있는가
- PHASE 3에 채널 매트릭스와 즉시 실행 액션이 있는가
- OUTPUT 섹션에 파일 저장 로직이 있는가

- [ ] **Step 3: orchestrator에서 커밋**

```bash
cd /Users/kim-young-gwang/Desktop/projects/orchestrator && git add .agents/skills/brand-engine/ && git commit -m "feat: add brand-engine skill

어떤 제품에도 적용 가능한 범용 브랜드 전략 스킬.
INTAKE → YC검증 → 바이럴포지셔닝 → 채널전략 → 리포트 파이프라인.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: brand-engine 로컬 미러 생성 (threads-uploader)

**Files:**
- Create: `threads-uploader/.agent/skills/brand-engine/SKILL.md`

- [ ] **Step 1: orchestrator의 brand-engine을 threads-uploader에 복사**

```bash
mkdir -p /Users/kim-young-gwang/Desktop/projects/threads-uploader/.agent/skills/brand-engine && \
cp /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/brand-engine/SKILL.md \
   /Users/kim-young-gwang/Desktop/projects/threads-uploader/.agent/skills/brand-engine/SKILL.md
```

- [ ] **Step 2: threads-uploader에서 커밋**

```bash
cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && \
git add .agent/skills/brand-engine/ && \
git commit -m "feat: add brand-engine skill (local mirror)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 최종 검증

- [ ] **Step 1: 스킬 목록 확인**

```bash
ls /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/
```

Expected 출력에 `threads-engine`과 `brand-engine`이 있고 `viral-engine`은 없어야 함.

```bash
ls /Users/kim-young-gwang/Desktop/projects/threads-uploader/.agent/skills/
```

동일하게 `threads-engine`과 `brand-engine`이 있어야 함.

- [ ] **Step 2: threads-engine SKILL.md 내부 참조 확인**

```bash
grep -n "viral-engine\|threads-engine" \
  /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/threads-engine/SKILL.md
```

Expected: `viral-engine` 참조 없음. `threads-engine` 참조만 있어야 함.

- [ ] **Step 3: brand-engine 프론트매터 확인**

```bash
head -5 /Users/kim-young-gwang/Desktop/projects/orchestrator/.agents/skills/brand-engine/SKILL.md
```

Expected:
```
---
name: brand-engine
description: 범용 브랜드 전략 스킬. ...
---
```
