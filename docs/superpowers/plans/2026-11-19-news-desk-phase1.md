# 뉴스 데스크 Phase 1 계획 (승인됨 2026-11-19)

## Context
- 사용자가 SNS_Auto(AI 코워크 v1.1) 스크린샷을 레퍼런스로 줬어. 기사 하나를 넣으면 팩트를 뽑고, 플랫폼별 원고를 만들고, 승인을 받은 뒤 여러 플랫폼에 한 번에 배포하는 도구야.
- 요청: "비슷한 것"이 아니라 제대로 된 기능으로 만든다. 팔지 않더라도 이걸로 대표 콘텐츠(콘텐츠 플라이휠, `ai-company/docs/DIRECTION.md` 11-18)를 돌릴 수 있게.
- 어디에 만드나: **threads-uploader 안의 새 모듈.** 이미 있는 배포 엔진(`ChannelAccount`/`ChannelUpload`/`runner.ts`/어댑터), 토큰 암호화, Claude 호출(`claude-text.ts`), Threads 자격증명·에러 분류·안전 게이트를 재사용해. 새 저장소로 만들면 이걸 전부 다시 만들어야 해.
- PIPELINE 순서: 1단계 PRD는 스크린샷과 이번 조사로 이 문서에 대신 채웠어(show-me-the-prd 인터뷰 생략). 승인되면 `PRD/news-desk/` 5종 + `docs/superpowers/plans/2026-11-19-news-desk-phase1.md`로 저장하고 3단계(디자인) → 4단계(구현)로 가.

## 플랫폼별 가능 범위 (공식 문서로 확인)
| 플랫폼 | 자동 발행 | 근거 | 결정 |
|---|---|---|---|
| 텔레그램 채널 | 가능 | Bot API: 글 1-4096자, 캡션 0-1024자, 미디어 그룹 2-10개, URL로 보낼 때 사진 5MB까지 (core.telegram.org/bots/api, 11-19 확인) | **Phase 1** |
| Threads | 가능 | 기존 발행 코드(`threads-api.ts:654`)와 같은 Graph API | **Phase 1**, 새 어댑터 |
| 카카오톡 단체방·오픈채팅 | **불가** | 카카오 데브톡 공식 답변: 단체방 자동 전송 API 없음, 자동화는 정책 위반 | **Phase 1: 복사 모드** |
| 링크드인 개인 | 가능 | Posts API `POST /rest/posts`, `w_member_social`(셀프서비스), 멀티 이미지 지원. 댓글은 `w_member_social_feed` 필요, 셀프서비스 여부 미확인 (추측: 심사 필요) | Phase 2 |
| 페이스북 개인 피드 | **불가** | 2018년 `publish_actions` 폐지 (서드파티 가이드 여러 곳. Meta 공식 문서는 직접 못 열어봄) | Phase 2: **페이스북 페이지**로 대체 |
| X | 가능 (글만, 이미 있음) | `adapters/x.ts` | 범위 밖 |

## 단계 (Phases)
- **Phase 0 (사용자):** Vercel 402 해결. 안 풀리면 운영 배포를 못 해 (Blob도 막히는지는 추측).
- **Phase 1 (이번 계획):** 뉴스 데스크 화면 + 기사 수집·팩트 추출 + 플랫폼별 원고·승인 + 이미지 5장 + 텔레그램·Threads 발행 + 카카오 복사 모드.
- **Phase 2:** 링크드인 개인 + 페이스북 페이지 + 발행 후 자동 댓글(Threads 포함). 댓글 칸과 `ChannelUpload.comment` 컬럼은 이때 추가.
- **Phase 3:** "AI 뉴스 자동 수집"(RSS 후보 → 클릭 한 번에 데스크로), 영상 첨부, 예약 발행.
- Phase 2·3은 시작할 때 plan mode로 따로 계획해.

## Phase 1 상세

### 사용자 흐름
1. `/brands/[slug]/newsdesk` 열기 (대시보드 헤더에 링크).
2. 왼쪽 입력
   - 기사 URL **또는** 원문 붙여넣기
   - "AI 가공 없이 원문 그대로" 체크, 운영자 메모
   - 이미지 최대 5장 (PNG/JPEG, 장당 5MB. Ctrl+V 연속 붙여넣기, 드래그, 파일 선택. 순서 = 전송 순서)
   - 같은 URL로 만든 기사가 있으면 경고 + 링크
