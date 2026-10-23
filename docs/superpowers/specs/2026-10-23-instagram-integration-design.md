# Instagram 연동 설계 (릴스 교차 발행 + 인스타 전용 캐러셀)

- 작성일: 2026-10-23
- 브랜치: `feat/instagram-integration`
- 상태: 사용자 최종 승인 대기

## 1. 왜 하는가

CosmicPath는 지금 Threads 하나로만 유입을 만든다. 인스타 계정을 새로 키워 **팔로워와 매출이 나오는 두 번째 채널**을 만든다.
성공 = 3개월 뒤 인스타 팔로워가 꾸준히 늘고, 인스타발 유입이 CosmicPath 결제로 이어지는 것이 숫자로 보이는 것.

인스타는 Threads와 두 가지가 다르다.
1. 게시물에 이미지·영상이 반드시 있어야 한다. 텍스트만 있는 Threads 글은 그대로 못 간다.
2. 캡션·댓글 링크는 클릭되지 않는다. 사이트로 보내는 길은 **프로필(바이오) 링크**뿐이다.

## 2. 목표 / 비목표 / 반목표

**목표**
- 1단계: 인스타 계정 OAuth 연결 + Threads에서 발행된 **릴스를 인스타 릴스로 자동 교차 발행**.
- 2단계: **인스타 전용 캐러셀**을 자동 생성 → 대시보드 검토·승인 → 자동 발행.
- 인스타발 매출을 Threads와 분리해서 볼 수 있게 한다 (바이오 링크 UTM → 기존 `ConversionEvent`).

**비목표 (이번에 안 함)**
- 인스타 지표(조회·저장·공유) 수집과 학습 루프 연결 → 3단계.
- 스토리, 댓글 자동 답글, DM 자동화.
- X·TikTok·YouTube 연동.
- Threads 텍스트 글을 캐러셀로 자동 변환 (캐러셀은 인스타 전용으로 따로 기획한다는 결정).
- 여러 인스타 계정을 가진 멀티테넌트 구조. 브랜드당 인스타 계정 1개.

**반목표 (기술적으로 돌아가도 실패로 보는 것)**
- 새 계정이 첫 주부터 자동으로 많이 올려서 제재·도달 제한을 받는 것.
- 인스타 쪽 오류가 Threads 발행을 막거나 늦추는 것. Threads 발행 경로는 건드리지 않는다.
- 댓글 키워드 → 자동 DM 퍼널 (이전에 기각된 방식).
- 영어 SaaS 느낌이나 타로 느낌의 캐러셀. 최근 릴스와 같은 사주 톤이어야 한다.

## 3. 사전 조건 (사람이 할 일)

- 사용자가 CosmicPath 인스타 계정을 직접 만들고 **프로페셔널(비즈니스/크리에이터) 계정**으로 전환한다.
- 인스타 연결 후 설정 페이지에 나오는 바이오 링크(§8)를 인스타 프로필에 붙여넣는다.
- Meta 개발자 앱에 Instagram 제품을 추가하고, 리디렉트 URI를 등록한다. 필요한 권한·심사 범위는 §9 참고.

## 4. 결정 사항 (사용자가 정한 것)

| 항목 | 결정 |
|---|---|
| 콘텐츠 | 릴스(기존 렌더 재활용) + 인스타 전용 캐러셀 |
| 릴스 승인 | Threads에서 승인·발행되면 인스타에도 **자동**으로 올라간다. 별도 승인 없음 |
| 캐러셀 소재 | Threads 글 변환이 아니라 **인스타용으로 따로** 기획·생성 |
| 매출 경로 | 콘텐츠 → 프로필 → 바이오 링크(UTM) → CosmicPath 결제 |
| 순서 | 1단계 연결+릴스, 2단계 캐러셀, 3단계 지표 |

## 5. 1단계: 연결 + 릴스 교차 발행

### 5.1 OAuth 연결
- `src/app/api/oauth/instagram/start`, `.../callback` 라우트를 기존 `src/app/api/oauth/threads` 패턴 그대로 만든다.
- 흐름: 인가 코드 → 단기 토큰 → 장기 토큰 교환 → 인스타 사용자 ID 조회 → `crypto.encrypt`로 암호화해 `Brand`에 저장.
- 로직은 `src/lib/instagram-oauth.ts`에 둔다 (`threads-oauth.ts`와 같은 모양: `isRecord`로 응답을 좁히는 방식, `any` 금지).
- 브랜드 설정 페이지(`/brands/[slug]/settings`, Threads 콜백이 돌아오는 곳)에 "인스타 연결" 버튼과 연결 상태(계정명, 토큰 만료일, 만료 시 "재연결 필요")를 보여준다. 콜백은 `?instagram=connected`로 같은 페이지에 돌아온다.

