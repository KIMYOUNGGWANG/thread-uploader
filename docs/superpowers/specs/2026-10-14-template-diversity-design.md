# 생성 글 문장 틀 반복 제거 설계

- 날짜: 2026-10-14
- 브랜치: `fix/template-diversity` (`origin/main` 기준)
- 범위: saju_viral 프로필(CosmicPath KR) 생성·게이트·점수·반복 차단

## 배경

CosmicPath 생성 글이 거의 같은 모양으로 수렴했다.

- 첫 줄: "X보다 센 건 Y고, Y보다 센 건 Z" 또는 평서문 끝에 억지 "~임?"
- 본문 끝: 1·2·3 번호 선택지 + "저장해"/"어때?"
- 첫 댓글: "난 솔직히 N번 골랐다가 ~했음. 너넨 몇 번이냐?"

이 모양은 모델의 우연이 아니라 코드가 강제한다.

| 위치 | 강제 내용 |
|---|---|
| `src/lib/generate-posts.ts` `SAJU_VIRAL_REQUIREMENTS` | 첫 줄에 `?` 또는 `보다 센`, 끝에 `1.` `2.` 선택지 + `저장해`/`어때?` (없으면 폐기된다고 명시) |
| `src/lib/generate-posts.ts` 한국어 바이럴 규칙 | "A보다 센 B보다 센 게 뭔지 알아? 바로 C야" 예시 문장, 첫 댓글 예시 "난 솔직히 2번 고르고 … 너넨 몇 번이냐?" |
| `src/lib/quality-gate.ts` `checkSajuViralQuality` | 사주 용어 + (훅 또는 참여 장치) 중 score ≥ 2 |
| `src/lib/viral-intent-modes.ts` `concept_hierarchy` | 첫 문장 'A보다 센 B보다 센' 규칙, fidelity는 첫 두 줄에 비교 2회 이상 |
| `src/lib/domain-registry.ts` 서열 공식 instruction | 원조 22k 글 문장을 그대로 예시로 포함 |
| `src/lib/threads-algorithm-scorer.ts` | 대비/질문 훅·선택지 없으면 감점, 수정 지시가 "'A보다 센 B' 적용", "1번/2번 선택지 추가" → `remediation-engine`이 80점 미만 글을 이 지시로 재작성 |

기존 반복 차단(`anti-repeat-memory.ts`)은 첫 문장 단어/바이그램 Jaccard만 본다. "궁합 점수보다 센 게 일간이고"와 "사랑보다 센 건 생활비고"는 틀이 같아도 단어가 달라 통과한다.

### 성과 데이터 (발행 176개, 2026-10-14 조회)

| 특징 | 있음 | 없음 |
|---|---|---|
| "보다 센" 첫 줄 | 11개, 중앙값 196회 (원조 1개 22,693회 제외 시 평균 ≈ 207회) | 중앙값 111회 |
| 번호 선택지 | 답글 1.1/글 | 답글 2.6/글 |
| "저장해" | 중앙값 88회 | 중앙값 137회 |
| "솔직히" 첫 댓글 | 답글 1.7/글 | 답글 2.7/글 |

상위 글(42k·22k·9k·5.5k)은 모두 구체적 사주 사실 또는 정체성 호명 구조였다. 표본이 작고 시기가 섞여 인과 근거는 약하지만, 위 틀을 강제할 근거는 없다.

## 목표

- 같은 첫 줄 틀·같은 첫 댓글 첫마디가 연속 생성에서 반복되지 않는다.
- 각 바이럴 모드가 설계된 고유 모양을 실제로 갖는다.

### 유지하는 제약

- 사주 용어 최소 1개, 반말/독백체, 존댓말 금지
- 첫 댓글 링크·상업 문구 금지, 본문 URL 금지
- 사람 승인 후 발행 (`qualityPass`/`algorithmicPass` 승인 규칙, cron `qualityPass: true` 필터)
- 연애 축(`/match/new`) 토픽과 lean sprint 모드 4종, Thompson priors

### 성공 기준

- 단위 테스트: 아래 "테스트" 절의 케이스 전부 통과, 기존 테스트 전부 통과(전제가 바뀐 테스트는 수정)
- 실측: 배포 후 cosmicpath 6개 생성 시 같은 틀 서명 최대 1쌍, 같은 첫 댓글 첫마디 0쌍

## 설계

### 1. 공통 강제 제거

`generate-posts.ts`

- `SAJU_VIRAL_REQUIREMENTS`에서 첫 줄(`?`/`보다 센`) 줄과 끝 번호 선택지(`저장해`/`어때?`) 줄을 삭제한다. 사주 용어 줄과 반말 줄은 유지한다.
- 한국어 바이럴 규칙의 "12만 뷰 서열화/극단적 앵커 훅" 항목에서 예시 문장을 제거하고 원칙으로 바꾼다: 첫 줄은 구체 숫자, 특정 살·일주 호명, 통념 반박 중 하나로 스크롤을 멈추게 하고, 최근 글과 다른 틀을 쓴다.

`quality-gate.ts` `checkSajuViralQuality`

- `pass = hasSajuTerm && fidelity.pass` 로 바꾼다. 훅·참여 장치 검사는 `score`와 `reasons`에 그대로 남겨 정보로만 쓴다.

### 2. 모드별 모양 재정의

`viral-intent-modes.ts`

- `concept_hierarchy`: 첫 문장 'A보다 센 B보다 센' 규칙을 "실제 사주 개념 2~3개(살·십신·일주)를 서열/대비로 비교한다. 최근 글에 쓰인 비교 문장 틀은 반복하지 않는다"로 바꾼다. fidelity의 첫 두 줄 비교 매치 기준을 `< 2`에서 `< 1`로 낮춘다.
- `identity_profile`, `relationship_tension`: 규칙에 "번호 선택지를 쓰지 않고 독자에게 직접 묻는 한 문장으로 끝낸다"를 추가한다.
- `imagination_dilemma`: 변경 없음 (3지선다 유지).

