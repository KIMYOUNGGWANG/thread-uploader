# 유튜브 쇼츠 급상승 레이더 설계 (threads-uploader)

출발점: 스레드 글 "레퍼런스 찾기 귀찮아서 만든 사이트 … 24시간 이내 국내외 떡상한 릴스/쇼츠를 가져온다" (`https://www.threads.com/@makefamily_/post/DexxF6NE6lF`).
별도 SaaS로 기획한 PRD(`PRD/` 5종)를 이 저장소의 내부 도구로 줄인 문서다. 결제·조직·RLS는 빠지고, 수집·속도·피드만 남는다.

## 왜

- 사주 릴스 실험(`docs/experiments/2026-10-22-ig-reels-format.md`)의 포맷 근거를 경쟁 계정 110개를 **손으로** 읽어서 만들었다. 다음 실험(시즌 훅, 일간별 체인)도 같은 수작업이 필요하다.
- 기존 바이럴 수집은 Threads 글뿐이다. 영상 레퍼런스는 아예 없다.
- Threads 공개 API는 조회수를 주지 않아서 "지금 터지는 것"을 못 본다. YouTube Data API는 조회수를 주고, 시간별로 찍으면 **증가 속도**를 계산할 수 있다.

## 목표

- 브랜드마다 `/brands/[slug]/shorts`에서 **48시간 안에 올라온 쇼츠**를 **시간당 조회수 증가** 순으로 본다. 국내/해외, 24h/48h로 거른다.
- 사람 손 없이 6시간마다 새 쇼츠를 찾고, 매시간 조회수를 다시 찍는다.
- YouTube 일 쿼터 10,000 유닛 안에서 브랜드 2개를 돌린다.
- 기존 Threads 바이럴 학습(`viralMemory`, `ViralPattern`)에 영향을 주지 않는다.

## 하지 않을 것

- 벤치마킹 스크립트·촬영컷 생성. 피드가 쌓인 뒤 별도 설계로 한다(아래 "다음").
- 자막 추출, 영상 다운로드, 임베드 플레이어. 카드는 유튜브로 링크만 한다.
- 인스타·틱톡 수집.
- 결제·조직·멀티테넌트. 브랜드 소유자 세션이면 충분하다.
- 주제 탭. 피드는 브랜드 단위이고, 주제는 브랜드 설정의 키워드가 대신한다.
- 쇼츠 레퍼런스를 Threads 글 생성에 넣는 것.

## 실패로 칠 것

- 쇼츠 예시가 `viralMemory`나 `ViralPattern`에 섞여서 Threads 글 생성이 바뀌는 것. 지금 글 길이 실험(11/17 판정) 중이라 생성 경로는 건드리면 안 된다.
- 일 쿼터를 넘겨서 하루 중 수집이 멈추는 것.
- 수집한 영상 데이터를 30일 넘게 들고 있는 것 (YouTube API 약관).
- 피드가 "누적 조회수 순"이 되는 것. 어제 터진 영상이 위에 있으면 이 기능의 존재 이유가 없다.

## 전제

- 저장소 관행을 따른다: Prisma + Postgres, npm, Next.js App Router, vitest. 전역 규칙의 pnpm·Supabase는 여기서 적용하지 않는다.
- `YOUTUBE_API_KEY` 하나를 서버 환경변수로 쓴다. Google Cloud에서 YouTube Data API v3를 켜고 키를 발급하는 건 사용자가 한다.
- GitHub Actions가 크론을 친다(기존 `viral.yml`·`trends.yml`과 같은 방식). 다른 워크플로가 실험 때문에 동결돼 있지만, 이 기능은 Threads 발행·생성에 손대지 않으므로 처음부터 켠다. **(내 판단)**

## 설계

### 1. 데이터

쇼츠 한 편 = `ViralExample` 한 행. 새 테이블은 시간별 스냅샷 하나만 추가한다.

```
ViralExample (기존)
  source        = "youtube_shorts"
  sourceKey     = YouTube videoId
  authorUsername= 채널 제목
  permalink     = https://www.youtube.com/shorts/{videoId}
  content       = 제목 + "\n" + 설명 앞 300자     ← 규칙 분석(analyzeViralText)이 돌 수 있게
  publishedAt   = snippet.publishedAt
  views/likes/replies = statistics.viewCount/likeCount/commentCount (최신값)
  velocityScore = 시간당 조회수 증가 (정수, 아래 식)
  country       = 신규 컬럼 String? ("KR" | ISO 국가코드 | "UNKNOWN"). 피드 where·국가별 minViews에 쓰려면 JSON 밖에 있어야 한다
  rawMetrics    = { channelId, channelHandle, durationSec, thumbnailUrl,
                    firstSeenAt, velocityWindowHours, searchKeyword?, searchRank? }

ViralExampleSnapshot (신규)
  id          cuid
  exampleId   → ViralExample (onDelete: Cascade)
  capturedAt  DateTime
  views       Int
  likes       Int?
  comments    Int?
  @@unique([exampleId, capturedAt])
  @@index([exampleId, capturedAt(sort: Desc)])
```

