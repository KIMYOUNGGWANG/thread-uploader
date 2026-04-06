# Viral Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/viral-setup` → `/viral-engine` → `/viral-retro` Claude Code 스킬 세트와 범용 포스트 생성 스크립트를 구축해 어떤 브랜드든 바이럴 Threads 포스트를 자동 생성·검증·발행할 수 있게 한다.

**Architecture:** 3개 Claude Code 스킬(Markdown 프롬프트) + 3개 레퍼런스 파일 + 1개 Node.js 스크립트. `/viral-setup`이 `brand-voice.md`를 생성 → `/viral-engine`이 이를 읽어 `generate-batch.mjs`를 호출, 초안 생성 후 Expert Panel 품질 검증 → threads-uploader 투입용 MD 출력. `/viral-retro`는 성과 데이터로 `brand-voice.md`를 업데이트해 플라이휠을 완성한다.

**Tech Stack:** Claude Code skills (Markdown) · Node.js ESM · `@anthropic-ai/sdk` (설치됨) · `claude-haiku-4-5-20251001`

---

## File Map

| 파일 | 역할 | 상태 |
|------|------|------|
| `.claude/skills/viral-engine/SKILL.md` | 메인 오케스트레이터 | 신규 |
| `.claude/skills/viral-engine/viral-setup.md` | 브랜드 설정 (5문답 → brand-voice.md) | 신규 |
| `.claude/skills/viral-engine/viral-engine.md` | 생성→검증→출력 플로우 | 신규 |
| `.claude/skills/viral-engine/viral-retro.md` | 성과 회고 + brand-voice.md 업데이트 | 신규 |
| `.claude/skills/viral-engine/references/viral-principles.md` | Roy Lee 20원칙 + 8 스턴트 템플릿 | 신규 |
| `.claude/skills/viral-engine/references/expert-panel.md` | 3 페르소나 채점 기준 + 24 AI slop 패턴 | 신규 |
| `.claude/skills/viral-engine/references/post-formulas.md` | 9가지 포스트 공식 (범용) | 신규 |
| `scripts/generate-batch.mjs` | 브랜드 파라미터 기반 범용 포스트 생성기 | 신규 |

---

## Task 1: 디렉토리 구조 생성

**Files:**
- Create: `.claude/skills/viral-engine/references/` (디렉토리)

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p .claude/skills/viral-engine/references
```

Expected output: (no output, silent success)

- [ ] **Step 2: 확인**

```bash
ls .claude/skills/viral-engine/
```

Expected: `references/` 디렉토리 존재

- [ ] **Step 3: Commit**

```bash
git add .claude/
git commit -m "chore: scaffold viral-engine skill directory"
```

---

## Task 2: viral-principles.md 작성

go-viral-or-die 레포의 핵심 내용을 스킬에서 참조할 수 있게 정리.

**Files:**
- Create: `.claude/skills/viral-engine/references/viral-principles.md`

- [ ] **Step 1: 파일 작성**

`.claude/skills/viral-engine/references/viral-principles.md` 내용:

```markdown
# Viral Marketing Principles (Roy Lee / go-viral-or-die)

Source: crealwork/go-viral-or-die — 11 YouTube interviews + TechCrunch Disrupt 2025

---

## Top 10 핵심 원칙 (포스트 생성 시 항상 참조)

### 1. 논란 = 화폐
논란이 강할수록 더 바이럴된다. 플랫폼별로 다름:
- X/Twitter: 논란, 드라마, WTF 순간
- TikTok: 볼륨, 공감형 숏폼
- Threads: 의견 분열, 편가르기, 반직관 주장

### 2. 50% 혐오 테스트
절반이 싫어해야 바이럴된다. "모두가 좋아할 것" = 모두가 무시한다.
모든 포스트에 이 질문을 던져라: "이 글에 강하게 반응할 사람이 있나?"

### 3. 배포 > 제품 (초기에만)
깊은 기술이 없다면 배포에 집중해라. 하지만 바이럴만으로 회사를 살릴 수 없다.
바이럴은 시도할 이유를 주지만, 계속 쓸 이유는 제품이 만든다.

### 4. 공공의 적 선언
타깃이 이미 싫어하는 것을 골라 선전 포고해라.
"우리 vs. 저것" 프레임은 아군을 즉시 결집시킨다.

### 5. 스캔들을 콘텐츠로 뒤집기
실패, 실수, 창피한 일 → 공개적으로 오너십 → 담대함/진정성의 증거로 프레임.
"이것 때문에 [제품]을 만들었어"로 마무리.

### 6. 불가능한 주장
기술적으로 사실이지만 감정적으로 도발적인 주장을 해라.
"이거 가능해?" 논쟁 → 무료 인게이지먼트.
모호함은 버그가 아니라 기능이다.

### 7. 투명성 핵폭탄
업계가 숨기고 싶어하는 것을 공개해라.
"이거 공개하지 말라고 했는데" → 즉각적 신뢰 + 바이럴.

### 8. 역발상
모두가 당연히 믿는 상식을 정면 반박해라.
동의하는 파와 반론 파 모두 댓글을 달게 만들어라.

### 9. 브랜드 DNA 일치
논란이 제품과 일치해야 한다. 제품이 반체제적이라면 논란도 반체제적이어야 한다.
일관성 없는 논란은 오히려 브랜드를 해친다.

### 10. 첫 번째 승리 + 모멘텀
첫 번째 바이럴 이후 즉시 행동해라. 관심의 창은 빠르게 닫힌다.
모멘텀이 있을 때 다음 단계로 치고나가라.

---

## Roy Scale — 포스트 평가 지표

포스트를 만들 때마다 이 기준으로 평가:

| 지표 | 기호 | 1 | 3 | 5 |
|------|------|---|---|---|
| 논란도 | 🔥 | 무해함 | 의견 분열 | 반반 분열 |
| 바이럴 잠재력 | 🚀 | 공유 안 됨 | 일부 공유 | 군중 공유 |
| 전환 잠재력 | 💰 | 제품 연관 없음 | 약한 연관 | 강한 구매 유발 |
| 리스크 | ⚠️ | LOW | MEDIUM | HIGH |

목표: 🔥🔥🔥 + 🚀🚀🚀 + 💰💰 + 리스크 MEDIUM 이하

---

## 8가지 스턴트 템플릿

### Template 1: 논란 데모 (Controversial Demo)
제품으로 "하면 안 될 것"을 대놓고 해본다.
- 변형: "X를 [제품]으로 하면 이렇게 돼" — 영상이나 캡처 포함
- 리스크: HIGH | 전환: HIGH | 시간: 1-3일

