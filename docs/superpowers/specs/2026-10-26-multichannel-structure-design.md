# 멀티 채널 구조 (브랜드 → 마켓 → 채널 계정) — 설계

- 날짜: 2026-10-26
- 대상: threads-uploader 전체 (첫 적용 브랜드: CosmicPath)
- 상태: 빌더 체크 반영, 사용자 최종 승인 대기
- 표기: **[사용자 결정]**은 대화에서 사용자가 정한 것, **[내 판단]**은 설계자가 정한 것으로 빌더가 근거를 갖고 바꿀 수 있다.

## 1. 왜 만드나

- 지금은 Threads 하나에 맞춰진 구조다. 채널을 붙일 때마다 `Brand`에 토큰 칸(`instagramAccessToken` 등), `Post`에 상태 칸(`instagramStatus` 등)이 늘어난다. X, Bluesky, LinkedIn까지 붙이면 테이블이 칸으로 넘친다.
- 사용자는 CosmicPath 하나를 Threads 계정 두 개(국내 `cosmicpath`, 해외 `cosmicpath-global`)로 나눠 운영한다. 두 계정은 사실 같은 브랜드인데, 시스템에서는 서로 모르는 별개의 `Brand`다.
- 원하는 것: **브랜드마다 여러 SNS에 올릴 수 있고**, 채널마다 다른 고객층(예: X = 해외)을 잡는 것. 새 SNS는 "어댑터 하나 + 계정 한 줄 추가"로 붙어야 한다.

## 2. 목표 / 비목표 / 실패 조건

**목표**
1. 3단 구조: **브랜드**(CosmicPath) → **마켓**(국내 한국어 / 해외 영어) → **채널 계정**(Threads, 인스타, X …). [사용자 결정]
2. 학습(공식 가중치, growth/viral memory, Thompson prior)은 **마켓 단위로 따로** 유지한다. 국내에서 터진 공식과 해외에서 터진 공식은 다르다. [사용자 결정]
3. 원본 글은 마켓 단위로 만들고, 그 마켓의 채널 계정마다 "게시(Publication)" 기록을 하나씩 가진다. [사용자 결정]
4. 자동 업로드가 안 되는 채널은 "올릴 준비됨" 수동 대기열로 둔다. 누가 올리든(사람/어시스턴트) 올린 뒤 글 주소만 기록하면 게시 완료로 처리된다. [사용자 결정]
5. 2단계 채널: 해외 마켓에 **X·Bluesky·LinkedIn 개인 직접 연결**, 나머지(TikTok, YouTube Shorts, Pinterest 등)는 **수동 대기열**. [사용자 결정]
6. 다른 채널은 **Threads를 따라간다**: 같은 마켓의 Threads에 실제로 올라간 글만 다른 채널로 나간다. 지금 인스타가 쓰는 방식이다. [사용자 결정]
7. X 비용 상한은 **월 $10**. 넘으면 그달 남은 X 게시는 `SKIPPED`(사유 기록)로 처리한다. [사용자 결정]

**비목표**
- "Threads에서도 글이 안 터진다" 문제 해결. 별도 과제다. [사용자 동의]
- 중계 API(Zernio, Upload-Post 등) 연동. 3단계로 미룬다. 구조만 끼울 자리를 남긴다.
- 브라우저 UI 자동화로 게시하기. X·LinkedIn·인스타·TikTok은 비공식 자동 게시를 금지하는 것으로 분석된다(3자 분석, 원문 미확인). [내 판단]
- X 유료 API 이외의 새 유료 서비스 도입.
- 화면 디자인 확정. 화면은 정보 구조만 정하고, 시각 디자인은 디자인 파이프라인(레퍼런스 확인 → taste-skill)을 따로 탄다.

**실패 조건 (작동해도 실패로 본다)**
- 이전 중 Threads 국내/해외 발행이나 인스타 릴스 발행이 하루라도 멈추거나 **같은 글이 두 번 올라가는 것**.
- 이전 후 학습 결과(공식 가중치, formulaWinners)가 이전과 달라지는 것. 구조만 바꿨는데 학습이 바뀌면 안 된다.
- 비밀값(토큰, 앱 비밀번호, API 키)이 평문으로 DB·코드·git에 들어가는 것.
- X 비용이 상한 없이 나가는 것(링크 글 건당 $0.20).
- 영상이 없는 글이 TikTok·Shorts 수동 대기열에 쌓이는 것처럼, 채널이 받을 수 없는 원본이 그 채널로 가는 것.