- 유니크 키 `(brandId, source, sourceKey)`는 그대로. 같은 영상이 두 브랜드에 잡히면 행이 두 개 생긴다. 브랜드 2개 수준에서는 그게 더 단순하다. **(내 판단)**
- `country`는 채널의 `snippet.country`. 비어 있으면 `"UNKNOWN"`. 피드의 "국내"는 `KR`, "해외"는 그 외 전부(UNKNOWN 포함). 기존 Threads 행은 null로 둔다.
- 스키마 변경은 마이그레이션 한 개(`add_shorts_snapshot_and_country`): `ViralExampleSnapshot` 테이블 + `ViralExample.country` 컬럼 + `@@index([brandId, source, publishedAt])`. 전역 규칙대로 **적용 전에 사용자 승인**을 받는다.

### 2. 속도(velocity) 정의

```
window  = 최근 6시간 안의 가장 오래된 스냅샷 ~ 지금
velocity = (views_now − views_at_window_start) / window_hours
스냅샷이 1개뿐이면: views_now / max(1, 게시 후 경과 시간)
```

- 정수로 반올림해 `velocityScore`에 저장한다. 기존 `calculateVelocityScore`(Threads 참여도 기준)는 호출하지 않는다. 쇼츠 저장 경로는 자기 식을 쓴다.
- `rawMetrics.velocityWindowHours`에 실제 창 길이를 남긴다. 카드에서 "+12,000/h (6h 기준)"처럼 보여주기 위해서다.
- 노출 최소값: `views ≥ 10,000`(KR) / `≥ 50,000`(그 외). 브랜드 설정 `minViews`로 바꿀 수 있다.

### 3. 설정 (`brandConfig.viralDiscovery`)

```ts
adapters: [..., { id: "youtube_shorts", enabled: boolean }]   // ViralAdapterId에 추가
youtube: {
  keywords: string[];        // 비어 있으면 brand.topics 앞 3개
  channelHandles: string[];  // "@handle" 형식, 선택
  regions: ("KR" | "GLOBAL")[];   // 기본 ["KR", "GLOBAL"]
  maxDurationSec: number;    // 기본 180
  minViews: { kr: number; global: number };  // 기본 10000 / 50000
}
```

- `parseBrandConfig`의 기본값과 정규화에 추가. 기존 브랜드 JSON에 없으면 기본값으로 채운다.
- `BrandSettingsForm` "바이럴 소스" 탭에 키워드·채널 핸들 입력과 어댑터 토글을 붙인다. regions·maxDurationSec·minViews는 v1에서 UI 없이 기본값만 쓴다. **(내 판단)**
- 어댑터 `youtube_shorts` 기본값은 **꺼짐**. 키 없는 브랜드에서 매 실행마다 에러가 쌓이지 않게. cosmicpath만 켠다.

### 4. 수집 어댑터 (`src/lib/youtube-shorts-harvester.ts`)

기존 `harvestFromThreadsSources`와 같은 모양: 입력 옵션 → `HarvestResult { candidates, errors, totalDiscovered }`.

```
키 없음 → errors: [{ adapter: "youtube_shorts", source: "auth", message: "YOUTUBE_API_KEY is not set" }], candidates: []

키워드마다, 지역마다:
  search.list  part=id  type=video  videoDuration=short  order=viewCount
               publishedAfter=now−48h  maxResults=25
               regionCode=KR + relevanceLanguage=ko   (KR)
               regionCode 없음                          (GLOBAL)
채널 핸들마다:
  channels.list forHandle → uploads playlistId (rawMetrics에 캐시, 하루 1회만 재조회)
  playlistItems.list maxResults=10 → 48h 이내 videoId

모든 videoId 합쳐 50개씩:
  videos.list part=snippet,contentDetails,statistics
  → durationSec ≤ maxDurationSec 만 통과 (ISO 8601 duration 파싱)
  → 채널 country는 channels.list part=snippet 를 50개씩 (channelId 캐시, rawMetrics에 있으면 생략)
```