### Template 2: 공공의 적 선언 (Common Enemy Manifesto)
타깃이 이미 싫어하는 업계 관행을 선전포고.
- 구조: "이제 [싫어하는 것]이 말이 안 된다고 생각해. 그래서 [제품] 만들었어"
- 리스크: MEDIUM | 전환: HIGH | 시간: 1일

### Template 3: 스캔들 플립 (Scandal Flip)
창피한 실패 → 공개 고백 → "그래서 더 좋아진" 서사.
- 구조: "나 [창피한 일] 했어. 근데 그게 왜 좋은 일인지 알려줄게"
- 리스크: MEDIUM | 전환: MEDIUM | 시간: 1-2일

### Template 4: 콘텐츠 군대 (Content Army)
여러 각도에서 같은 핵심 메시지를 일제히 발사.
- 변형: 같은 주제를 warning/contrarian/choice/reveal 공식으로 각각 작성
- 리스크: LOW | 전환: HIGH | 시간: 1-2주

### Template 5: 스펙터클 이벤트 (Spectacle Event)
오프라인/온라인에서 업계가 본 적 없는 과도한 이벤트.
- 리스크: MEDIUM-HIGH | 전환: MEDIUM | 시간: 2-4주

### Template 6: 도발적 론칭 영상 (Provocative Launch Video)
제품의 가장 극단적 사용 사례를 보여주는 영상.
- 구조: "좋든 싫든, 이게 [산업]의 미래야"
- 리스크: HIGH | 전환: VERY HIGH | 시간: 3-7일

### Template 7: 불가능한 주장 (Impossible Claim)
기술적으로 사실이지만 감정적으로 도발적인 주장.
- 구조: "[불가능해 보이는 것] 가능해" — 논쟁 유발 → 증명
- 리스크: MEDIUM | 전환: HIGH | 시간: 1일

### Template 8: 투명성 핵폭탄 (Transparency Nuke)
업계가 숨기는 것을 공개.
- 구조: "이거 공개하지 말라고 했는데 — [비밀]"
- 리스크: HIGH | 전환: MEDIUM-HIGH | 시간: 1-2일

---

## 스턴트 선택 매트릭스

| 상황 | 추천 템플릿 |
|------|-----------|
| 론칭 전, 팔로워 없음 | 2 (공공의 적) + 7 (불가능한 주장) |
| 론칭 당일 | 6 (도발적 영상) + 1 (논란 데모) |
| 론칭 후, 성장 필요 | 4 (콘텐츠 군대) + 3 (스캔들 플립) |
| 팔로워 있음, 전환 필요 | 1 (논란 데모) + 8 (투명성 핵폭탄) |
| 실패 후 회복 | 3 (스캔들 플립) + 8 (투명성 핵폭탄) |
| 예산 없는 솔로 창업자 | 2 + 3 + 7 |
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-engine/references/viral-principles.md
git commit -m "feat: add viral-principles reference (Roy Lee + stunt templates)"
```

---

## Task 3: expert-panel.md 작성

ai-marketing-skills의 Expert Panel + x-longform-post의 24 AI slop 패턴을 통합.

**Files:**
- Create: `.claude/skills/viral-engine/references/expert-panel.md`

- [ ] **Step 1: 파일 작성**

`.claude/skills/viral-engine/references/expert-panel.md` 내용:

```markdown
# Expert Panel — 포스트 품질 게이트

Source: ericosiu/ai-marketing-skills (content-ops, x-longform-post)

각 포스트를 3개 페르소나가 채점한다. 3명 평균 90점 이상이어야 통과.
미달 시 1회 재작성 → 재채점 → 여전히 미달이면 폐기.

---

## 3개 채점 페르소나

### Persona 1: Roy Lee (바이럴 심사관)
**역할:** go-viral-or-die 20원칙 기준으로 바이럴 가능성 평가
**채점 기준 (각 25점):**
- 50% 혐오 테스트 통과? (25점): 절반이 싫어할 각도가 있는가
- 공유 유발 요소 있음? (25점): 저장/공유/댓글 중 하나라도 강하게 유발하는가
- 논란 각도가 브랜드 DNA와 일치? (25점): 브랜드 보이스와 일관성
- 훅이 스크롤을 멈추게 하는가? (25점): 첫 1-2줄이 즉각적 반응 유발

**Roy Lee 감점 항목:**
- "모두를 위한" 메시지: -20점
- 브랜드 직접 언급/광고 느낌: -30점
- 예측 가능한 결말: -15점

---

### Persona 2: 타깃 유저 (독자 심사관)
**역할:** 실제 타깃이 이 포스트를 보면 어떻게 반응할지 평가
**채점 기준 (각 25점):**
- "내 얘기인가?" (25점): 타깃의 구체적 상황/감정을 건드리는가
- 저장하고 싶은가? (25점): 나중에 다시 볼 만큼 가치 있는 정보/인사이트
- 댓글 달고 싶은가? (25점): 의견을 표명하거나 공유하고 싶은 충동
- 읽기 편한가? (25점): 줄바꿈, 길이, 가독성

**타깃 유저 감점 항목:**
- 너무 광범위해서 아무도 내 얘기가 아닌 느낌: -25점
- 6줄 미만 또는 12줄 초과: -10점

---

### Persona 3: 편집장 (품질 심사관)
**역할:** 문체 품질 + AI 냄새 탐지 (24패턴 체크)
**채점 기준 (각 25점):**
- AI slop 패턴 없음 (25점): 아래 24패턴 중 하나도 없어야 함
- 자연스러운 한국어 문체 (25점): 친구가 쓴 것 같은 구어체
- 브랜드 금지 표현 미사용 (25점): brand-voice.md의 금지 항목 준수
- 포스트 공식 충실 (25점): 선택된 공식(warning/contrarian 등)의 구조 따름

---

## AI Slop 24패턴 체크리스트

Source: ericosiu/ai-marketing-skills x-longform-post/SKILL.md

포스트를 최종 출력하기 전 이 24패턴을 전수 검사한다. 하나라도 발견되면 재작성.

### 절대 금지 어휘 (한국어 포스트 적용)
다음 단어/표현이 있으면 즉시 재작성:
- `활용하다` (→ 쓰다)
- `다양한` (→ 구체적으로 나열하거나 삭제)
- `혁신적인`, `혁신` (→ 구체적 기능으로 대체)
- `중요합니다`, `중요한` (→ 왜 중요한지 보여주거나 삭제)
- `효과적인`, `효율적인` (→ 얼마나? 구체적 수치로)
- `~해야 합니다` (→ `~해`, `~하면 돼`)
- `~것 같습니다`, `~것 같아요` (→ 직접 말해)
- `그리고`, `또한`, `추가로` 로 시작하는 문장 (→ 재구성)