### 5.2 토큰 갱신
- 기존 `src/app/api/cron/refresh-token/route.ts`(GitHub Actions에서 하루 1회 호출)의 브랜드 루프에 인스타 토큰 갱신을 추가한다. 만료 임박이면 갱신, 갱신 실패 시 `sendSystemAlert`.
- 이미 만료된 경우: 별도 상태 컬럼을 두지 않는다. 설정 페이지가 `instagramTokenExpiry < now`면 "재연결 필요"로 보여주고, 발행 cron은 해당 브랜드를 건너뛴다. 만료를 처음 발견한 날 `sendSystemAlert`를 한 번 보낸다. (Threads 쪽은 지금 응답 JSON에만 `needsReconnect`를 넣고 알림이 없다 — 이번 범위에서 고치지 않는다.)

### 5.3 릴스 교차 발행
- **Threads 발행 라우트(`/api/cron/publish`)는 수정하지 않는다.** 인스타는 별도 라우트 `/api/cron/instagram-publish`가 맡는다.
- 대상 선택: 인스타가 연결된 브랜드의 `Post` 중
  - `status = "PUBLISHED"`이고
  - `imageUrls`에 영상 URL이 있고 (`isVideoMediaUrl` 재사용)
  - `instagramStatus`가 비어 있고
  - `publishedAt`이 **인스타 연결 시각 이후**인 글 (과거 릴스를 한꺼번에 올리지 않기 위해).
- 같은 cron이 겹쳐 돌아도 이중 발행이 없게, 대상 글은 `updateMany({ where: { id, instagramStatus: null } , data: { instagramStatus: "PROCESSING" } })`처럼 **원자적으로 선점**한 뒤 처리한다 (count가 0이면 다른 실행이 가져간 것). 캐러셀도 같은 방식.
- 처리는 영상 처리 시간 때문에 **두 틱에 나눠서** 한다 (Vercel 함수 시간 제한 회피):
  1. 틱 A: 릴스 컨테이너 생성 → `instagramContainerId` 저장, `instagramStatus = "PROCESSING"`.
  2. 다음 틱: 컨테이너 상태 확인 → 완료면 `media_publish` → `instagramMediaId`, `instagramPublishedAt` 저장, `"PUBLISHED"`. 처리 중이면 다음 틱에 다시. 오류·만료면 재시도 카운트를 올리고 3회 실패 시 `"FAILED"` + 시스템 알림(`sendSystemAlert`).
- 캡션 = `post.content` + 빈 줄 + 브랜드 설정의 인스타 캡션 꼬리말(§5.4). Threads 첫 댓글(`firstComment`)의 링크는 인스타로 가져가지 않는다.
- 하루 한도(§5.5)에 걸리면 `instagramStatus`를 비운 채로 두고 다음 날 다시 시도한다. 단, Threads 발행 후 3일이 지나면 `"SKIPPED"`로 정리한다 (오래된 릴스가 밀려 올라가지 않게).
- 스케줄: `cloudflare/scheduler/worker.js`의 `*/15 * * * *` 목록에 `/api/cron/instagram-publish?brands=cosmicpath`를 추가한다. GitHub Actions `cron.yml`에는 추가하지 않는다 (호출원은 하나만).

### 5.4 브랜드 설정
`Brand.brandConfig`(JSON)에 `instagram` 객체를 추가한다. DB 컬럼 추가 아님. `parseBrandConfig`는 필드를 골라 담으므로 타입과 파서에 `instagram`을 직접 추가해야 한다 (저장은 `serializeBrandConfigUpdate`가 병합해서 보존됨).

```ts
instagram?: {
  captionSuffix: string;   // 예: "내 사주 맛보기 리포트는 프로필 링크에서 1분이면 나와 ✦\n#사주 #오늘의운세"
  carouselDailyCap: number;  // 기본 1. 사용자가 직접 올린다 (램프업)
  publishHoursKst: number[]; // 캐러셀 발행 허용 시각. 기본 [12, 20]
  bioAnchorPostId?: string;  // §8 바이오 링크 기준 글 id. OAuth 연결 시 자동 생성
}
```

