# 영상 공장 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cosmicpath 숏폼 영상(`kinetic_list`, 10초)이 매일 사람 손 없이 원고 생성 → 렌더 → 품질 검사 → Blob 업로드까지 되고, 대시보드에서 보고 판정할 수 있다.

**Architecture:** Next.js cron 라우트 2개(`video-factory/next`, `complete`)가 새 표 `VideoDraft`의 작업을 내주고 받는다. GitHub Actions가 HyperFrames 템플릿 `hyperframes/templates/kinetic-list`를 렌더하고, ffmpeg 기반 품질 검사를 통과한 영상만 Vercel Blob에 올린다. 순수 로직(날짜, 클립 선택, 원고 검사, 변수 생성, QC 판정)은 작은 파일로 나눠 단위 테스트한다.

**Tech Stack:** Next.js 16, Prisma 5 + PostgreSQL, vitest 4, Anthropic SDK(기존), HyperFrames CLI 0.8.210(`npx`), ffmpeg/ffprobe, `@vercel/blob` 2.8.0(`video/` 패키지에 이미 있음), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-29-video-factory-1a-design.md` (+ `docs/design/video-references.md` Q1~Q12)

## Global Constraints

- 패키지 매니저는 pnpm. 새 라이브러리 설치 금지 (필요하면 멈추고 사용자에게 묻는다).
- `any` 금지, `unknown` + 타입 좁히기.
- Threads 발행·생성·학습 코드, `src/app/api/cron/video-jobs/**`, `TikTokVideoDraft`, `.github/workflows/render-video.yml`은 한 줄도 바꾸지 않는다.
- DB 마이그레이션은 SQL을 사용자에게 보여주고 **승인받은 뒤** 적용한다.
- 비밀값은 `.env.local` / GitHub Secrets에만. 새 시크릿 이름은 기존 것(`APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`)만 쓴다.
- 하루 기준은 KST 날짜. 일정 실행은 그날 `COMPLETED`·`RENDERING`이 없을 때만 새로 만든다. `force=1`이면 하루 최대 3편까지.
- 글자는 화면 y 288~1330px 안. 영상 1080×1920, 30fps, `kinetic_list` 길이 10초(QC 허용 9~11초).
- 색: 배경 `#0a0908`, 골드 `#c8a84d`, 밝은 골드 `#f5d77f`. 본문 Pretendard 900, 한자만 Noto Serif KR.
- 원고 글자 수 상한(넘으면 재생성, 줄이지 않음): `hook.kicker` ≤6, `hook.lines` 2줄 각 ≤8, `intro.l1`/`l2` 각 ≤6, `items` 정확히 3개, `label` ≤4, `action` 2줄 각 ≤10, `cta.l1` ≤10, `cta.l2` ≤12. 생성은 최초 1회 + 재시도 2회.
- `glyph`는 `甲乙丙丁戊己庚辛壬癸` 중 하나 (폰트 서브셋과 맞춤).
- 커밋 메시지: conventional commits, 한국어 설명.

## Review Focus

1. **같은 날 next가 두 번 호출됨** (일정 + 수동 실행 겹침): 두 번째 호출은 새 원고를 만들지 않고 `job: null`. → Task 6 테스트 `does not create a second draft on the same KST day`.
2. **렌더러가 죽어서 RENDERING이 남음**: 30분 뒤 다음 호출이 QUEUED로 되돌려 다시 내준다. → Task 6 테스트 `requeues stale RENDERING drafts`.
3. **complete가 두 번 오거나 RENDERING이 아닌 초안에 옴**: 409, 클립 사용 횟수가 두 번 오르지 않는다. → Task 6 테스트 `rejects completion for a draft that is not RENDERING`.
4. **LLM이 글자 수를 넘기거나 금지어를 씀**: 재생성 3회 모두 실패하면 FAILED 초안으로 남고 렌더하지 않는다. → Task 4 테스트 `gives up after three invalid attempts`.
5. **브랜드에 클립이 0개**: 기본 훅 이미지(`assets/hook-default.png`)로 렌더한다. → Task 2 테스트 `returns null when there are no enabled clips` + Task 5 테스트 `falls back to the default hook`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261030000000_add_video_factory/migration.sql` | `ClipAsset`, `VideoDraft` |
| `src/lib/video-factory/kst.ts` | KST 날짜 문자열 |
| `src/lib/video-factory/clip-picker.ts` | 훅 클립 고르기 |
| `src/lib/video-factory/kinetic-list-script.ts` | 원고 타입·검사 (글자 수, glyph, 금지어) |
| `src/lib/video-factory/generate-kinetic-list.ts` | Anthropic 호출 + 재시도 + 키 없을 때 대체 원고 |
| `src/lib/video-factory/render-variables.ts` | 원고 → 템플릿 변수 |
| `src/lib/video-factory/draft-service.ts` | 선점·생성·완료 (DB) |
| `src/lib/video-factory/verdict.ts` | 연속 "올릴 만함" 계산 |
| `src/app/api/cron/video-factory/{next,complete}/route.ts` | cron 라우트 (얇게) |
| `src/app/api/video-drafts/[id]/verdict/route.ts` | 사용자 판정 |
| `hyperframes/templates/kinetic-list/` | 템플릿 + 커밋되는 에셋 |
| `scripts/video-factory/qc-rules.mjs` | QC 판정 (순수 함수) |
| `video/scripts/factory-job.mjs` | CI 러너 (next → render → qc → blob → complete) |
| `.github/workflows/video-factory.yml` | 매일 실행 |
| `src/app/brands/[slug]/videos/page.tsx`, `src/components/videos/VideoFactoryPanel.tsx` | 대시보드 |
| `scripts/clips/add-clip.mjs` | 클립 추가 |

---

### Task 1: DB 스키마 (승인 게이트)

**Files:**
- Modify: `prisma/schema.prisma` (model `Brand`에 관계 2줄, 새 model 2개)
- Create: `prisma/migrations/20261030000000_add_video_factory/migration.sql`

**Interfaces:**
- Produces: Prisma 모델 `ClipAsset`, `VideoDraft` (아래 필드 그대로). 이후 모든 태스크가 `prisma.clipAsset`, `prisma.videoDraft`를 쓴다.

```prisma
model ClipAsset {
  id          String   @id @default(cuid())
  brandId     String
  brand       Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  source      String   // stock | ai | own
  kind        String   // image | video
  fileUrl     String
  license     String
  mood        String   @default("[]")
  durationSec Float?
  usedCount   Int      @default(0)
  lastUsedAt  DateTime?
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  videoDrafts VideoDraft[]

  @@index([brandId, enabled, lastUsedAt])
}

model VideoDraft {
  id           String     @id @default(cuid())
  brandId      String
  brand        Brand      @relation(fields: [brandId], references: [id], onDelete: Cascade)
  formatId     String
  status       String     @default("QUEUED") // QUEUED | RENDERING | COMPLETED | FAILED
  kstDate      String     // YYYY-MM-DD
  script       String     @default("{}")
  captions     String     @default("{}")
  hashtags     String     @default("[]")
  voiceMode    String     @default("bgm_only")
  clipAssetId  String?
  clipAsset    ClipAsset? @relation(fields: [clipAssetId], references: [id], onDelete: SetNull)
  renderErrors String     @default("[]")
  videoUrl     String?
  coverUrl     String?
  userVerdict  String?    // good | bad
  verdictAt    DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([brandId, kstDate])
  @@index([status, updatedAt])
}
```

- [ ] **Step 1:** 위 모델과 `Brand`의 `clipAssets ClipAsset[]`, `videoDrafts VideoDraft[]`를 추가한다.
- [ ] **Step 2:** `pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261030000000_add_video_factory/migration.sql`로 SQL을 만든다. 기존 마이그레이션 형식과 맞는지 눈으로 확인한다.
- [ ] **Step 3: 멈춤.** SQL 전문을 사용자에게 보여주고 승인을 기다린다. supabase-postgres-best-practices 관점(인덱스 컬럼 순서, FK 인덱스)으로 한 줄 평을 붙인다.
- [ ] **Step 4:** 승인 후 `pnpm prisma migrate deploy` → `pnpm prisma generate` → `pnpm typecheck` 통과.
- [ ] **Step 5: Commit** `feat(db): 영상 공장 ClipAsset·VideoDraft 표 추가`

---

### Task 2: KST 날짜 + 클립 선택

**Files:**
- Create: `src/lib/video-factory/kst.ts`, `src/lib/video-factory/clip-picker.ts`
- Test: `src/lib/video-factory/kst.test.ts`, `src/lib/video-factory/clip-picker.test.ts`

**Interfaces:**
- Produces:
  - `kstDate(now: Date): string` (`"YYYY-MM-DD"`, UTC+9)
  - `type PickableClip = { id: string; usedCount: number; lastUsedAt: Date | null }`
  - `pickClip<T extends PickableClip>(clips: T[], now: Date): T | null`

- [ ] **Step 1: 실패하는 테스트**

```ts
it("rolls over at 15:00 UTC", () => {
  expect(kstDate(new Date("2026-10-29T14:59:59Z"))).toBe("2026-10-29");
  expect(kstDate(new Date("2026-10-29T15:00:00Z"))).toBe("2026-10-30");
});
const now = new Date("2026-10-30T00:00:00Z");
const day = 86_400_000;
it("skips clips used in the last 7 days, then prefers lower usedCount, then older lastUsedAt", () => {
  const clips = [
    { id: "recent", usedCount: 0, lastUsedAt: new Date(now.getTime() - 2 * day) },
    { id: "busy", usedCount: 5, lastUsedAt: new Date(now.getTime() - 20 * day) },
    { id: "freshA", usedCount: 1, lastUsedAt: new Date(now.getTime() - 9 * day) },
    { id: "freshB", usedCount: 1, lastUsedAt: new Date(now.getTime() - 30 * day) },
  ];
  expect(pickClip(clips, now)?.id).toBe("freshB");
});
it("uses the oldest clip when every clip was used in the last 7 days", () => {
  const clips = [
    { id: "a", usedCount: 3, lastUsedAt: new Date(now.getTime() - 1 * day) },
    { id: "b", usedCount: 9, lastUsedAt: new Date(now.getTime() - 6 * day) },
  ];
  expect(pickClip(clips, now)?.id).toBe("b");
});
it("treats never-used clips as eligible", () => {
  expect(pickClip([{ id: "n", usedCount: 0, lastUsedAt: null }], now)?.id).toBe("n");
});
it("returns null when there are no enabled clips", () => {
  expect(pickClip([], now)).toBeNull();
});
```

- [ ] **Step 2:** `pnpm vitest run src/lib/video-factory` → FAIL (모듈 없음)
- [ ] **Step 3:** 두 함수 구현. `kstDate`는 `now.getTime() + 9h`의 ISO 앞 10자.
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5: Commit** `feat(video): KST 날짜와 훅 클립 선택 함수 추가`

---

### Task 3: 원고 타입과 검사

**Files:**
- Create: `src/lib/video-factory/kinetic-list-script.ts`
- Modify: `src/lib/tiktok/tiktok-script-engine.ts` (`FORBIDDEN_CTA_PATTERN` 옆에 `export function hasForbiddenCta(text: string): boolean` 추가, 기존 `assertAllowedCta`가 이것을 쓰게. 동작 변화 없음)
- Test: `src/lib/video-factory/kinetic-list-script.test.ts`

**Interfaces:**
- Consumes: `getDomainPreset(qualityProfile)` (`src/lib/domain-registry.ts`), `hasForbiddenCta`
- Produces:
  ```ts
  export const KINETIC_GLYPHS = "甲乙丙丁戊己庚辛壬癸";
  export interface KineticListScript {
    hook: { kicker: string; lines: [string, string] };
    intro: { l1: string; l2: string };
    items: [KineticItem, KineticItem, KineticItem];
    cta: { l1: string; l2: string };
    captions: { instagram: string; youtube: string; tiktok: string };
    hashtags: string[];
  }
  export interface KineticItem { glyph: string; label: string; action: [string, string] }
  export type ScriptCheck = { ok: true; script: KineticListScript } | { ok: false; errors: string[] };
  export function checkKineticListScript(input: unknown, forbiddenTerms: string[]): ScriptCheck;
  export function forbiddenTermsFor(qualityProfile: string): string[]; // preset.forbiddenCrossDomainTerms + 모든 formula의 forbiddenKeywords, 중복 제거
  ```
- 글자 수는 공백 포함 `[...s].length`. 금지어 검사는 화면 글자 + 캡션 전부. `hasForbiddenCta`는 `cta.l1`, `cta.l2`, 캡션 3개에 적용.

- [ ] **Step 1: 실패하는 테스트** — 유효 예시(스타일 샘플 원고: kicker `"11월,"`, lines `["이직","고민 중이면"]`, intro `"일간별로"`/`"딱 하나만"`, items 丙 병화 `["제안 오면","하루 안에 답하기"]` / 壬 임수 `["연말까지는","지금 자리 지키기"]` / 己 기토 `["이력서보다","서류 정리 먼저"]`, cta `"내 일간 모르면"`/`"프로필 링크 → 1분"`)로:
  - `accepts the style-sample script` → `ok: true`
  - `rejects a hook line over 8 chars` → errors에 `"hook.lines[1]"` 포함
  - `rejects two items` → errors에 `"items"` 포함
  - `rejects a glyph outside KINETIC_GLYPHS` (`"龍"`)
  - `rejects a forbidden term in captions` (forbiddenTerms `["부적"]`, 캡션에 `"부적"`)
  - `rejects a DM call to action` (`cta.l2 = "댓글 달면 해석"`)
  - `rejects non-object input` (`null`, `"x"`)
- [ ] **Step 2:** `pnpm vitest run src/lib/video-factory/kinetic-list-script.test.ts` → FAIL
- [ ] **Step 3:** 구현 (`unknown` 좁히기, 에러는 필드 경로 문자열로 모은다)
- [ ] **Step 4:** PASS + `pnpm vitest run src/lib/tiktok` 기존 테스트도 PASS
- [ ] **Step 5: Commit** `feat(video): 키네틱 리스트 원고 검사 추가`

---

### Task 4: 원고 생성 (Anthropic + 재시도 + 대체 원고)

**Files:**
- Create: `src/lib/video-factory/generate-kinetic-list.ts`
- Test: `src/lib/video-factory/generate-kinetic-list.test.ts`

**Interfaces:**
- Consumes: `checkKineticListScript`, `forbiddenTermsFor`, `CLAUDE_TEXT_MODEL` (`src/lib/claude-text.ts`)
- Produces:
  ```ts
  export interface GenerateInput { brandName: string; qualityProfile: string; recentHooks: string[]; kstDate: string }
  export type CreateMessage = (prompt: string) => Promise<string>; // 모델 응답 텍스트
  export async function generateKineticListScript(input: GenerateInput, createMessage?: CreateMessage): Promise<ScriptCheck>;
  export const FALLBACK_SCRIPTS: KineticListScript[]; // 2개 이상, 모두 check 통과
  ```
- 기본 `createMessage`는 `ANTHROPIC_API_KEY`가 있을 때만 Anthropic SDK로 만든다. 키가 없으면 `FALLBACK_SCRIPTS[dayIndex % length]`를 `ok: true`로 돌려준다. `dayIndex`는 `kstDate`의 일 수다. 운영에는 키가 있으므로 대체 원고는 로컬·데모용이다.
- 응답에서 첫 `{`부터 마지막 `}`까지 JSON.parse. 실패하면 그 시도를 무효로 센다.
- 재시도 프롬프트에는 직전 errors를 붙인다. 최대 3회.
- 프롬프트에는 글자 수 상한 전부, 금지어, 행동 문장 규칙(예언 금지), `recentHooks`(겹치지 말 것), JSON 스키마를 넣는다. 모델 호출 문법은 claude-api 스킬로 확인한다.

- [ ] **Step 1: 실패하는 테스트** (`createMessage`를 가짜로 주입)
  - `retries with the previous errors and returns the second valid script`: 1회차 hook 9자 → 2회차 유효. 호출 2번, 2번째 프롬프트에 `"hook.lines"` 포함, `ok: true`
  - `gives up after three invalid attempts`: 3회 모두 무효 → `ok: false`, 호출 3번
  - `counts unparseable JSON as an attempt`: `"no json"` → 다음 시도
  - `uses a fallback script when no API key and no createMessage`: `delete process.env.ANTHROPIC_API_KEY` → `ok: true`, 결과가 `FALLBACK_SCRIPTS` 중 하나
  - `every fallback script passes the check`
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현
- [ ] **Step 4:** PASS
- [ ] **Step 5: Commit** `feat(video): 키네틱 리스트 원고 생성과 재시도 추가`

---

### Task 5: 템플릿 `kinetic-list` + 변수 생성

**Files:**
- Create: `hyperframes/templates/kinetic-list/index.html`, `README.md`, `hyperframes.json`(기존 `hyperframes/hyperframes.json` 복사)
- Create (커밋되는 에셋): `assets/fonts/PretendardVariable.woff2`, `assets/fonts/NotoSerifKR-glyphs.woff2`, `assets/audio/bgm.m4a`, `assets/img/hook-default.png`, `assets/img/report-top.png`
- Modify: `.gitignore`, `hyperframes/.gitignore` (`!templates/kinetic-list/assets/**` 예외)
- Create: `src/lib/video-factory/render-variables.ts`
- Test: `src/lib/video-factory/render-variables.test.ts`

**Interfaces:**
- Consumes: `KineticListScript`
- Produces:
  ```ts
  export const KINETIC_LIST_VARIABLE_IDS: readonly string[]; // 템플릿 data-composition-variables의 id와 같은 순서·같은 집합
  export const DEFAULT_HOOK_SRC = "assets/img/hook-default.png";
  export function buildKineticListVariables(script: KineticListScript, hookSrc: string | null): Record<string, string>;
  ```
- 변수 id: `hookSrc, hookKind(image|video), kicker, hook1, hook2, intro1, intro2, g1, l1, a1a, a1b, g2, l2, a2a, a2b, g3, l3, a3a, a3b, cta1, cta2`. `hookSrc`가 null이면 `DEFAULT_HOOK_SRC`, 확장자가 `.mp4/.webm/.mov`면 `hookKind=video`.
- 템플릿은 설계 3장 표를 그대로 따른다 (스파이크 `d-mix`와 같은 타이밍). 다른 점: 모든 문구가 변수, 폰트는 `url()` woff2만, 훅은 `hookKind`에 따라 `<img>`/`<video muted>` 하나만 보이게, 글자 띠 288~1330px.
- 에셋 준비:
  - Pretendard·BGM·훅 기본·리포트 크롭: 메인 체크아웃 `hyperframes/assets/`의 같은 파일 (`report-top.png` = `sample-mobile.png` 위 1500px 크롭, `ffmpeg -i sample-mobile.png -vf crop=780:1500:0:0`). 메인 체크아웃에 파일이 없으면 멈추고 사용자에게 알린다
  - Noto Serif KR 서브셋: `https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600&text=甲乙丙丁戊己庚辛壬癸` 응답 CSS의 woff2 URL을 받는다 (OFL). README에 이 명령을 적는다

- [ ] **Step 1: 실패하는 테스트**
  - `maps the script to every template variable`: 결과 키 집합 == `KINETIC_LIST_VARIABLE_IDS`
  - `falls back to the default hook`: `hookSrc=null` → `DEFAULT_HOOK_SRC`, `hookKind="image"`
  - `marks mp4 hooks as video`
  - `matches the template variable ids`: `hyperframes/templates/kinetic-list/index.html`을 읽어 `data-composition-variables` JSON의 id 목록 == `KINETIC_LIST_VARIABLE_IDS`
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 템플릿·에셋·README·gitignore·`render-variables.ts` 작성
- [ ] **Step 4:** `pnpm vitest run src/lib/video-factory/render-variables.test.ts` PASS
- [ ] **Step 5:** `cd hyperframes/templates/kinetic-list && npx --yes hyperframes@0.8.210 check --json` → error 0. 경고는 README "알려진 경고"에 이유와 함께 적는다
- [ ] **Step 6:** 스타일 샘플 원고로 로컬 렌더 → 0, 1, 2.5, 4, 6, 7, 9초 프레임을 뽑아 직접 본다. 설계 3장과 다르면 고친다. 이때 1초 간격으로 붙은 프레임 쌍의 PSNR(`ffmpeg -lavfi psnr`)을 재서 가장 높은 값(가장 덜 움직인 구간)을 기록한다. 그 값 + 3dB를 Task 7의 `QC.maxStillPsnr`로 쓴다 (PSNR이 높을수록 두 프레임이 같다)
- [ ] **Step 7: Commit** `feat(video): HyperFrames kinetic-list 템플릿과 변수 생성 추가`

---

### Task 6: 초안 서비스 + cron 라우트

**Files:**
- Create: `src/lib/video-factory/draft-service.ts`, `src/app/api/cron/video-factory/next/route.ts`, `src/app/api/cron/video-factory/complete/route.ts`
- Test: `src/app/api/cron/video-factory/video-factory.test.ts` (`video-jobs.test.ts`의 prisma mock 방식)

**Interfaces:**
- Consumes: `kstDate`, `pickClip`, `generateKineticListScript`, `buildKineticListVariables`, `parseBrandConfig`, `verifyCronSecret`
- Produces (HTTP):
  - `GET /api/cron/video-factory/next?brands=cosmicpath[&force=1]` → `200 { job: { draftId: string; brandSlug: string; variables: Record<string,string>; blobPrefix: string } | null }`. `blobPrefix = "videos/factory/<brandSlug>/<draftId>"`. 401 / 400(brands 없음)
  - `POST /api/cron/video-factory/complete` body `{ draftId: string; videoUrl: string; coverUrl: string } | { draftId: string; errors: string[] }` → `200 { ok: true }`, 400(형식), 404, 409(RENDERING 아님)
- `draft-service.ts`:
  ```ts
  export interface FactoryJob { draftId: string; brandSlug: string; variables: Record<string, string>; blobPrefix: string }
  export type CompleteInput = { draftId: string; videoUrl: string; coverUrl: string } | { draftId: string; errors: string[] };
  export const STALE_RENDER_MS = 30 * 60 * 1000;
  export const MAX_DRAFTS_PER_DAY = 3;
  export async function requeueStaleRenders(now: Date): Promise<number>;
  export async function claimOrCreateDraft(brand: { id: string; slug: string; name: string; brandConfig: string }, now: Date, force: boolean): Promise<FactoryJob | null>;
  export async function completeDraft(input: CompleteInput): Promise<"ok" | "not_found" | "conflict">;
  ```
- 새 초안 흐름: 오늘(KST) 초안 수 확인 → (일정: `COMPLETED|RENDERING` 있으면 null / force: 전체 3편 이상이면 null) → 최근 14개 초안의 `hook.lines` 모음을 `recentHooks`로 → 원고 생성 → 실패면 `status=FAILED, renderErrors=errors`로 만들고 null → 성공이면 클립 선택(`enabled=true`, 해당 브랜드) → `status=RENDERING`으로 바로 생성 (QUEUED를 거치지 않는다).
- 완료: `$transaction`으로 `updateMany where {id, status: "RENDERING"}` (count 0이면 존재 여부로 404/409 구분) + 성공 시 클립 `usedCount: {increment: 1}, lastUsedAt: now`.

- [ ] **Step 1: 실패하는 테스트**
  - `requires the cron secret` (401), `requires a brand filter` (400)
  - `creates and claims a RENDERING draft with template variables`: `videoDraft.create` data.status `"RENDERING"`, `kstDate`, 응답 `job.variables.hook1`
  - `does not create a second draft on the same KST day`: count가 COMPLETED 1 → `job: null`, create 안 불림
  - `force creates another draft until three per day`
  - `requeues stale RENDERING drafts`: `updateMany`가 `status: "RENDERING", updatedAt: { lt: now-30m }`로 불림
  - `stores a FAILED draft when generation fails` (생성 함수 mock이 `ok:false`)
  - `completes a RENDERING draft and bumps the clip once`
  - `rejects completion for a draft that is not RENDERING` (409, 클립 update 안 불림)
  - `stores render errors as FAILED`
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현. 라우트는 인증·파싱·응답만, 로직은 `draft-service.ts`
- [ ] **Step 4:** `pnpm vitest run src/app/api/cron/video-factory` PASS, `pnpm vitest run src/app/api/cron/video-jobs` 기존 테스트 PASS
- [ ] **Step 5: Commit** `feat(video): 영상 공장 작업 큐 라우트 추가`

---

### Task 7: 품질 검사 규칙 + CI 러너 + 워크플로

**Files:**
- Create: `scripts/video-factory/qc-rules.mjs`, `scripts/video-factory/qc-rules.test.ts`
- Create: `video/scripts/factory-job.mjs`, `.github/workflows/video-factory.yml`

**Interfaces:**
- Produces (`qc-rules.mjs`, JSDoc 타입):
  ```js
  export const QC = { minSec: 9, maxSec: 11, maxBlackSec: 0.3, maxStillPsnr: /* Task 5 Step 6 값 */ };
  export function parseDuration(ffprobeOut) // -> number
  export function parseBlackIntervals(blackdetectStderr) // -> {start,end,duration}[]
  export function parseMeanVolumeDb(volumedetectStderr) // -> number | null
  export function judge({ checkErrors, durationSec, blackIntervals, meanVolumeDb, framePsnrs }) // -> { pass: boolean, errors: string[] }
  ```
- `judge` 규칙 (설계 5.4): check error > 0 → `"check: n errors"`; 길이 범위 밖; `start < 0.05`인 검은 구간(0초 프레임 검정) 또는 duration > 0.3; `meanVolumeDb === null || < -60` → 무음; `framePsnrs[i]`(i초와 i+1초 프레임) 중 하나라도 `> QC.maxStillPsnr`(거의 같은 프레임) → `"motion: still at {i}s"`. 단 마지막 2초(끝 화면 정지, 설계 3장)는 검사하지 않는다.
- `check`는 실제 문구로 검사해야 한다 (대비·겹침). 러너는 임시 복사본의 `data-composition-variables` 기본값을 이번 변수로 바꿔 쓴 뒤 `check --json`을 돌린다.
- `factory-job.mjs` 순서: `GET next` (`Authorization: Bearer $CRON_SECRET`) → job 없으면 종료 0 → 템플릿 폴더를 임시 폴더로 복사, 훅이 원격 URL이면 `assets/img/hook.<ext>`로 받고 변수 `hookSrc`를 그 경로로 → `npx --yes hyperframes@0.8.210 render --variables '<json>' -o out.mp4` → `check --json`, `ffprobe`, `blackdetect`, `volumedetect`, 1초 간격 PSNR → `judge` → 통과면 mp4와 1.5초 프레임 jpg를 `put(blobPrefix + ".mp4"|".jpg", …, { access: "public", token })` → `POST complete`. 실패면 `POST complete {errors}`. 어느 단계든 예외면 `errors: ["runner: <message>"]`로 complete 후 exit 1.
- 워크플로: `schedule: cron '0 21 * * *'` (KST 06:00) + `workflow_dispatch` (input `force` boolean). Node 22, pnpm 10, `video/` install, `sudo apt-get install -y ffmpeg`, secrets `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, env `VIDEO_FACTORY_BRANDS=cosmicpath`. `concurrency: video-factory`.