### 24패턴 체크

1. **과장된 중요성 부여** ("이건 정말 중요해", "반드시 알아야 해")
2. **근거 없는 권위 인용** ("전문가들은", "연구에 따르면" — 출처 없음)
3. **-ing형 수식어 남발** ("이걸 보여주면서", "알려주면서")
4. **홍보성 어휘** ("최고의", "완벽한", "놀라운")
5. **모호한 귀속** ("사람들이 말하길", "업계에서는")
6. **역경→극복 공식 남용** ("어렵지만… 계속 나아갑니다" 구조)
7. **AI 어휘 군집** (한 문단에 금지 어휘 2개 이상)
8. **대리 동사 사용** ("역할을 합니다" → "입니다", "기능을 수행합니다" → "합니다")
9. **부정 병렬 구조** ("X가 아니라 Y야" → "Y야"로 직접 말하기)
10. **3연속 나열 강요** (형용사 3개, 병렬절 3개 인위적 나열)
11. **불필요한 유의어 순환** (같은 개념을 다른 단어로 반복)
12. **가짜 범위 제시** ("X부터 Y까지" — 의미 없는 스펙트럼)
13. **대시(—) 남용** (200자에 2개 이상)
14. **기계적 강조 볼드** (모든 핵심어에 **강조** 남발)
15. **인라인 헤더 목록** (볼드 + 콜론 + 설명 반복 패턴)
16. **모든 소제목 제목체 대문자** (LIKE THIS IN KOREAN 비슷한 패턴)
17. **헤딩/불릿에 이모지 장식** (📌 **포인트:** 식의 남발)
18. **AI 협력 흔적** ("도움이 됐으면 해", "궁금한 거 있으면 말해줘")
19. **지식 컷오프 면피** ("최신 정보는 직접 확인하세요")
20. **아첨성 톤** ("좋은 질문이야")
21. **필러 표현** ("사실은", "솔직히 말하면", "중요한 건")
22. **과도한 헤징** ("~할 수도 있어", "~인 것 같기도 해")
23. **긍정 클리셰 마무리** ("앞으로가 기대돼", "밝은 미래가 보여")
24. **"Not X, It's Y" 구조** ("이건 X가 아니야. Y야." → "Y야."로 직접)

---

## 채점 방법

각 포스트에 대해 3 페르소나가 각각 0-100점 채점.

```
Roy Lee 점수:    __/100
타깃 유저 점수:  __/100
편집장 점수:     __/100
평균:            __/100  → 90+ 통과 / 미달 재작성
```

**재작성 지시:**
- Roy Lee 낮음: 훅 강화, 논란 각도 추가, 브랜드 직접 언급 제거
- 타깃 유저 낮음: 더 구체적인 상황/감정으로 바꾸기, 길이 조정
- 편집장 낮음: AI 패턴 제거, 금지 어휘 교체, 공식 구조 강화
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-engine/references/expert-panel.md
git commit -m "feat: add expert-panel reference (3 personas + 24 slop patterns)"
```

---

## Task 4: post-formulas.md 작성

기존 `generate-posts.mjs`의 CosmicPath 전용 공식 9개를 브랜드 독립적으로 범용화.

**Files:**
- Create: `.claude/skills/viral-engine/references/post-formulas.md`

- [ ] **Step 1: 파일 작성**

`.claude/skills/viral-engine/references/post-formulas.md` 내용:

```markdown
# 9가지 포스트 공식

어떤 브랜드에도 적용 가능한 Threads 포스트 공식.
generate-batch.mjs의 FORMULAS 배열과 동일한 구조.

각 공식은 독립적이며, Expert Panel 채점 시 해당 공식의 구조 충실도를 평가한다.

---

## 1. warning — 경고/위험 회피 (weight: 4)

**핵심 구조:**
- 특정 타깃이 반드시 조심해야 할 것을 경고
- 제목 라인: "[대상]가 반드시 조심해야 할 [N]가지" 또는 "[대상]는 [위험] 주의"
- 리스트 형식(1. 2. 3.)으로 위험 신호 나열
- 마지막 CTA: "해당되면 저장해" 또는 "주변에 [대상] 있으면 공유해줘"
- 톤: 공포 유발이 아니라 "알고 대비하면 막을 수 있어" 느낌

**왜 작동하는가:** 저장 유발 + 공유 유발. "내가 해당되는지" 확인 욕구.

---

## 2. contrarian — 반직관 훅 (weight: 3)

**핵심 구조:**
- 모두가 당연하게 믿는 상식을 정면 반박
- 시작: "사실 [당연한 상식]은 틀렸어" 또는 "아무도 말 안 해주는 진짜 얘기"
- 반박 근거 2-3개 제시
- 동의파/반론파 모두 댓글 달 여지 남기기
- 선택적 마무리: "반박시 니 말이 맞음"

**왜 작동하는가:** 댓글 폭발. 동의와 반론 모두 인게이지먼트.

---

## 3. choice — 편가르기 (weight: 3)

**핵심 구조:**
- 극적인 상황 설정
- 3개의 선택지 제시 (3번은 반전이거나 의외)
- 질문으로 끝내지 말 것 — 선택지만 주면 됨
- 매번 완전히 다른 도입부 구조 (반복 금지)

**왜 작동하는가:** "나는 뭐지?" 자기 인식 욕구 + 댓글로 선택 공유.

---

## 4. reveal — 반전 폭로 (weight: 3)

**핵심 구조:**
- A보다 B가 낫고, B보다 C가 더 강력하다는 논리 전개
- 매번 전혀 다른 문장 구조로 시작
- 설명 후 독자 해당 여부 확인 유도

**왜 작동하는가:** "내가 C인가?" 자기 확인 + 저장 후 다시 읽기.

---

## 5. thisorthat — 양자택일 (weight: 2)

**핵심 구조:**
- 극단적으로 다른 두 유형 대비
- 에너지나 성향 차이를 나열
- 마지막에 선택 유도
- 매 포스트마다 다른 일상적 상황/말투로 시작

**왜 작동하는가:** "나는 어느 쪽?" 자기 분류 욕구 + 댓글 진입장벽 낮음.

---