## 3. 지금 상태 (2026-10-26 코드·DB 확인)

| 항목 | 현재 |
|---|---|
| `Brand` 행 | `cosmicpath`(Threads+인스타, 게시 213건+), `cosmicpath-global`(Threads), `catchdex`(Threads, 게시 0), `ulw-qa-demo-assets`(QA용) |
| 채널 토큰 | `Brand.accessToken/threadsUserId/tokenExpiry`(Threads), `Brand.instagram*`(인스타). 암호화는 `src/lib/crypto.ts` |
| 게시 상태 | `Post.status`가 검토 상태(`NEEDS_REVIEW`/`PENDING`/`DRAFT`)와 Threads 발행 상태(`PUBLISHING`/`PUBLISHED`/`FAILED`/`ARCHIVED`)를 한 칸에 섞어 쓴다 |
| Threads 전용 칸 | `Post.threadsId`, `threadRootId`, `threadPartIds`, `threadPartsPosted`, `firstComment` 등. `threadsId`는 16개 파일, `threadsUserId`는 14개 파일에서 쓴다 |
| 인스타 | `Post.instagramStatus/ContainerId/MediaId/...`. Threads에 올라간 영상 글을 하루 1개 릴스로 교차 게시한다(`src/lib/instagram-reels-sync.ts`) |
| 지표·학습 | `Post.views/likes/replies/reposts/clicks/conversions` → `src/lib/growth-learning.ts`가 마켓(`Brand`) 단위로 학습 |
| `productProfile` | 국내와 해외는 9개 칸 중 7개가 다르다(랜딩 URL, 타깃, 약속 문구 등이 현지화됨). 같은 칸은 `primaryChannel`, `primaryMetric`뿐이다 |
| 스케줄 | Cloudflare Worker와 GitHub Actions가 15분마다 `/api/cron/publish?brands=…&slots=…`, `/api/cron/instagram-publish`를 호출한다. 슬롯 중복은 서버에서 막는다 |

## 4. 설계

### 4.1 용어와 테이블 대응

| 사용자 용어 | 테이블 | 비고 |
|---|---|---|
| 브랜드 | **새** `BrandGroup` | CosmicPath 하나. 이름, slug, owner만 둔다 |
| 마켓 | 기존 `Brand` (이름 그대로) | 국내/해외 각 1행. 제품 정보, 말투, 학습, 발행 설정은 지금처럼 여기에 둔다 |
| 채널 계정 | **새** `ChannelAccount` | 마켓 아래 SNS 계정 한 줄 |
| 원본 글 | 기존 `Post` (이름 그대로) | 생성 메타데이터(공식, 훅, 품질 점수)와 검토 상태 |
| 게시 | **새** `Publication` | 원본 × 채널 계정. 채널별 본문, 상태, 외부 ID, 지표 |

- **[내 판단]** `Brand`를 `Market`으로, `Post`를 `Content`로 이름을 바꾸지 않는다. `brandConfig`만 46개 파일에서 쓰여서 이름 변경은 위험만 크고 얻는 게 없다. README에 이미 "DB는 legacy `Brand` 이름"이라고 적혀 있다. 화면 라벨만 "마켓"으로 바꾼다.
- **[내 판단]** `productProfile`과 학습 관련 칸은 마켓(`Brand`)에 그대로 둔다. 두 마켓의 제품 정보가 거의 다 다르므로, 브랜드 단위로 공유할 실익이 없다.
- `BrandGroup`은 묶음과 대시보드 진입점 역할만 한다. 다른 브랜드(`catchdex` 등)는 각자 마켓 1개짜리 그룹이 된다.

### 4.2 데이터 모델 (초안, 칸 이름은 빌더가 다듬어도 됨)