- [ ] **Step 1: 실패하는 테스트** (`qc-rules.test.ts`, 실제 ffmpeg 출력 조각을 문자열로)
  - `parses blackdetect intervals`, `parses mean_volume`, `returns null volume when missing`
  - `passes a clean 10s render`
  - `fails a black first frame`, `fails a 12s render`, `fails silence`, `fails a still stretch`, `fails when check reports errors`
- [ ] **Step 2:** FAIL 확인 → **Step 3:** 구현 → **Step 4:** `pnpm vitest run scripts/video-factory` PASS
- [ ] **Step 5:** 로컬 확인: `APP_URL=http://localhost:3000` + `pnpm dev`로 `node video/scripts/factory-job.mjs` 1회 실행. DB에 COMPLETED 초안과 Blob URL이 생기는지, 일부러 BGM을 빼고 돌려 FAILED + `silence` 이유가 남는지 본다
- [ ] **Step 6: Commit** `feat(video): 영상 공장 품질 검사와 CI 렌더 러너 추가`
- [ ] **Step 7:** 머지 후 GitHub에서 `workflow_dispatch` 1회 성공을 확인하고 나서 schedule이 도는지 다음 날 확인 (사용자 보고)

---

### Task 8: 대시보드 영상 페이지 + 판정

**Files:**
- Create: `src/lib/video-factory/verdict.ts`, `src/lib/video-factory/verdict.test.ts`
- Create: `src/app/api/video-drafts/[id]/verdict/route.ts`, `src/app/api/video-drafts/[id]/verdict/route.test.ts`
- Create: `src/app/brands/[slug]/videos/page.tsx`, `src/components/videos/VideoFactoryPanel.tsx`
- Modify: `src/components/Dashboard.tsx:934-942` 근처 (tiktok·shorts 링크 옆에 `/videos` 링크 하나)