## 6. check — 해당여부 확인 (weight: 2)

**핵심 구조:**
- 특정 조건이나 특성 나열
- "있어?", "깔려있어?" 형식으로 독자 확인 유도
- "있으면 넌 [특별한 것]이야" 또는 "조심해야 해" 구조

**왜 작동하는가:** 즉각적인 자기 확인 + "나 해당돼!" 댓글 유발.

---

## 7. save — 저장형 정리 (weight: 2)

**핵심 구조:**
- 체크리스트 / 단계별 방법론 / 비교표
- "저장해두고 나중에 꺼내봐" CTA 직접 작성
- 앱 없어도 이해되는 독립형 콘텐츠
- 3-5줄 리스트로 정리, 수치/공식 포함

**왜 작동하는가:** 저장 수 극대화. 알고리즘 신호.

---

## 8. humor — 공감 유머 (weight: 2)

**핵심 구조:**
- 공통 경험에서 시작 (모두가 겪는 것)
- "그 시간/돈으로 더 나은 걸 했을걸" 또는 의외의 반전
- 캐주얼한 친구 말투 유지

**왜 작동하는가:** 리포스트 유발. "맞아ㅋㅋ" 댓글.

---

## 9. truth — 불편한 진실 (weight: 2)

**핵심 구조:**
- 불편하지만 공감 가는 팩트 제시
- 논쟁 유발 — 동의하는 사람과 반론하는 사람 모두 댓글 달게
- 직설적이고 솔직한 톤
- "반박시 니 말이 맞음" 같은 표현 가능

**왜 작동하는가:** 댓글 폭발. 바이럴 잠재력 최고.

---

## 공식별 Roy Scale 기대치

| 공식 | 논란도 | 바이럴 잠재력 | 저장 | 댓글 |
|------|--------|-------------|------|------|
| warning | 🔥🔥🔥 | 🚀🚀🚀 | 높음 | 중간 |
| contrarian | 🔥🔥🔥🔥 | 🚀🚀🚀🚀 | 중간 | 높음 |
| choice | 🔥🔥🔥 | 🚀🚀🚀 | 낮음 | 높음 |
| reveal | 🔥🔥🔥 | 🚀🚀🚀 | 높음 | 중간 |
| thisorthat | 🔥🔥 | 🚀🚀🚀 | 낮음 | 높음 |
| check | 🔥🔥 | 🚀🚀🚀 | 낮음 | 높음 |
| save | 🔥🔥 | 🚀🚀🚀🚀 | 높음 | 낮음 |
| humor | 🔥🔥 | 🚀🚀🚀🚀 | 중간 | 높음 |
| truth | 🔥🔥🔥🔥 | 🚀🚀🚀🚀 | 중간 | 높음 |
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-engine/references/post-formulas.md
git commit -m "feat: add post-formulas reference (9 generic formulas)"
```

---

## Task 5: viral-setup.md 스킬 작성

**Files:**
- Create: `.claude/skills/viral-engine/viral-setup.md`

- [ ] **Step 1: 파일 작성**

`.claude/skills/viral-engine/viral-setup.md` 내용:

```markdown
---
name: viral-setup
description: Brand voice setup for viral-engine. Run ONCE per brand. Asks 5 questions one at a time and creates .agent/memory/brand-voice.md — the foundation for all /viral-engine runs.
---

# /viral-setup — 브랜드 보이스 설정

바이럴 마케팅 기반을 만든다.
5개의 질문에 답하면 `.agent/memory/brand-voice.md`가 생성된다.
이 파일은 모든 `/viral-engine` 실행의 기반이다.

## 진행 방식

질문을 **하나씩** 묻는다. 답변을 받은 후 다음 질문으로 넘어간다.
5개 완료 후 `brand-voice.md`를 Write 툴로 생성한다.

## 질문 순서

**Q1 — 브랜드 기본 정보**
> "브랜드명과 한 줄 설명을 알려줘. 무엇을 하는 제품인가?"

**Q2 — 타깃 유저**
> "누가 주로 써? 가능한 구체적으로. (나이대, 상황, 이 제품이 해결하는 문제)"

**Q3 — 기존 성공 사례**
> "잘 됐던 포스트나 콘텐츠 예시가 있어? 없으면 '없음'이라고 해줘."

**Q4 — 50% 혐오 테스트**
> "이 제품이나 브랜드를 싫어할 사람이 누구야?
> (절반이 싫어해야 바이럴됨. '모두가 좋아할 것'은 모두가 무시한다.)"

**Q5 — 가드레일**
> "절대 하면 안 되는 톤이나 표현이 있어?"

## brand-voice.md 생성

5개 답변 수집 후, `.agent/memory/brand-voice.md`를 Write 툴로 생성.
`references/viral-principles.md`의 Roy Scale과 스턴트 매트릭스를 참조해서
브랜드에 맞는 추천 스턴트 3개를 선정한다.

파일 내용:

```
# Brand Voice — {Q1에서 추출한 브랜드명}
> 마지막 업데이트: {오늘 날짜}

## 브랜드 정보
- **이름:** {브랜드명}
- **설명:** {한 줄 설명}
- **ICP:** {Q2 타깃 유저 — 가능한 구체적으로}

## 핵심 메시지
{Q1 + Q2를 종합한 단 하나의 핵심 메시지. 한 문장.}

## 논란 각도
- **싫어할 사람:** {Q4 답변}
- **50% 혐오 포인트:** {Q4에서 도출한 구체적 논란 각도}
- **공공의 적 (선택):** {브랜드가 싸울 수 있는 업계 관행이나 경쟁자}

## 추천 스턴트 템플릿
{viral-principles.md의 8개 템플릿 + 스턴트 매트릭스 참조, 브랜드에 맞는 3개 + 이유}
1. {템플릿명}: {이 브랜드에 맞는 구체적 이유}
2. {템플릿명}: {이유}
3. {템플릿명}: {이유}

## Roy Scale 목표
- 논란도: {🔥 추천 개수}
- 바이럴 잠재력: {🚀 추천 개수}
- 전환 잠재력: {💰 추천 개수}
- 리스크 수준: {LOW / MEDIUM / HIGH}

## 금지 톤 / 표현
{Q5 답변 정리. 없으면 "없음"}

## 성과 히스토리
> /viral-retro 실행 시 자동 업데이트됨

| 날짜 | 배치 | 공식 우승 | 스턴트 우승 | 비고 |
|------|------|----------|-----------|------|
| - | - | - | - | 아직 데이터 없음 |
```

## 완료