3. [원고 만들기] → 오른쪽에 팩트 목록(근거 인용 + "원문에서 확인됨/못 찾음") + 플랫폼 탭(텔레그램·Threads·카카오).
4. 탭마다 원고 수정(글자 수/한도) → [승인] 또는 [전체 일괄 승인]. 승인 뒤 글이나 이미지를 바꾸면 승인이 풀려(Rev 올라감).
5. [발행] → 승인된 플랫폼만 나가. 카카오는 [복사] → [보냈어].
6. 탭마다 상태(대기/올라가는 중/완료+링크/실패+사유) 표시. 대기 중이면 [취소], 처리 중이면 5초마다 진행 요청(최대 2분, 그 뒤는 cron이 이어받음).

### 데이터 (승인 필요 — 새 테이블 2개, 기존 테이블은 Brand 관계 줄만)
```prisma
model NewsItem {
  id           String   @id @default(cuid())
  brandId      String
  brand        Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  sourceUrl    String?             // normalizeUrl로 정리한 값
  sourceTitle  String?
  sourceText   String              // 긁어온 본문 또는 붙여넣은 원문 (최대 20,000자)
  rawMode      Boolean  @default(false)
  operatorNote String?
  facts        String   @default("[]")  // JSON [{ text, evidence, verified }]
  media        String   @default("[]")  // JSON [{ url, sha256, name, bytes }] 최대 5개, Blob URL만
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  variants     NewsVariant[]
  @@index([brandId, createdAt])
  @@index([brandId, sourceUrl])
}

model NewsVariant {
  id               String    @id @default(cuid())
  newsItemId       String
  newsItem         NewsItem  @relation(fields: [newsItemId], references: [id], onDelete: Cascade)
  platform         String    // telegram | threads | kakao (Phase 2: linkedin | facebook)
  text             String
  revision         Int       @default(1)
  approvedRevision Int?      // revision과 같을 때만 "승인됨"
  approvedAt       DateTime?
  lockedAt         DateTime? // 발행 시작(카카오는 "보냈어") 시각. 잠긴 동안 수정·재승인 불가
  manualDoneAt     DateTime? // kakao: "보냈어" 누른 시각
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  @@unique([newsItemId, platform])
}
// Brand: newsItems NewsItem[]  (관계 줄만)
```
- 마이그레이션 SQL은 `npx prisma migrate diff`로 오프라인에서 만들어. 맨 위에 기존 관례대로 `SET lock_timeout = '5s';`를 넣어(`prisma/migrations/20261110000000_add_wellness_media/migration.sql:1`).
- `migrate deploy`는 **PR 머지 전에** 돌려. 추가만이라 옛 코드는 영향이 없어. 실행 직전에 한 번 더 확인받을게.

### 규칙 (중복 발행·안 본 글 승인 방지) — 전부 `src/lib/newsdesk/approval.ts` 한 곳에서만 씀
- **원고 글을 바꾸는 유일한 함수**가 `revision+1`을 같이 해. AI 재생성도 이 함수를 거쳐. DB 트리거 대신 모듈 하나 + 테스트로 지켜 (트레이드오프).
- **승인**: 화면에서 본 `revision`을 보내고 `updateMany where {id, revision, lockedAt: null}`일 때만 승인.
- **글 수정**: `updateMany where {id, lockedAt: null}`.
- **이미지 변경**
  - 잠긴 원고가 하나라도 있으면 거부해 ("이미 발행된 플랫폼이 있어서 이미지를 못 바꿔")
  - 아니면 한 트랜잭션 안에서 media를 바꾸고 모든 원고의 `revision+1`