`domain-registry.ts` 서열 공식 instruction: 원조 글 문장 예시를 제거하고 비교 원칙만 남긴다.

### 3. 첫 댓글

`generate-posts.ts` 한국어 바이럴 규칙의 첫 댓글 항목

- "난 솔직히 2번 고르고 … 너넨 몇 번이냐?" 예시를 제거한다.
- 모드별 방향을 넣는다: 딜레마 = 고른 이유를 묻는 한 줄, 서열 = 독자 원국에 그 개념이 있는지 묻기, 정체성 = 본인 일주·살을 꺼내게 하기, 관계 = 상대와의 실제 상황을 묻기.
- 공통: "난 솔직히"로 시작하지 않는다. 링크·상업 문구 금지는 유지한다.

`charlie-viral-skills.ts`의 `buildConversationIgniterComment`는 저장 경로에서 쓰이지 않으므로 변경하지 않는다.

### 4. 틀 단위 반복 차단

`anti-repeat-memory.ts`

- `extractStructureSignature(content, firstComment)` 추가. 반환값:
  - `opener`: `hierarchy`(첫 두 줄에 `보다` 2회 이상) / `question`(첫 줄 `?`) / `callout`(첫 줄에 살·일주 호명) / `statement` — 위에서부터 첫 매치
  - `hasNumberedChoices`: `^\s*1[.)]\s` 존재
  - `closer`: 마지막 비어있지 않은 줄이 `저장해` 포함 → `save`, `어때?` → `ask`, 그 외 `other`
  - `commentOpener`: 첫 댓글 앞 2어절 (없으면 `null`)
- `checkStructureRepeat(candidate, recentPosts, { window = 5, maxSame = 1 })`: 최근 `window`개 중 `opener|hasNumberedChoices|closer`가 같은 글이 `maxSame`개를 넘거나, `commentOpener`가 같은 글이 1개 이상이면 중복 사유를 반환한다.
- `generate-posts.ts`의 `generateWithQuality`에서 `checkAntiRepeatSimilarity`를 부르는 두 곳(첫 초안, 재시도)마다 바로 뒤에 후보 본문과 첫 댓글로 호출하고, 중복이면 기존처럼 `gate.pass = false` + 사유를 앞에 넣는다.
- 최근 글 조회 `select`와 `RecentPostSummary`에 `firstComment`를 추가하고, 배치 내 글(`inBatchPosts`)에도 `firstComment`를 넣는다.

### 5. 점수기·자동 재작성

`threads-algorithm-scorer.ts`

- 훅 호기심 신호에 구체 숫자(`\d+\s*(명|%|년|개|번|만)`), 살·일주 호명, 2인칭 직접 호명(`^너|\s너[는가]`)을 추가한다. 살·일주 호명은 `viral-intent-modes.ts`의 `IDENTITY_MARKER_PATTERN`을 export해서 재사용한다(`anti-repeat-memory`의 `callout` 판정도 같은 패턴 사용).
- 대화 초대 신호에 직접 질문(`너(는|넨|네|희).*\?`)을 추가한다.
- `actionableFixes` 문구 변경: "첫 줄에 'A보다 센 B' …" → "첫 줄에 구체 숫자·특정 살/일주 호명·통념 반박 중 하나를 넣으십시오", "본문 말미에 1번/2번 선택형 …" → "본문 끝에 독자에게 직접 묻는 한 문장을 두십시오".

`remediation-engine.ts`는 `actionableFixes`를 그대로 쓰므로 코드 변경은 없다.

## 테스트

- `quality-gate`: 선택지·물음표 없는 정체성 글(사주 용어 포함, 반말)이 `identity_profile` 모드로 통과. 사주 용어 없는 글은 여전히 실패.
- `viral-intent-modes`: 첫 두 줄에 비교 1회인 서열 글이 `concept_hierarchy` fidelity 통과.
- `anti-repeat-memory`: 최근 5개 중 2개가 `hierarchy|true|save`일 때 같은 서명 후보는 거부, `callout|false|other` 후보는 통과. 최근 글 하나와 첫 댓글 첫 2어절("난 솔직히")이 같으면 거부.
- `threads-algorithm-scorer`: "한국인 10명 중 7명은 …"으로 시작해 "너는 …?"로 끝나는 선택지 없는 글이 이전보다 높은 점수, 수정 지시에 "보다 센"/"1번/2번" 문구 없음.
- 기존 테스트 중 "보다 센 필수" 또는 선택지 필수를 전제로 한 케이스는 새 규칙에 맞게 수정한다.
- 전체 `pnpm test`, `pnpm typecheck` 통과.

## 배포·브랜치

- `origin/main` 기준 `fix/template-diversity`에서 작업하고, 이전과 같이 `main`에 fast-forward로 배포한다.
- `feat/viral-engine`(미배포 11커밋)은 `generate-posts.ts`가 `main`과 119줄 다르다. 나중에 `feat/viral-engine`을 합칠 때 이 파일에서 충돌 정리가 한 번 필요하다.

## 범위 밖

- `src/lib/generation-engine.ts`: 어디서도 import되지 않는 중복 프롬프트. 별도 정리.
- 1번 선택지 뒤 빈 줄: 선택지가 딜레마 모드에만 남으므로 실측 후 판단.
- 갈등(friction) 소재 반복: 컨텍스트 오프셋 수정(057c550 배포) 이후 실측 후 판단.
- 새 모드(팩트 폭탄) 추가: 후속 B안.
