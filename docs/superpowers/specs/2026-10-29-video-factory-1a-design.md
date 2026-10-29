# 영상 공장 (Phase 1a) — 설계

- 날짜: 2026-10-29
- 상위 문서: `PRD/01_PRD.md`, `PRD/02_DATA_MODEL.md`, `PRD/03_PHASES.md`, `PRD/04_PROJECT_SPEC.md`
- 품질 기준: `docs/design/video-references.md` (Q1~Q12)
- 표기: **[사용자 결정]** = 사용자가 정한 것, **[내 판단]** = 설계자가 정한 것 (빌더가 근거를 갖고 바꿀 수 있다)

## 1. 왜 만드나

cosmicpath 숏폼 영상이 **매일 사람 손 없이** 만들어지고, 대시보드에서 미리 볼 수 있게 한다. 업로드는 1b에서 한다. 자동 업로드는 11/17 Threads 실험 판정 뒤에 켠다 **[사용자 결정]**. 자동 렌더는 지금 켜도 된다 **[사용자 결정]**.

**완료 기준**
1. 하루 1편 이상이 사람 손 없이 렌더된다 (GitHub Actions 일정 실행).
2. 사용자가 대시보드에서 보고 "올릴 만하다"고 판정한 영상이 **5편 연속**이다.
3. 매일 드는 외부 비용은 0원이다 (원고 생성 LLM 비용 제외).

## 2. 목표 / 비목표 / 실패 조건

**목표**
- 브랜드 스타일 템플릿 1개(`kinetic-list`)를 고정하고, 매일은 원고·훅 이미지만 바꿔 렌더한다.
- 품질 검사를 통과한 영상만 "완성"으로 표시한다.

**비목표 (1a에서 안 함)**
- 채널 업로드, 취소 창 동작 (1b)
- 매 영상 AI 영상 생성, 에이전트가 매번 새로 디자인하는 것 (PRD 6장)
- Threads 발행·생성·학습 로직 변경, 기존 `video-jobs` 경로 변경

**실패 조건 (기술적으로 돌아가도 실패)**
- 품질 검사가 사실상 무조건 통과한다 (2026-10-24 매일 영상 사고 재발)
- 영상이 "슬라이드 같다"는 판정을 다시 받는다 (Q3)
- 렌더가 내 맥에서만 된다 (CI 폰트 차이로 화면이 달라짐)

## 3. 스타일 [사용자 결정]

샘플 A(수묵 한지, 10/28 기존)·B(흑요석·골드 키네틱)·C(사진 훅 + 한지)를 보고 **"C의 훅 + B의 본문"**을 골랐다. 스파이크 렌더는 보관하지 않는다. 아래 명세가 기준이다.

| 구간 | 시간 | 내용 |
|---|---|---|
| 훅 | 0~1.7초 | 훅 이미지(또는 클립)를 전체 화면에 깔고 1.14→1.0 빠른 푸시인. 위아래 어둡게. 0초 프레임부터 훅 글자: 작은 골드 "11월," + Pretendard 900 168px 흰 글자 2줄 + 골드 밑줄 와이프. 1.5초에 사진은 블러·페이드되며 흑요석으로, 글자는 위로 휩 |
| 도입 | 1.6~3.1초 | "일간별로 / 딱 하나만" 단어별 블러 인 |
| 항목 ×3 | 3.1~8.0초 | 항목마다 약 1.65초: 골드 한자 440px(명조)가 1.3→1 블러 인, 이름, 행동 문장 2줄(96px 900). 다음 항목으로 가로 휩. 위에 `01 / 03` 카운터 |
| 끝 | 8.0~10.0초 | "내 일간 모르면 / 프로필 링크 → 1분" + 리포트 화면(폰 카드)이 올라오며 스크롤 + `COSMICPATH` 워드마크. 2초 정지 |
| 배경 | 전체 | 흑요석 `#0a0908`, 골드 빛 번짐이 천천히 이동, 얇은 결 |
| 소리 | 전체 | BGM 1곡 공유, 볼륨 0.18, 끝 0.6초 페이드 |