- **발행** (플랫폼마다)
  1. 계정 확인을 먼저 해: 텔레그램 행 있음 + enabled, Threads 연결됨. 없으면 잠그기 전에 에러
  2. 원고와 media를 읽어
  3. 한 트랜잭션 안에서 처리해. 행 생성이 실패하면 잠금도 같이 롤백돼서 풀 방법 없는 잠김이 안 생겨
     - `updateMany where {id, lockedAt: null, revision: 읽은값, approvedRevision: 읽은값}` → `lockedAt=now`
     - 업로드 행 생성 (`sourceKey = "news:<newsItemId>"`, caption = 원고, mediaUrls = 읽은 media, `scheduledAt` = 실행에 넘길 같은 `now`)
  4. 기존 행이 FAILED/CANCELED면 `updateMany where {id, status in [FAILED, CANCELED]}`로만 다시 넣어. 초기화 대상: caption, media, attempts 0, platformData `{}`, externalId·externalUrl·errorLog null, QUEUED
     - 0건이면(그사이 누가 다시 보냄) 롤백하고 "이미 다시 보내졌어"
- **잠금 해제**: 활성 업로드 행이 없을 때(행 없음 또는 FAILED/CANCELED)만 [잠금 해제] 버튼이 보여. 경고 문구는 "실패 사유 확인: 실제로는 올라갔을 수 있어"야.
- **대기 취소**: QUEUED 행은 뉴스 데스크에서 [취소] → CANCELED (기존 `applyUploadAction` 재사용).
- **모닝 리포트 [재시도] 막기**: `controls.ts`의 retry가 `sourceKey`가 `news:`로 시작하면 거부해 ("뉴스 데스크에서 다시 보내줘"). 승인 상태를 우회해서 옛 글·옛 이미지로 나가는 걸 막는 거야.
- **카카오**: 승인된 원고만 [복사]가 켜져. [보냈어]는 `lockedAt`도 같이 찍어서, 그 뒤 수정으로 보낸 기록이 바뀌지 않게 해.

### 새 파일
- `src/lib/newsdesk/scrape.ts`: 기사 가져오기 (새 라이브러리 없이)
  - SSRF 방어: http/https만, `dns.lookup`으로 사설·루프백·링크로컬 IP 차단, 리다이렉트는 직접 따라가며(최대 3번) 매번 다시 검사
  - 제한: 10초, 3MB, HTML만
  - 인코딩: content-type/meta charset을 보고 `TextDecoder`로 (euc-kr 언론사)
  - 추출: og:title/og:image/og:description → `<article>` → 없으면 전체 `<p>`
  - 200자 미만이면 "본문을 못 읽었어. 원문을 붙여넣어 줘"
  - `normalizeUrl` 재사용 (`src/lib/wellness/articles.ts:14`)
- `src/lib/newsdesk/compose.ts`: Claude 1회 호출로 팩트 + 플랫폼별 원고 JSON
  - `src/lib/wellness/draft.ts` 패턴, `CLAUDE_TEXT_MODEL`, `readMessageText`, `extractJsonObject`(`llm-judge.ts:26`) 재사용
  - rawMode면 AI 없이 원문을 그대로 넣어
- `src/lib/newsdesk/verify.ts`: 승인 전 검사
  - 팩트 `evidence`가 원문에 있는지 (공백 정규화 후 포함 여부)
  - 원문에 없는 숫자가 원고에 있으면 경고
  - 한도
    - 텔레그램: 이미지 있으면 1024자, 없으면 4096자 (JS `.length` 기준. UTF-16으로 세서 이모지를 넉넉하게 잡음)
    - Threads: `getThreadsContentLimitError(text, { allowMultiPart: false })` 재사용 (`src/lib/threads-limits.ts:7`)
  - Threads 안전 게이트: `getPublishSafetyBlockReasons`(`src/lib/publish-safety-gate.ts:32`)를 `postCategory: "NEWS"`와 브랜드 계정 상태로 불러. 섀도우밴 의심이면 뉴스·링크 발행을 막아 (cron 발행이 쓰는 것과 같은 계정 상태 조회를 재사용)
  - 걸리면 승인 버튼을 막아
