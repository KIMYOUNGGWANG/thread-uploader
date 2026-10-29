# 숏폼레이더 (가칭) -- 기술 스펙

> 01~04가 "무엇을·왜"라면 이 문서는 "어떻게"입니다.
> API 계약 · 생성 스키마 · 크론 명세 · 에러 체계 · 보안 · 테스트 · 관측 지표.
> Phase 2단계(brainstorming → writing-plans)의 입력 문서. 구현 중 바뀌면 여기를 먼저 고칩니다.

---

## 1. 시스템 구조

```
브라우저 ──> Next.js (Vercel)
               ├─ 페이지 (RSC)  ──> Supabase (anon key + RLS)
               └─ Route Handler ──> Supabase (service role, 한도 검사)
                                ──> Claude API
                                ──> 토스페이먼츠

pg_cron ──> Edge Function
             ├─ collect-videos  (6h)  ──> YouTube Data API v3
             ├─ snapshot-stats  (1h)  ──> YouTube Data API v3
             └─ cleanup         (1d)
```

원칙
- 피드 읽기는 RSC에서 anon key로 직접 조회. API 라우트를 거치지 않음.
- 쓰기 중 "돈·한도"가 걸린 건(생성, 결제)은 Route Handler에서 service role로 처리.
- 크론은 Edge Function 하나가 5분 안에 끝나도록 배치 크기를 제한. 넘치면 다음 실행에서 이어서.

---

## 2. 데이터 흐름

### 2.1 수집 → 피드

```
collect-videos (6h)
  Channel(topic별, last_checked_at 오래된 순 200개)
    → playlistItems.list(uploads_playlist_id, maxResults=10)      1유닛/채널
    → 신규 video id 모음
    → videos.list(ids 50개씩, part=contentDetails,statistics)      1유닛/50개
    → duration ≤ 60s(미결: 180s)만 Video upsert + 첫 VideoSnapshot

snapshot-stats (1h)
  Video(published_at ≥ now-48h)
    → videos.list(ids 50개씩, part=statistics)                       1유닛/50개
    → VideoSnapshot insert
    → velocity 계산 → Video.latest_views, velocity, fetched_at 갱신

cleanup (1d)
  VideoSnapshot(captured_at < now-30d) delete
  Video(published_at < now-7d AND 참조 Generation 없음) delete
```

### 2.2 velocity 정의

```
velocity = (views_now − views_at(now − window)) / window_hours
window   = min(6h, 게시 후 경과 시간)      -- 게시 2시간 된 영상은 2h 창
```
- 스냅샷이 1개뿐이면 `views / 경과시간`으로 대체.
- 피드 정렬 키: `velocity DESC`. 동점이면 `latest_views DESC`.
- 최소 노출 기준: `latest_views ≥ 10,000` (국내) / `≥ 50,000` (해외). 값은 Topic별 설정 가능하게 컬럼으로.

### 2.3 생성

```
POST /api/generate
  1. 세션 → org_id
  2. Subscription 확인: status=active AND gen_used < gen_quota   (아니면 402)
  3. Client 소유 확인 (org_id 일치, 아니면 404)
  4. Transcript 조회 → 없으면 추출 시도 → 실패 시 422 (사용량 차감 없음)
  5. gen_used += 1  (트랜잭션, 먼저 차감)
  6. Claude 호출 (structured output, 아래 스키마)
  7. 스키마 검증 실패 → 1회 재시도 → 또 실패 시 gen_used −= 1, 500
  8. Generation insert → 200
```

---

## 3. API 계약

인증: Supabase 세션 쿠키. 모든 응답은 `{ ok: true, data }` 또는 `{ ok: false, error: { code, message } }`.

### 3.1 피드 (RSC 직접 조회, API 아님)

```sql
select v.*, c.title as channel_title
from videos v join channels c on c.id = v.channel_id
where :topic_id = any(v.topic_ids)
  and v.country = any(:countries)           -- ['KR'] | ['US','JP',...] | 전체
  and v.published_at >= now() - :window     -- '24 hours' | '48 hours'
  and v.latest_views >= :min_views
order by v.velocity desc, v.latest_views desc
limit 60;
```

### 3.2 클라이언트

