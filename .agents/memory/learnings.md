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

## [2026-09-01] Viral Breakout & Learning Loop (CosmicPath 28k Views)
- **Breakout Case**: `진태양시 30분 왜곡 폭로` (Threads ID: 18088096508277166 / 28,024 뷰 / 25 댓글 / 15 리포스트 / 72 좋아요)
- **핵심 바이럴 3대 공식**:
  1. `손실 불안 + 뇌내 시뮬레이션`: "한국인 10명 중 7명은 틀렸다" + "지금 당장 태어난 시간에서 30분을 빼라" → 독자가 즉시 읽는 도중 머릿속으로 뺄셈을 해보게 만들어 체류 시간(Dwell Time) 강제 확보.
  2. `반박 불가능한 물리/역사 팩트 폭격`: 미신 대신 1961년 동경 135도 표준시(KST) 및 서울 태양 남중 32분 오차 제시로 지적 신뢰도 확보 및 기득권(30분 오차 안 잡는 철학관) 공격.
  3. `저장/리포스트 중심의 정보 자산화`: 일회성 잡담이 아니라 '내 사주 기준표' 성격으로 북마크(저장) 및 공유(15 리포스트) 유발.
- **후속 배치 복제 프로토콜**:
  - `동일 팩트 축 변형 1`: 대한민국 서머타임 적용 연도(1987~1988년생 1시간 왜곡) 폭로.
  - `동일 팩트 축 변형 2`: 출생지 경도 차이(강릉 vs 인천 15분 시차)로 인한 사주 시주 변동.
  - `랜딩페이지 방어`: 외부 사주 앱으로의 트래픽 누출(Leakage)을 막기 위해 랜딩페이지 상단에 '32분 진태양시 정밀 무료 계산기'를 즉시 제공하여 리포트 시작으로 유도.