**Interfaces:**
- Produces:
  - `consecutiveGood(drafts: { status: string; userVerdict: string | null; createdAt: Date }[]): number` — `COMPLETED`만 최신순으로 세다가 `good`이 아닌 것에서 멈춤
  - `PATCH /api/video-drafts/[id]/verdict` body `{ verdict: "good" | "bad" }` → `requireAuth`, 초안 브랜드의 `ownerId`가 본인(또는 `isSuperAdmin`)이 아니면 404, `COMPLETED`가 아니면 409, 성공 `{ ok: true }`
- 위치: 설계 5.6은 "브랜드 페이지에 영역 추가"였지만, 기존 tiktok·shorts처럼 하위 페이지 `/brands/[slug]/videos`로 둔다 **[계획 판단]**. 1,000줄 가까운 `Dashboard.tsx`를 크게 고치지 않으려는 것이다. 대시보드에는 링크 하나만 단다.
- 페이지: 서버 컴포넌트가 최근 7개 `VideoDraft`(+ 클립 license)를 읽고 `VideoFactoryPanel`에 넘긴다. 카드: 표지 → 클릭 시 `<video controls playsInline>`, 상태 배지(렌더 중/완료/실패), 실패 이유 목록, 훅 클립 출처, "올릴 만함 / 아님" 버튼(현재 판정 강조), 위쪽에 "연속 n편 / 목표 5편". 빈 목록·로딩·오류 상태와 모바일(375px) 1열 레이아웃을 갖춘다.