```
GET    /api/clients                     → Client[]
POST   /api/clients                     body: ClientInput   → Client   (403 if count ≥ client_limit)
PATCH  /api/clients/:id                 body: Partial<ClientInput>
DELETE /api/clients/:id                 (Generation은 남김, client_id null 처리 없음 → soft delete: deleted_at)
```

```ts
const ClientInput = z.object({
  name: z.string().min(1).max(40),
  handle: z.string().max(60).optional(),
  platform: z.enum(['youtube', 'instagram']),
  topic_ids: z.array(z.string()).min(1).max(5),
  tone: z.string().min(1).max(300),
  banned_words: z.array(z.string().max(20)).max(30).default([]),
  notes: z.string().max(1000).optional(),
});
```

### 3.3 생성

```
POST /api/generate
body: { video_id: string, client_id: string }
200: Generation
402: { code: 'QUOTA_EXCEEDED', remaining: 0, plan: 'free' }
422: { code: 'NO_TRANSCRIPT' }
```

```
GET /api/generations?client_id=&cursor=   → { items: Generation[], next_cursor }
GET /api/generations/:id                  → Generation
```

### 3.4 결제 (토스 빌링)

```
POST /api/billing/checkout     body: { plan: 'pro'|'team' }
                               → { customer_key, success_url, fail_url }   // 토스 위젯용
GET  /api/billing/callback     ?authKey=&customerKey=
                               → 빌링키 발급 → 첫 결제 → Subscription 갱신 → /billing 리다이렉트
POST /api/billing/cancel       → status='canceled', period_end까지 유지
POST /api/toss/webhook         토스 → 서명 검증 → 결제 성공/실패 반영 (멱등: payment_key unique)
```

정기 결제는 pg_cron `charge-subscriptions (1d)`: `period_end <= today AND status=active` 인 조직에 빌링키로 결제 → 성공 시 `period_end += 1 month, gen_used = 0`, 실패 시 `status='past_due'`.

### 3.5 영상 상세 (RSC)

- Video + Channel + VideoSnapshot(최근 48h, 시간순) + Transcript 유무.
- 유튜브 임베드: `https://www.youtube.com/embed/{id}` iframe. 다운로드·프록시 없음.

---

## 4. 생성 엔진

### 4.1 입력

```ts
interface GenerateInput {
  video: { title: string; channel: string; views: number; velocity: number; duration_sec: number };
  transcript: string;                 // 최대 4,000자, 넘으면 앞뒤 2,000자씩
  client: { name: string; tone: string; topics: string[]; banned_words: string[]; notes?: string };
  output_lang: 'ko';                  // 미결: 해외 영상도 ko 고정
}
```

### 4.2 출력 스키마 (Zod, Claude structured output으로 강제)

```ts
const Analysis = z.object({
  hook_type: z.enum(['question', 'shock', 'contrast', 'list', 'story', 'challenge', 'other']),
  hook_text: z.string().max(200),                 // 원본 첫 3초 내용
  structure: z.array(z.object({ sec: z.number(), beat: z.string().max(80) })).min(2).max(8),
  cta: z.string().max(120),
  why_viral: z.array(z.string().max(120)).min(2).max(4),
});

const Shot = z.object({
  no: z.number().int().min(1),
  scene: z.string().max(120),        // 화면에 보이는 것
  line: z.string().max(200),         // 대사
  caption: z.string().max(40),       // 화면 자막
  sec: z.number().min(1).max(20),
});

const GenerationOutput = z.object({
  analysis: Analysis,
  script: z.object({
    hook: z.string().max(200),
    body: z.array(z.string().max(300)).min(1).max(6),
    cta: z.string().max(120),
    est_sec: z.number().min(10).max(90),
  }),
  shots: z.array(Shot).min(3).max(12),
});
```

### 4.3 프롬프트 규칙 (시스템 프롬프트에 고정)

- 원본을 베끼지 말고 **구조만** 가져온다. 대사는 클라이언트 톤으로 새로 쓴다.
- `banned_words`는 결과 어디에도 등장하면 안 된다. 서버에서 후검사, 걸리면 재시도.
- 촬영컷 `sec` 합계는 `script.est_sec ± 20%`.
- 한 컷 대사는 한 문장. 구어체. 숫자·키워드는 `caption`에 넣는다.
- 모델: `claude-sonnet-5-5`, `max_tokens: 2000`, `temperature: 0.7`. 품질 불만 시 `claude-opus-5-5`로 플랜별 분기.