### 5.5 새 계정 보호 (램프업)
- **릴스와 캐러셀은 한도를 따로 센다** (사용자 결정). 인스타 하루 최대 = 릴스 1 + 캐러셀 `carouselDailyCap`(기본 1) = 2개.
  - 릴스: 브랜드당 하루 1개. `queue-reels.mjs`가 이미 하루 한 편만 등록하지만, 인스타 쪽에서도 같은 날 이미 올린 릴스가 있으면 다음 날로 넘긴다.
  - 캐러셀: 하루 `carouselDailyCap`개. 릴스 발행 여부와 무관.
- **하루 기준은 KST 0시** (사용자 결정). 기존 `startOfPublishDay` 계산을 재사용한다.
- 자동 증가 로직은 만들지 않는다. 2~3주 지켜본 뒤 사용자가 `carouselDailyCap`을 올린다. (`account-trust-ramp`처럼 자동화하는 건 필요해지면 나중에.)
- 발행 직전에 인스타 API의 게시 한도 조회 엔드포인트로 남은 한도를 확인하고, 0이면 건너뛴다.

## 6. 2단계: 인스타 전용 캐러셀

### 6.1 생성
- `/api/cron/instagram-carousels` (하루 1회)가 브랜드별로 검토 대기 캐러셀이 3개 미만일 때만 1개를 새로 만든다.
- 생성은 Anthropic SDK를 직접 호출하는 코드를 새로 쓴다 (`claude-text.ts`는 모델 상수와 응답 텍스트 추출 함수뿐이라 그것만 재사용). 출력은 구조화 JSON:
  - 표지 1장 (훅 제목 + 부제)
  - 본문 3~6장 (제목 + 짧은 본문, 장당 2~4줄)
  - CTA 1장 ("프로필 링크에서 내 사주 확인" 류)
  - 캡션, 주제(topic)
- 응답은 타입 가드로 검증하고, 실패하면 1회 재생성 후 포기한다.
- 주제 중복 방지: 최근 캐러셀 20개의 `topic`을 프롬프트에 "피할 주제"로 넘기고, 생성된 topic이 그중 하나와 정확히 같으면 재생성한다. (`topic-saturation-guard`는 특정 마커·상황 빈도만 보는 도구라 여기 쓰지 않는다.)
- 문체: Threads의 말하는 투가 아니라, 저장하고 싶어지는 정보 카드 톤. 브랜드 보이스(`brand-profile`)는 그대로 따른다.

### 6.2 이미지 렌더
- `next/og`의 `ImageResponse`로 슬라이드를 그리는 라우트: `/api/cards/instagram/[id]/[index]`. 크기 1080×1350 (4:5). 기존 공개 카드 라우트 `src/app/api/cards/[id]/route.tsx` 옆에 둔다.
- 접근: `src/proxy.ts`는 `/api/cards`를 공개 경로로 둔다. 인스타가 가져가야 하므로 공개로 두되, `NEEDS_REVIEW`·`ARCHIVED` 캐러셀은 로그인 세션이 있을 때만 보여준다 (대시보드 미리보기용). 승인된 것만 누구나 볼 수 있다.
- 인스타 캐러셀은 **JPEG만** 받는데 `ImageResponse`는 PNG를 낸다. 라우트에서 PNG → JPEG 변환이 필요하다 (방법은 §13 미결 사항).
- 인스타는 이 라우트 URL을 직접 가져가므로, 같은 id·index면 항상 같은 이미지가 나와야 한다 (승인 후 슬라이드 수정 불가).
- 한글 폰트(Pretendard 등)는 저장소에 폰트 파일을 넣고 라우트에서 읽는다.
- 템플릿은 2~3종으로 시작 (표지 / 본문 / CTA). 팔레트·타이포는 최근 사주 톤 릴스와 맞춘다. 기존 `src/lib/carousel-cards`(영어 SaaS 예시)는 쓰지 않는다.
- **시안 먼저:** 2단계 구현 전에 템플릿 시안을 사용자에게 보여주고 승인받는다.

### 6.3 검토·승인
- 대시보드에 "인스타 캐러셀" 섹션을 추가: 검토 대기 목록, 슬라이드 미리보기(렌더 라우트 이미지), 캡션, [승인] [보관] 버튼.
- 승인하면 `APPROVED`. 발행 cron(§5.3과 같은 `/api/cron/instagram-publish`)이 `publishHoursKst` 시각대에 한도 안에서 발행한다.

### 6.4 발행
- 슬라이드마다 캐러셀 아이템 컨테이너 생성 → 캐러셀 컨테이너 생성 → 상태 확인 → `media_publish`.
- 릴스와 같은 두 틱 방식, 같은 재시도·실패 규칙.