글자는 모두 화면 **288~1330px** 띠 안에 둔다 **[내 판단]**. Q4의 위 15%(288px)와 HyperFrames 세로 가이드의 아래 한계(1330px) 중 더 엄격한 쪽을 택했다. 품질 검사도 이 값을 쓴다.

## 4. 전체 흐름

```
[GitHub Actions 매일 1회]
  → GET /api/cron/video-factory/next?brands=cosmicpath
      (오늘 원고가 없으면 생성 → 훅 클립 선택 → 선점 RENDERING → 렌더 입력 JSON 반환)
  → hyperframes render (템플릿 kinetic-list + 변수)
  → 품질 검사 스크립트 (check + 프레임·길이·소리 검사)
  → 통과: Vercel Blob 업로드 → POST /complete {videoUrl, coverUrl}
     실패: POST /complete {errors[]} (영상은 업로드 안 함)
[대시보드 브랜드 페이지] 최근 영상 목록: 재생, 상태, 실패 이유
```

기존 `src/app/api/cron/video-jobs/{next,complete}`의 **패턴만** 따른다: 원자적 선점(`updateMany where status=QUEUED`), 30분 넘은 RENDERING은 QUEUED로 되돌림, `verifyCronSecret`. **경로와 표를 모두 새로 만든다.** 기존 경로는 `TikTokVideoDraft`를 브랜드·상태만으로 집어 가고, 완료 시 Threads `Post`를 만든다 (`video-jobs/next/route.ts:27-60`, `complete/route.ts:40-50`). 그래서 새 영상은 새 표 `VideoDraft`에 둔다 **[사용자 결정, 2026-10-29]**. 그러면 옛 경로가 다시 켜져도 서로 집어 갈 일이 없다. 기존 경로 코드는 한 줄도 바꾸지 않는다.

**하루 기준 [내 판단]**: 한국 시간(KST) 날짜로 센다. 일정 실행은 그날 `COMPLETED` 또는 `RENDERING`인 초안이 없을 때만 새 원고를 만든다. 실패한 날은 일정 실행으로 다시 만들지 않는다. 수동 실행(`workflow_dispatch`)에 `force=true`를 주면 그날 한 편을 더 만든다. 하루 최대 3편이다.

## 5. 부품

### 5.1 원고 생성

- 입력: 브랜드 설정, 포맷 `kinetic_list`, 최근 14일 원고(주제 중복 방지)
- 출력 JSON:
  - `hook.kicker` (≤6자)와 `hook.lines` (2줄, 줄당 ≤8자)
  - `intro.l1` / `intro.l2` (각 ≤6자)
  - `items[3]`: `{ glyph(한자 1자), label(≤4자), action: [줄1, 줄2] (줄당 ≤10자) }`
  - `cta.l1` / `cta.l2`, 채널별 `captions` 3개, `hashtags`
- 글자 수 상한은 템플릿 레이아웃에서 나온 값이다. 넘으면 다시 생성한다 (최대 2회). 그래도 넘으면 FAILED로 남긴다. **글자를 줄이지 않는다.**
- 생성 함수는 새로 짠다. 기존 영상 대본 엔진(`src/lib/tiktok/tiktok-script-engine.ts`)은 LLM 없이 고정 템플릿이고, Anthropic 호출(`src/lib/generate-posts.ts`)은 Threads 글 전용이기 때문이다. Anthropic SDK(이미 설치됨)로 구조화 JSON을 받는다. 모델 ID와 호출 문법은 claude-api 스킬·공식 문서로 확인한다.
- 문구 검사는 기존 규칙을 재사용한다: 브랜드 도메인의 `forbiddenKeywords`(`src/lib/domain-registry.ts`), CTA 금지 규칙(키워드 DM·"댓글 달면" 류, `tiktok-script-engine.ts:282`). 후자는 함수로 꺼내 두 곳에서 쓴다.
- 저장: 새 표 `VideoDraft` (`formatId=kinetic_list`).

