# TikTok 스튜디오 멀티브랜드화 설계

날짜: 2026-10-29 · 브랜치: `feat/tiktok-multibrand`

## 왜

threads-uploader는 1인 운영자가 여러 자사 제품을 홍보하는 멀티브랜드 툴이고 브랜드는 계속 늘어난다.
Threads 글 생성 쪽 사주 하드코딩은 걷어냈지만 TikTok 스튜디오(`/brands/[slug]/tiktok`)는 아직 사주 전용이다.
catchdex(`product_growth`) 같은 제품 브랜드에서 스튜디오를 열면 일간 선택칸이 나오고, 사주 대본만 만들어진다.

## 목표

- 사주가 아닌 브랜드는 그 브랜드의 `productProfile`(제품명·한 줄 설명·대상 고객·약속·포지셔닝)과
  `qualityProfile` 프리셋(`getDomainPreset`)으로 대본 입력칸과 생성 프롬프트가 정해진다.
- 제품 대본은 Claude API로 만든다(사용자 결정). `ANTHROPIC_API_KEY`가 없으면 같은 모양의 결정적 템플릿으로 만든다
  (기존 `src/lib/command-plan.ts`와 같은 패턴).
- 사주 브랜드(cosmicpath, cosmicpath-global)는 지금과 바이트 단위로 같은 결과가 나온다.

## 비목표

- 매일 자동 영상 cron(`/api/cron/video-jobs/next`): 일간 순환 구조라 사주 전용으로 남긴다. 제품 브랜드 자동 영상은 나중 일.
- Remotion(`video/`) 변경: 제품 대본은 이미 렌더러가 그리는 `kinetic-card`·`placeholder` 장면만 쓴다.
- productProfile 편집 화면, Threads 영상 캡션, Instagram 릴스 포맷.
- DB 스키마·데이터 변경 없음.

## 안티 목표 (돌아가도 실패인 것)

- 사주 브랜드 대본·드래프트 필드가 한 글자라도 바뀜.
- 제품 대본에 사주 용어(일간, 명식, 사주 등)나 `saju-card` 장면이 섞임.
- 키가 없는 로컬·CI에서 제품 브랜드 생성이 터짐.

## 결정된 것

### 1. 엔진 판정 (사용자 결정: 기존 표 재사용)

`qualityProfile === "saju_viral"` 이거나 브랜드 slug가 `NEW_YEAR_BRANDS`(`src/lib/new-year/new-year-season.ts`,
영상 언어를 정하는 기존 표: cosmicpath→ko, cosmicpath-global→en)에 있으면 `"saju"`, 아니면 `"product"`.

근거: 운영 DB 확인(2026-10-29) 결과 cosmicpath는 `saju_viral`, cosmicpath-global은 `ecommerce_d2c`(사주 상품 판매),
catchdex는 `product_growth`, ulw-qa-demo-assets는 `career_decision`. qualityProfile만으로는 cosmicpath-global을 놓친다.

### 2. 제품 대본 구조

사주 대본과 같은 4장면·같은 길이(3.5 / 5.5 / 7 / 4초 = 20초)를 쓴다.

| 장면 | 타입 | 역할 |
|---|---|---|
| 1 훅 | `kinetic-card` | 대상 고객이 겪는 문제를 "왜?"로 묻는 질문 |
| 2 답 | `placeholder` | 훅의 답. 제품명이 반드시 들어감 |
| 3 근거 | `kinetic-card` | 제품이 그 문제를 푸는 방식·약속 1가지 (사주의 명식 카드 자리) |
| 4 CTA | `kinetic-card` | 프로필 링크로 유도 |

- Claude 호출: `CLAUDE_TEXT_MODEL`, `output_config.format` JSON 스키마로 장면별 문구(훅 화면/음성, 답 음성/화면, 근거 음성/화면,
  CTA 음성/화면, 해시태그)를 받고 장면 배열·길이·`visualProps`는 코드가 조립한다. 프롬프트 입력: productProfile 필드,
  프리셋 이름·설명, 주제, 톤, 언어, 금지어(프리셋 `forbiddenCrossDomainTerms` + 과장 표현).
