# ScrapeCreators Threads 어댑터 — 설계

- 날짜: 2026-11-05
- 브랜드: `viralDiscovery.keywords`가 있는 모든 브랜드. 처음 켜는 곳은 cosmicpath(국내 Threads).
- 바탕: `2026-10-27-reference-replay-design.md`(v2, 키워드 TOP 신호만), `2026-10-28-rising-source-radar-design.md`(4시간 수집, `risingScore`). 이 문서는 그 위에 얹는 **증분 설계**다. 여기서 바꾸지 않은 것은 그대로다.
- 참고: [ScrapeCreators/social-media-research-skills](https://github.com/ScrapeCreators/social-media-research-skills)의 `scrapecreators-api`, `outlier-post-finder` 스킬. 엔드포인트 정의는 `https://docs.scrapecreators.com/v1/threads/{search,user/posts}/openapi.json`(2026-11-05 확인).
- 표기: **[사용자 결정]**은 사용자가 대화에서 정한 것이다. **[내 판단]**은 설계자가 정한 것이라 빌더가 근거가 있으면 바꿀 수 있다. **[결정 필요]**는 구현 전에 사용자가 답해야 하는 것이다.

## 0. 먼저 뒤집어야 하는 결정 — **2026-11-05 사용자 승인: "뒤집고 구현"**

- 결정 기록: 이 문서를 읽고 사용자가 스크레이핑 미사용 결정을 뒤집고 1단계 구현을 승인했다. **[사용자 결정]** 7장의 2·3번은 따로 답을 받지 않았다. 2번은 문서 권고(대체)대로 구현했고, 3번은 비용 상한 없이 크레딧 잔량 경고만 넣었다(4.5).

- 2026-10-27 설계 1장과 2026-10-28 설계 1장에 **"유료 데이터 API와 스크레이핑은 쓰지 않는다. [사용자 결정]"**이 있다. 이 어댑터는 그 결정을 뒤집는다. 2026-11-05 대화에서 사용자가 "Threads 어댑터 설계"를 골랐지만, 그건 설계를 해 보라는 뜻이다. 구현은 아래 내용을 승인받은 뒤에 시작한다.
- 뒤집을 때 받아들이는 것:
  - ScrapeCreators는 Threads 공개 웹 데이터를 긁어 오는 비공식 서비스다. Meta 약관상 회색 지대다. 다만 우리 Threads 계정이나 토큰은 쓰지 않으므로 계정 제재 위험이 직접 생기지는 않는다(호출 주체가 ScrapeCreators 서버다).
  - 응답 형식은 예고 없이 바뀔 수 있다. 그래서 파서는 방어적으로 짜고, 실패하면 공식 검색으로 돌아간다(4.6).
- 1·2장 결정의 다른 부분은 유지한다: 댓글 선점·자동 댓글, 남의 사연 웹툰화.

## 1. 왜 만드나

- `ref_replay`는 원본이 있어야 돈다. 그런데 공식 `keyword_search`는 Meta 앱 심사 전이라 **본인 글만** 돌려준다(`src/app/api/cron/viral/route.ts:55-60`, `keywordOnlyOwnPosts`). `profile_posts`·`profile_lookup`은 권한 오류다(10-27 설계 3.0 게이트). 그래서 외부 원본은 사실상 0개다. 2026-10-29 X 수동 레퍼런스는 이 공백을 사람 손으로 메우는 우회책이다.
- 설령 심사를 통과하더라도 공식 API는 **남의 글 반응 수를 주지 않는다**. 그래서 지금의 `referenceScore`는 TOP 순위·키워드 겹침·재등장 횟수로 반응을 추측한다(`src/lib/viral-analysis.ts:137-147`). 10-28 설계 2장은 "글 단위 좋아요·조회수는 추측하지 않는다"를 비목표로 뒀다.
- ScrapeCreators의 `/v1/threads/search`와 `/v1/threads/user/posts`는 **다른 계정 글**을 주고, 글마다 `like_count`가 붙어 있다. 공백 두 개가 한 번에 메워진다.
  1. 원본 공급: 키워드 검색과 경쟁 계정 글이 실제로 들어온다.
  2. 반응 신호: 추측 대신 좋아요 수가 생긴다. 계정의 평소 좋아요 대비 몇 배인지도 계산할 수 있다(outlier-post-finder 스킬의 "baseline-aware" 원칙).

## 2. 목표 / 비목표 / 실패 조건

**목표**
1. 키 하나(`SCRAPECREATORS_API_KEY`)와 어댑터 토글 하나로 켜고 끈다. 키가 없거나 토글이 꺼져 있으면 지금과 완전히 같게 동작한다. **[내 판단]**
2. 켜면 `viral` 크론이 공식 키워드 검색 대신 ScrapeCreators 검색으로 외부 글을 모은다. 저장 형식(`ViralExample`, `rawMetrics.searchRank`·`rankHistory`·`timesSeen`)은 그대로라서 `referenceScore` → `risingScore` → `ref_replay` 경로가 손대지 않아도 돈다.
3. 좋아요 수를 `ViralExample.likes`와 `rawMetrics.likeHistory`에 남긴다. 1단계에서는 **저장만** 한다. 점수 반영은 판정(6장)을 거친 뒤 2단계에서 한다.
4. `competitorHandles`의 최근 글을 모아, 계정 중앙값 대비 좋아요 배수(`likeMultiple`)를 남긴다(2단계).

**비목표**
- 스키마 변경. 전부 기존 컬럼과 `rawMetrics` JSON에 담는다.
- 댓글·답글 본문 수집(`comment-mining` 스킬 영역). 필요해지면 따로 설계한다.
- TikTok·Instagram 등 다른 플랫폼 엔드포인트. 쇼츠 레이더는 YouTube Data API를 그대로 쓴다.
- `trends` 크론의 Threads 검색 교체. 같은 클라이언트를 쓸 수 있지만 이번 범위는 아니다.
- `ref_replay` 하루 상한(1개), 자격 조건(`MIN_TIMES_SEEN = 2`, 첫 발견 후 3h, 7일 이내) 변경.
- 리서치 스킬 13개를 `.claude/skills/`에 설치하는 것. 대화형 리서치 도구라서 이 설계와 상관없다.

**실패 조건 (작동해도 실패로 본다)**
- 키가 없는 환경(로컬, 프리뷰)에서 `viral` 크론이 에러로 끝나거나, 기존 공식 검색까지 멈추는 것.
- 크레딧이 떨어졌는데 조용히 0건으로 끝나는 것. 실패는 `errors`에 남고, `externalAllFailed`로 드러나야 한다.
- 같은 글이 공식 검색 행과 ScrapeCreators 행으로 나뉘어 `ref_replay`에 두 번 쓰이는 것.
- 한 달 크레딧 사용량이 4.5장 예상치의 2배를 넘는 것.
- 좋아요가 큰 외부 글 때문에 `viralScore` 기반 패턴 학습(`learnViralPatterns`)이 내 글 신호를 덮는 것(4.4).

## 3. 0단계 게이트 (구현 전, DB 쓰기 없음)

10-27 설계의 `scripts/check-threads-discovery.ts`와 같은 방식이다.

- `scripts/check-scrapecreators-threads.ts`: 무료 크레딧(가입 시 100)으로 아래를 한 번씩 호출하고 필드 존재 여부만 출력한다.
  1. `/v1/threads/search?query=<cosmicpath 키워드 1개>` — 한국어 키워드로 결과가 나오는지, 몇 개 나오는지, 순서가 웹의 "인기" 탭과 비슷한지.
  2. 같은 호출에 `start_date=<7일 전>` — 날짜 필터가 실제로 먹는지.
  3. `/v1/threads/user/posts?handle=<경쟁 계정 1개>` — 몇 개 나오는지(문서상 20~30개).
  4. 응답 글 1개의 키 목록. 문서 예시에는 `like_count`만 있다. `text_post_app_info.direct_reply_count`·`repost_count`·`quote_count`가 실제로 오는지 본다.
  5. 같은 글의 공식 API `permalink`와 ScrapeCreators `code`/`url`이 같은 shortcode를 가리키는지(4.3 중복 방지의 전제).
- 통과 기준: 1·4(`like_count`)·5가 되면 1단계로 간다. 2가 안 되면 7일 필터는 코드에서 `taken_at`으로 한다. 3이 안 되면 2단계를 접는다.

## 4. 설계

### 4.1 어댑터와 켜는 방법

- `ViralAdapterId`에 `"threads_scrapecreators"`를 추가한다(`src/types/viral.ts:2`). 기본값은 `enabled: false`(`src/types/brand.ts:227` 기본 adapters). 기존 브랜드는 `normalize` 단계에서 기본값과 병합되므로 마이그레이션은 필요 없다.
- 실제로 도는 조건은 **토글 켜짐 + `SCRAPECREATORS_API_KEY` 있음** 둘 다다. 토글은 켜져 있는데 키가 없으면 `errors`에 `{ adapter: "threads_scrapecreators", source: "auth", message: "SCRAPECREATORS_API_KEY missing" }`를 하나 남기고 공식 경로로 간다. **[내 판단]**
- 키는 Vercel 환경 변수에 둔다. 크론 라우트는 Vercel에서 돌고, GitHub Actions는 URL만 호출하기 때문이다.
- 설정 화면(`src/components/BrandSettingsForm.tsx:957-977`)의 라벨은 "Threads 검색 (ScrapeCreators)", 설명은 "다른 계정 글과 좋아요 수 수집 (SCRAPECREATORS_API_KEY 필요, 유료)"로 한다. `Record<ViralAdapterId, …>` 때문에 타입 검사에서 빠뜨리면 바로 걸린다. 대시보드 `sourceLabel`(`src/components/Dashboard.tsx:2115`)에도 추가한다.

### 4.2 공식 키워드 검색과의 관계: 켜면 대체한다 **[내 판단]**

- `threads_scrapecreators`가 실제로 돌면(토글과 키 모두 있음) 그 실행에서는 공식 `keyword_search`를 **건너뛴다**. 공식 검색은 지금 본인 글만 주므로 같이 돌려도 얻는 게 없다. 같이 돌리면 같은 글이 행 두 개로 저장될 위험만 생긴다(4.3).
- 키워드 목록은 지금과 같다: `viralDiscovery.keywords`, 비어 있으면 제품 토픽 3개(`buildDiscoveryRunConfig`). `threads_keyword` 토글이 꺼져 있어도 `threads_scrapecreators`가 켜져 있으면 저장된 키워드를 쓴다. **`keywords`를 비우면 전부 꺼지는 킬 스위치는 그대로 지킨다.**
- 경쟁 계정도 같은 방식이다. `threads_scrapecreators`가 돌면 공식 `profile_posts`(권한 오류) 대신 `/v1/threads/user/posts`를 쓴다. 최대 5개 계정(`MAX_HANDLES`).
- Meta 심사를 통과하면 그때 비교해서 고른다. 공식 검색으로 돌아가는 방법은 토글 하나다.

### 4.3 데이터 매핑

`src/lib/scrapecreators/threads-client.ts`(신규)가 응답을 아래 내부 형식으로 바꾼다. 필드가 없거나 타입이 다르면 `null`로 두고, 행 하나가 깨져도 나머지는 살린다.

| `HarvestedCandidate` | ScrapeCreators 필드 | 비고 |
|---|---|---|
| `adapter` | — | `"threads_scrapecreators"` |
| `source` | — | 검색은 `keyword:<kw>`, 계정은 `profile:@<handle>`로 공식과 **같은 문자열**. `reference-replay.ts:22`의 키워드별 행 묶음 가정을 그대로 탄다. **[내 판단]** |
| `sourceKey` | `code` (shortcode) | 아래 설명 |
| `content` | `caption.text` | 비면 버린다(공식과 동일) |
| `authorUsername` | `user.username` | |
| `permalink` | `url` 없으면 `https://www.threads.com/@{username}/post/{code}` | |
| `publishedAt` | `taken_at` (unix 초) | |
| `likes` | `like_count` | |
| `replies` / `reposts` / `quotes` | `text_post_app_info.*_count` | 게이트 4에서 확인된 것만 |
| `views` | — | **항상 `null`**(4.4) |
| `rawMetrics.searchRank` | 응답 배열 순서 + 1 | 검색만 |
| `rawMetrics.scPk` | `pk` | 디버깅용 |

**`sourceKey`를 `code`로 하는 이유.** 공식 Threads 미디어 id와 웹 `pk`는 다른 숫자 체계라서 같은 글인지 맞춰 볼 수 없다. 둘 다 아는 값은 permalink의 shortcode뿐이다. `ref_replay`의 "이미 쓴 글" 판정은 `sourceKey` 묶음 기준이다(`src/lib/reference-replay.ts:40-55`). 그래서 `code`로 통일해 두면 나중에 공식 검색으로 돌아가도 permalink에서 shortcode를 뽑아 같은 키로 맞출 수 있다. 공식 경로의 `sourceKey`는 이번에 바꾸지 않는다. 지금 쌓인 공식 외부 행이 사실상 0개라서, 두 키 체계가 겹칠 일이 없다. **[내 판단]**

### 4.4 점수: 1단계는 저장만, 2단계에서 반영

**1단계(이번 구현).** 좋아요는 `likes` 컬럼과 `rawMetrics.likeHistory: [{ at, likes }]`(최근 12건, `rankHistory`와 같은 상한)에 남긴다. `referenceScore`·`risingScore` 공식은 바꾸지 않는다.

- 걸리는 점: `calculateViralScore`는 `likes × 3`을 그대로 더한다(`src/lib/viral-analysis.ts:47-64`). 좋아요 5,000개인 외부 글은 `viralScore`가 15,000을 넘고, 지금 외부 글의 상한(약 40)이나 내 글 점수와는 단위가 달라진다. `viralScore`는 리포트 정렬과 `learnViralPatterns`의 평균에 쓰인다.
- 처리: `views === null`이면서 `likes !== null`인 외부 글은 `calculateViralScore`에 **좋아요를 넘기지 않는다**. 지금처럼 구조 점수 + `searchBonus`만 쓴다. 좋아요는 컬럼에 남아 화면에 보이기만 하고 점수에는 들어가지 않는다. **[내 판단: 판정 전에 점수 체계를 섞지 않는다]**

**2단계(6장 판정 뒤, 별도 PR).** 후보안이다. 가중치는 전부 추측이라 판정으로 검증한다.

- `likeScore = min(30, round(10 × log10(likes + 1)))`. 좋아요 10개면 10점, 100개면 20점, 1,000개 이상이면 30점이다. 상한 30은 TOP 1위의 `rankScore`(28)와 비슷하게 맞춘 값이다.
- `likeVelocity`: `likeHistory` 마지막 두 시점의 시간당 증가량. `risingScore`의 `rankGain` 자리에 같이 얹는다. 4시간 주기라 두 번째 수집부터 생긴다.
- 경쟁 계정 글은 `likeMultiple = likes / 그 계정 최근 글 좋아요 중앙값`. 3배 이상이면 outlier로 표시한다(outlier-post-finder 스킬의 기준). 중앙값은 최소 8개 글이 있을 때만 계산한다.
- `referenceScore = 지금 공식 + likeScore`. `risingScore`에 `likeVelocity`를 더한다.

### 4.5 비용과 호출 수

- 가격(2026-11-05 scrapecreators.com 확인): 대부분의 엔드포인트가 1회 1크레딧이다. 25,000크레딧에 $47(1,000회에 $1.88)이고, 크레딧은 만료되지 않는다. 캐시에 걸린 응답은 0크레딧이다. 가입하면 100크레딧을 무료로 준다.
- 예상: `viral` 크론은 4시간마다, 하루 6회 돈다. 키워드 10개(`MAX_KEYWORDS`)와 계정 5개(`MAX_HANDLES`)면 실행당 15회, **하루 90회, 한 달 약 2,700회(약 $5)**다. 브랜드 하나 기준이다.
- 페이지네이션은 하지 않는다. 검색과 계정 글 모두 첫 페이지만 가져온다. **[내 판단: `ref_replay`는 하루 1개라 첫 페이지면 충분하다]**
- 응답의 `credits_remaining`을 실행 결과에 같이 돌려준다. 1,000 아래로 떨어지면 `viral` 라우트가 기존 경고 경로(`route.ts:55-60` 옆)로 알린다.

### 4.6 실패 처리

- 키워드나 계정 하나가 실패하면 그것만 `errors`에 남기고 다음으로 넘어간다(지금 harvester와 같다).
- 시도한 ScrapeCreators 호출이 **전부** 실패하면(401·402 크레딧 부족·5xx·형식 깨짐) 같은 실행에서 공식 `keyword_search`로 한 번 더 돈다. 이때는 `keywordOnlyOwnPosts` 경고가 원래대로 뜬다.
- 요청 간격은 지금과 같은 300ms다. ScrapeCreators는 rate limit이 없다고 하지만 연속 호출을 줄인다. 타임아웃은 요청당 20초다(평균 응답 3초).

### 4.7 바뀌는 파일

| 파일 | 변경 |
|---|---|
| `src/types/viral.ts` | `ViralAdapterId`에 `threads_scrapecreators` |
| `src/types/brand.ts` | 기본 adapters에 `{ id: "threads_scrapecreators", enabled: false }` |
| `src/lib/scrapecreators/threads-client.ts` (신규) | `searchThreads(query, { startDate })`, `fetchThreadsUserPosts(handle)`, 응답 파서, `credits_remaining` 반환 |
| `src/lib/viral-harvester.ts` | `provider: "official" \| "scrapecreators"` 옵션, `convertScrapeCreatorsPostToCandidate`, 전부 실패 시 공식 폴백 |
| `src/lib/viral-service.ts` | 토큰이 없어도 ScrapeCreators 경로는 돌게 `if (brand.accessToken)` 조건 분리. `buildDiscoveryRunConfig`의 키워드·계정 사용 조건. 4.4의 `viralScore` 처리 |
| `src/lib/viral-analysis.ts` | `likeHistory` 누적(`mergeStoredRawMetrics`) |
| `src/components/BrandSettingsForm.tsx`, `src/components/Dashboard.tsx` | 라벨 |
| `scripts/check-scrapecreators-threads.ts` (신규) | 0단계 게이트 |
| `README.md` | Cron Endpoints의 `viral` 설명, 환경 변수 |

테스트(vitest): 응답 파서(필드 누락, 타입 이상, 빈 caption), shortcode 기반 `sourceKey`, 토글 켜짐·키 없음, 전부 실패 시 폴백, 좋아요가 `viralScore`에 들어가지 않는지, `likeHistory` 상한 12.

## 5. 켜는 순서

1. 0단계 게이트(무료 크레딧).
2. 1단계를 머지하고 Vercel에 키를 넣는다. cosmicpath에서만 토글을 켠다.
3. 3일 동안 지켜본다: 실행마다 저장된 외부 글 수, `eligibleSource` 행 수, 크레딧 사용량, `ref_replay` 초안 생성 여부.
4. 6장 판정을 하고 2단계로 갈지 정한다.

## 6. 판정 (2단계로 가기 전)

- 3일치 외부 글 중 무작위 20개를 뽑는다. 각 글에 대해 **사람이 "소재로 쓸 만한가"를 O/X로 매기고**, 지금 `referenceScore` 순위와 좋아요 순위 중 어느 쪽이 O와 더 맞는지 본다.
- 좋아요 순위가 확실히 낫다(20개 중 O 상위 10개와 겹치는 개수가 3개 이상 많다)면 2단계로 간다. 아니면 좋아요는 표시용으로만 남긴다.
- 10-27 설계의 20개 판정 기록과 같은 형식으로 `docs/experiments/`에 남긴다.

## 7. 구현 전 답이 필요한 것 (1번은 2026-11-05 승인, 2·3번은 권고안으로 구현)

1. **스크레이핑 금지 결정을 뒤집을지**(0장). 뒤집지 않으면 이 설계는 여기서 멈추고, 수동 레퍼런스(10-29)와 Meta 심사 대기를 유지한다.
2. **켜면 공식 검색을 대체할지, 같이 돌릴지**(4.2). 이 문서는 대체를 권한다.
3. **비용 상한.** 한 달 약 $5(브랜드 하나)를 예상한다. 여러 브랜드에 켤 거라면 브랜드별 상한을 둘지 정해야 한다.

## 8. 나중에 할 수 있는 것

- `trends` 크론의 Threads 검색을 같은 클라이언트로 바꾸기. 72시간 창을 `start_date`로 줄일 수 있다.
- `comment-mining` 방식: `ref_replay` 원본으로 뽑힌 글 하나만 답글을 가져와 "독자가 실제로 쓰는 말"을 프롬프트에 넣기. 글 하나당 1크레딧.
- 경쟁 계정 자동 발견: 검색 결과에 자주 나오는 작성자를 `competitorHandles` 후보로 올리기(사람이 승인).