```prisma
model BrandGroup {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  markets   Brand[]
  createdAt DateTime @default(now())
}

// Brand에 추가
//   groupId     String?   (이전 완료 후 필수로)
//   group       BrandGroup? @relation(...)
//   marketLabel String?   ("국내", "해외" 같은 화면 라벨)
//   locale      String?   ("ko", "en")
//   channelAccounts ChannelAccount[]

model ChannelAccount {
  id             String    @id @default(cuid())
  brandId        String                       // 마켓
  brand          Brand     @relation(fields: [brandId], references: [id])
  platform       String                       // threads | instagram | x | bluesky | linkedin | tiktok | youtube | pinterest | ...
  mode           String                       // direct | relay | manual
  externalUserId String?
  handle         String?
  accessToken    String?                      // 암호화 저장 (crypto.ts encrypt)
  refreshToken   String?                      // 암호화 저장
  tokenExpiry    DateTime?
  settings       String    @default("{}")     // 슬롯, 하루 한도, 링크 정책, 비용 상한 등 채널별 설정
  enabled        Boolean   @default(true)
  connectedAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  publications   Publication[]
  @@unique([brandId, platform, externalUserId])
  @@index([brandId, enabled])
}

model Publication {
  id               String    @id @default(cuid())
  postId           String
  post             Post      @relation(fields: [postId], references: [id])
  channelAccountId String
  channelAccount   ChannelAccount @relation(fields: [channelAccountId], references: [id])
  status           String    @default("QUEUED")  // QUEUED | READY_MANUAL | PUBLISHING | PUBLISHED | FAILED | SKIPPED | ARCHIVED
  body             String?                       // 채널에 맞게 바꾼 본문 (없으면 Post.content)
  mediaUrls        String    @default("[]")
  scheduledAt      DateTime?
  publishedAt      DateTime?
  externalId       String?
  externalUrl      String?
  platformData     String    @default("{}")     // Threads 스레드 파트 ID, 인스타 컨테이너 ID 등 채널 전용 값
  attempts         Int       @default(0)
  errorLog         String?
  views            Int?
  likes            Int?
  replies          Int?
  reposts          Int?
  clicks           Int?
  metricsAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  @@unique([postId, channelAccountId])          // 같은 글을 같은 계정에 두 번 못 올리게
  @@index([channelAccountId, status, scheduledAt])
}
```

- `@@unique([postId, channelAccountId])`가 중복 게시를 막는 최종 안전장치다.
- **[내 판단]** `Post.status`의 의미는 이번 범위에서 바꾸지 않는다. 테스트를 뺀 25개 파일이 `"PUBLISHED"`를 읽는다(쿨다운, 슬롯 판정, 하루 한도, 지표 경보). Threads 발행 결과는 계속 `Post.status`와 Threads `Publication`에 같이 쓴다. `Post.status`를 "검토 상태 전용"으로 바꾸는 일은 4.5의 정리 단계에서 별도 승인으로 한다.
- `mode`가 `manual`인 계정의 게시는 `READY_MANUAL`로 대기하고, 사람이 외부 URL을 넣으면 `PUBLISHED`가 된다.

### 4.3 채널 어댑터

채널마다 파일 하나(`src/lib/channels/<platform>.ts`)로 아래 계약을 구현한다.

```ts
interface ChannelAdapter {
  platform: string;
  accepts(post: SourcePost): boolean;               // 필요한 미디어가 있는가 (예: tiktok·youtube는 영상 필수)
  format(post: SourcePost, account: ChannelAccountView): Promise<FormattedBody>; // 글자 수·링크·해시태그 규칙
  publish(pub: PublicationView, creds: ChannelCredentials): Promise<PublishResult>; // direct/relay만
  fetchMetrics?(pubs: PublicationView[], creds: ChannelCredentials): Promise<MetricsResult[]>;
  refreshCredentials?(account: ChannelAccountView): Promise<ChannelCredentials>;
}
```

- **[내 판단]** `format`은 원본이 채널 한도 안이면 그대로 쓰고, 넘으면 Claude로 줄인다(기존 `claude-text.ts` 재사용). 줄인 글도 기존 품질 게이트의 표면 안전 검사(`enforceGeneratedSurfaceSafety` 계열)를 통과해야 한다.
- 수동 채널은 `accepts`와 `format`만 구현한다.
- Threads와 인스타는 기존 `threads-publisher.ts`와 `instagram-reels-sync.ts`를 감싸는 어댑터로 시작한다. 로직을 새로 짜지 않는다.

### 4.4 흐름

1. 원본 생성, 검토, Threads 발행은 지금과 같다(마켓 단위, `Post`, `/api/cron/publish`). 글 고르기(`pickPublishCandidate`, 11/17 판정 예정인 길이 실험 포함)와 Threads 발행 속도 규칙(조용한 시간, 쿨다운, 랜덤 건너뛰기, 서킷 브레이커, 신뢰 단계별 하루 한도)은 바꾸지 않는다.
2. **Threads 게시가 `PUBLISHED`가 된 직후**, 같은 마켓의 `enabled` 채널 계정 중 `accepts(post)`가 참인 계정마다 `Publication`을 만든다. 상태는 direct/relay면 `QUEUED`, manual이면 `READY_MANUAL`이다. [사용자 결정: Threads 따라가기]
   - 그래서 "승인"이나 "상태 되돌리기"(`regate-pending`의 `ARCHIVED`, 안전 검사의 `NEEDS_REVIEW` 강등)는 다른 채널에 영향을 주지 않는다. Threads에 실제로 나간 글만 따라가기 때문이다.
   - Threads 계정이 멈추면(서킷 브레이커, 하루 한도) 다른 채널도 새 글이 생기지 않는다. 이건 받아들인 트레이드오프다.
   - Threads 글이 나중에 삭제(`ARCHIVED`)되면, 아직 `QUEUED`/`READY_MANUAL`인 다른 채널 게시는 `SKIPPED`로 바꾼다. 이미 올라간 다른 채널 글은 건드리지 않는다. [내 판단]