- `src/lib/newsdesk/approval.ts`: 위 규칙
- `src/lib/distribution/adapters/telegram.ts`: kind `"post"`. **업로드 하나당 API 호출 1번**
  - 0장 `sendMessage` / 1장 `sendPhoto` / 2-5장 `sendMediaGroup`(첫 항목에 캡션)
  - parse_mode는 안 써 (일반 텍스트). 글만 보낼 때 링크 미리보기는 켜 둬 (트레이드오프, 화면에 "링크 미리보기 이미지가 붙을 수 있어" 표시)
  - 에러 분류
    - 요청 전 에러 → 일반 에러
    - **요청을 보낸 뒤 생기는 에러는 전부 영구 실패야** (응답 파싱 실패, 이상한 응답 모양 포함). 예외는 두 가지뿐이야
      - `{ok:false}` + 429 → 일시 오류 (재시도)
      - `{ok:false}` + 400/403 → 영구 실패, description 기록
    - 그 밖(타임아웃·네트워크·5xx·파싱 실패) → 영구 실패 "전송 여부 확인 필요"
  - **봇 토큰이 들어간 URL은 에러 메시지·로그에 절대 안 넣어** (errorLog·시스템 알림으로 새는 걸 막음, 테스트로 확인)
  - `externalUrl = https://t.me/<username>/<message_id>` (공개 채널)
- `src/lib/distribution/adapters/threads.ts`: kind `"post"`. 컨테이너 생성(start)과 발행(poll)을 나눠
  - `start()`: 컨테이너만 만들어(TEXT / IMAGE / CAROUSEL). 발행 전 컨테이너는 다시 만들어도 무해해. `processing` + `{...job.platformData, containerId}`, `retryAfterMs: 3000`
  - `poll()`: 먼저 컨테이너 상태를 봐. 기존 답글 코드(`threads-api.ts:750-757`)와 같은 방식이야
    - `PUBLISHED` → 이미 올라감: 발행 안 하고 `published`
    - `ERROR`/`EXPIRED` → `retryFromStart` (아무것도 안 나갔으니 안전)
    - 처리 중 → `processing`
    - `FINISHED` → `threads_publish`
  - 에러 처리
    - 발행 호출을 보낸 뒤의 에러는 `classifyThreadsError`(`threads-api.ts:65`)가 `"retry"`(레이트리밋 4/17/32/613, 4279009)일 때만 일시 오류야. 나머지는 영구 실패 "전송 여부 확인 필요"
    - 다음 poll도 상태부터 보니까, 함수가 발행 직후 죽어도 다시 발행하지 않아
  - poll은 항상 `job.platformData`를 이어서 돌려줘. 그래야 `processingSince`가 유지돼서 24h 타임아웃이 동작해
  - `fetchContainerStatus`를 쓰려고 `threads-api.ts`에 `export` 키워드 하나만 붙여 (동작 변화 없음). 그 외 Threads 코드는 안 고쳐. topic_tag는 안 붙여 (가정)
  - **Post 행을 안 만드는 이유**: Post로 만들면 X 크로스포스트(`scheduler.ts:193-214`), 인스타 카드뉴스(`:77-89`), autopilot 슬롯·쿼터(`cron/publish/route.ts:109-205`), 길이 실험, winner-replay, auto-plug, refill 집계로 새어 나가
- API 라우트 (모두 `requireBrandForCurrentUser`, `src/lib/brand-access.ts:25`)
  - `POST /api/newsdesk/scrape`
  - `POST /api/newsdesk`, `GET /api/newsdesk?brandId=`
  - `GET|PATCH /api/newsdesk/[id]` (원문·메모·이미지)
  - `PATCH /api/newsdesk/[id]/variants/[platform]` (수정 / 승인 / 승인 취소 / 잠금 해제 / 카카오 보냈어)
  - `POST /api/newsdesk/[id]/approve-all`
  - `POST /api/newsdesk/[id]/publish`
  - `POST /api/newsdesk/[id]/tick` (그 기사의 행만 `runDueUploads(now, { ids })`)
  - `POST /api/newsdesk/[id]/cancel`
  - `POST /api/newsdesk/upload` (Vercel Blob 클라이언트 업로드 토큰: png/jpeg, 5MB, 인증 확인. 서버는 Blob 스토어 도메인 URL만 받아)
  - `POST /api/channel-accounts/telegram` (`getChat` + `getChatMember`로 봇이 게시 권한 있는 관리자인지 확인 후 저장 또는 다시 켜기. 채널 id는 `externalUserId`)
