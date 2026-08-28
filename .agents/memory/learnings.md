# 🧠 Orchestrator 5.4 — Meta-Learning Memory (learnings.md)

> This file is automatically updated after each development cycle.
> It is preloaded in every workflow's Step 0 to prevent repeating past mistakes.
> **Do not delete this file.** It is the system's accumulated intelligence.

---

## Format
- `## [YYYY-MM-DD] Cycle Learnings`
- `- Recurring error: <type> — <description> — Prevention: <action>`
- `- What worked well: <description>`
- `- Next cycle: <specific action>`

---
<!-- New learnings are appended below -->

## [2026-04-08] Cycle Learnings
- Recurring error: contract drift — `docs/api-spec.md`의 HTTP method와 payload가 실제 route 구현과 어긋나 ship 점검에서 혼선이 생김 — Prevention: API route를 바꾼 같은 사이클에 계약 문서도 함께 갱신하기
- Recurring bug: stale publish state — 게시 성공 경로가 여러 군데로 갈라져 있을 때 한 경로만 `errorLog`를 초기화하면 `PUBLISHED` 글에도 과거 실패 로그가 남아 UI에 재노출됨 — Prevention: 상태 전이(`FAILED -> PUBLISHED`)를 쓰는 모든 publisher 경로에서 성공 시 `errorLog`를 동일하게 비우고, 읽기 경계에서도 legacy 데이터를 정상화하기
- What worked well: `qa-runner`가 실제 실행 가능한 검증 스크립트를 `lint`, `build`로 정확히 좁혀줘서 ship 확인이 빨랐음
- Next cycle: ship 전 `audit-status`에서 dirty worktree를 먼저 정리하거나 범위를 고정한 뒤 검증 시작하기

## [2026-05-15] Cycle Learnings
- Recurring bug: missing publish boundary guard — quality gate fail 글이 생성 큐에 남아도 발행 경계에서 막지 않으면 수동/cron 업로드로 실제 발행될 수 있음 — Prevention: `qualityPass === false`는 모든 publisher 경로와 UI 업로드 버튼에서 차단하기
- Recurring bug: campaign prompt conflict — 브랜드 기본 프롬프트의 reply-dependent CTA 금지가 예전 `career_decision` 댓글 진단 조건과 충돌해 usable posts를 fail 처리함 — Prevention: 커리어 캠페인은 댓글 접수 대신 셀프체크/저장/공유 mechanics를 기본값으로 두고, retry에는 gate 실패 이유를 주입하기

## [2026-05-16] Cycle Learnings
- Recurring bug: opaque external-source failure — Meta permission errors were collapsed into “일부 소스 실패” so the operator could not tell whether discovery failed because of no data or blocked API permission — Prevention: surface source error classes directly and provide a manual seed-handle fallback for permission-limited discovery.

## [2026-05-21] Cycle Learnings
- Recurring bug: cron implementation without deployment registration — 토큰 갱신 route가 있어도 `vercel.json` cron에 없으면 production에서는 자동 갱신이 돌지 않음 — Prevention: 새 cron endpoint를 만들 때 같은 변경에서 배포 스케줄과 README를 함께 갱신하기
- Recurring bug: fallback setup blocks primary workflow — legacy env-token 초기화 실패가 multi-brand refresh 전체를 막을 수 있음 — Prevention: fallback refresh는 non-blocking으로 처리하고 브랜드별 작업은 독립적으로 계속 실행하기

## [2026-06-01] Cycle Learnings
- Recurring bug: missing token refresh at publish boundary — refresh cron이 실패하거나 배포되지 않으면 앱 발행 경로가 만료 임박 토큰을 그대로 사용함 — Prevention: 모든 publisher 경로는 저장 토큰을 직접 쓰지 말고 발행 직전 fresh credentials 헬퍼를 통과하기
