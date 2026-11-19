# 뉴스 데스크 -- Phase 분리 계획

> 2026-11-19. Phase마다 시작할 때 plan mode로 따로 계획한다.

## Phase 0: 전제 (사용자)
- Vercel 402(DEPLOYMENT_DISABLED) 해결
- 텔레그램 봇 토큰(`TELEGRAM_BOT_TOKEN`), 테스트 채널에 봇 관리자 추가
- Vercel Blob 스토어 연결, `BLOB_READ_WRITE_TOKEN`

## Phase 1: 데스크 + 텔레그램·Threads·카카오 복사 (진행 중)
### 목표
기사 → 팩트·근거 → 플랫폼별 원고 → 승인 → 발행이 끝까지 돈다.
### 기능
- [ ] 기사 수집(SSRF 방어, euc-kr) + 원문 붙여넣기 + 원문 그대로 모드
- [ ] Claude 1회 호출로 팩트·원고, 근거·숫자·한도 검사
- [ ] 플랫폼별 승인·일괄 승인·수정 시 승인 해제
- [ ] 이미지 5장 (Vercel Blob)
- [ ] 텔레그램 채널 어댑터, Threads 어댑터 (배포 엔진)
- [ ] 카카오 복사 모드
- [ ] 텔레그램 채널 연결 카드
### 데이터
`NewsItem`, `NewsVariant` (02_DATA_MODEL.md)
### 완료 기준
- typecheck·test·build 통과
- 테스트 텔레그램 채널에 글만/1장/3장 발행
- 화면 스크린샷 확인
### 상세 계획
`docs/superpowers/plans/2026-11-19-news-desk-phase1.md`

## Phase 2: 링크드인 개인 + 페이스북 페이지 + 자동 댓글
### 전제 조건
Phase 1 운영 확인. 링크드인 앱에 "Share on LinkedIn" 추가, 페이스북 페이지·Meta 앱 권한.
### 기능
- 링크드인 OAuth(`w_member_social`), Posts API, 멀티 이미지
- 페이스북 페이지 토큰(`pages_manage_posts`), /feed·/photos
- 발행 후 자동 댓글(Threads·페이지·링크드인은 권한 확인 후), `ChannelUpload.comment` 컬럼 추가
- 계정 하나 제한(`accounts.ts`) 손볼지 판단

## Phase 3: AI 뉴스 자동 수집
- RSS 후보 목록 → 클릭 한 번에 데스크로 (기존 `news-rss.ts`, `wellness/articles.ts` 재사용)
- 영상 첨부, 예약 발행

## Phase 로드맵 요약
| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 사용자 준비 | 대기 |
| 1 | 데스크 + 텔레그램·Threads·카카오 복사 | 진행 중 |
| 2 | 링크드인·페이스북 페이지·자동 댓글 | 대기 |
| 3 | 자동 수집·영상·예약 | 대기 |