brand-voice.md 생성 후:
> "✅ brand-voice.md 생성 완료!
> 이제 `/viral-engine`을 실행해 포스트 배치를 생성할 수 있어."
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-engine/viral-setup.md
git commit -m "feat: add viral-setup skill (brand voice 5-question setup)"
```

---

## Task 6: viral-engine.md 스킬 작성

**Files:**
- Create: `.claude/skills/viral-engine/viral-engine.md`

- [ ] **Step 1: 파일 작성**

`.claude/skills/viral-engine/viral-engine.md` 내용:

```markdown
---
name: viral-engine
description: Generate viral Threads posts. Reads brand-voice.md, selects stunt strategy, runs generate-batch.mjs (draft generation), applies Expert Panel quality gate (90+ score), outputs threads-uploader ready MD file.
---

# /viral-engine — 바이럴 포스트 생성

## 사전 조건 확인

`.agent/memory/brand-voice.md`가 존재하는지 Read 툴로 확인.
없으면 즉시 중단:
> "brand-voice.md가 없습니다. 먼저 `/viral-setup`을 실행해주세요."

## Phase 1 — 전략 선택

`.agent/memory/brand-voice.md`를 읽고 `## 추천 스턴트 템플릿` 섹션을 표시.
`## 성과 히스토리`가 있으면 잘 된 스턴트를 강조.

유저에게:
> "이번 배치에 어떤 전략을 쓸까요?
> 1. {추천 스턴트 1}
> 2. {추천 스턴트 2}
> 3. {추천 스턴트 3}
> 4. 자동 선택
> 번호를 입력해줘."

## Phase 2 — 포스트 초안 생성

선택된 전략으로 Bash 툴로 generate-batch.mjs 실행:

```bash
node scripts/generate-batch.mjs \
  --brand .agent/memory/brand-voice.md \
  --count 60 \
  --stunt "{선택된 스턴트명}" \
  --output output/$(date +%Y-%m-%d)-draft.md
```

실행 완료 후 생성된 draft.md를 Read 툴로 읽는다.

## Phase 3 — Expert Panel 품질 게이트

`references/expert-panel.md`를 읽어 채점 기준 로드.

초안의 각 포스트를 **5개씩 묶어** 채점한다 (토큰 효율).

각 묶음마다:
1. 3개 페르소나(Roy Lee / 타깃 유저 / 편집장)로 각 포스트 0-100점 채점
2. 24 AI slop 패턴 전수 검사
3. 평균 90점 미만 → 재작성 지시 (구체적 이유 포함)
4. 재작성 후 재채점 → 여전히 미달이면 폐기 표시

## Phase 4 — 최종 출력

통과한 포스트만 모아 최종 파일 생성.
Write 툴로 `output/YYYY-MM-DD-{브랜드명}-posts.md` 작성.

파일 헤더:
```
# {브랜드명} Threads 포스트 (통과: {N}개)
> 생성일시: {날짜}
> 스턴트: {선택된 스턴트}
> Expert Panel 통과: {통과 수}/{전체 수}
```

각 포스트 포맷 (threads-uploader 호환):
```
---

## 포스트 {번호}
<!-- formula:{공식id} stunt:{스턴트} score:{평균점수} -->

{포스트 본문}

> **💬 첫 댓글 (골든타임용)**
>
> {첫 댓글}
```

## Phase 5 — 완료 메시지

> "✅ {N}개 포스트 생성 완료
> → output/YYYY-MM-DD-{브랜드명}-posts.md
>
> threads-uploader에서 업로드:
> POST /api/posts/upload 에 이 파일을 투입하세요.
>
> 2주 후 /viral-retro로 성과 분석을 실행하면 다음 배치가 더 정확해집니다."
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-engine/viral-engine.md
git commit -m "feat: add viral-engine skill (generate + quality gate + output)"
```

---

## Task 7: viral-retro.md 스킬 작성

**Files:**
- Create: `.claude/skills/viral-engine/viral-retro.md`

- [ ] **Step 1: 파일 작성**

`.claude/skills/viral-engine/viral-retro.md` 내용:

```markdown
---
name: viral-retro
description: Analyze Threads post performance and update brand-voice.md. Run every 2 weeks after publishing a batch. Accepts any format of performance data (numbers, screenshots, vibes).
---

# /viral-retro — 성과 분석 + 학습 반영

발행한 포스트의 성과를 분석하고 다음 배치 전략을 개선한다.

## 데이터 수집

`.agent/memory/brand-voice.md`를 Read 툴로 읽어 이전 배치 정보 확인.

유저에게:
> "지난 배치 성과 데이터를 붙여넣어줘.
> 수치, 스크린샷 설명, '이게 터진 것 같아' 같은 느낌도 다 괜찮아."

## 분석 프레임워크

받은 데이터에서 5가지를 추출:

**1. 공식별 성과**
`references/post-formulas.md`의 9개 공식 중 어떤 것이 가장 높은 반응을 얻었는가.
조회수 / 저장수 / 댓글수 기준으로 순위 매기기.

**2. 스턴트 템플릿별 성과**
`references/viral-principles.md`의 8개 스턴트 중 어떤 것이 공유/저장을 유발했는가.

**3. 주제별 반응**
어떤 주제(타깃/상황/문제)가 댓글 폭발을 일으켰는가.

**4. 역학습 (의외의 히트)**
탈락할 것 같았는데 의외로 터진 것. 이유 분석.

**5. 다음 배치 전략 추천**
위 분석 기반으로:
- 다음에 집중할 공식 Top 3
- 다음에 피할 공식
- 추천 스턴트 템플릿 업데이트

## brand-voice.md 업데이트

`.agent/memory/brand-voice.md`의 `## 성과 히스토리` 테이블에 행 추가:

```
| {오늘 날짜} | {배치번호} | {공식 우승} | {스턴트 우승} | {주요 인사이트} |
```

성과 기반으로 `## 추천 스턴트 템플릿` 순위도 업데이트.

## 완료

> "✅ brand-voice.md 업데이트 완료.
> 다음 /viral-engine 실행 시 이 학습이 반영됩니다.
>
> **핵심 인사이트:**
> - 가장 잘 된 공식: {공식명}
> - 가장 잘 된 스턴트: {스턴트명}
> - 다음에 집중할 것: {추천}
> - 피할 것: {비추}"
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-engine/viral-retro.md
git commit -m "feat: add viral-retro skill (performance analysis + brand-voice update)"
```

---

## Task 8: SKILL.md 오케스트레이터 작성

**Files:**
- Create: `.claude/skills/viral-engine/SKILL.md`

- [ ] **Step 1: 파일 작성**

`.claude/skills/viral-engine/SKILL.md` 내용:

```markdown
---
name: viral-engine
description: Viral marketing skill suite for Threads. Three sub-skills: viral-setup (brand config, run once), viral-engine (generate + quality gate posts), viral-retro (performance analysis). Start with viral-setup if brand-voice.md doesn't exist yet.
---

