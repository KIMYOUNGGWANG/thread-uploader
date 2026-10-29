# SNS 운영 비서 -- 프로젝트 스펙

> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 이 문서를 AI에게 항상 함께 공유하세요.
> 저장소 공통 규칙(`CLAUDE.md`, `.claude/rules/*.md`)이 먼저다. 이 문서는 이 제품에만 붙는 규칙이다.

---

## 기술 스택

새 스택을 들이지 않는다. 지금 저장소 것을 그대로 쓰고, 영상 엔진만 하나로 정한다.

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 16 (기존) | 대시보드·API·cron 라우트가 이미 여기 있다 |
| DB | PostgreSQL + Prisma 5 (기존) | `ChannelAccount`·`Publication`·`TikTokVideoDraft`가 이미 있다 |
| 배포 | Vercel (기존) | 기존 그대로. 함수 시간 제한은 플랜과 `maxDuration`에 따라 다르다 (예: `api/posts/[id]/publish/route.ts`는 300초). 렌더는 수 분이 걸려서 Vercel에서 돌리지 않는다 |
| 영상 엔진 | **HyperFrames** (`hyperframes/`, 0.8.210 고정) **[사용자 결정]** | 레퍼런스(광고 모션·자막·브랜드 킷)가 대부분 이쪽이고, 블록 약 450개와 릴스 템플릿이 있다. Remotion(`video/`)은 새 포맷에 쓰지 않는다 |
| 렌더 실행 | GitHub Actions 새 워크플로 (Node 22+, ffmpeg, Noto 한글 폰트) | 공개 저장소라 무료다. 기존 `render-video.yml`은 Remotion·Node 20용이라 따로 만든다 |
| 파일 저장 | Vercel Blob (기존 `video/scripts/render-job.mjs`) | 이미 렌더 결과를 여기에 올린다 |
| 원고 생성 | Anthropic SDK (기존) | 기존 원고 생성·품질 게이트를 재사용한다 |
| 외부 cron | Cloudflare Worker / cron-job.org (기존, `docs/ops/external-scheduler.md`) | 시간에 민감한 업로드 틱에 쓴다 |
| 인증 | 기존 대시보드 로그인 | 사용자 1명. 새 로그인은 만들지 않는다 |
| 패키지 매니저 | pnpm | 전역 규칙. HyperFrames CLI는 버전을 고정한 `npx`로 부른다 (기존 README 방식) |

---

## 프로젝트 구조 (추가되는 곳만)

```
threads-uploader/
├── hyperframes/              # 영상 템플릿 (브랜드 스타일 + 포맷별 레이아웃)
│   ├── specs/                # 렌더 입력 JSON
│   └── assets/               # 폰트·BGM (git 밖 파일은 README에 재생성 방법)
├── src/lib/video/            # 원고→렌더 입력 변환, 클립 선택, 품질 검사 (새로)
├── src/lib/channels/         # (기존 폴더) youtube·tiktok 업로드 어댑터 추가
├── src/app/api/cron/         # video-generate, video-publish 틱 (새로)
├── docs/design/video-references.md   # 영상 레퍼런스 통합 문서 (새로)
└── PRD/                      # 이 문서들
```

폴더 이름은 빌더가 기존 구조에 맞춰 바꿔도 된다.

---

## 절대 하지 마 (DO NOT)

> AI에게 코드를 시킬 때 이 목록을 반드시 함께 공유하세요.

- [ ] API 키나 토큰을 코드·git에 넣지 마 (`.env.local`에만)
- [ ] DB 스키마·마이그레이션을 설명과 승인 없이 바꾸지 마 (전역 규칙)
- [ ] **Threads 발행·생성·학습 로직을 건드리지 마** (11/17 글 길이 실험 동결)
- [ ] **영상을 Threads 경유로 올리지 마.** 각 채널에 직접 올린다
- [ ] **매 영상마다 AI 영상 생성(Higgsfield 등)이나 유료 API를 부르지 마.** 돈이 드는 호출은 켜기 전에 사용자에게 확인한다
- [ ] 품질 검사를 통과하지 못한 영상을 올리지 마. 검사를 "무조건 통과"로 만들지 마 (2026-10-24 매일 영상 사고 재발 방지)
- [ ] 같은 영상을 같은 채널에 두 번 올리지 마 (Publication 유일 제약 + 기존 인스타 중복 방지 패턴)
- [ ] 라이선스를 확인하지 않은 외부 스킬·템플릿 코드를 복사하지 마. 스톡 클립은 출처 URL을 `ClipAsset.license`에 남긴다
- [ ] 새 라이브러리를 묻지 않고 설치하지 마 (전역 규칙)
- [ ] 목업 데이터나 손으로 렌더한 영상으로 "완성"이라고 하지 마
- [ ] 예언형 문구, "댓글 달면 해석", 키워드 DM을 원고에 쓰지 마 (브랜드 보이스 규칙)