3. 채널 발행 크론이 `QUEUED` 게시를 채널 계정별 최소 간격·하루 상한·비용 상한을 보고 하나씩 올린다. 하루 개수는 Threads를 따라가므로 자연히 Threads와 같거나 적다. 채널별 설정(`settings`)에는 최소 간격, 하루 상한, (X만) 월 비용 상한만 둔다. [내 판단]
4. 인스타는 이미 이 방식("Threads에 올라간 영상 글 중 3일 안의 글을 하루 1개")이다. 1단계에서는 동작을 그대로 두고 상태 저장만 `Publication`에도 같이 쓴다. 인스타의 후보 고르기(`selectReelCandidate`)를 2번 흐름으로 합칠지는 빌더가 정한다.
5. 지표 크론이 `fetchMetrics`가 있는 채널의 지표를 `Publication`에 모은다.
6. 학습은 마켓 단위다. **1~2단계 동안 학습 입력은 Threads 게시 지표만** 쓴다(지금 동작과 같음). [내 판단] 채널별 학습 분리는 채널마다 72시간 지난 게시가 충분히 쌓인 뒤(예: 30건) 별도 과제로 판단한다.

### 4.5 이전 방법 (무중단)

순서: **확장 → 채우기 → 같이 쓰기 → 읽기 전환 → 정리**. 각 단계는 따로 배포하고, 단계마다 하루 이상 운영으로 확인한다.

1. **확장**: 새 테이블과 칸을 추가한다(기존 칸은 건드리지 않음). DB 마이그레이션은 사용자 승인 후 실행한다.
2. **채우기**: 스크립트로 `BrandGroup`(CosmicPath = `cosmicpath` + `cosmicpath-global`, 나머지는 각자), `ChannelAccount`(기존 Threads·인스타 토큰을 그대로 복사, 이미 암호화된 값은 다시 암호화하지 않음), `Publication`(이미 발행된 Threads·인스타 게시 이력)을 만든다. 다시 돌려도 결과가 같아야 한다(idempotent).
3. **같이 쓰기**: Threads·인스타 발행과 지표 수집이 기존 칸과 `Publication`에 둘 다 쓴다.
4. **읽기 전환**: 발행 대상 선택, 지표, 화면이 `Publication`을 읽는다. 학습 입력도 `Publication`(Threads) 기준으로 바꾸고, 전환 전후 학습 결과가 같은지 비교한다.
5. **정리**: 기존 칸(`Brand.instagram*`, `Post.instagram*`, Threads 전용 칸) 삭제는 **별도 승인**으로 나중에 한다. 이번 범위에서는 삭제하지 않는다.

### 4.6 2단계 채널 (해외 마켓)