### 4.4 자막 추출

```
Transcript 없음
  → 1차: 유튜브 자막 트랙 (timedtext, 비공식)  — ko → en → auto 순
  → 실패: 422 NO_TRANSCRIPT, "자막이 없는 영상이에요" 안내
  → Phase 2: 외부 전사 API 폴백 (비용 측정 후)
```
- 추출 결과는 Transcript에 캐시. 재생성 시 재추출 없음.
- `source` 컬럼으로 출처 기록. 비공식 엔드포인트가 막히면 해당 소스만 끄고 서비스는 유지.

---

## 5. 크론 함수 명세

| 함수 | 주기 | 입력 | 배치 상한 | 성공 조건 | 실패 처리 |
|------|------|------|-----------|-----------|-----------|
| collect-videos | 6h | Channel 200개 (last_checked_at 오래된 순) | 200채널, 200유닛 | 모든 채널 last_checked_at 갱신 | 채널 단위 try/catch, 실패 채널은 다음 회차 |
| snapshot-stats | 1h | Video 48h 이내 (최대 2,500개) | 50개×50호출 | 스냅샷 insert 수 = 대상 수 | 배치 단위 실패 로그, 나머지 계속 |
| cleanup | 1d | — | — | 삭제 건수 로그 | — |
| charge-subscriptions | 1d | Subscription period_end ≤ today | 100건 | 결제 결과 반영 | past_due 전환, 알림 메일 |

공통
- 함수 상단에 **이번 실행 예상 쿼터**를 계산해 로그. 일 누적이 8,000 넘으면 collect-videos는 skip.
- 각 실행은 `cron_runs(fn, started_at, finished_at, quota_used, ok, note)`에 기록. 피드 상단에 "마지막 갱신 N분 전" 표시용.
- 멱등: Video/Snapshot upsert는 `(video_id)` / `(video_id, date_trunc('hour', captured_at))` unique.

---

## 6. 에러 체계

| 코드 | HTTP | 사용자 메시지 | 비고 |
|------|------|---------------|------|
| AUTH_REQUIRED | 401 | 로그인이 필요해요 | |
| FORBIDDEN | 403 | 권한이 없어요 | 다른 조직 자원 접근 |
| NOT_FOUND | 404 | 찾을 수 없어요 | 다른 조직 자원도 404로 (존재 여부 노출 금지) |
| QUOTA_EXCEEDED | 402 | 이번 달 생성 횟수를 다 썼어요 | 업그레이드 모달 트리거 |
| CLIENT_LIMIT | 403 | 플랜에서 등록 가능한 계정 수를 넘었어요 | |
| NO_TRANSCRIPT | 422 | 자막이 없는 영상이라 아직 생성할 수 없어요 | 사용량 차감 없음 |
| GENERATION_FAILED | 500 | 생성에 실패했어요. 다시 시도해 주세요 | 사용량 롤백 |
| UPSTREAM_YOUTUBE | 503 | 유튜브 연결이 잠시 불안정해요 | 크론 전용 |
| PAYMENT_FAILED | 402 | 결제에 실패했어요 | 토스 메시지 그대로 노출 금지 |
| VALIDATION | 400 | 입력값을 확인해 주세요 | Zod 이슈 필드명 포함 |

- 스택 트레이스는 로그에만. 응답엔 `code`와 `message`만.
- 로그 형식: `{ level, code, org_id, user_id, route, duration_ms, detail }` JSON 한 줄.

---

## 7. 보안

### 7.1 RLS 정책 (조직 테이블 전부)

```sql
-- 공통 헬퍼
create function current_org_id() returns uuid
  language sql stable as $$ select org_id from users where id = auth.uid() $$;

-- 예: clients
alter table clients enable row level security;
create policy clients_org_isolation on clients
  for all using (org_id = current_org_id())
  with check (org_id = current_org_id());
```
- 적용: users, subscriptions, clients, generations, boards, board_items, topics(org_id not null인 행).
- 공용 테이블(videos, channels, video_snapshots, transcripts, 기본 topics): `select`만 anon/authenticated 허용, 쓰기는 service role만.
- 테스트: 조직 A 세션으로 조직 B의 client id를 PATCH → 404. CI에 포함.