---

## 항상 해 (ALWAYS DO)

- [ ] 바꾸기 전에 무엇을 왜 바꾸는지 먼저 설명
- [ ] 환경변수는 `.env.local`, 운영 값은 Vercel·GitHub Secrets
- [ ] 업로드 실패는 이유와 함께 `Publication.errorLog`에 남기고, 보고판에 보이게
- [ ] 외부 API 문법은 기억으로 쓰지 말고 공식 문서(context7·docs-guide)로 확인
- [ ] 렌더 결과는 실제 영상 파일과 프레임 캡처로 확인한 뒤에만 "됐다"고 보고
- [ ] 대시보드 화면은 모바일에서도 쓸 수 있게 (보고판은 폰으로 볼 수 있다)
- [ ] 비용이 드는 기능은 끄는 스위치(`brandConfig`)를 둔다

---

## 채널 제약 (2026-10-29 공식 문서 확인)

| 채널 | 제약 | 출처 |
|---|---|---|
| 틱톡 | 심사 전 앱이 올린 콘텐츠는 모두 **비공개**로 제한된다. 공개하려면 앱 심사 필요 | developers.tiktok.com Content Posting API Get Started |
| 유튜브 | `videos.insert`는 프로젝트당 하루 100회 (다른 엔드포인트와 별도 할당) | developers.google.com/youtube/v3/determine_quota_cost |
| 스톡 (Pexels) | 무료·출처 표기 불필요·광고와 SNS 사용 가능. 수정 없이 재판매, 인물을 나쁘게 묘사, 보증 암시, 상표 사용은 금지 | pexels.com/license |
| 인스타 | 기존 릴스 업로드 코드가 공개 영상 URL을 넘긴다 (`createReelsContainer`) | 저장소 코드 |

---

## 테스트 방법

```bash
pnpm typecheck
pnpm test
pnpm build
```

```bash
cd hyperframes && npx --yes hyperframes@0.8.210 check
```

영상 결과는 렌더된 mp4의 프레임 캡처로 확인한다 (품질 검사 항목별).

---

## 배포 방법

- 앱: main 머지 → Vercel 자동 배포 (기존)
- 렌더: GitHub Actions 워크플로 (schedule + workflow_dispatch)
- 업로드 틱: 외부 cron에 잡 추가 (`scripts/register-cronjobs.mjs`)

---

## 환경변수 (새로 필요한 것, 이름은 빌더가 기존 규칙에 맞춰 정함)

| 용도 | 어디서 발급 |
|------|------------|
| 유튜브 OAuth 클라이언트 ID·시크릿 | Google Cloud Console (YouTube Data API v3 사용 설정) |
| 틱톡 앱 클라이언트 키·시크릿 | TikTok for Developers (Content Posting API) |
| 스톡 검색 키 (클립 수집을 자동화할 경우만) | Pexels API |

> `.env.local`에 저장. 절대 GitHub에 올리지 마세요. 채널 토큰은 DB의 `ChannelAccount`에 저장한다 (기존 방식).

---

## [NEEDS CLARIFICATION]

- [ ] CI에서 HyperFrames 렌더 시 한글 폰트 (README: Mac의 AppleMyungjo 대신 Noto Serif KR woff2 필요)
- [ ] 영상 파일 저장소와 보관 기간
- [ ] 내레이션 무료 TTS 엔진
- [ ] 품질 검사의 "비평 단계(LLM 비전)"를 켤지와 월 비용 상한
