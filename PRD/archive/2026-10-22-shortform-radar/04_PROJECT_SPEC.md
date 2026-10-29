# 숏폼레이더 (가칭) -- 프로젝트 스펙

> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 이 문서를 AI에게 항상 함께 공유하세요.

---

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js (App Router) + TypeScript | self-deokjil과 동일 조합. 2026년 SaaS 기본값(MakerKit·Supastarter 가이드 공통) |
| DB/백엔드 | Supabase (Postgres + Auth + pg_cron + Edge Functions) | 인증·크론·RLS를 한 곳에서. 무료 티어로 시작 |
| 배포 | Vercel | Next.js 기본 배포처. 무료 티어 |
| 인증 | Supabase Auth 소셜 (Google, Kakao) | 비밀번호 관리 없음. Kakao 기본 제공 |
| 스타일링 | Tailwind CSS 4 | 기존 프로젝트와 동일 |
| 수집 | YouTube Data API v3 (`playlistItems.list`, `videos.list`, 발굴용 `search.list`) | 공식·무료. 쿼터 10,000/일 |
| 크론 | pg_cron → Edge Function 호출 | 별도 서버 없음. 1회 실행 수분 이내로 설계 |
| AI 생성 | Claude API (`claude-sonnet-5-5` 기본, 품질 부족 시 `claude-opus-5-5`) | 한국어 스크립트 품질. `@anthropic-ai/sdk` 이미 사용 경험 |
| 결제 | 토스페이먼츠 빌링(정기결제) | 국내 카드·계좌. cosmicpath에서 사용 경험 |
| 패키지 매니저 | pnpm | 전역 규칙 |

---

## 프로젝트 구조

```
shortsradar/
├── src/
│   ├── app/
│   │   ├── (marketing)/        # 랜딩, 요금
│   │   ├── (app)/
│   │   │   ├── feed/           # 급상승 피드
│   │   │   ├── video/[id]/     # 영상 상세 + 생성
│   │   │   ├── clients/        # 클라이언트 CRUD
│   │   │   └── billing/        # 구독
│   │   └── api/
│   │       ├── generate/       # 벤치마킹 생성 (서버에서 한도 검사)
│   │       └── toss/webhook/   # 결제 콜백
│   ├── components/
│   ├── lib/
│   │   ├── supabase/           # 클라이언트·서버 헬퍼
│   │   ├── youtube/            # API 래퍼 + 쿼터 계산 주석
│   │   ├── ai/                 # 프롬프트, 스키마
│   │   └── toss/
│   └── types/
├── supabase/
│   ├── migrations/             # 스키마 (승인 후에만 변경)
│   ├── seed.sql                # 기본 주제·시드 채널
│   └── functions/
│       ├── collect-videos/     # 6h: 신규 쇼츠
│       ├── snapshot-stats/     # 1h: 통계 스냅샷 + velocity
│       └── cleanup/            # 1d: 보관 정리
├── PRD/
├── .env.local
└── package.json
```

---

## 절대 하지 마 (DO NOT)

> AI에게 코드를 시킬 때 이 목록을 반드시 함께 공유하세요.

- [ ] API 키·빌링키·비밀번호를 코드에 직접 쓰지 마 (.env.local만)
- [ ] DB 스키마·마이그레이션·RLS 정책·인증 로직을 승인 없이 바꾸지 마
- [ ] 테스트 없이 배포하지 마
- [ ] 목업/하드코딩 데이터로 완성이라고 하지 마
- [ ] npm·yarn 쓰지 마 (pnpm만). lockfile 섞이면 배포가 깨짐
- [ ] `any` 쓰지 마 (`unknown` + 타입 좁히기)
- [ ] 유튜브 영상·음성 파일을 다운로드하거나 서버에 저장하지 마 (API 약관 위반). 재생은 공식 임베드만
- [ ] 유튜브 API 응답을 30일 넘게 캐시하지 마. 통계는 매시간 갱신, 오래된 건 삭제
- [ ] `search.list`를 크론에서 매시간 돌리지 마 (100유닛/회). 발굴용으로 하루 수 회만
- [ ] 생성 한도 검사를 클라이언트(브라우저)에서만 하지 마. 반드시 서버 API에서
- [ ] 다른 조직 데이터가 보이는 쿼리를 쓰지 마. 모든 조직 테이블은 RLS + `org_id` 필터
- [ ] 결제 webhook을 서명 검증 없이 믿지 마
- [ ] 새 라이브러리를 묻지 않고 설치하지 마