### 5.2 훅 클립 선택 (`ClipAsset`)

- 고르는 순서: 브랜드의 켜진 클립 → 최근 7일 안에 쓴 것 제외 → `usedCount` 적은 순 → 같으면 `lastUsedAt` 오래된 순
- 다 최근에 썼으면 그중 가장 오래된 것을 쓴다. 클립이 0개면 브랜드 기본 이미지를 쓴다 (`saju-table.png`).
- 이미지와 영상을 둘 다 받는다. 템플릿은 `hookSrc` 확장자로 `<img>`/`<video muted>`를 고른다.
- 클립 추가는 스크립트 하나로 한다: `scripts/clips/add-clip.mjs --brand cosmicpath --mood 붓,탁자 <파일 또는 URL> --license <출처URL>`. Blob에 올리고 `ClipAsset` 한 줄을 만든다. 처음 30~50개는 Pexels에서 사람이 골라 넣는다 **[내 판단]**. Pexels API 자동 검색은 1a 범위가 아니다.

### 5.3 템플릿 `hyperframes/templates/kinetic-list/`

- 3장의 명세를 HyperFrames 컴포지션으로 만든다. 모든 문구와 `hookSrc`, 색 3개는 `data-composition-variables`로 받는다.
- 폰트는 모두 `assets/fonts/`의 woff2를 쓴다: Pretendard, Noto Serif KR(한자). `local()`로 맥 폰트를 빌리지 않는다. CI와 내 맥 화면이 같아야 한다.
- 고정 에셋은 **git에 커밋한다** **[내 판단]**. 매일 도는 CI가 사람 손 없이 써야 해서다. `templates/kinetic-list/assets/` 아래에 두고 `.gitignore`·`hyperframes/.gitignore`에 이 폴더만 예외를 연다. 합계 약 5MB다.
  - 폰트: Pretendard(OFL), Noto Serif KR(OFL). 한자 10자 + 숫자만 서브셋해서 작게 만든다
  - BGM: `bgm-ambient.m4a` (생성 모델 출력, 0.5MB)
  - 기본 훅 이미지: `saju-table.png` (1.5MB)
  - 리포트 화면: `sample-mobile.png` 상단 1500px 크롭. 원본은 cosmicpath 리포트 페이지 캡처이고, 다시 만드는 명령은 README에 적는다
- `npx hyperframes check` 오류 0, 경고는 이유를 README에 적는다.

### 5.4 렌더 + 품질 검사 (CI)

- 새 워크플로 `.github/workflows/video-factory.yml`: Node 22, ffmpeg, `schedule` 하루 1회 + `workflow_dispatch`. 기존 `render-video.yml`은 건드리지 않는다.
- 렌더: `npx --yes hyperframes@0.8.210 render --variables '<json>' -o out.mp4`
- 품질 검사 `scripts/video-factory/qc.mjs` **[내 판단]**: 결과는 `{ pass, errors[] }`이다.
  1. `hyperframes check --json`의 error가 0이다 (대비, 겹침, 잘림)
  2. 길이가 포맷 범위 안이다 (`kinetic_list`: 9~11초)
  3. 0초 프레임이 검은 화면이 아니다 (Q1). `blackdetect`로 0.3초 넘는 검은 구간이 없다 (Q8)
  4. 움직임: 1초 간격 프레임끼리 차이가 기준값 이상이다 (Q3). 기준값은 스파이크 렌더로 정한다
  5. 오디오 스트림이 있고 무음이 아니다 (`volumedetect`, Q5)
- 통과하면 mp4와 표지(1.5초 프레임 jpg)를 Blob `videos/<brand>/<draftId>.mp4|jpg`에 올린다.

### 5.5 완료 기록

- `POST /api/cron/video-factory/complete`: `{draftId, videoUrl, coverUrl}` 또는 `{draftId, errors}`
- 통과: `status=COMPLETED`, `videoUrl`, `coverUrl`, `renderErrors=[]`, 쓴 클립의 `usedCount+1`, `lastUsedAt`
- 실패: `status=FAILED`, `renderErrors`. 다시 시도하지 않는다. 다음 날 새 원고로 간다 **[내 판단]**.

