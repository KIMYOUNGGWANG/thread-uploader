# 웰니스 미디어 -- 프로젝트 스펙

> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 저장소 루트 `CLAUDE.md` 규칙이 이 문서보다 우선한다.

---

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 16 (기존) | 이미 배포 중인 Portfolio Growth OS를 확장한다. 새 앱을 만들면 게시·성과·인스타 연동을 다시 만들어야 한다 |
| DB | PostgreSQL + Prisma (기존) | 기존 Brand·Post·Publication 위에 출처·기사·카드 테이블만 붙인다 |
| AI | Anthropic SDK (기존) | 기존 생성 파이프라인(`claude-text.ts` 등) 재사용 |
| 이미지 | `carousel-cards/` 렌더러 + sharp (기존) | 카드뉴스 렌더가 이미 있다. 웰니스용 템플릿만 추가 |
| 게시 | 기존 스레드 크론 + `instagram-api.ts` + PR #128 카드 배포 흐름 | 재시도·취소 창·성과 수집이 이미 있다 |
| 배포 | Vercel (기존) | `vercel.json`에 크론이 이미 설정되어 있다 |
| 인증 | 기존 운영자 로그인 | 운영자 1명이라 새 인증이 필요 없다 |
| 패키지 매니저 | 루트는 npm | 저장소 `CLAUDE.md` 규칙. 전역 pnpm 규칙보다 우선 |

---

## 프로젝트 구조 (추가되는 곳만)

```
threads-uploader/
├── PRD/wellness-media/          # 이 문서들
├── src/
│   ├── app/                     # 출처 관리·글감 후보·검수 화면 추가
│   └── lib/
│       ├── wellness/            # 글감 점수화, 초안 프롬프트, 금지 표현 검사 (신규)
│       ├── news-rss.ts          # 재사용 (Google News 전용 → 일반 RSS 지원 확장 검토)
│       └── carousel-cards/      # 재사용 + 웰니스 템플릿 추가
└── prisma/schema.prisma         # ContentSource·SourceArticle·PostArticle·PostSlide 추가 (승인 후)
```

---

## 절대 하지 마 (DO NOT)

- [ ] API 키·토큰을 코드에 직접 쓰지 마 (`.env.local`만 사용)
- [ ] 스키마를 승인 없이 바꾸지 마 (마이그레이션 전 설명 + 승인)
- [ ] 기존 제품 프로필(CosmicPath 등)의 생성·게시 동작을 바꾸지 마. 웰니스 전용 로직은 `src/lib/wellness/`와 brand 설정으로 분기
- [ ] 금지 표현이 걸린 초안을 자동 게시하지 마. 반드시 운영자 승인을 거친다
- [ ] 질병 치료·예방, 효능 단정 표현을 생성하지 마 (예: "불면증 개선", "살 빠지는", "면역력 강화")
- [ ] 건강기능식품을 추천·판매하는 문구를 만들지 마
- [ ] 출처 없는 사진(Pinterest 등)을 카드에 쓰지 마. 라이선스가 확인된 이미지나 AI 생성 이미지만 쓴다
- [ ] 기사 본문을 그대로 옮기지 마. 요약·재구성하고 출처를 캡션에 남긴다
- [ ] 루트에서 pnpm·yarn을 실행하지 마 (npm lockfile)
- [ ] 목업 데이터로 완성이라고 하지 마

---

## 항상 해 (ALWAYS DO)

- [ ] 변경하기 전에 계획을 먼저 보여줘
- [ ] 새 로직은 테스트부터 쓰고 구현 (기존 `*.test.ts` 패턴, vitest)
- [ ] 생성된 사실(숫자·날짜·인용)은 원문 링크를 함께 저장해 검수 화면에 보여줘
- [ ] 검수 화면은 폰에서도 쓸 수 있게 반응형으로
- [ ] 게시 실패는 대시보드에 이유와 재시도 버튼으로 보여줘

---

## 테스트 방법

```bash
# 로컬 실행
npm run dev

# 타입 체크
npm run typecheck

# 테스트
npm test

# 빌드 확인
npm run build
```

---

## 배포 방법

기존과 같다. 작업 브랜치 → PR → main 머지 시 Vercel이 배포한다. 크론은 `vercel.json`에 경로를 추가한다.

---

## 환경변수

| 변수명 | 설명 | 어디서 발급 |
|--------|------|------------|
| DATABASE_URL | 기존 Postgres | 기존 |
| ANTHROPIC_API_KEY | 기존 AI 키 | 기존 |
| Instagram 앱 ID·시크릿 (기존 변수명 따름) | 캐러셀 게시 권한 | Meta for Developers |

> 새 변수가 필요하면 `.env.local`에만 추가한다. 절대 git에 올리지 않는다.

---

## [NEEDS CLARIFICATION]

- [ ] `news-rss.ts`가 Google News 전용이라 일반 RSS(해외 매체)를 읽으려면 파서 확장이 필요한지
- [ ] 카드 템플릿 디자인: 화면 작업이라 레퍼런스(벤치마크 캡처 또는 `docs/design/visual-direction.md`)를 먼저 정한다
- [ ] 인스타 Meta 앱 권한 승인 상태
