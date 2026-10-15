# 홍보 영상 로테이션 설계 (Promo Video Rotation)

- 작성일: 2026-10-15
- 브랜치: `feat/promo-video-rotation`
- 선행 작업: `feat: 유료 리포트 투어 홍보 영상(KO/EN) 추가` — `PromoViral` 컴포지션, `extract-report-data.ts`, `queue-promo-posts.mjs`

## 1. 목표

CosmicPath 제품 홍보 영상을 **주 2회, 매번 다른 버전으로** 자동 생성해 Threads에 올린다. 같은 영상 반복으로 인한 피로를 막기 위해 포맷·주제·가상 인물·훅이 회차마다 바뀐다. 영상 속 숫자는 항상 cosmicpath 엔진의 실제 계산값이다.

### 성공 기준
- 월·목 KST 06:30에 브랜드별(KO `cosmicpath`, EN `cosmicpath-global`) 홍보 영상 1개가 `NEEDS_REVIEW`로 등록된다.
- 2주 안에 같은 포맷+주제+인물 조합이 반복되지 않는다.
- 영상 속 모든 숫자·날짜는 렌더 당일 기준 엔진 계산값이다 (지난 날짜가 "가장 강한 날"로 나오지 않는다).
- 실패 시 반쪽 게시물이 생기지 않고, 같은 날짜로 재실행하면 빠진 것만 채운다.

### 사용자 결정 (브레인스토밍 Q&A)
| 질문 | 결정 |
|---|---|
| 반복 방식 | 매번 다른 버전 |
| 주기 | 주 2회 (기존 매일 사주 설명 영상은 유지) |
| 발행 | 승인 후 발행 (`NEEDS_REVIEW`) |
| 엔진 숫자 출처 | A. CI가 렌더 직전 cosmicpath 엔진으로 계산 |
| 포맷 | ① 리포트 투어 ② A vs B 레이스 ③ 궁합 매치 ④ 7일 실험 — 4개 모두 |

## 2. 범위

**포함**
- 포맷 4종 컴포지션 (①은 기존 `PromoViral` 리팩터)
- 회차 선택 로직 (포맷·주제·인물·훅, 날짜 결정적)
- 엔진 스냅샷 추출 스크립트 일반화 + 결과 이상 감지
- CI 러너 `render-promo-job.mjs` + 워크플로 `render-promo.yml`
- 앱 경로 `POST /api/cron/promo-posts` + `docs/api-spec.md` 등재
- 주제별·포맷별 문구 (KO/EN), 캡션 템플릿

**제외 (YAGNI)**
- 자동 발행, 배경음악, Higgsfield 등 생성형 영상
- 성과 기반 포맷 가중치 학습 (지표가 쌓인 뒤 별도 작업)
- DB 스키마 변경 (기존 `Post` 재사용)
- cosmicpath 쪽 API 추가

## 3. 전체 흐름

```
render-promo.yml (cron '30 21 * * 0,3' = 월·목 KST 06:30, workflow_dispatch)
 ├─ checkout thread-uploader
 ├─ checkout KIMYOUNGGWANG/cosmicpath → ./cosmicpath  (secrets.COSMICPATH_READ_TOKEN)
 ├─ Node 22, CJK 폰트, video·cosmicpath 의존성 설치 (cosmicpath는 --ignore-scripts)
 └─ node video/scripts/render-promo-job.mjs
      for lang in [ko, en]:
        ① pickPromoVariant(date, lang)           → { format, topic, persona(s), hookIndex }
        ② extract-report-data.ts (cosmicpath 로더) → snapshot.json
        ③ validateSnapshot(snapshot)            → 이상하면 해당 lang 중단
        ④ remotion render Promo<Format> --props={lang, variant, snapshot}
        ⑤ @vercel/blob put (public)
      ⑥ POST {APP_URL}/api/cron/promo-posts  (성공한 lang만)
           → 앱이 브랜드별 NEEDS_REVIEW Post 생성 + UTM 첫 댓글
대시보드 승인 → 기존 /api/cron/publish 가 영상 발행 (publishPostWithCredentials의 VIDEO 경로)
```

