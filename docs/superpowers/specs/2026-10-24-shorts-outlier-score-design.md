# 쇼츠 아웃라이어 점수 설계 (threads-uploader)

출발점: 김뽑희 「떠먹여주는 AI 자동화 바이블」 01장 "릴스 레이더". 핵심은 **조회수 순위가 아니라 "그 계정 평소보다 몇 배 나왔나"**로 레퍼런스를 고른다는 것. 평소는 최근 영상 12개의 **중앙값**으로 잰다(평균은 대박 하나에 부풀려진다).

상위 설계: `docs/superpowers/specs/2026-10-22-youtube-shorts-radar-design.md` (이하 "레이더 설계"). 이 문서는 그 위에 점수 하나를 얹는다.

## 왜

- 지금 쇼츠 피드는 **시간당 조회수 증가(velocity)** 순이다. 증가량도 절대값이라, 구독자 많은 채널이 평소 수준으로 올린 영상이 위를 차지한다. "작은 채널에서 갑자기 터진 영상", 즉 훅·주제·편집에 비결이 있는 영상이 묻힌다.
- DB 실측(2026-10-24, cosmicpath): 쇼츠 150건, 같은 채널이 반복해서 잡힌다(강남 돼지보살 11, 사주소담 8, 가화만사성 7). 그런데 쇼츠의 `viralScore`는 전부 0이다. 레이더 설계가 쇼츠에 Threads 점수식을 쓰지 않기로 해서, 이 컬럼이 비어 있다.
- YouTube Data API는 채널의 최근 업로드와 조회수를 싸게(2유닛) 준다. 중앙값을 바로 계산할 수 있다.

## 목표

- 쇼츠마다 **"채널 평소의 N배"**(`outlierRatio = 현재 조회수 ÷ 채널 쇼츠 조회수 중앙값`)를 계산해 저장한다.
- `/brands/[slug]/shorts` 피드에서 **정렬을 "급상승(velocity) / 평소 대비(outlier)"로 바꿀 수 있다.** 카드에 "평소의 N.N배" 배지를 보여주고, 2배 이상이면 주황색으로 강조한다.
- 스키마 변경 없이, 새 의존성 없이 한다.
- YouTube 일 쿼터 증가는 브랜드당 하루 약 320유닛 이하로 묶는다.

## 하지 않을 것

- **Threads 외부 글의 아웃라이어 점수.** 아래 "Threads는 왜 빠지나" 참고.
- 우리 계정 글(own_post)의 "평소 대비" 점수. 성장 학습 쪽에 `performanceScore`가 이미 있고, 길이 실험(11/27 판정 예정) 중이라 생성·학습 경로는 건드리지 않는다.
- 쇼츠 레퍼런스를 Threads 글 생성에 넣는 것. 레이더 설계의 "하지 않을 것"을 그대로 유지한다.
- 인스타 릴스 수집. 책은 Apify를 쓰지만 새 유료 서비스라 별도 결정이다.
- 체크박스로 골라서 분석하기(책의 3→4단계). 피드에 점수가 쌓인 뒤 따로 한다.

## 실패로 칠 것

- 쇼츠 점수가 `viralMemory`·`ViralPattern`·글 생성 경로에 섞이는 것. `source: { not: SHORTS_SOURCE }` 필터가 이미 막고 있으니, 그 필터를 우회하는 변경이 생기면 실패다.
- 재발견(6시간마다 같은 영상 upsert) 때 저장해 둔 채널 기준값이 지워지는 것. 지금 `mergeStoredRawMetrics`는 이전 키 중 LLM 키만 살리고 나머지는 버린다. 그대로 두면 기준값이 6시간마다 사라지고 쿼터를 다시 쓴다.
- 기준을 못 잰 영상(샘플 부족)이 "0배"처럼 보여서 "안 터진 영상"으로 오해되는 것. 기준 없음은 **기준 없음**으로 보여야 한다.
- 일 쿼터 초과로 수집이 멈추는 것.

## 전제

- 저장소 관행을 따른다: Prisma + Postgres, **npm**(`package-lock.json`), Next.js App Router, vitest. 레이더 설계와 같다.
- 데이터 보관은 기존 규칙(쇼츠 행 7일 후 삭제)을 따른다. 기준값도 행과 함께 사라진다.