- `src/app/brands/[slug]/newsdesk/page.tsx` + `src/components/newsdesk/*`

### 고칠 기존 파일
- `prisma/schema.prisma`: 모델 2개 + Brand 관계 줄
- `src/lib/distribution/adapters/types.ts`: `UploadKind`에 `"post"`
- `src/lib/distribution/adapters/index.ts`: telegram, threads 등록
- `src/lib/distribution/accounts.ts`
  - `UploadPlatform`에 `"telegram" | "threads"`
  - `getChannelCredentials`(`:71`)에 분기 2개 (지금은 둘 다 `:77` "Unsupported platform"에서 막혀)
    - telegram: env 토큰 + 채널 id. env가 없으면 영구 에러
    - threads: `getFreshBrandCredentials`. 에러는 instagram 분기(`:73-74`)처럼 영구 `ChannelApiError`로 감싸
  - `getUploadAccounts`는 안 건드려
- `src/lib/distribution/runner.ts`: `runDueUploads(now, { ids })` 선택 인자 (선택 조건에만 추가하고, 기존 due·lock 조건은 그대로)
- `src/lib/distribution/controls.ts`: `news:` 행 retry 거부 (위 규칙)
- `src/lib/distribution/metrics.ts`(`:29`): 메트릭 어댑터가 있는 플랫폼만 조회
- `src/lib/distribution/morning-report.ts`(`:9`, `:100-102`), `src/components/report/MorningReportView.tsx`(`:14-17`): telegram·threads 채널 라벨, `post` kind 라벨 ("재연결 필요"는 이미 OAuth 플랫폼만 봐서 수정 불필요, `morning-report.ts:154`)
- `src/lib/threads-api.ts`: `fetchContainerStatus`에 `export`만
- `src/components/ChannelDistributionSection.tsx`, `src/app/brands/[slug]/settings/page.tsx`: 텔레그램 채널 연결 카드
- `src/components/Dashboard.tsx`: 헤더 링크 한 줄

### 승인이 필요한 것 (전역 규칙)
1. **DB 스키마**: 새 테이블 `NewsItem`, `NewsVariant` (기존 컬럼 변화 없음). 반대 검토 2회 결과는 맨 아래에 있어.
2. **새 라이브러리 `@vercel/blob`** (루트 앱)
   - 붙여넣은 이미지를 공개 URL로 올려야 텔레그램·Threads가 가져가. 앱 라우트로 서빙하면 로그인 프록시에 막혀 (`src/proxy.ts:5-18`)
   - `video/`에서 이미 `2.8.0`을 써
   - API는 구현 때 context7로 확인할게
3. **PRD 정리**: `PRD/01_PRD.md:105` "텔레그램 알림 제외"는 알림 얘기라 그대로 둬. 텔레그램 *발행*, 페북 개인→페이지, 카카오 복사 모드는 `PRD/news-desk/`에 적어.

### 사용자가 할 일 (구현과 따로)
1. Vercel 대시보드에서 402 원인 해결 (10분, 추측)
2. 텔레그램 @BotFather로 봇 만들고 토큰을 `.env.local`과 Vercel env `TELEGRAM_BOT_TOKEN`에 넣기 (5분)
3. 테스트용 텔레그램 채널을 만들고 봇을 관리자로 추가, "메시지 게시" 권한 주기 (3분)
4. Vercel 프로젝트에 Blob 스토어가 연결됐는지, 루트 앱 env에 `BLOB_READ_WRITE_TOKEN`이 있는지 확인 (5분)