- 키 없음 → 같은 입력으로 결정적 템플릿.
- 키가 있는데 호출이 실패하면 에러를 그대로 올린다(조용히 템플릿으로 바꾸지 않음. command-plan과 같음).
- 언어: `brandVideoLang(slug)` (표에 없는 브랜드는 ko).

빈 productProfile (빌더 판단): `normalizeProductProfile`은 빈 값을 제품명 `"Untitled Product"`, 나머지 `""`로 채운다.
제품명이 비었거나 `"Untitled Product"`면 `brand.name`을 쓴다(`brand-config-builder.ts`와 같은 규칙).
나머지 빈 필드는 프롬프트에서 빼고, 템플릿에서는 프리셋 설명으로 대신한다. 막지 않고 생성한다.

### 3. 제품 품질 게이트

`qualityScore`/`qualityPass`/`qualityReasons`를 사주와 같은 방식(통과 항목 비율)으로 채운다. 항목:
훅이 질문을 연다(`?`·`이유`·why), 훅 길이 ≤ ko 30자 / en 64자, 2번 장면에 제품명이 있다,
과장 문구 없음(기존 `OVERPROMISE_PATTERN` 재사용), 금지어 없음, 길이 15~30초.
금지어 = 프리셋 `forbiddenCrossDomainTerms` + 사주 용어 고정 목록(사주·일간·명식·대운·운세 등, 빌더 판단).
`career_decision` 프리셋에는 "사주"가 없어서 프리셋 목록만으로는 안티 목표를 못 막는다. 같은 목록을 프롬프트 금지어에도 넣는다.
게이트에서 떨어져도 드래프트는 저장한다(지금 수동 생성 경로와 같음).

### 4. 드래프트 저장

`buildTikTokDraftCreateData`에 엔진 인자를 추가(기본값 `"saju"`라 기존 호출·cron·테스트는 그대로).
제품이면 `campaignId: "product_tiktok_campaign"`, `qualityProfile: "tiktok_product_retention"`.
cron이 `saju_tiktok_campaign`으로 오늘 개수를 세므로 사주 쪽 값은 건드리지 않는다.

### 5. API (`POST /api/tiktok/generate`)

`parseBrandConfig(brand.brandConfig)`로 엔진을 판정한다. 사주는 지금 호출 그대로.
제품은 `topic`이 비면 프리셋 `defaultTopics[0]`, `dayMaster`는 무시.

### 6. 스튜디오 화면

- `page.tsx`가 브랜드 설정을 읽어 `engine`, 제품명, 추천 주제(프리셋 `defaultTopics`)를 클라이언트에 넘긴다.
- 사주 엔진: 지금 화면 그대로(일간 선택, 주제 기본값, 문구).
- 제품 엔진: 일간 선택칸 대신 제품명 표시. 주제 입력칸은 추천 주제를 `<datalist>`로 제안하고 기본값은 첫 추천 주제.
  톤 버튼은 유지. 제목 아래 설명과 빈 상태 안내 문구에서 사주·일주 단어를 뺀다.
- 생성 중 / 에러(토스트) / 빈 상태는 기존 처리를 그대로 쓴다. 모바일 375px에서 깨지지 않는지 스크린샷으로 확인한다.

## 제약

- npm 사용(이 저장소 기준), `any` 금지, 새 라이브러리 없음(`@anthropic-ai/sdk` 이미 설치됨).
- 테스트에서 실제 Claude·DB를 부르지 않는다(기존 테스트처럼 `vi.mock`).

## 완료 기준

- product_growth 브랜드로 대본이 생성되는 회귀 테스트(템플릿 경로 + Claude 경로 mock), 엔진 판정 테스트.
- 기존 `src/lib/tiktok/tiktok-engine.test.ts`, `src/app/api/tiktok/tiktok-routes.test.ts` 그대로 통과.
- typecheck / test / build 통과, 스튜디오 화면(사주·제품 각각) 스크린샷.

## 빌더에게 맡긴 것

- 엔진 판정 함수와 제품 엔진의 파일 위치·이름.
- 템플릿 대체 경로의 구체 문구.
- 4장면 조립 코드를 사주 쪽 `buildExplainerScenes`와 공유할지 여부(공유한다면 사주 결과가 바뀌지 않아야 함).