CI는 DB에 직접 접근하지 않는다 (기존 `render-job.mjs` 규칙과 동일). 상태 변경은 앱 경로가 소유한다.

## 4. 회차 선택 규칙 (`video/src/promo/rotation.ts`)

순수 함수, 입력은 날짜(`YYYY-MM-DD`, KST)와 언어. 같은 입력이면 항상 같은 결과.

- **슬롯 번호**: 기준일 `2026-10-19`(월)부터 센 월·목 슬롯 순번. 월·목이 아닌 날짜(수동 실행)는 직전 슬롯 번호를 쓴다.
- **포맷**: `FORMATS = [reportTour, race, match, experiment]`, `format = FORMATS[slot % 4]`.
  - EN에서 `match`가 걸리면 `race`로 대체 (궁합 화면이 한국어 전용).
- **주제**: `TOPICS = [contact, career, confession, sideJob, marriage, partnership]`.
  - 일반: `TOPICS[slot % 6]`
  - `match` 회차: 관계 주제 `[contact, confession, marriage, partnership]`에서 `[floor(slot / 4) % 4]`
- **가상 인물**: 날짜 문자열 시드의 결정적 난수.
  - 출생 1990–2001년, 월 1–12, 일 1–28, 시 0–23, 분 0 또는 30, 출생지 서울.
  - 성별은 슬롯 홀짝으로 번갈아.
  - `match`는 두 번째 인물을 시드 `date + ":guest"`, 반대 성별로 만든다.
- **훅**: 포맷마다 3개, `hookIndex = floor(slot / 4) % 3`.
- 수동 실행 시 `--format`, `--topic` 덮어쓰기 허용.

## 5. 포맷 4종

공통: 1080×1920, 30fps, 무음 + 무음 AAC 트랙, `PromoKit` 팔레트(흑요석·샴페인 골드), 각 장면에 "가상 인물 예시 · 숫자는 엔진 실제 계산값" 표시, 마지막 CTA + 참고용 고지.

| 포맷 | 컴포지션 | 길이 | 연출 | 엔진 실제값 | 링크 |
|---|---|---|---|---|---|
| ① 리포트 투어 | `PromoReportTour` | 45초 | 훅 → 문제 → 5엔진 → 질문 → 리포트 01~05 → (KO 관계 주제: 궁합 / 그 외: 7일 뒤 결과 대조) → CTA | 사주 4주·오행, 12개월 흐름, 월별 단계·최강일, 자미두수 12궁 | `/start` |
| ② A vs B 레이스 | `PromoRace` | 20초 | 훅 → 질문 → 좌우 분할 A/B 막대가 월별로 경주 → 최고·최저 달 강조 → 엔진 헤드라인 → "너라면 A야 B야?" | 12개월 행동 지수, 최고/최저 달, 헤드라인 | `/start` |
| ③ 궁합 매치 (KO) | `PromoMatch` | 20초 | 훅 → 두 생일 카드 충돌 → 사주/점성/수비학 점수 차례로 채움 → 종합 점수 → 천간합·지지충 배지 → "이거 너랑 나 돌려볼까?" | `match-calculator.calculateCompatibility` 점수·오행·별자리·합충 | `/start?context=love` |
| ④ 7일 실험 | `PromoExperiment` | 20초 | 훅 → 질문 → Day1→7 체크리스트 체크 → Day4 '접을 신호' 경고 → "저장해두고 이번 주에 해봐" | '언제' 구간(최고 달), 최강일 | `/start` |

- ①의 자미두수 강조 궁: career→관록궁, sideJob→재백궁, partnership→노복궁, 관계 주제→부처궁.
- ①은 기존 `PromoViral`을 props 기반으로 바꾼 것이다. 기존 컴포지션 ID `PromoViralKo/En`은 미리보기용 기본값으로 남긴다.
- 컴포지션 props는 Zod 스키마로 검증한다: `{ lang, variant: { format, topic, hookIndex, persona, guest? }, copy, snapshot }`.