### 작업 순서 (테스트 먼저)
1. `feat/news-desk` 브랜치 (main 기준)
2. `PRD/news-desk/` 5종 + `docs/superpowers/plans/2026-11-19-news-desk-phase1.md` 저장
3. 스키마 + `migrate diff` SQL → (확인 후) `migrate deploy` → `prisma generate`
4. `scrape.ts`, `verify.ts`, `approval.ts`, `compose.ts`
5. 텔레그램·Threads 어댑터, accounts/runner/controls/metrics 수정
6. API 라우트 + Blob 업로드 라우트
7. 디자인 3단계: taste-skill 앱 화면 절차, 레퍼런스 = 사용자 스크린샷. 앱 톤(밝은 테마)에 맞춰 (가정)
8. 화면 구현 → 브라우저 스크린샷 보고 수정 (빈 상태·로딩·에러·한도 초과·발행 실패·잠금 해제 포함)
9. `/code-review` 한 번 → typecheck·test·build → `/security-review` → push·PR

## 검증
- `npm run typecheck`, `npm test`, `npm run build` 통과
- 단위 테스트
  - scrape: UTF-8·EUC-KR·article 없는 HTML, SSRF(localhost, 10.x, 리다이렉트로 사설 IP)
  - verify: 근거 일치/불일치, 없는 숫자, 이미지 유무별 텔레그램 한도, Threads 한도, 섀도우밴 게이트
  - approval
    - 수정하면 승인 풀림, 오래된 revision 승인 거부
    - 이미지 변경: 전부 풀림, 잠긴 원고 있으면 거부
    - 발행 선점과 수정 경합, 행 생성 실패 시 잠금 롤백
    - FAILED 행 조건부 재사용, PUBLISHED 행은 안 건드림
    - 카카오 보냈어 후 수정 거부
  - telegram 어댑터: 0/1/3장, 429만 재시도, 400 description 기록, 타임아웃·5xx·파싱 실패 → 영구 실패, **에러 메시지에 토큰 없음**
  - threads 어댑터: start는 컨테이너만, poll 상태별(PUBLISHED면 재발행 안 함, ERROR→retryFromStart, FINISHED→발행), 발행 후 레이트리밋만 재시도, platformData 유지
  - runner `ids` 필터, controls `news:` retry 거부, accounts 분기와 기존 플랫폼 결과 그대로
- 실제 확인 (로컬 `npm run dev` + 브라우저 패널)
  - 실제 기사 URL 2개(zdnet 포함)로 수집 → 팩트·원고, 근거 표시
  - 원문 붙여넣기 + raw 모드, 이미지 3장 Ctrl+V
  - 승인 → 수정 → 풀림 → 일괄 승인, 두 탭 동시 승인·발행
  - **테스트 텔레그램 채널**에 글만 / 1장 / 3장 발행
  - 카카오 복사 → 보냈어
  - Threads 실발행은 실제 계정에 올라가니까 그 직전에 한 번 물어볼게
- 화면은 스크린샷으로 확인한 뒤에만 완료라고 해

## 반대 검토 결과 (doubt-driven-development, 새 컨텍스트 서브에이전트 2회, 교차 모델은 사용자가 건너뜀)
**1차 (21개 지적):** 아래처럼 반영했어.
| 지적 | 분류 | 반영 |
|---|---|---|
| Threads용 Post가 X·카드뉴스·autopilot·실험·auto-plug로 새어 나감, 링크 태깅·자동 분할로 승인한 글과 달라짐 | 고칠 것 | Post 대신 Threads 어댑터 |
| 두 탭 중복 발행, 다른 테이블로 판정하는 잠금 경합 | 고칠 것 | `lockedAt` 조건부 선점 + 업로드 유니크 키 |
| 텔레그램 2단계 전송·애매한 실패의 중복 재전송 | 고칠 것 | 호출 1번 + 요청 후 에러는 영구 실패 |
| 이미지 바꿔도 revision 그대로 | 고칠 것 | 이미지 변경 시 전체 revision+1 |
| `runDueUploads`가 모든 브랜드 행 실행 | 고칠 것 | `ids` 필터 |
| `ChannelUpload.comment` 지금 불필요 | 고칠 것 | Phase 2로 |
| `getUploadAccounts` 수정 위험 | 고칠 것 | 안 건드림 |
| variantId 키로는 재생성 시 재발송 | 고칠 것 | `news:<newsItemId>` |
| 텔레그램 에러 설명 누락, 라벨, 메트릭 창, `migrate dev` drift, 카카오 승인 전 복사 | 고칠 것 | 각각 반영 |
| 1장 sendPhoto, 미디어 호스팅 | 잡음 (계획에 있었음) | — |
| 같은 URL 기사 중복 | 트레이드오프 | 화면 경고만 (일부러 다시 쓸 수 있어서) |