## 설계

### 1. 채널 기준값(baseline) 정의

```
대상 영상 = 채널 uploads 재생목록의 최근 50개 중
            · durationSec ≤ config.maxDurationSec   (쇼츠만, 긴 영상 제외)
            · publishedAt ≤ now − 3일               (조회수가 아직 크는 중인 영상 제외)
            · 지금 평가하는 영상 자신 제외
          → 게시일 최신순 12개
샘플 < 5개 → 기준 없음 (channelMedianViews = null)
channelMedianViews = 대상 영상 views의 중앙값 (짝수면 가운데 두 값의 평균)
```

- 3일·12개·5개·50개는 상수로 두고 이유를 주석에 남긴다. 3일: 쇼츠 조회수는 대부분 첫 2~3일에 붙어서, 그보다 어린 영상을 기준에 넣으면 기준이 낮게 잡힌다. 12개: 책의 기준. 5개: 그보다 적으면 중앙값이 영상 1~2개에 휘둘린다. **(내 판단)**
- 평가 대상 영상은 48시간 이내라 아직 크는 중이다. 크는 중인 영상을 다 큰 영상들과 비교하니 배수는 **보수적으로(작게)** 나온다. 하루 된 영상이 이미 3배면 진짜 튄 것이다. 이 비대칭은 받아들인다. **(내 판단)**
- 중앙값 계산은 순수 함수(`computeChannelBaseline(videos, { excludeVideoId, now, maxDurationSec })`)로 만들어 단위 테스트한다.

### 2. 언제, 얼마나 부르나

- **발견(discover) 때만** 기준값을 잰다. 스냅샷(매시간)은 API를 추가로 부르지 않는다.
- 기준값은 **브랜드 안에서 채널 단위**로 재사용한다. 브랜드끼리는 공유하지 않는다(행이 브랜드별로 따로 있는 레이더 설계와 같은 이유). **(내 판단)**
- 발견 실행 순서 (전부 service 단계, 후보 저장이 끝난 뒤):
  1. 이 브랜드의 쇼츠 행 중 `publishedAt ≥ now − 48h`(피드 창)를 `id, rawMetrics`만 읽는다. 많아야 수백 행이다.
  2. `rawMetrics.channelId`로 묶어서 채널별 상태를 만든다. 같은 채널의 어느 행이든 `baselineStatus`가 `measured` 또는 `insufficient`이고 `baselineComputedAt`이 7일 안이면 그 값을 **같은 채널의 다른 행에도 복사**하고 API를 부르지 않는다.
  3. 남은 채널(기준값이 없거나 `skipped`인 채널)을 최대 40개까지 잰다. 40개를 넘거나 쿼터에 막힌 채널의 행은 `skipped`로 남기고 다음 실행에서 다시 시도한다.
  - 이렇게 하면 이번 검색에 다시 안 걸린 영상도, 피드 창 안에 있는 동안 다음 실행에서 기준값을 받는다.
  - `channelId`는 rawMetrics 문자열 안에만 있어서 DB에서 JSON 검색을 하지 않고, 1에서 읽은 행을 코드에서 묶는다.
- 채널 한 개 = `playlistItems.list`(1유닛, maxResults=50) + `videos.list`(1유닛, 50개) = **2유닛**. uploads 재생목록 ID는 잴 채널들에 대해 `listChannels`를 50개씩 한 번 더 불러서 얻는다(실행당 +1유닛). `hydrate`의 결과를 `ShortsCandidate`로 넘기는 배관은 만들지 않는다. 1유닛이 배관보다 싸다. **(내 판단)**
- 실행당 최대 40채널(= 81유닛). 하루 최대 81 × 4회 = **약 320유닛/브랜드**. 지금 `SHORTS_BRAND_SLUGS` 기본값은 cosmicpath 하나이고, 두 브랜드를 켜도 약 650유닛이다. 레이더 설계의 약 5,000/일에 더해도 10,000 안이다. 채널 단위 재사용 때문에 실제로는 이보다 적다.
- 쿼터 초과(`YoutubeQuotaError`)가 기준값 단계에서 나면 남은 채널은 `skipped`로 두고, 수집 결과는 그대로 저장한다. errors에 `source: "baseline"`으로 남긴다.
- 기존 `recentUploads`는 videoId만 돌려준다. 그 뒤 `listVideos`로 duration·publishedAt·views를 받는다. 새 API 메서드는 만들지 않는다.

