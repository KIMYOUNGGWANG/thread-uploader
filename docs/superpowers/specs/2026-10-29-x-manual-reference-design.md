# X 인기글 수동 레퍼런스 → 즉시 초안 — 설계

- 날짜: 2026-10-29
- 브랜드: **모든 브랜드** (cosmicpath, cosmicpath-global, catchdex 등)
- 브랜치: `feat/x-manual-reference` (main `c4d0303`에서 분기. `fix/brand-agnostic-defaults`는 #86으로 이미 머지됨)
- 표기: **[사용자 결정]**은 대화에서 사용자가 정한 것, **[내 판단]**은 설계자가 정한 것으로 빌더가 근거를 갖고 바꿀 수 있다.

## 1. 왜 만드나

- `ref_replay`(외부 글 → 재작성) 파이프라인은 이미 있다(2026-10-27 설계). 그런데 원본 수집이 Threads `keyword_search` 권한에 묶여 있고, Meta 심사 전이라 검색 결과가 내 글뿐이다. 그래서 원본이 0개다(`src/app/api/cron/viral/route.ts:60`).
- 참고 영상(투더제이, 2026-10)에서 효과가 확인된 방법이 있다. X에서 이미 반응이 검증된 글을 소재로 쓰면 평균 조회수가 4배 이상 뛰었다. 특히 "도구·자료 추천 + 링크" 같은 정보형 글이 잘 됐다.
- X API는 종량제라 월 $50~150 정도 들고, 자동 수집 범위를 정하는 것도 일이다. 지금은 **사람이 X에서 고른 글을 붙여넣는 것**만으로 충분하다. **[사용자 결정: 수동 입력부터]**

## 2. 목표 / 비목표 / 실패 조건

**목표**
1. 대시보드에서 X 글 본문을 붙여넣고 버튼을 누르면, **그 자리에서 초안 1개**를 만든다. **[사용자 결정: 넣자마자 바로]**
2. 그 초안은 **사람이 승인해야 발행된다.** `NEEDS_REVIEW`로 저장하고, 기존 승인 버튼(`PATCH /api/posts/[id]`의 `status: "PENDING"`)으로 승인한다. **[사용자 결정: 승인 후 발행]** 다른 자동 초안은 지금처럼 `PENDING`으로 바로 대기열에 들어간다. 이 결정은 수동 레퍼런스 초안에만 적용된다.
3. 모든 브랜드에서 쓸 수 있다. 재작성 결론은 그 브랜드의 도메인을 따른다. 사주가 아닌 브랜드에는 사주 용어가 들어가지 않는다. **[사용자 결정: 모든 브랜드]**
4. 레퍼런스는 두 유형으로 받는다. **[내 판단, 사용자에게 보여준 목업 기준]**
   - **사연형**: 지금 `ref_replay`와 같다. 상황과 감정 흐름은 가져오고, 인물·숫자·이름·표현은 전부 바꾼다.
   - **정보형**: 도구·자료 추천 글이다. 원글이 소개하는 항목(도구 이름, 순서)은 살리고, 문장은 브랜드 말투로 새로 쓴다. 사용자가 링크를 주면 첫 댓글에 붙인다.
5. 같은 X 글로 두 번 발행되지 않게 막는다.

**비목표**
- X API 연동, 자동 수집, 스크레이핑
- DB 스키마 변경. 레퍼런스는 기존 `ViralExample`에 저장한다.
- 넣은 레퍼런스 목록이나 성과 화면. 필요해지면 따로 만든다.
- 하루 1개 자동 `ref_replay`(크론)의 선택 로직 변경. 수동 레퍼런스는 크론이 고르지 않는다. 크론의 "오늘 이미 했나" 판정에서 수동 글을 빼는 것만 바꾼다(5.3).
- 수동 행을 브랜드 바이럴 패턴 학습에 쓰는 것(5.4)

**실패 조건 (동작해도 실패로 본다)**
- 원글 문장을 거의 그대로 옮긴 초안. 정보형도 **사실(도구 이름·URL)만 가져오고 문장은 새로 써야 한다**. 2026-10-27 설계의 "원문 문장 0% 재사용" 원칙은 그대로 지킨다.
- 사주가 아닌 브랜드(catchdex 등) 초안에 사주·궁합·운세 같은 말이 들어가는 것
- 버튼을 눌렀는데 아무 반응이 없거나, 실패 이유 없이 입력 내용이 사라지는 것

## 3. 화면 **[사용자 결정: A안]**

- 대시보드의 **"뉴스" 탭 이름을 "소재"로 바꾼다.** 탭 맨 위에 "X 인기글로 초안 만들기" 카드를 두고, 그 아래에 기존 뉴스 목록을 그대로 둔다(`src/components/Dashboard.tsx:967~1020`, `src/components/NewsTrendingTab.tsx`).
- 목업: `.superpowers/brainstorm/95910-1793235480/content/reference-input-layout.html`
- 카드 입력 칸

| 칸 | 필수 | 규칙 |
|---|---|---|
| 원글 본문 (textarea) | 필수 | 공백을 빼고 20자 이상, 5,000자 이하. 스레드 전체를 붙여넣어도 된다. |
| 글 유형 (사연형 / 정보형) | 필수 | 기본값은 정보형 **[내 판단: 영상에서 효과가 확인된 쪽]** |
| 첫 댓글 링크 | 선택 | 정보형일 때만 보인다. `http(s)://`만 받는다. |
| X 원글 주소 | 선택 | `x.com` 또는 `twitter.com`의 `/status/<숫자>` 주소만 받는다. 중복을 막는 데 쓴다. |

- 카드 문구에 지금 선택된 브랜드 이름을 보여준다(어느 브랜드로 쓸지 헷갈리지 않게).
- 상태
  - **만드는 중**: 버튼이 "초안 만드는 중…"으로 바뀌고 잠긴다. 입력 칸도 잠근다.
  - **성공**: 피드 탭으로 이동하고, 승인 대기만 보는 필터(`reviewOnly`, `Dashboard.tsx:863`)를 켠다. 토스트는 "레퍼런스 초안 1개, 승인 대기 중"을 띄운다. 기존 `handleUseNewsForDraft` 흐름(`Dashboard.tsx:547`)과 같은 방식이다. 입력 칸은 비운다.
  - 초안 카드 라벨: 지금 `NEEDS_REVIEW` 기본 라벨은 "승인 대기 (승자 공식 아님)"이다(`PostCard.tsx:388`). 수동 레퍼런스 초안은 "승인 대기 (X 레퍼런스)"로 보여준다. 수동 표시 태그(5.3)로 구분한다.
  - **품질 탈락**(초안 0개): 카드 안에 탈락 이유(`failureReasons`)를 보여주고 입력은 그대로 둔다. 다시 누를 수 있다.
  - **이미 쓴 글**: "이 X 글로 만든 초안이 이미 있어"를 보여주고 생성하지 않는다.
  - **입력 오류**: 칸 바로 아래에 이유를 보여준다. 서버에서도 똑같이 검사한다.
- 모바일(375px)에서 한 줄 세그먼트가 넘치면 두 줄로 쌓는다. 버튼과 입력 칸 모두 보이는 포커스 표시를 둔다.

## 4. 재작성 규칙

### 4.1 브랜드 도메인 따라가기 (모든 `ref_replay` 공통)

- 지금 `REFERENCE_REPLAY_MODE`(`src/lib/viral-intent-modes.ts:290`)는 지시문에 "cosmicpath(사주·궁합·타이밍)"가 박혀 있다. 이걸 브랜드 정보로 채우는 방식으로 바꾼다. 결론과 시선은 **그 브랜드 이름 + 재작성 관점**으로 가져온다.
- 재작성 관점 **[내 판단]**
  - `DomainPresetConfig`에 선택 필드 `referenceAngle?: string`을 추가한다. 없으면 `description`을 쓴다.
  - `saju_viral`에만 `"사주·궁합·타이밍"`을 넣는다. 그래서 cosmicpath의 문구는 지금과 글자 그대로 같아진다. 다른 프리셋은 건드리지 않는다.
  - `description`을 그대로 쓰지 않는 이유: `saju_viral`의 description에는 "쿠폰 나눔"이 들어 있고 궁합·타이밍이 빠져 있어서 뜻이 달라진다.
- 도메인은 생성 경로가 이미 쓰는 `domainProfile`(캠페인 qualityProfile 우선, `generate-posts.ts:1054`)을 그대로 따른다. 프롬프트의 다른 부분과 기준을 맞추기 위해서다.
- 이 변경은 크론이 만드는 기존 `ref_replay`에도 적용된다. cosmicpath의 지시문 문자열이 지금과 같은지 회귀 테스트로 고정한다.
- 금지어는 기존 프롬프트 가드(`forbiddenCrossDomainTerms`, `generate-posts.ts:529`)를 그대로 쓴다. 새 금지어 목록은 만들지 않는다. **[내 판단]**
- 언어는 브랜드 언어(`brandProfile.language`)를 따른다. 영어 X 글이라도 ko 브랜드면 한국어로, en 브랜드(cosmicpath-global)면 영어로 쓴다.

### 4.2 사연형

- 지금 `ref_replay` 규칙 그대로(상황·감정 흐름만, 고유 디테일 전부 교체, 140~260자).

### 4.3 정보형 (새 모드) **[내 판단, 빌더가 조정 가능]**

- 새 `ViralIntentMode`를 하나 추가한다(예: id `ref_replay_info`). `REFERENCE_REPLAY_MODE`처럼 `VIRAL_INTENT_MODES` 로테이션에는 넣지 않는다.
- 지시문 요지
  - 원글이 소개하는 항목(도구·사이트·자료 이름)과 순서는 유지한다. 항목을 지어내거나 더하지 않는다.
  - 문장은 원글을 번역하거나 옮기지 않고, 브랜드 독자에게 "왜 쓸모있는지" 관점으로 새로 쓴다.
  - 첫 줄에는 결과·숫자·반전 중 하나를 넣는다(참고 영상 규칙).
  - 링크가 있으면 본문에 URL을 쓰지 않는다. 첫 댓글에 기존 `appendFirstCommentLink`(`generate-posts.ts:953`) 형식(`→ URL`)으로 붙인다.
- 링크 규칙 **[내 판단]**
  - **사용자 링크가 있을 때**: 그 글은 `shouldLink = false`로 생성한다. 브랜드 제품 링크, bridge header, `[링크 정책]` 제품 CTA 문구를 모두 넣지 않는다. 첫 댓글에는 사용자 링크의 **원래 주소**를 붙인다. short redirect(`/r/<postId>`)는 쓰지 않는다. `Post.linkUrl`과 `utmContent`도 비워 둔다. 외부 도구 클릭이 제품 클릭·전환 통계에 섞이지 않게 하려는 것이다.
  - **정보형인데 사용자 링크가 없을 때**: 평소 링크 정책(캠페인 주기에 따른 `shouldLink`)을 그대로 따른다.
  - **사연형**: 평소 링크 정책을 그대로 따른다. 링크 칸은 보이지 않는다.
- 길이: 본문은 목록 때문에 길어질 수 있다. 300~900자를 목표로 하고, 500자가 넘으면 기존 스레드 분할(`thread-splitter.ts`, 최대 5조각)을 그대로 쓴다.
- 원본 유사도 검사(`generate-posts.ts:350`)는 정보형에도 그대로 건다. 도구 이름이 겹쳐서 억울하게 탈락하는지는 테스트로 확인한다. 탈락이 잦으면 비교 전에 원글에서 URL과 고유명사를 빼는 정도로만 완화한다.

## 5. 서버 흐름

### 5.1 API

- 새 라우트: `POST /api/viral/references/manual` **[내 판단, 이름은 빌더가 정해도 된다]**
- 입력: `{ brandId, content, kind: "story" | "info", linkUrl?, sourceUrl? }`. 3장 규칙으로 검증하고, 실패하면 400과 칸별 이유를 돌려준다.
- 권한: 기존 브랜드 접근 확인(`src/lib/brand-access.ts`)을 그대로 쓴다. 인증 로직은 바꾸지 않는다.
- 라우트에는 검증만 두고, 나머지는 서비스 함수 하나(`createManualReferenceDraft`)로 처리한다(`.claude/rules/backend.md`).

### 5.2 서비스 순서

1. `sourceKey`를 정한다. `sourceUrl`이 있으면 status 숫자 ID, 없으면 본문 해시(`hashContent`, `viral-harvester.ts:53`).
2. 중복 확인: 같은 브랜드에서 `ref_replay_source:<id>` 태그가 붙은 Post가 그 `ViralExample`에 이미 있으면 "이미 쓴 글"로 끝낸다. 예전에 품질 탈락만 났던 글은 다시 시도할 수 있다.
3. `ViralExample`을 upsert한다.
   - `source = "manual_x"`, `sourceKey`, `content`, `permalink = sourceUrl`
   - `authorUsername`은 X 주소에서 핸들을 뽑을 수 있으면 넣고, 아니면 null
   - `publishedAt = now`
   - `rawMetrics`에 `{ manual: true, kind, linkUrl }`
4. `generatePosts`를 `referenceReplay: { id, content }`, `insertAtFront: true`로 호출한다. 여기에 필드를 추가한다.
   - 유형(`kind`)과 링크를 넘길 필드
   - 저장 상태를 정할 선택 입력(예: `initialStatus?: "NEEDS_REVIEW"`). 없으면 지금처럼 `PENDING`이다. 지금 하드코딩된 `const postStatus = "PENDING"`(`generate-posts.ts:1337`)을 이 입력으로 바꾼다.
   - 승인 시각 **[내 판단]**: 승인 API는 `scheduledAt`을 따로 주지 않으면 그대로 둔다. 그래서 늦게 승인한 초안은 예약 시각이 이미 지나 있고, 다음 발행 크론에 바로 올라간다. "승인 = 곧 발행"이라 이대로 둔다.
5. 결과
   - `count: 1`: 성공
   - `count: 0`: 품질 탈락. `failureReasons`를 돌려주고 `markReferenceAttempted`로 표시한다.

### 5.3 크론과의 관계 **[내 판단: 수동과 자동은 서로 독립]**

- **크론이 수동 행을 고르지 않는다.** 수동 행에는 `eligibleSource`/`timesSeen` 신호가 없어서 `pickReferenceReplaySource`(`reference-replay.ts:41`)에서 빠진다. 의도한 동작이고, 테스트로 고정한다.
- **수동은 크론 제한에 걸리지 않는다.** 사람이 고른 만큼 만든다.
- **수동이 크론을 막지 않는다.** 지금 `refillReferenceReplay`(`reference-replay-refill.ts:22~32`)는 세 가지 판정으로 그날 자동 생성을 건너뛴다. 이 판정에서 수동 글과 수동 행을 뺀다.
  - `already_today`, `pending_in_queue`: `qualityReasons`에 수동 표시 태그(예: `ref_replay_manual`)가 있는 글은 세지 않는다.
  - `attempted_today`: `source = "manual_x"`인 행은 세지 않는다.
- 위 판정이 Post를 걸러내려면 표시가 필요하다. 그래서 수동 초안은 `qualityReasons`에 수동 표시 태그를 추가로 단다.

### 5.4 다른 기능에 섞이지 않게 **[내 판단]**

- `ViralExample`을 읽는 기존 함수 중 다음 셋은 `source = "manual_x"`를 걸러낸다: `learnViralPatterns`, `getViralReport`(`viral-service.ts:70`, `:215`), `analyzeTopViralExamples`(`viral-llm-analysis.ts:135`).
- 이유는 두 가지다. X 정보형 글이 브랜드 패턴 학습에 섞이면 안 되고, LLM 분석 비용이 쓸데없이 들면 안 된다.
- 기존 `source: "manual"`(핸들 수동 입력, `viral-service.ts:333`)과는 다른 값을 쓴다.

## 6. 같이 정리할 것

- `src/lib/last30days-trend-fetcher.ts`와 그 테스트를 삭제한다. 실제 수집 없이 가짜 트렌드를 만드는 파일이고, 호출하는 곳이 없다.
- `.gitignore`에 `.superpowers/`를 추가한다.

## 7. 완료 기준

- 테스트
  - (a) catchdex(`product_growth`) 정보형 프롬프트에 사주 문구가 없고, 브랜드 도메인 설명이 들어 있다.
  - (b) cosmicpath 사연형 프롬프트는 지금과 같은 뜻을 유지한다.
  - (c) 입력 검증: 본문 길이, URL 형식, X 주소 형식
  - (d) 중복: 이미 쓴 글은 막고, 탈락만 났던 글은 다시 허용한다.
  - (e) 수동 행은 크론 자동 선택에서 빠지고, 수동 글과 수동 시도가 크론의 하루 1개 판정을 막지 않는다.
  - (f) 사용자 링크가 있는 정보형: 첫 댓글이 `→ <원래 주소>`이고, 제품 링크·bridge header·`Post.linkUrl`이 없다.
  - (g) `learnViralPatterns`, `getViralReport`, `analyzeTopViralExamples`가 `manual_x` 행을 읽지 않는다.
  - (h) 수동 레퍼런스 초안은 `NEEDS_REVIEW`로 저장되고, `initialStatus`를 안 준 기존 호출은 여전히 `PENDING`이다.
- `pnpm typecheck`, `pnpm test`, `pnpm build` 통과
- 브라우저 확인: 소재 탭 카드(데스크톱·375px), 만드는 중·성공·탈락·중복 상태, 피드 탭의 "승인 대기 (X 레퍼런스)" 카드 스크린샷

## 8. 빌더에게 맡기는 것

- API 라우트 이름, 서비스 함수 위치
- 정보형 지시문의 정확한 문장(4.3의 요지만 지키면 된다)
- 유사도 검사 완화가 필요한지 판단(4.3 마지막 항목)