### 7.2 키·결제
- 빌링키는 Supabase Vault 또는 `pgsodium`으로 암호화. 평문 컬럼 금지.
- 토스 webhook: 시그니처 검증 + `payment_key` unique로 멱등.
- service role key는 Route Handler·Edge Function 환경변수에만. 브라우저 번들 검사(`NEXT_PUBLIC_` 접두사 외 노출 0건).

### 7.3 입력
- 모든 Route Handler 입력은 Zod. 길이·enum·배열 크기 제한은 3.2 참조.
- 생성 프롬프트에 들어가는 사용자 텍스트(tone, notes)는 길이 제한 + 시스템 프롬프트와 분리된 user 블록으로만 전달.

### 7.4 YouTube API 약관
- 영상·오디오 다운로드 금지. 재생은 공식 임베드만.
- 통계 캐시 30일 상한(cleanup). 피드 카드에 채널명 + 유튜브 링크 표기.
- API 키는 HTTP referrer 제한 없이 서버 전용으로 발급.

---

## 8. 테스트 전략

| 층 | 대상 | 도구 | 필수 케이스 |
|----|------|------|-------------|
| 단위 | velocity 계산, 쇼츠 판정, Zod 스키마, 금지어 검사, 쿼터 계산 | vitest | 스냅샷 1개/2개/창 초과, 60초 경계, 금지어 부분 일치 |
| 통합 | /api/generate, /api/clients, 결제 콜백 | vitest + Supabase 로컬 | 한도 소진 402, 롤백, 다른 조직 404, webhook 중복 |
| 크론 | collect/snapshot | YouTube 응답 fixture | 쿼터 상한 skip, 채널 실패 격리, 멱등 upsert |
| RLS | 조직 격리 | SQL 테스트 | 7.1 시나리오 |
| E2E | 로그인 → 피드 → 생성 → 복사 | Playwright, 배포 프리뷰 | 1개 시나리오만 |

- Claude 호출은 테스트에서 fixture로 대체. 실제 호출 테스트는 수동 1회.
- 배포 전 게이트: `pnpm tsc --noEmit && pnpm test && pnpm build`.

---

## 9. 관측 지표

| 지표 | 목표 | 어디서 |
|------|------|--------|
| 피드 최신성 (마지막 snapshot 이후 경과) | < 90분 | cron_runs |
| 주제당 24h 영상 수 | ≥ 20 | 일 1회 쿼리 |
| YouTube 일 쿼터 사용 | < 8,000 | cron_runs 합계 + GCP 콘솔 |
| 생성 p95 지연 | < 15s | 로그 duration_ms |
| 생성 실패율 | < 3% | GENERATION_FAILED / 전체 |
| 자막 없음 비율 | 추적 (Phase 2 전사 도입 판단) | NO_TRANSCRIPT / 전체 |
| 결제 실패율 | < 5% | PAYMENT_FAILED |

Vercel Analytics + Supabase 로그로 시작. 별도 APM은 유료 고객 10곳 전까지 도입하지 않음.

---

## 10. 성능 목표 (보장 아님, 설계 기준)

| 작업 | 목표 |
|------|------|
| 피드 페이지 TTFB | < 500ms (RSC + 인덱스: `(topic_ids gin), (published_at), (velocity desc)`) |
| 영상 상세 | < 400ms |
| 생성 | 10~15s (Claude 호출이 대부분) |
| collect-videos 1회 | < 3분 |
| snapshot-stats 1회 | < 2분 |

---

## 11. 인덱스

```sql
create index videos_topic_gin      on videos using gin (topic_ids);
create index videos_pub            on videos (published_at desc);
create index videos_velocity       on videos (velocity desc);
create index snapshots_video_time  on video_snapshots (video_id, captured_at desc);
create unique index snapshots_hour on video_snapshots (video_id, date_trunc('hour', captured_at));
create index generations_client    on generations (org_id, client_id, created_at desc);
```

---

## [NEEDS CLARIFICATION]

- [ ] 비공식 자막 엔드포인트가 Edge Function(Deno)에서 호출 가능한지, 차단 시 Route Handler(Node)로 옮길지
- [ ] Claude structured output 지원 범위 — 미지원이면 JSON mode + Zod 재시도로
- [ ] 토스 빌링 "정기결제" 상품 심사 전까지 테스트 키로 1b 개발 가능 여부
- [ ] Supabase Vault vs pgsodium 중 빌링키 암호화 방식