## 7. 데이터 모델 변경 (승인 필요)

Threads 쪽 쿼리(리필 백로그, 쿨다운, 일일 한도, 지표 학습)가 인스타 전용 콘텐츠를 보지 않도록, **캐러셀은 `Post`가 아닌 별도 테이블**에 둔다. 릴스 교차 발행 상태만 `Post`에 붙인다.

```prisma
model Brand {
  // ...기존
  instagramAccessToken  String?   // crypto.encrypt로 암호화
  instagramUserId       String?
  instagramUsername     String?
  instagramTokenExpiry  DateTime?
  instagramConnectedAt  DateTime?
  instagramCarousels    InstagramCarousel[]
}

model Post {
  // ...기존
  instagramStatus       String?   // null | PROCESSING | PUBLISHED | FAILED | SKIPPED
  instagramContainerId  String?
  instagramMediaId      String?
  instagramPublishedAt  DateTime?
  instagramAttempts     Int       @default(0)
  instagramError        String?

  @@index([brandId, instagramStatus])
}

model InstagramCarousel {
  id                String    @id @default(cuid())
  brandId           String
  brand             Brand     @relation(fields: [brandId], references: [id], onDelete: Cascade)
  status            String    @default("NEEDS_REVIEW") // NEEDS_REVIEW | APPROVED | PROCESSING | PUBLISHED | FAILED | ARCHIVED
  topic             String
  caption           String
  slides            String    @default("[]") // JSON: [{ kind: "cover"|"body"|"cta", title, body? }]
  containerId       String?
  mediaId           String?
  attempts          Int       @default(0)
  errorLog          String?
  approvedAt        DateTime?
  publishedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([brandId, status])
  @@index([brandId, publishedAt])
}
```

- 모든 새 컬럼은 nullable이거나 기본값이 있어서 기존 데이터·코드에 영향이 없다.
- 기존 JSON-in-String 컨벤션(`imageUrls`, `brandConfig`)을 따른다.

## 8. 매출 추적
**현재 구조:** `src/app/api/webhooks/conversion/route.ts`는 `postId`/`pid`가 없으면 400으로 버리고, UTM·출처는 저장하지 않는다. CosmicPath 사이트는 Threads 링크의 `pid`를 받아 이 웹훅으로 넘긴다.

**방식: 바이오 기준 글 (사용자 결정)**
- 인스타 OAuth 연결 시 브랜드마다 `Post` 한 행을 "인스타 바이오 기준 글"로 만든다: `status = "ANCHOR"`, `postCategory = "INSTAGRAM_BIO"`, `content = "[instagram bio anchor]"`, `scheduledAt = 생성 시각`. id는 `brandConfig.instagram.bioAnchorPostId`에 저장. 이미 있으면 재사용.
- 바이오 링크 = `buildTrackedUrl(<CosmicPath>/start, { postId: 기준 글 id, source: "instagram" })`. 설정 페이지에 복사 버튼과 함께 보여준다. 지금 `buildTrackedUrl`은 `utm_source`를 항상 `"threads"`로 박으므로, `params.source`가 있으면 그 값을 쓰도록 고친다 (기존 호출은 source를 안 넘기니 동작 동일).
- 결과: 인스타발 결제가 기존 웹훅 경로 그대로 기준 글에 쌓인다. 사이트·DB 스키마 수정 없음. 대시보드는 기준 글의 `clicks`/`conversions`를 "인스타 합계"로 보여준다.
- **필수 확인:** `status = "ANCHOR"` 글이 Threads 쪽 어떤 쿼리에도 잡히지 않아야 한다. 구현 시 `prisma.post.findMany/findFirst/count/aggregate` 중 status 조건이 없거나 `not`/`notIn`으로 거르는 곳을 전부 찾아 확인하고, 필요한 곳에 제외 조건을 넣는다 (리필 백로그, 쿨다운, 지표 수집, 학습, anti-repeat 메모리, 대시보드 목록).
- 한계: 인스타 전체 합계만 보인다. 게시물 단위 귀속은 3단계에서 다시 본다.

## 9. 외부 API 제약 (Instagram Graph API)

2026-10 Meta 공식 문서 기준 조사 결과. "확인 필요" 표시는 실제 계정으로 첫 호출 때 검증한다.