---

## 항상 해 (ALWAYS DO)

- [ ] 변경하기 전에 무엇을 왜 바꾸는지 2~3줄 먼저 설명
- [ ] 환경변수는 .env.local에 저장
- [ ] 외부 API(YouTube·Claude·토스) 호출은 실패해도 앱이 죽지 않게 처리하고 사용자에게 쉬운 메시지
- [ ] YouTube 호출마다 쿼터 비용을 주석으로 남기고, 크론 1회 총 비용을 함수 상단에 계산해 둘 것
- [ ] 생성 결과(analysis·shots)는 JSON 스키마로 검증 후 저장 (LLM 출력 그대로 믿지 않기)
- [ ] 생성 실패 시 `gen_used` 차감 롤백
- [ ] 모든 조직 테이블에 RLS 정책 + 테스트
- [ ] 데스크톱 우선이되 모바일에서 피드가 깨지지 않는 반응형
- [ ] 피드 카드에 YouTube 출처(채널명·링크) 표기 (API 브랜딩 가이드)
- [ ] 커밋은 conventional commits + 한국어, `feat/xxx` 브랜치

---

## 수집 쿼터 계산 (기준값)

| 작업 | 호출 | 유닛 | 하루 합계 |
|------|------|------|----------|
| 신규 쇼츠 수집 (6h × 4회) | 채널 500개 × `playlistItems.list` 1유닛 | 500 | 2,000 |
| 신규 영상 메타 (길이·통계) | 신규 약 1,000개 / 50 = 20 × `videos.list` 1유닛 | 20 | 80 |
| 스냅샷 (1h × 24회) | 48h 이내 영상 약 2,000개 / 50 = 40 × 1유닛 | 40 | 960 |
| 채널 발굴 `search.list` | 하루 20회 × 100유닛 | 2,000 | 2,000 |
| **합계** | | | **약 5,000 / 10,000** |

시드 채널이 1,000개를 넘기면 Google 쿼터 확장 신청(심사 수주) 또는 수집 주기 12h로 조정.

---

## 테스트 방법

```bash
# 로컬 실행
pnpm dev

# 타입 체크
pnpm tsc --noEmit

# 테스트
pnpm test

# 빌드 확인
pnpm build

# 크론 함수 로컬 실행
supabase functions serve collect-videos
```

---

## 배포 방법

1. Supabase 프로젝트 생성 → `supabase link` → `supabase db push` (마이그레이션) → `supabase functions deploy`
2. Supabase 대시보드에서 pg_cron 스케줄 등록 (collect 6h, snapshot 1h, cleanup 1d)
3. Vercel에 GitHub 연결 → 환경변수 입력 → main 푸시 시 자동 배포
4. Google Cloud 콘솔에서 YouTube Data API 활성화 + 쿼터 모니터링 알림 설정

---

## 환경변수

| 변수명 | 설명 | 어디서 발급 |
|--------|------|------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 프로젝트 URL | supabase.com 대시보드 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 공개 키 | 동일 |
| SUPABASE_SERVICE_ROLE_KEY | 서버 전용 키 (크론·webhook) | 동일 |
| YOUTUBE_API_KEY | YouTube Data API v3 | console.cloud.google.com |
| ANTHROPIC_API_KEY | Claude API | console.anthropic.com |
| TOSS_CLIENT_KEY / TOSS_SECRET_KEY | 토스페이먼츠 | developers.tosspayments.com |
| TOSS_WEBHOOK_SECRET | 결제 콜백 서명 검증 | 동일 |
| KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET | 카카오 로그인 | developers.kakao.com |

> .env.local 파일에 저장. 절대 GitHub에 올리지 마세요.

---

## [NEEDS CLARIFICATION]

- [ ] 자막 추출 방법: 공식 `captions.download`는 채널 소유자 OAuth가 필요해 남의 영상엔 못 씀. 비공식 자막 엔드포인트(timedtext) 또는 외부 전사 API 중 선택 필요
- [ ] Edge Function 실행 시간 제한 안에 채널 500개 수집이 끝나는지 (안 되면 채널을 50개씩 나눠 여러 번 호출)
- [ ] 토스 정기결제 심사 요건 (사업자 등록·서비스 URL) 준비 여부