### 3. 저장 (스키마 변경 없음)

```
ViralExample (source = "youtube_shorts")
  rawMetrics 추가 키:
    baselineStatus       "measured" | "insufficient" | "skipped"
    channelMedianViews   number | null     (measured일 때만 숫자)
    baselineSampleSize   number
    baselineComputedAt   ISO string        (measured·insufficient일 때)
    outlierRatio         number | null     (소수 둘째 자리까지)
  viralScore = outlierRatio 있으면 round(outlierRatio × 100), 없으면 0
```

- `viralScore`는 쇼츠에서 지금 항상 0이고, 쇼츠 행은 Threads 학습·분석 쿼리에서 전부 제외된다. 그래서 이 컬럼을 "평소 대비 × 100"으로 쓴다. 3.2배 → 320. DB에서 바로 정렬할 수 있어서 피드 쿼리를 메모리 정렬로 바꿀 필요가 없다. **(내 판단)** 대안은 새 컬럼인데, 스키마 승인과 마이그레이션이 필요해서 택하지 않았다.
- 상태 셋의 뜻: `measured` = 샘플 5개 이상으로 잼. `insufficient` = 쟀는데 샘플이 5개 미만이라 기준 없음. 7일 동안 다시 재지 않는다(작은 채널이 일주일 안에 쇼츠 5개를 더 올릴 일은 드물고, 6시간마다 2유닛씩 새는 걸 막는다). `skipped` = 상한·쿼터 때문에 못 잼. 다음 실행에서 다시 시도한다. **(내 판단)**
- **기준값 보존:** `buildRawMetrics`가 `firstSeenAt`을 이전 값에서 이어받듯, 기준값 키(`baselineStatus`, `channelMedianViews`, `baselineSampleSize`, `baselineComputedAt`)도 이전 값에서 이어받는다. 이게 빠지면 "실패로 칠 것" 두 번째가 터진다. 회귀 테스트 필수.
- **배수 갱신:** 조회수가 바뀔 때마다 배수도 바뀐다. `recordSnapshot`(매시간 스냅샷과 발견 때 둘 다 거친다)에서 `stats.views ÷ channelMedianViews`로 `outlierRatio`와 `viralScore`를 다시 쓴다. API 호출 없음. 지금 `refreshVelocity`가 하는 "행 읽기 → rawMetrics 병합 → update"에 같이 넣으면 update가 한 번으로 끝난다.
- `channelMedianViews`가 0이면(조회수 0 영상만 있는 채널) 기준 없음으로 처리한다. 0으로 나누지 않는다.

### 4. 피드

- 쿼리 파라미터 `sort=velocity|outlier`. 기본값은 **`velocity`**(지금 동작 그대로). **(내 판단)** 써 보고 outlier가 더 쓸모 있으면 기본값만 바꾸면 된다.
- `outlier` 정렬: `orderBy [{ viralScore: "desc" }, { velocityScore: "desc" }]`. 기준 없음(0)은 자연히 아래로 간다.
- `minViews`(KR 1만 / 해외 5만) 필터는 두 정렬 모두 그대로 적용한다. 작은 채널의 "500 → 5천" 같은 잡음을 거르는 역할이라 유지한다. **(내 판단)**
- 카드: 기존 지표 줄 옆에 배지 하나.
  - 기준 있음: `평소의 3.2배`. `outlierRatio ≥ 2`면 주황 배경, 미만이면 회색.
  - 기준 없음: `평소 기준 없음`(회색, 작게). 숫자 0을 보여주지 않는다.
  - 배지에 `title`(툴팁)로 "채널 최근 쇼츠 N개 중앙값 X회 기준"을 단다.
- 정렬 토글은 기존 window/region 필터 옆에 같은 모양으로 둔다. URL 파라미터로 상태를 들고 있어서 새로고침해도 유지된다.
- 2배 기준은 책과 같다. 상수로 둔다.

### 5. Threads는 왜 빠지나