# Viral Engine — Threads 바이럴 마케팅 스킬 세트

3개 서브스킬로 구성된 플라이휠. Claude Code에서만 실행된다.

## 서브스킬

### `viral-setup` (처음 사용 시 / 새 브랜드 추가 시)
**5개 질문 → `.agent/memory/brand-voice.md` 생성**
브랜드명, 타깃, 기존 성공 사례, 50% 혐오 테스트, 금지 표현을 물어보고
Roy Lee 원칙 기반으로 추천 스턴트 3개와 Roy Scale 목표를 설정한다.

실행: Skill 툴로 `viral-engine/viral-setup` 호출

### `viral-engine` (정기 콘텐츠 배치 생성 시)
**brand-voice.md 로드 → 스턴트 선택 → generate-batch.mjs 실행 → Expert Panel 검증 → MD 출력**
Expert Panel(Roy Lee / 타깃 유저 / 편집장) 3 페르소나가 90점 이상 통과한 포스트만
threads-uploader 호환 MD 파일로 출력한다.

실행: Skill 툴로 `viral-engine/viral-engine` 호출

### `viral-retro` (발행 2주 후)
**성과 데이터 입력 → 공식/스턴트별 분석 → brand-voice.md 업데이트**
다음 배치가 이전 배치보다 정확해지는 학습 루프.

실행: Skill 툴로 `viral-engine/viral-retro` 호출

---

## 전체 플로우

```
처음 사용
    └─ viral-setup (1회)
           ↓
    .agent/memory/brand-voice.md 생성

정기 실행 (2주 사이클)
    ├─ viral-engine
    │      ↓ generate-batch.mjs (초안 60개)
    │      ↓ Expert Panel (90점 통과만)
    │      ↓ output/YYYY-MM-DD-posts.md
    │      ↓ threads-uploader 업로드
    │      ↓ (2주 발행)
    └─ viral-retro
           ↓ 성과 분석
           ↓ brand-voice.md 업데이트
           ↓ (다음 viral-engine에 반영)
```

## 레퍼런스 파일