- 쿼터: search 100/회, 나머지 1/회. 브랜드당 한 실행 = 키워드 3 × 지역 2 = 600 + 약 20 = **약 620 유닛**. 6시간마다 4회 × 브랜드 2 = **약 5,000/일**. 함수 상단 주석에 이 계산을 남기고, 실행마다 `quotaUsed`를 응답에 넣는다.
- `videoDuration=short`는 4분 미만이라 3분짜리 일반 영상도 들어온다. `maxDurationSec=180`으로 다시 거른다. 그래도 세로/가로는 못 가린다. 받아들인다. **(내 판단, PRD 미결 "쇼츠 판정"의 답)**
- 같은 영상이 키워드 두 개에서 나오면 기존 `annotateSearchSignals`처럼 `searchRank`·`keywordHits`를 합친다.

### 5. 저장 (`viral-service.ts` 확장)

**`discoverViralExamples`는 건드리지 않는다.** 쇼츠는 별도 함수 `discoverShorts(brandId)`로 두고 `/api/cron/shorts/discover`만 호출한다. 이유 둘:
- `discoverViralExamples`는 대시보드 버튼(`/api/viral/discover`)과 매시간 크론(`/api/cron/viral`, 지금은 동결) 양쪽에서 불린다. 거기에 넣으면 버튼 한 번에 600유닛, 크론 해제 시 하루 3만 유닛이 나간다.
- 저장 규칙이 다르다. 기존 `saveCandidate`는 `calculateViralScore`·`calculateVelocityScore`를 쓰고 `discoveredAt`을 매번 덮는데, 쇼츠는 그 둘을 쓰지 않고 `firstSeenAt`을 보존해야 한다. 그래서 저장도 `saveShortsCandidate`로 따로.

어댑터 토글 `youtube_shorts`는 `isAdapterEnabled`로 크론이 대상 브랜드를 고를 때만 읽는다. `buildDiscoveryRunConfig`에는 영향 없다.

```
saveShortsCandidate:
  upsert ViralExample (where brandId_source_sourceKey)
    create: 위 1절 필드 + rawMetrics.firstSeenAt = now
    update: views/likes/replies/content/rawMetrics(merge) 만. discoveredAt·firstSeenAt 유지
  insert ViralExampleSnapshot (capturedAt = now, 같은 시(hour)에 이미 있으면 건너뜀)
  velocityScore 재계산 → update
  viralScore = 0 고정 (Threads 점수 체계와 섞이지 않게)
```

- **학습 제외:** `learnViralPatterns`의 `findMany`와 `analyzeTopViralExamples`의 `findMany`에 `source: { not: "youtube_shorts" }`를 넣는다. 이게 "실패로 칠 것" 1번의 방어선이다. 두 함수에 각각 회귀 테스트를 둔다.
- `getViralReport`(바이럴 리포트 12개)도 쇼츠를 제외한다. 그 화면은 Threads용이다.

### 6. 크론

| 라우트 | 주기 | 하는 일 | 상한 |
|---|---|---|---|
| `GET /api/cron/shorts/discover?brands=slug,slug` | 6시간 (`7 */6 * * *` UTC) | 어댑터 실행 → `saveShortsCandidate` | 브랜드당 search 8회 |
| `GET /api/cron/shorts/snapshot` | 매시간 (`37 * * * *`) | `youtube_shorts` 중 `publishedAt ≥ now−72h`인 예시의 `videos.list statistics` → 스냅샷 insert → velocity 갱신. 끝나면 정리(아래) | 50개 × 60호출 |

- 정리(snapshot 크론 끝에): `publishedAt < now−7d`인 `youtube_shorts` 예시와 그 스냅샷 삭제. 피드는 48h까지만 보여주므로 7일이면 충분하고, 30일 약관도 지킨다. **(내 판단, PRD 미결 "보관 기간"의 답)**
- 둘 다 `verifyCronSecret`. `brands` 없으면 `youtube_shorts` 어댑터가 켜진 브랜드 전부.
- GitHub Actions `shorts.yml` 하나에 schedule 두 줄. 스텝 `if: github.event.schedule == '...'`로 라우트를 가른다. `workflow_dispatch`에 `mode` 입력(discover/snapshot).
- 응답: `{ success, brands: [{ slug, discovered, saved, snapshots, deleted, quotaUsed, errors }] }`. `maxDuration = 300`.

### 7. 피드 화면 (`/brands/[slug]/shorts`)

RSC 페이지. 필터는 `searchParams`로 받는다(`window=24|48`, `region=kr|global|all`). 클라이언트 상태 없음.

```
상단: [24h] [48h]   [국내] [해외] [전체]   마지막 갱신 N분 전 (가장 최근 capturedAt)
그리드: 2열(모바일) → 4열(데스크톱)
카드:
  썸네일 9:16 (rawMetrics.thumbnailUrl)
  제목 2줄
  채널명 · N시간 전
  조회 424만   +12.3만/h   ❤ 2.3만  💬 1.1천
  [유튜브에서 보기 ↗]  (새 탭, rel=noopener)
```