- [ ] **Step 1: 실패하는 테스트**
  - `consecutiveGood`: `[good, good, bad, good]`(최신순) → 2, `RENDERING`·`FAILED`는 건너뜀, 빈 배열 → 0
  - verdict 라우트: `rejects other owners` 404, `rejects non-COMPLETED` 409, `rejects unknown verdict` 400, `stores verdict and verdictAt`
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS
- [ ] **Step 5:** `pnpm dev` + 브라우저로 `/brands/cosmicpath/videos`를 데스크톱·375px에서 스크린샷. 빈 상태와 완료 영상 1개 상태를 둘 다 본다
- [ ] **Step 6: Commit** `feat(video): 대시보드 영상 페이지와 판정 버튼 추가`

---

### Task 9: 클립 추가 스크립트

**Files:**
- Create: `scripts/clips/add-clip.mjs`
- Test: 수동 (외부 업로드라 단위 테스트 대신 dry-run)

**Interfaces:**
- CLI: `node scripts/clips/add-clip.mjs --brand cosmicpath --mood 붓,탁자 --license <출처URL> [--source stock] [--dry-run] <로컬파일>`
- 동작: 확장자로 `kind`(이미지/영상) 결정 → 영상이면 `ffprobe` 길이 → Blob `clips/<brand>/<cuid>.<ext>` 업로드(`video/node_modules/@vercel/blob`를 쓰려면 스크립트를 `video/scripts/add-clip.mjs`에 둔다. 위치는 구현자가 정하되 README에 적는다) → `ClipAsset` 생성 (Prisma Client).
- `--license`가 없으면 거부한다 (PRD 04 "출처 URL 기록").

- [ ] **Step 1:** 구현
- [ ] **Step 2:** `--dry-run`으로 무엇을 만들지 출력되는지 확인
- [ ] **Step 3:** 실제로 기본 훅 이미지 1개를 넣어 `ClipAsset` 한 줄이 생기고 다음 next 호출이 그 클립을 고르는지 확인
- [ ] **Step 4: Commit** `feat(video): 훅 클립 추가 스크립트`
- [ ] **Step 5 (사용자):** Pexels에서 세로 클립 30~50개 고르기. 분위기 태그 예시: 붓, 탁자, 손, 창가, 새벽, 책

---

## 마감

- [ ] `pnpm typecheck && pnpm test && pnpm build` 통과
- [ ] 브랜치 push → main 대상 PR (PR #88 머지 후, 그 전이면 base를 `docs/sns-automation-prd`로) → Auto-fix 켜기
- [ ] 완료 기준 2(연속 5편)는 머지 후 운영 데이터로 확인한다. 이 계획의 범위 밖이다