- `references/viral-principles.md` — Roy Lee 원칙 + 8 스턴트 템플릿
- `references/expert-panel.md` — 3 페르소나 채점 기준 + 24 AI slop 패턴
- `references/post-formulas.md` — 9가지 포스트 공식
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-engine/SKILL.md
git commit -m "feat: add viral-engine main SKILL.md orchestrator"
```

---

## Task 9: generate-batch.mjs 작성

기존 `generate-posts.mjs`를 범용화. CosmicPath 전용 내용을 제거하고 brand-voice.md에서 동적으로 브랜드 컨텍스트를 로드한다.

**Files:**
- Create: `scripts/generate-batch.mjs`

- [ ] **Step 1: 파일 작성**

`scripts/generate-batch.mjs` 전체 내용:

```javascript
/**
 * generate-batch.mjs
 * 범용 브랜드 파라미터 기반 Threads 포스트 배치 생성기
 *
 * 사용법:
 *   node scripts/generate-batch.mjs [options]
 *
 * 옵션:
 *   --brand <path>    brand-voice.md 경로 (기본: .agent/memory/brand-voice.md)
 *   --count <n>       생성할 포스트 수 (기본: 60)
 *   --stunt <name>    스턴트 전략명 (없으면 brand-voice.md 첫 번째 추천 사용)
 *   --output <path>   출력 파일 경로 (기본: output/YYYY-MM-DD-batch.md)
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── env 로드 ──────────────────────────────────────────────────────────────
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(root, envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
    console.log(`✅ env loaded: ${envFile}`);
    break;
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

// ── 인수 파싱 ──────────────────────────────────────────────────────────────
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      result[args[i]] = args[i + 1];
      i++;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));

const BRAND_FILE = path.resolve(root, args["--brand"] ?? ".agent/memory/brand-voice.md");
const COUNT = parseInt(args["--count"] ?? "60", 10);
const STUNT = args["--stunt"] ?? null;
const dateStr = new Date().toISOString().slice(0, 10);
const OUTPUT = path.resolve(
  root,
  args["--output"] ?? path.join("output", `${dateStr}-batch.md`)
);

// ── brand-voice.md 읽기 ───────────────────────────────────────────────────
if (!fs.existsSync(BRAND_FILE)) {
  console.error(`❌ brand-voice.md를 찾을 수 없습니다: ${BRAND_FILE}`);
  console.error("   먼저 /viral-setup을 실행해주세요.");
  process.exit(1);
}

const brandVoice = fs.readFileSync(BRAND_FILE, "utf-8");

// 브랜드명 추출 (첫 번째 # 헤더에서)
const brandNameMatch = brandVoice.match(/^#\s+Brand Voice\s+[—-]\s+(.+)$/m);
const brandName = brandNameMatch ? brandNameMatch[1].trim() : "브랜드";

const stuntContext = STUNT
  ? `\n【이번 배치 스턴트 전략】\n${STUNT} 템플릿을 중심으로 포스트를 작성해. 이 스턴트의 구조와 원칙을 자연스럽게 반영해.`
  : "";

// ── 상수 ──────────────────────────────────────────────────────────────────
const SEPARATOR = "===FIRST_COMMENT===";
const META_SEP = "===META===";
const BATCH = 2;
const COOLDOWN = 800;
const RETRIES = 5;
const BASE_DELAY = 3000;
const RETRYABLE = new Set([429, 529]);

// ── 포스트 공식 ────────────────────────────────────────────────────────────
const FORMULAS = [
  {
    id: "warning",
    name: "경고/위험 회피",
    weight: 4,
    instruction: `특정 타깃이 반드시 조심해야 할 것을 경고하는 포스트.
제목 라인: "[타깃]가 반드시 조심해야 할 [N]가지" 또는 "[타깃]는 [위험] 주의" 형식.
리스트 형식(1. 2. 3.)으로 위험 신호 나열.
마지막 CTA: "해당되면 저장해" 또는 "주변에 [타깃] 있으면 공유해줘".
톤: 공포 유발이 아니라 "알고 대비하면 막을 수 있어" 느낌.`,
  },
  {
    id: "contrarian",
    name: "반직관 훅",
    weight: 3,
    instruction: `모두가 당연하게 믿는 상식을 정면으로 반박.
"사실 [당연한 상식]은 틀렸어" 또는 "아무도 말 안 해주는 진짜 얘기" 형식.
반박 근거 2-3개 제시. 반박할 여지를 의도적으로 남겨서 댓글 유발.
"반박시 니 말이 맞음" 표현 가능.`,
  },
  {
    id: "choice",
    name: "편가르기",
    weight: 3,
    instruction: `극적인 상황을 설정하고 3개의 선택지를 줘.
3번은 반전이거나 의외의 답. 질문으로 끝내지 말 것 — 선택지만 주면 됨.
도입부를 매번 완전히 다른 구조로 창의적으로 작성해. ("자, 상상해봐" 반복 금지)`,
  },
  {
    id: "reveal",
    name: "반전 폭로",
    weight: 3,
    instruction: `A보다 B가 낫고, B보다 C가 더 강력하다는 식의 논리 전개.
매번 전혀 다른 문장 구조로 시작할 것. 설명 후 독자도 해당되는지 확인 유도.`,
  },
  {
    id: "thisorthat",
    name: "양자택일",
    weight: 2,
    instruction: `극단적으로 다른 두 유형 대비. 에너지나 성향 차이를 나열하고 마지막에 선택 유도.
도입부를 매 포스트마다 다른 일상적 상황이나 다른 말투로 시작해.`,
  },
  {
    id: "check",
    name: "해당여부 확인",
    weight: 2,
    instruction: `특정 조건을 나열. "있어?" "깔려있어?" 형식으로 독자 확인.
"있으면 넌 [특별한 것]이야" 또는 "조심해야 해" 구조.`,
  },
  {
    id: "save",
    name: "저장형 정리",
    weight: 2,
    instruction: `체크리스트·단계별 방법론·비교표 형식.
"저장해두고 나중에 꺼내봐" CTA 직접 작성.
앱 없어도 이해되는 독립형 콘텐츠. 수치/공식화된 팁 위주. 3-5줄 리스트.`,
  },
  {
    id: "humor",
    name: "공감 유머",
    weight: 2,
    instruction: `공통 경험에서 시작. "그 시간/돈으로 더 나은 걸 했을걸" 반전 포함.
매우 자연스럽고 캐주얼한 친구 말투 유지.`,
  },
  {
    id: "truth",
    name: "불편한 진실",
    weight: 2,
    instruction: `불편하지만 공감 가는 팩트. 논쟁 유발 — 동의하는 사람과 반론하는 사람 모두 댓글 달게.
직설적이고 솔직한 톤. "반박시 니 말이 맞음" 가능.`,
  },
];

// ── 시스템 프롬프트 ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `너는 ${brandName} 브랜드의 Threads 계정 운영자야.

【브랜드 보이스 — 반드시 준수】
${brandVoice}
${stuntContext}

핵심 규칙:
1. 2인칭으로 직접 말걸기 ("너", "넌", "니")
2. 해시태그 정확히 1개만
3. 길이: 6-12줄
4. 글 말미에 리포스트 유발용 강한 한 줄 요약 배치
5. 브랜드 광고/홍보 느낌 금지 — 친구가 말해주는 톤
6. 앱/서비스 이름이나 링크 포함 금지
7. 출력 형식 엄수 (아래 구분자를 정확히 사용):
   포스트 본문 작성
   ${SEPARATOR}
   게시 직후 달 첫 댓글 (2-3문장, 반말, 본문 보완)
   ${META_SEP}
   formula:{공식id} stunt:{스턴트명 또는 none}`;

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function buildPool() {
  const pool = [];
  for (const f of FORMULAS) {
    for (let i = 0; i < f.weight; i++) pool.push(f);
  }
  return pool;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── API 호출 ──────────────────────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateOne(formula) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `[공식: ${formula.name}]\n${formula.instruction}\n\n위 공식으로 Threads 포스트 1개 작성해줘.\n작성 후 ${SEPARATOR}를 출력하고 첫 댓글을 작성해줘.\n그 다음 ${META_SEP}를 출력하고 메타데이터를 작성해줘.`,
          },
        ],
      });

      const raw = message.content[0].text.trim();
      const parts = raw.split(SEPARATOR);
      const post = parts[0].trim();
      const rest = (parts[1] ?? "").split(META_SEP);
      const firstComment = rest[0].trim();
      const meta = (rest[1] ?? "").trim();

      return { post, firstComment, meta, formulaId: formula.id };
    } catch (error) {
      const status = error?.status;
      if (RETRYABLE.has(status) && attempt < RETRIES) {
        const wait = BASE_DELAY * attempt;
        console.warn(`  ⚠️  ${status} (시도 ${attempt}/${RETRIES}) → ${wait}ms 후 재시도…`);
        await sleep(wait);
      } else {
        throw error;
      }
    }
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 ${brandName} 포스트 ${COUNT}개 생성 시작 (배치 ${BATCH}개씩)\n`);
  console.log(`   브랜드 파일: ${BRAND_FILE}`);
  console.log(`   스턴트: ${STUNT ?? "auto"}`);
  console.log(`   출력: ${OUTPUT}\n`);

  const pool = buildPool();
  const results = [];
  const total = Math.ceil(COUNT / BATCH);

  for (let i = 0; i < COUNT; i += BATCH) {
    const batchNum = Math.floor(i / BATCH) + 1;
    const batchSize = Math.min(BATCH, COUNT - i);
    process.stdout.write(`배치 ${batchNum}/${total} (${i + 1}~${i + batchSize}번) 생성 중…`);

    const batch = Array.from({ length: batchSize }, () => generateOne(pickRandom(pool)));
    const texts = await Promise.all(batch);
    results.push(...texts);
    process.stdout.write(` ✅\n`);

    if (i + BATCH < COUNT) await sleep(COOLDOWN);
  }

  // ── 출력 파일 생성 ──────────────────────────────────────────────────────
  const dir = path.dirname(OUTPUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const nowStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const lines = [
    `# ${brandName} Threads 포스트 초안 (${COUNT}개)`,
    `> 생성일시: ${nowStr}`,
    `> 브랜드: ${brandName} | 스턴트: ${STUNT ?? "auto"}`,
    `> ⚠️ Expert Panel 검증 전 초안입니다. /viral-engine에서 품질 게이트를 통과한 포스트만 발행하세요.`,
    "",
  ];

  results.forEach(({ post, firstComment, meta }, index) => {
    lines.push(`---`, ``, `## 포스트 ${index + 1}`, ``);
    if (meta) lines.push(`<!-- ${meta} -->`, ``);
    lines.push(post, ``);
    if (firstComment) {
      lines.push(
        `> **💬 첫 댓글 (골든타임용)**`,
        `>`,
        `> ${firstComment.replace(/\n/g, "\n> ")}`,
        ``
      );
    }
  });

  fs.writeFileSync(OUTPUT, lines.join("\n"), "utf-8");
  console.log(`\n✨ 초안 ${results.length}개 저장 완료:\n   ${OUTPUT}\n`);
  console.log(`다음 단계: /viral-engine에서 Expert Panel 품질 검증을 실행하세요.\n`);
}

main().catch((error) => {
  console.error("❌ 오류:", error.message ?? error);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-batch.mjs
git commit -m "feat: add generate-batch.mjs (generic brand-aware post generator)"
```

---

## Task 10: CosmicPath로 엔드투엔드 테스트

실제 CosmicPath 브랜드 데이터로 스크립트가 정상 동작하는지 검증.

**Files:**
- Create: `.agent/memory/brand-voice.md` (테스트용, /viral-setup이 생성하는 포맷)

- [ ] **Step 1: 테스트용 brand-voice.md 생성**

`.agent/memory/brand-voice.md` 작성:

```markdown
# Brand Voice — CosmicPath
> 마지막 업데이트: 2026-04-05

## 브랜드 정보
- **이름:** CosmicPath
- **설명:** AI 사주·점성술·타로 앱
- **ICP:** 20-35세 여성, 연애·취업·진로 고민, 기존 점집보다 저렴하고 즉각적인 해답 원함

## 핵심 메시지
AI가 운명을 읽는다 — 전통 점술의 깊이 + 디지털의 즉각성

## 논란 각도
- **싫어할 사람:** "사주는 미신이다"고 생각하는 합리주의자들
- **50% 혐오 포인트:** AI가 운명을 예측한다는 개념 자체
- **공공의 적:** 비싸고 불편한 기존 점집 + "그런 거 믿어?" 하는 회의론자

## 추천 스턴트 템플릿
1. 불가능한 주장 (Template 7): "AI가 니 연애운 알고 있어" — 믿기 어려운 주장 → 검증 욕구 유발
2. 공공의 적 선언 (Template 2): "기존 점집 10만원 쓰지 마" — 타깃이 이미 느끼는 불만 대변
3. 역발상 (Template 7 변형): "사주 믿는 사람이 더 이성적인 이유" — 반직관 주장

## Roy Scale 목표
- 논란도: 🔥🔥🔥
- 바이럴 잠재력: 🚀🚀🚀
- 전환 잠재력: 💰💰
- 리스크 수준: MEDIUM

## 금지 톤 / 표현
- "CosmicPath", "코스믹패스" 직접 언급
- 앱 다운로드 링크, 광고 느낌
- "~해야 합니다", "~것 같습니다" 같은 공손체
- 논문 같은 설명체

## 성과 히스토리
> /viral-retro 실행 시 자동 업데이트됨

| 날짜 | 배치 | 공식 우승 | 스턴트 우승 | 비고 |
|------|------|----------|-----------|------|
| - | - | - | - | 아직 데이터 없음 |
```

- [ ] **Step 2: 소규모 테스트 실행 (4개 생성)**

```bash
node scripts/generate-batch.mjs \
  --brand .agent/memory/brand-voice.md \
  --count 4 \
  --stunt "불가능한 주장" \
  --output output/test-batch.md
```

Expected output:
```
✅ env loaded: .env
🚀 CosmicPath 포스트 4개 생성 시작 (배치 2개씩)
   브랜드 파일: .../.agent/memory/brand-voice.md
   스턴트: 불가능한 주장
   출력: .../output/test-batch.md

배치 1/2 (1~2번) 생성 중… ✅
배치 2/2 (3~4번) 생성 중… ✅

✨ 초안 4개 저장 완료:
   .../output/test-batch.md
```

- [ ] **Step 3: 출력 파일 검증**

```bash
head -30 output/test-batch.md
```

확인 항목:
- `# CosmicPath Threads 포스트 초안` 헤더 존재
- `<!-- formula:... stunt:... -->` 메타 태그 존재
- `===FIRST_COMMENT===` 구분자 없음 (파싱 완료된 상태)
- 포스트 본문이 6-12줄 범위
- "CosmicPath" 앱 이름이 본문에 직접 등장하지 않음

- [ ] **Step 4: brand-voice.md 없을 때 에러 메시지 확인**

```bash
node scripts/generate-batch.mjs --brand nonexistent.md --count 1 --output /tmp/test.md
```

Expected:
```
❌ brand-voice.md를 찾을 수 없습니다: .../nonexistent.md
   먼저 /viral-setup을 실행해주세요.
```

- [ ] **Step 5: 최종 커밋**

```bash
git add .agent/memory/brand-voice.md output/test-batch.md
git commit -m "test: add CosmicPath brand-voice.md and verify generate-batch output"
```

---

## Task 11: 전체 커밋 + 정리

- [ ] **Step 1: 최종 상태 확인**

```bash
ls -la .claude/skills/viral-engine/
ls -la .claude/skills/viral-engine/references/
```

Expected:
```
SKILL.md
viral-setup.md
viral-engine.md
viral-retro.md
references/
  viral-principles.md
  expert-panel.md
  post-formulas.md
```

- [ ] **Step 2: git status 확인**

```bash
git status
git log --oneline -10
```

Expected: 모든 파일이 커밋된 상태 (working tree clean)

- [ ] **Step 3: 사용법 최종 검증**

Claude Code에서 실행 가능한지 수동 확인:
```
/viral-setup   → viral-setup.md 로드 확인
/viral-engine  → viral-engine.md 로드 확인
/viral-retro   → viral-retro.md 로드 확인
```

각 스킬이 올바른 파일을 로드하면 구현 완료.

---

## 구현 완료 기준

- [ ] `.claude/skills/viral-engine/` 디렉토리에 7개 파일 존재
- [ ] `scripts/generate-batch.mjs` 실행 시 brand-voice.md 기반 포스트 생성
- [ ] 출력 MD 파일이 threads-uploader `/api/posts/upload` 포맷과 호환
- [ ] brand-voice.md 없을 때 명확한 에러 메시지
- [ ] 모든 파일 git 커밋 완료