- 쿼리: `brandId`, `source="youtube_shorts"`, `publishedAt ≥ now−window`, region 조건은 `country` 컬럼(`kr` → `= "KR"`, `global` → `not "KR"`, `all` → 없음), `views ≥ minViews`는 `OR [{country:"KR", views ≥ kr}, {country ≠ "KR", views ≥ global}]`, `orderBy velocityScore desc, views desc`, `take 60`. 전부 DB에서 거른다. 메모리 필터 없음.
- 비어 있을 때: "아직 수집된 쇼츠가 없어요. 설정 → 바이럴 소스에서 유튜브 어댑터를 켜고 키워드를 넣어주세요." + 설정 링크. 키가 없으면 그 사실도 같이.
- `Dashboard` 헤더의 기존 링크 줄(틱톡 스튜디오 옆)에 "쇼츠 레이더" 링크 추가.
- 카드에 채널명과 유튜브 링크를 반드시 표기한다(API 브랜딩 요건).

### 8. API 계약 (`docs/api-spec.md`에 추가)

```ts
type ViralAdapterId = "owned_posts" | "threads_keyword" | "threads_profile" | "manual" | "youtube_shorts";

interface ViralDiscoveryConfig {
  // 기존 필드 유지
  youtube?: {
    keywords: string[];
    channelHandles: string[];
    regions: Array<"KR" | "GLOBAL">;
    maxDurationSec: number;
    minViews: { kr: number; global: number };
  };
}

// GET /api/cron/shorts/discover?brands=  → ShortsCronResponse
// GET /api/cron/shorts/snapshot          → ShortsCronResponse
interface ShortsCronResponse {
  success: true;
  brands: Array<{
    slug: string;
    discovered?: number;
    saved?: number;
    snapshots?: number;
    deleted?: number;
    quotaUsed: number;
    errors: ViralSourceError[];
  }>;
}
```

- `/api/viral/discover` 사용자 엔드포인트는 바꾸지 않는다. 쇼츠는 크론 전용이다.
- 스키마 절(`model ViralExampleSnapshot`, `ViralExample.country`)도 api-spec의 Prisma 섹션에 추가.

### 9. 테스트

| 대상 | 케이스 |
|---|---|
| `parseIsoDuration` | `PT59S`→59, `PT1M30S`→90, `PT3M1S`→181(탈락), `P1DT2H`→86400+ |
| `calculateShortsVelocity` | 스냅샷 1개, 2개(6h 안), 3개(가장 오래된 것이 6h 밖이면 창 안의 것만), 조회수 감소(0으로 클램프) |
| 어댑터 매핑 | fixture JSON → candidate 필드, `maxDurationSec` 필터, country 기본값 UNKNOWN |
| 어댑터 키 없음 | errors 1개, candidates 0, 네트워크 호출 0 |
| `saveShortsCandidate` | 두 번 저장 시 `firstSeenAt` 유지, 같은 시간대 스냅샷 중복 안 됨 |
| 학습 제외 | `learnViralPatterns`·`analyzeTopViralExamples`가 `youtube_shorts` 행을 읽지 않음 (prisma mock의 where 검사) |
| 정리 | 7일 지난 예시만 삭제, 스냅샷 cascade |
| 피드 쿼리 빌더 | window/region → where 절 |

YouTube 호출은 전부 fixture. 실제 키로는 수동 1회.

### 10. 환경변수·문서

- `.env.example`에 `YOUTUBE_API_KEY=` 추가. README "Cron Endpoints"에 두 라우트 설명 추가.
- `PRD/`(5파일, 미추적)는 이 기능의 상위 기획이다. `docs/plans/shortsradar-prd/`로 옮겨 두는 걸 권한다. 이 설계가 그 문서를 대체하므로 커밋은 사용자 판단.

## 빌더에게 맡기는 것

- 파일 분할(어댑터·velocity 계산·크론 핸들러를 어디까지 쪼갤지). 함수 20줄 규칙만 지키면 된다.
- 카드 디자인 세부, 썸네일 비율 처리, 다크모드.
- fixture 파일 위치와 모양.
- 쿼터 초과(403 quotaExceeded) 시 처리: 남은 브랜드 건너뛰고 errors에 기록하면 된다.

## 다음 (이 설계 밖)

- **1b 벤치마킹 생성:** 카드의 "이 영상으로 초안 만들기" → 자막 추출 → Claude로 훅 분석 + cosmicpath 톤 스크립트 + 촬영컷 → `TikTokVideoDraft`로 저장. 자막 추출 방식(비공식 timedtext vs 외부 전사)이 미결이라 피드가 쌓인 뒤 따로 설계.
- 인스타 릴스 어댑터(Apify). 릴스 실험 판정 후.