| 채널 | mode | 인증 | 확인된 조건 (2026-10-26) | 빌더가 공식 문서로 확인할 것 |
|---|---|---|---|---|
| X | direct | OAuth 2.0 (PKCE, refresh token) | 쓴 만큼 과금. 글 $0.015, 링크 글 $0.20, 최소 금액 없음 ([docs.x.com](https://docs.x.com/x-api/getting-started/pricing)) | 지표 읽기 요금, 토큰 수명 |
| Bluesky | direct | 앱 비밀번호 → 세션 | 승인 불필요 | 게시·요청 한도 |
| LinkedIn 개인 | direct | OAuth 3-legged, `w_member_social` | 셀프서브(3자 출처) | 토큰 수명과 재인증 주기, 개인 글 지표를 API로 읽을 수 있는지 |
| TikTok, YouTube Shorts, Pinterest 등 | manual | 없음 | 감사·심사 부담이 큼 | — |

- X 비용 안전장치: `ChannelAccount.settings`의 월 비용 상한 **$10**. [사용자 결정] 게시마다 예상 비용(글 $0.015, 링크 글 $0.20, 지표 읽기 비용 포함)을 더해 가다 상한을 넘으면 그달 남은 X 게시는 `SKIPPED`(사유 기록)로 처리한다. 링크는 기존 `linkCadenceEvery` 정책을 따르되, 링크를 본문 대신 답글로 넣을지는 빌더가 비용을 계산해 정한다.
- 국내 마켓은 지금처럼 Threads + 인스타다.
- **[내 판단]** 수동 대기열은 영상 글이 실제로 생기는 **국내 마켓**에 먼저 둔다(TikTok, YouTube Shorts). 영상 글은 지금 국내 경로(릴스, `video-jobs`)에서만 생긴다. 해외 마켓 수동 채널은 해외 영상이 생길 때 계정을 추가한다.
- 수동 채널 계정은 사용자가 실제로 운영하는 계정만 만든다. 해당 채널이 받을 수 있는 원본(예: 영상 글)만 대기열에 들어간다.
- 기존 틱톡 대본 초안 기능(`TikTokVideoDraft`, `/brands/[slug]/tiktok`)은 그대로 둔다. 대본을 만드는 도구이고, 수동 대기열은 이미 만든 영상을 올리는 곳이라 역할이 다르다. [내 판단]

### 4.7 화면 (정보 구조만)

- 브랜드 화면: 마켓 탭(국내/해외) + 마켓별 채널 계정 목록(연결 상태, mode, 토큰 만료).
- 글 카드: 채널별 게시 상태 배지(대기/올릴 준비됨/게시됨/실패) + 채널별 링크.
- 수동 대기열: `READY_MANUAL` 목록. 채널별 본문 복사, 미디어 다운로드 링크, "게시 완료" 버튼(외부 URL 입력).
- 채널 연결: X·LinkedIn은 OAuth 시작/콜백 라우트, Bluesky는 핸들 + 앱 비밀번호 입력 폼.
- 시각 디자인은 이 문서 범위 밖이다. 구현 전에 `docs/design/visual-direction.md`를 확인하고, 없으면 사용자에게 레퍼런스를 받는다.

## 5. 제약

- 패키지 매니저는 pnpm. 새 라이브러리는 설치 전에 사용자에게 묻는다. X·Bluesky·LinkedIn은 `fetch`로 직접 호출하는 것을 기본으로 한다.
- DB 스키마 변경, 인증 로직(OAuth 라우트), git push는 사용자 승인 후 실행한다.
- 비밀값은 `.env.local`에만 둔다. X·LinkedIn 앱 클라이언트 ID/시크릿은 환경 변수, 계정 토큰은 DB에 암호화해서 저장한다.
- 크론은 Vercel Hobby 제약(하루 1회) 때문에 Cloudflare Worker / GitHub Actions에서 호출한다. 새 발행 라우트도 같은 방식으로 붙인다.
- 크론 호출은 `CRON_SECRET` Bearer 인증을 쓴다(`src/lib/cron-auth.ts`).

## 6. 단계와 완료 기준

| 단계 | 끝났다고 보는 기준 |
|---|---|
| 1. 구조 정리 + 이전 | 새 구조에서 Threads 국내(하루 5슬롯)·해외(하루 2슬롯)와 인스타 릴스가 연속 2일 정상 발행되고 중복 0건. 전환 전후 학습 결과와 글 고르기(길이 실험 포함) 일치. `pnpm test`, `pnpm typecheck`, `pnpm build` 통과 |
| 2. 해외 채널 + 수동 대기열 | `cosmicpath-global`에 X·Bluesky·LinkedIn 개인이 연결되고, 해외 Threads에 올라간 글이 세 채널로 따라 올라감. X 월 $10 상한에서 `SKIPPED` 처리 확인(테스트). 국내 마켓 수동 채널(TikTok·Shorts)에 영상 글이 `READY_MANUAL`로 뜨고 "게시 완료" 처리가 됨. 화면은 스크린샷으로 확인 |
| 3. 중계 API (나중) | 수동 채널 하나를 `relay`로 바꿔도 다른 코드 수정 없이 자동 발행됨. 별도 설계 |

## 7. 빌더에게 맡기는 것

- 칸 이름, 인덱스, 마이그레이션 파일 분할.
- 어댑터 파일 구조와 기존 Threads·인스타 코드를 감싸는 방식.
- 새 발행 크론을 기존 `/api/cron/publish`에 합칠지, 채널 공통 라우트로 뺄지.
- X 링크 처리 방식(본문 vs 답글)과 Claude 축약 프롬프트.
- 단계 1의 "학습 결과 일치" 비교 방법.