### 5.6 대시보드

- 브랜드 페이지(`/brands/[slug]`)에 "오늘의 영상" 영역을 추가한다: 최근 7편의 표지, 재생(`<video controls>`), 상태 배지, 실패 이유, 훅 클립 이름.
- 사용자 판정 버튼 "올릴 만함 / 아님" **[내 판단]**: 완료 기준 2(5편 연속)를 숫자로 확인하려는 것이다. `ReviewDecision`은 `postId`가 필수라 쓸 수 없다. 그래서 `VideoDraft.userVerdict`(`good`/`bad`/null)와 `verdictAt`에 저장한다. 다시 누르면 바뀐다. "연속 n편"은 `COMPLETED` 초안을 최신순으로 세다가 `good`이 아닌 것을 만나면 멈춘 수이고, 화면에 표시한다.
- 상태(로딩·빈 목록·오류)와 모바일 레이아웃을 갖춘다 (전역 디자인 규칙).

## 6. 데이터 변경 (승인 필요)

`PRD/02_DATA_MODEL.md`를 기준으로 하되, 원고 표는 새 `VideoDraft`로 바꿨다 (위 4장). 1a에서 필요한 것만 추린다.

| 표 | 변경 |
|---|---|
| `ClipAsset` | 새 표 |
| `VideoDraft` | 새 표 **[사용자 결정]**: `id`, `brandId`, `formatId`, `status`(QUEUED/RENDERING/COMPLETED/FAILED), `script`(원고 JSON), `captions`(채널별 JSON), `hashtags`, `voiceMode`, `clipAssetId`, `renderErrors`, `videoUrl`, `coverUrl`, `userVerdict`, `verdictAt`, `kstDate`, `createdAt`, `updatedAt`. 1b에서 `autoPublishAt`·`cancelledAt`을 더한다 |

`TikTokVideoDraft`와 기존 `video-jobs` 경로는 바꾸지 않는다. `Publication.videoDraftId`는 1b에서 추가한다.

마이그레이션은 구현 계획의 첫 태스크에서 SQL을 보여주고 **사용자 승인을 받은 뒤** 적용한다 (전역 규칙). supabase-postgres-best-practices로 인덱스를 검토한다 (`ClipAsset(brandId, enabled, lastUsedAt)`).

## 7. 순서

1. 마이그레이션 (승인) + 클립 추가 스크립트 + 클립 선택 함수 (단위 테스트)
2. 템플릿 `kinetic-list` (폰트 woff2, 변수화, check 통과, 로컬 렌더로 3장 명세와 같은지 프레임 비교)
3. 원고 생성 + 글자 수 검사 (단위 테스트)
4. next / complete 라우트 (테스트, 기존 `video-jobs.test.ts` 패턴)
5. qc.mjs (일부러 망가뜨린 영상으로 실패하는지 확인)
6. 워크플로 (workflow_dispatch 수동 실행 1회 성공 확인 후 schedule 켬)
7. 대시보드 영역 (브라우저 스크린샷 확인)
8. 클립 30~50개 넣기 (사람이 Pexels에서 고름)

## 8. 내레이션형 포맷은?

PRD는 1a 포맷을 2개(BGM형 + 내레이션형)로 잡았다. 무료 TTS가 아직 미정이라 **1a는 BGM형 `kinetic_list` 하나로 완료 기준을 채운다** **[내 판단]**. 내레이션형은 TTS 샘플 비교(무료 엔진 2~3개, 같은 문장)를 사용자가 듣고 고른 뒤 1a-2로 붙인다. 포맷은 `formatId` + 템플릿 폴더 하나로 늘어나게 둔다.

## 9. 열린 질문

- 이 문서에서 정하지 않고 구현 계획 단계로 넘기는 것: 움직임 검사 기준값 (템플릿 첫 렌더로 정함), BGM 교체 여부 (지금은 `bgm-ambient.m4a`. 광고형에는 템포가 느림)