권한 문제가 아니라 **데이터 자체가 없다**.

- 키워드 검색 응답에 조회수·좋아요 같은 수치 필드가 없다(공식 문서의 요청 필드: `id, text, media_type, permalink, timestamp, username, has_replies, is_quote_post, is_reply`). 지금 코드(`convertThreadsPostToCandidate`)도 외부 글의 views·likes를 전부 `null`로 저장한다.
- `profile_lookup`은 `follower_count`와 **최근 7일 합계** `views_count`·`likes_count` 등을 주지만, 글 단위 수치는 없다. 게다가 표준 접근 권한으로는 Meta 공식 계정만 조회되고, 일반 계정은 `threads_profile_discovery` 고급 접근(앱 심사)이 필요하다.
- 글 단위 조회수가 없으면 "이 글 ÷ 그 계정 평소"를 계산할 수 없다.
- 다시 볼 조건: (a) Meta가 공개 글 단위 수치를 열어 주거나, (b) 사용자가 외부 수집 서비스(Apify 등, 유료·약관 회색지대) 도입을 결정할 때. 둘 다 새 설계로 한다. 그때 1절의 `computeChannelBaseline`을 플랫폼 무관하게 재사용할 수 있게, 입력을 `{ id, publishedAt, durationSec?, views }[]` 형태로 둔다.

### 6. 테스트

| 대상 | 케이스 |
|---|---|
| `computeChannelBaseline` | 홀수·짝수 개 중앙값 / 3일 안 된 영상 제외 / 긴 영상 제외 / 자기 자신 제외 / 13개 이상이면 최신 12개만 / 4개면 null / 전부 0 조회면 null |
| 배수 계산 | 중앙값 1만·조회 3.2만 → ratio 3.2, viralScore 320 / 기준 없음 → ratio null, viralScore 0 |
| 기준값 보존 (회귀) | 같은 영상을 두 번 `saveShortsCandidate` → 두 번째 저장 후에도 `channelMedianViews`·`baselineComputedAt` 유지, 기준값용 API 호출 0회 |
| 채널 중복 | 같은 채널 영상 3개 발견 → 기준값 API 호출 채널당 1세트(2유닛) |
| 채널 재사용 | 6시간 전에 잰 채널의 새 영상 → API 호출 0, 기존 기준값 복사 |
| 샘플 부족 | 4개 → `insufficient`, 다음 실행에서 재측정 안 함 |
| 채널 상한 | 41번째 채널은 `skipped`, API 호출 안 함 / 다음 실행에서 이번 검색에 안 걸린 그 행도 측정됨 |
| 쿼터 초과 | 기준값 단계 `YoutubeQuotaError` → 후보는 저장되고 남은 채널 `skipped`, errors에 `baseline` 1건 |
| 스냅샷 갱신 | 스냅샷 views 변경 → ratio·viralScore 갱신, YouTube 호출 0 |
| 피드 | `sort=outlier` → orderBy viralScore desc / 값 없거나 이상하면 velocity |
| 학습 제외 유지 | 기존 테스트(`learnViralPatterns`·`analyzeTopViralExamples`가 쇼츠를 안 읽음) 그대로 통과 |

YouTube 호출은 전부 fixture/mock. 실제 키로는 배포 후 수동 discover 1회로 확인한다(응답의 `quotaUsed`가 이전 대비 +80 이하인지, 피드에 배지가 보이는지).

## 빌더에게 맡기는 것

- `computeChannelBaseline`과 기준값 수집 함수를 어느 파일에 둘지(`shorts-harvester.ts`에 넣을지, `shorts-baseline.ts`로 뺄지). 함수 20줄 규칙만 지키면 된다.
- 배지·토글의 세부 스타일. 기존 쇼츠 카드 스타일을 따른다.
- 상수 이름.

## 다음 (이 설계 밖)

- 써 본 뒤 기본 정렬을 outlier로 바꿀지 결정.
- 책의 3→4단계: 피드에서 체크한 쇼츠만 자막·장면 분석 → "내 버전" 훅 3개. 레이더 설계의 "1b 벤치마킹 생성"과 합쳐서 설계.
- Threads 아웃라이어: 5절의 조건이 충족되면.