- **방식:** Instagram API with Instagram Login. 호스트 `graph.instagram.com`, 버전 `v26.0`. Facebook Page 불필요.
- **권한:** `instagram_business_basic`, `instagram_business_content_publish`. 앱 소유자 본인 계정만 쓰므로 Standard Access로 충분하고 App Review 불필요 (확인 필요). 앱은 Business 타입.
- **토큰:** 인가 code(1시간, 1회용) → `POST api.instagram.com/oauth/access_token`으로 단기 토큰(1시간) → `GET graph.instagram.com/access_token?grant_type=ig_exchange_token`으로 장기 토큰(60일). 갱신은 `GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`, 발급 후 24시간 이상 지나고 아직 유효할 때만 가능. 만료되면 재연결밖에 없다.
- **릴스:** `POST /<IG_ID>/media` (`media_type=REELS`, `video_url`, `caption`, `share_to_feed=true`) → `GET /<CONTAINER_ID>?fields=status_code` (`IN_PROGRESS` / `FINISHED` / `ERROR` / `EXPIRED`(24시간 안에 게시 안 하면) / `PUBLISHED`) → `POST /<IG_ID>/media_publish` (`creation_id`). Instagram Login에서는 `video_url` 방식만 된다.
- **영상 규격:** MP4/MOV, H.264, AAC, 23~60fps, 3초~15분, 300MB 이하, 9:16 권장, **moov atom이 파일 앞쪽**에 있어야 한다. Remotion 출력이 이 조건(faststart)을 만족하는지 1단계 첫 작업에서 확인하고, 아니면 `queue-reels.mjs` 업로드 전에 `-movflags +faststart`로 다시 감싼다.
- **캐러셀:** 아이템마다 `is_carousel_item=true` 컨테이너 → `media_type=CAROUSEL` + `children=...` 컨테이너 → `media_publish`. 2~20장. **이미지는 JPEG만**, 8MB 이하, 너비 320~1440px, 비율 4:5~1.91:1. 첫 장 비율로 전체가 맞춰진다. 캡션은 캐러셀 컨테이너에만.
- **한도:** 24시간 이동 창 기준 게시 수 제한 (캐러셀 = 1건). 문서마다 50/100으로 엇갈리니 하드코딩하지 말고 `GET /<IG_ID>/content_publishing_limit?fields=quota_usage,config`로 매번 확인 (응답 구조는 확인 필요). 어차피 우리 `dailyCap`이 훨씬 낮다.
- **캡션:** 2,200자, 해시태그 30개 이하. 캡션 링크는 클릭되지 않는다 (공식 문서엔 언급 없음, 일반적으로 알려진 동작).
- **확인 못 한 것:** Threads용 Meta 앱에 Instagram 제품을 추가해 재사용할 수 있는지. 안 되면 앱을 새로 만든다 (`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`은 `.env.local`/Vercel 환경변수에만).

## 10. 문서 갱신
- `docs/api-spec.md` Non-goals의 "X/Instagram 외부 플랫폼 연동"을 수정하고, 새 라우트(OAuth 2개, cron 2개, 캐러셀 렌더·승인 API)를 명세에 추가한다. 구현 전에 먼저 반영한다 (CLAUDE.md: api-spec이 단일 진실 공급원).
- `docs/ops/external-scheduler.md`에 인스타 cron 추가를 기록한다.

## 11. 완료 기준
- 1단계: 실제 인스타 계정에 Threads 릴스 1편이 자동으로 올라가고, `Post.instagramStatus = PUBLISHED`. 인스타 API를 일부러 실패시켜도 Threads 발행은 영향 없음(테스트). 하루 한도·3일 SKIPPED·원자적 선점 테스트 통과. 바이오 링크 클릭 → 기준 글 `clicks` 증가 확인. `ANCHOR` 글이 Threads 쿼리에 안 잡히는지 테스트.
- 2단계: 생성된 캐러셀 1개를 대시보드에서 미리보고 승인 → 실제 인스타에 캐러셀로 게시.
- 각 단계 `pnpm test` 통과, 새 로직마다 테스트 포함.

## 12. 빌더에게 맡기는 것
- 파일·함수 분리, 테스트 구조 (기존 `*.test.ts` 옆 배치 관례 따름).
- 대시보드 UI의 세부 배치 (기존 `Dashboard.tsx`, `PostCard.tsx` 스타일 따름).
- 캐러셀 생성 프롬프트 문구.

## 13. 의존성
- `sharp`를 `package.json` 명시 의존성으로 추가한다 (사용자 승인 완료). Next.js가 이미 설치해 둔 라이브러리라 번들 부담은 거의 없다. 용도: 캐러셀 슬라이드 PNG → JPEG 변환. 설치는 `pnpm add sharp`.