## 6. 문구 (`video/src/promo/copy.ts`)

- 주제 6개 × KO/EN: 질문, A/B 선택지, 7일 실험 단계(Day1·3·5·7), if/then 2줄, 접을 신호, 캡션 본문, 첫 댓글 문구.
- 포맷 4개 × 훅 3개 × KO/EN.
- 규칙 (cosmicpath `docs/product.md`):
  - 숫자는 엔진값만. 조작된 퍼센트·점수·소셜 프루프 금지.
  - "판정/직답/권고/최적기" 금지. 대신 결정해주지 않는다는 톤.
  - 가격은 `$9.99`(7일 결정 패킷)만, 궁합 가격은 노출하지 않는다.
  - 예시 문구(7일 실험, if/then 등)가 나오는 화면은 '예시 화면' 표시.
  - KO 캡션은 반말 독백체, EN은 대화체. Threads 본문 480자 이내(분할 방지).
- 구현 전에 사용자 검토를 받는다 (계획의 별도 체크포인트).

## 7. 엔진 스냅샷 (`video/scripts/extract-report-data.ts`)

입력 JSON(`--input`)을 받아 출력 JSON(`--out`)을 쓴다. cosmicpath 루트에서 `node --experimental-transform-types --import ./scripts/alias-loader.mjs`로 실행.

- 입력: `{ asOf, lang, topic, scenarioA, scenarioB, question, persona, guest? }`
- 출력 (기존 구조 확장):
  - `saju`: 일간, 4주, 오행
  - `heatmap`: 월별 단계·평균, 최강일
  - `scenario`: 헤드라인, 최고 달 라벨, 12개월 타임라인
  - `ziwei`: 12궁, 영문명, 사화
  - `match` (guest가 있을 때만): `calculateCompatibility` 결과 중 overall/saju/astro/num 점수, 양측 오행·별자리, `tianganHe`, `dizhiChong`
- 기존 `promo-report-data.json`은 미리보기 기본값으로 유지.

### 이상 감지 (`video/src/promo/validate-snapshot.ts`)
렌더 전에 실패시키는 조건:
- 타임라인이 12개가 아니거나, 행동 지수가 전부 같거나, 범위(0–100)를 벗어남
- 최강일이 없거나 `asOf` 이전 날짜
- 헤드라인·라벨에 깨진 패턴(예: `/\d+M\b/`, `undefined`, `NaN`)
- 자미두수 12궁이 아님
- `match` 포맷인데 점수가 없거나 범위 밖

## 8. 앱 경로 `POST /api/cron/promo-posts`

- 인증: `verifyCronSecret` (기존 cron과 동일). 실패 시 401.
- 본문:
  ```json
  {
    "date": "2026-10-19",
    "items": [
      { "brandSlug": "cosmicpath", "videoUrl": "https://…mp4", "content": "…", "commentTemplate": "… {{link}}",
        "landingPath": "/start", "format": "reportTour", "topic": "career" }
    ]
  }
  ```
- 검증: `date` 형식, `videoUrl`은 https + `isVideoMediaUrl`, `content` 1–480자, `landingPath`는 `/start`로 시작, 브랜드 존재. 형식 오류 400, 브랜드 없음은 해당 item만 `skipped: "brand_not_found"`.
- 멱등성: `formulaId = video:promo:<date>` + `brandId`가 이미 있으면 `skipped: "already_queued"`.
- 생성: `Post { status: NEEDS_REVIEW, imageUrls: [videoUrl], scheduledAt: now, formulaId, topic: "<format>:<topic>", qualityReasons: ["영상 포스트: 승인 후 발행"] }` → 생성 후 `linkUrl = https://cosmicpath.app<landingPath>?utm_source=threads&utm_campaign=promo-rotation&utm_content=<postId>`, `utmContent = postId`, `firstComment = commentTemplate.replace("{{link}}", linkUrl)`.
- 응답: `{ results: [{ brandSlug, postId? , skipped? }] }`.
- 구조: route → `src/lib/promo/promo-post-service.ts` (서비스) → prisma. 라우트에 비즈니스 로직을 두지 않는다.
- `docs/api-spec.md`의 Cron API 표와 TikTok/영상 섹션에 먼저 등재한다.

