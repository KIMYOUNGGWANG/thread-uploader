# 환경변수 목록

코드의 `process.env.*`와 `prisma/schema.prisma`, 워크플로의 `secrets.*`/`vars.*`에서 이름을 뽑아 정리했다. **값은 하나도 적지 않았다.** 실제 값은 `.env.local`과 Vercel·GitHub 설정에만 둔다.

"필수/기본값"은 해당 변수를 읽는 코드를 보고 적었다. 코드가 바뀌면 틀릴 수 있으니 "근거" 파일을 먼저 확인한다.

## 앱 (Vercel + 로컬 `.env.local`)

| 변수 | 필수/기본값 | 용도 | 근거 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 필수 | Prisma가 쓰는 Postgres 연결 문자열 | `prisma/schema.prisma` |
| `ENCRYPTION_KEY` | 필수 (없으면 예외) | 저장되는 토큰을 암호화하는 키의 원본. sha256으로 해시해 AES-256-GCM 키로 쓴다. 바꾸면 이미 암호화된 토큰을 못 푼다 | `src/lib/crypto.ts` |
| `ANTHROPIC_API_KEY` | 글 생성에 필요 | Claude 호출 | `src/lib/generate-posts.ts`, `src/lib/command-plan.ts` |
| `ANTHROPIC_GENERATION_MODEL` | 기본값 `claude-haiku-5-5` | 글 생성 모델 | `src/lib/claude-text.ts` |
| `CRON_SECRET` | 프로덕션 필수 (없으면 `/api/cron/*` 전부 거부) | 크론 호출 인증. 호출하는 쪽은 `Authorization: Bearer <값>`으로 보낸다 | `src/lib/cron-auth.ts` |
| `APP_URL` | 기본값 `https://thread-uploader.vercel.app` | 짧은 링크·리다이렉트의 기준 주소 | `src/app/api/cron/auto-plug/route.ts`, `src/app/r/[code]/route.ts` |
| `ALERT_WEBHOOK_URL` | 선택 | 시스템 알림 웹훅. 비면 알림이 로그에만 남는다 | `src/lib/alert-service.ts` |
| `SUPERADMIN_EMAIL` | 선택 | 이 이메일로 로그인한 사용자는 브랜드 소유자 검사를 건너뛴다 | `src/lib/brand-access.ts` |
| `ALLOW_REGISTRATION` | 선택 | 정확히 `true`일 때만 회원가입 허용 | `src/app/api/auth/register/route.ts` |
| `CONVERSION_WEBHOOK_SECRET` | 선택 (없으면 결제 이벤트 전부 거부) | 결제 전환 이벤트를 보내는 서버의 인증값. `x-webhook-secret` 또는 `Authorization: Bearer`로 보낸다 | `src/app/api/webhooks/conversion/route.ts` |
| `CONVERSION_WEBHOOK_REQUIRE_SECRET` | 선택 (기본 꺼짐) | `true`면 시크릿 없는 모든 전환 이벤트를 401로 거절. 모든 발신자(타래로그 Worker 포함)가 시크릿을 붙인 뒤에 켠다. PR #162부터 | `src/app/api/webhooks/conversion/route.ts` |
| `AUTO_REPLY_PUBLISH` | 기본 켜짐 | `false`면 답글 초안을 자동 게시하지 않고 승인 대기로 둔다 | `src/app/api/cron/replies/route.ts` |

## Threads

| 변수 | 필수/기본값 | 용도 | 근거 |
| --- | --- | --- | --- |
| `THREADS_APP_ID` | 기본값이 코드에 있음 | Threads OAuth 앱 ID | `src/lib/threads-oauth.ts` |
| `THREADS_APP_SECRET` | OAuth 콜백에 필요 | Threads OAuth 앱 시크릿 | `src/app/api/oauth/threads/callback/route.ts` |
| `THREADS_DEFAULT_TOPIC` | 선택 | 게시글에 붙이는 주제 태그 | `src/lib/threads-api.ts` |
| `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID` | 옛 단일 계정 폴백 | 브랜드별 토큰이 DB에 있으면 필요 없다 | `src/lib/threads-api.ts`, `scripts/` |

## 다른 채널

| 변수 | 필수/기본값 | 용도 | 근거 |
| --- | --- | --- | --- |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | 인스타 연결에 필요 | Instagram OAuth | `src/app/api/oauth/instagram/` |
| `YOUTUBE_API_KEY` | 선택 | 쇼츠 리서치 페이지 | `src/lib/youtube/shorts-service.ts` |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | 둘 다 있어야 해당 채널 사용 가능 | YouTube 업로드 OAuth | `src/lib/distribution/oauth-providers.ts` |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | 둘 다 있어야 해당 채널 사용 가능 | TikTok 업로드 OAuth | 위와 같음 |
| `TIKTOK_SCOPES` | 기본값 `user.info.basic,video.publish` | TikTok OAuth 권한 범위 | 위와 같음 |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | 둘 다 있어야 해당 채널 사용 가능 | X 업로드 OAuth | 위와 같음 |

## 로컬 스크립트·영상 (`scripts/`, `video/`)

| 변수 | 쓰는 곳 |
| --- | --- |
| `CRONJOB_API_KEY` | `scripts/register-cronjobs.mjs` (cron-job.org API) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `scripts/migrate-to-multibrand.js` (1회성) |
| `COSMICPATH_DIR`, `VIDEO_BRAND_SLUGS`, `VIDEO_FACTORY_BRANDS`, `VIDEO_FACTORY_FORCE` | `video/` 렌더링. `APP_URL`, `CRON_SECRET`, `DATABASE_URL`도 같이 읽는다 |

## GitHub Actions와 Cloudflare (`.env`가 아니라 각 서비스 설정에 넣는다)

- GitHub 저장소 Settings → Secrets and variables → Actions
  - Secrets: `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, `COSMICPATH_READ_TOKEN`, `PUBLISH_BRAND_SLUGS`
  - Variables: `APP_URL`, `SHORTS_BRAND_SLUGS`, `TREND_BRAND_SLUGS`, `VIDEO_BRAND_SLUGS`, `VIDEO_FACTORY_BRANDS`
- Cloudflare Worker(`cloudflare/scheduler`): `CRON_SECRET`은 `wrangler secret put`으로, `APP_URL`은 선택

## `.env.local` 시작용 이름 목록

새 환경에서 아래를 `.env.local`에 붙여넣고 값만 채운다. 필수 항목은 위 표를 따른다.

```
DATABASE_URL=
ENCRYPTION_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_GENERATION_MODEL=
CRON_SECRET=
APP_URL=
ALERT_WEBHOOK_URL=
SUPERADMIN_EMAIL=
ALLOW_REGISTRATION=
CONVERSION_WEBHOOK_SECRET=
CONVERSION_WEBHOOK_REQUIRE_SECRET=
AUTO_REPLY_PUBLISH=
THREADS_APP_ID=
THREADS_APP_SECRET=
THREADS_DEFAULT_TOPIC=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
YOUTUBE_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_SCOPES=
X_CLIENT_ID=
X_CLIENT_SECRET=
```
