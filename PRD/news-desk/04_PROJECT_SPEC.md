# 뉴스 데스크 -- 프로젝트 스펙

> 2026-11-19. 상위 `PRD/04_PROJECT_SPEC.md`와 루트 `CLAUDE.md`가 먼저다 (루트 앱은 npm).

## 기술 스택
- 기존 그대로: Next.js, Prisma(Postgres), `@anthropic-ai/sdk`, Vitest
- 추가: `@vercel/blob` (이미지 업로드, 승인됨)
- 외부 API는 SDK 없이 `fetch`: Telegram Bot API, Threads Graph API

## 프로젝트 구조 (추가되는 곳만)
```
src/lib/newsdesk/          scrape, compose, verify, approval
src/lib/distribution/adapters/telegram.ts, threads.ts
src/app/api/newsdesk/**    데스크 API
src/app/brands/[slug]/newsdesk/page.tsx
src/components/newsdesk/*
```

## 절대 하지 마 (DO NOT)
- 뉴스를 `Post` 테이블로 만들지 마 (X·카드뉴스·autopilot으로 샌다).
- NewsVariant 글을 `approval.ts` 밖에서 바꾸지 마 (revision이 안 올라가면 안 본 글이 승인된다).
- 발행 요청을 보낸 뒤의 애매한 에러를 일시 오류로 던지지 마 (재시도하면 두 번 올라간다).
- 봇 토큰이 들어간 URL을 에러 메시지·로그에 넣지 마.
- 카카오 단체방 자동 전송(매크로·비공식 API)을 만들지 마.
- 기존 Threads 발행·생성 코드(`threads-api.ts`, autopilot)를 고치지 마 (`fetchContainerStatus` export만 예외).

## 항상 해 (ALWAYS DO)
- 새 API 라우트는 `requireBrandForCurrentUser`로 권한 확인.
- 서버가 가져오는 URL은 SSRF 검사(`scrape.ts`)를 거친다.
- 승인·발행 상태 변경은 조건부 `updateMany`로 한다.
- 실패하는 테스트를 먼저 쓴다.

## 테스트 방법
```bash
npm run typecheck
npm test
npm run build
```

## 배포 방법
- 마이그레이션은 PR 머지 **전에** `npx prisma migrate deploy` (추가만이라 옛 코드에 영향 없음).
- 그다음 PR 머지 → Vercel 배포.

## 환경변수
| 이름 | 용도 |
|---|---|
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 (env에만, DB에 안 넣음) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 업로드 |
| 기존 `ANTHROPIC_API_KEY`, `ANTHROPIC_GENERATION_MODEL` | 팩트·원고 생성 |

## [NEEDS CLARIFICATION]
- 없음