## 9. 실패 처리

| 상황 | 동작 |
|---|---|
| 엔진·검증·렌더·업로드 실패 | 해당 lang은 등록 요청에서 빠짐. 둘 다 실패면 등록 요청 없이 종료, 워크플로 실패(빨간불, GitHub 기본 알림) |
| KO/EN 중 하나만 성공 | 성공한 쪽만 등록. 재실행 시 등록된 쪽은 `already_queued`로 건너뜀 |
| cosmicpath 엔진 경로 변경 | 추출 단계 실패로 즉시 드러남 |
| 회차 누락 (CI 장애 등) | 밀린 회차를 몰아 올리지 않음. 다음 실행은 그날 날짜 기준 |
| 앱 경로 실패 | 러너가 실패 처리. Blob 파일은 남지만 재실행 시 새로 업로드(랜덤 접미사) — 고아 파일은 용량상 무시 |

수동 실행(`workflow_dispatch`) 입력: `date`(기본 오늘), `format`, `topic`, `dry_run`.

## 10. 테스트

- `video/src/promo/rotation.test.ts`: 날짜 → 포맷·주제·인물·훅 결정성, `match` 회차 관계 주제 한정, EN `match→race` 대체, 2주(4슬롯) 내 조합 비중복.
  - 선택 로직·문구·`validateSnapshot`은 영상 쪽(`video/src/promo/`)에만 둔다. 앱 경로는 CI가 보낸 format/topic을 받기만 하므로 필요 없다.
  - 이 파일들은 remotion/React를 import 하지 않는 순수 TS로 두고, 러너(`.mjs`)는 Node 22 `--experimental-strip-types`로 직접 import 한다.
  - 루트 `vitest.config.ts`의 `include`에 `video/src/promo/**/*.test.ts`를 추가해 `pnpm test`로 함께 돌린다.
- `src/app/api/cron/promo-posts/promo-posts.test.ts`: 기존 `video-jobs.test.ts`처럼 prisma mock. 401, 400 검증, 브랜드 없음, 중복 건너뜀, UTM·첫 댓글 생성.
- `validateSnapshot` 단위 테스트: 정상/깨진 헤드라인/평평한 타임라인/지난 최강일.
- 로컬 리허설: `render-promo-job.mjs --dry-run --date … --format …` → 업로드·등록 없이 `video/out/`에 렌더. 포맷 4 × KO/EN 스틸 확인.
- 완료 기준: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `video`의 `pnpm typecheck` 통과 + 포맷별 스틸 확인.

## 11. 사용자 1회 설정

1. GitHub Secrets `COSMICPATH_READ_TOKEN`: cosmicpath 저장소 전용 fine-grained 토큰, Contents: Read.
2. GitHub Secrets `BLOB_READ_WRITE_TOKEN`: 새 public 스토어 토큰으로 교체 (매일 설명 영상과 공용).
3. 기존 `CRON_SECRET`, `APP_URL`은 그대로 사용.

## 12. 열린 위험

- cosmicpath 의존성 설치 시간 (CI 1–3분 추가 예상). 너무 길면 엔진 import 경로만 sparse checkout으로 줄인다.
- 궁합 계산기 `strengths/challenges` 등 문장형 필드는 영상에 쓰지 않는다 (점수·합충만 사용) — 문장 품질을 영상에서 보장할 수 없어서.
- 영어 헤드라인 버그(`Next year 9M`)는 별도 작업(task_5e4e6f49)에서 수정 중. 수정 전에는 `validateSnapshot`이 EN 회차를 막을 수 있으므로, EN ②는 헤드라인 대신 최고 달 라벨로 문장을 조립한다(현재 ①과 동일 방식).