**2차 (25개 지적, 1차 반영본 대상):**
| 지적 | 분류 | 반영 |
|---|---|---|
| Threads poll 발행이 함수 종료·예외·잠금 경합으로 재발행 | 고칠 것 | 발행 전 컨테이너 상태 확인(PUBLISHED면 안 함), 발행 후 에러는 `classifyThreadsError` "retry"만 재시도 |
| 텔레그램 응답 파싱 실패가 일시 오류로 재전송 | 고칠 것 | 요청 후 에러는 429 말고 전부 영구 실패 |
| FAILED 행 재사용이 조건부가 아님, externalId 초기화 누락 | 고칠 것 | `status in [FAILED, CANCELED]` 조건 + externalId 초기화 |
| 캡션만 동기화해서 옛 이미지와 섞임, 모닝 리포트 retry가 승인 우회 | 고칠 것 | 동기화 대신 `news:` 행 retry 거부, 재발행은 데스크에서 글+이미지 함께 |
| 선점 후 행 생성 실패 시 풀 수 없는 잠김, 비활성 계정에 영원히 대기 | 고칠 것 | 계정 확인 먼저 + 한 트랜잭션 + 행 없을 때도 잠금 해제 허용 + 데스크에서 대기 취소 |
| 이미지 변경에 잠금 가드 없음 | 고칠 것 | 잠긴 원고가 있으면 이미지 변경 거부 |
| autopilot의 섀도우밴·속도 제한 우회 | 일부 고침 + 트레이드오프 | 안전 게이트 재사용으로 섀도우밴 의심 시 차단. 일일 쿼터는 수동 발행이라 세지 않음 |
| Threads 500자 사전 검사, 자격증명 에러가 일시 오류, 레이트리밋 판별 | 고칠 것 | 기존 함수 재사용, 영구 에러로 감싸기, `classifyThreadsError` |
| 봇 토큰이 에러 메시지로 샐 수 있음 | 고칠 것 | 에러에 URL 금지 + 테스트 |
| media URL 바뀔 수 있음, 포맷 | 고칠 것 | Blob 스토어 도메인만, png/jpeg, 5MB |
| 마이그레이션 lock_timeout 관례 | 고칠 것 | 맨 위에 추가 |
| poll이 platformData를 덮어써 24h 타임아웃 무력화, scheduledAt과 now 불일치 | 고칠 것 | platformData 이어서 반환, 같은 `now` |
| 카카오 보냈어 뒤 수정 | 고칠 것 | 보냈어 때 잠금 |
| 텍스트 바꿀 때 revision 강제 | 트레이드오프 | 쓰기 함수 한 곳 + 테스트 (DB 트리거 안 씀) |
| 링크 미리보기 이미지 | 트레이드오프 | 켜 두고 화면에 안내 |
| threads 레거시 계정 행 2개 경합 | 잡음 | 원고 선점이 1번만 성공해서 중복 발행으로 이어지지 않음 |
| 엔드포인트 인증, 텔레그램 계정 생성 경로 | 잡음 (계획에 있었음, 검토 입력에서 빠짐) | — |
| NewsItem 삭제 시 업로드 행 남음 | 잡음 | Phase 1에 삭제 기능 없음 |

**멈춘 이유:** 2차 지적은 대부분 어댑터 에러 경로처럼 구현 수준이야. 이건 위 단위 테스트(실패하는 테스트를 먼저 씀)와 4단계 끝 `/code-review`로 다시 걸러. 3차 검토(최대치)를 원하면 승인 전에 말해 줘.

**범위 밖 발견 (안 고침):** 기존 `x.ts:18`, `youtube.ts:53`은 발행 성공 뒤 응답 파싱에 실패하면 일시 오류로 재업로드될 수 있어. `instagram.ts:22-28`은 컨테이너가 이미 PUBLISHED여도 다시 발행을 시도해.
