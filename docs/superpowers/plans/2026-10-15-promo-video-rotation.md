# 홍보 영상 로테이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 월·목 KST 06:30마다 포맷·주제·가상 인물이 바뀌는 CosmicPath 홍보 영상(KO/EN)을 cosmicpath 실제 엔진값으로 렌더해 Threads 검토 대기 게시물로 등록한다.

**Architecture:** 영상 쪽 순수 TS 모듈(`video/src/promo/`)이 회차 선택·문구·스냅샷 검증을 담당하고, 러너(`render-promo-job.mjs`)가 cosmicpath 저장소의 엔진을 cosmicpath 자체 TS 로더로 돌려 스냅샷을 만든 뒤 Remotion 포맷 4종 중 하나로 렌더 → Vercel Blob 업로드 → 앱 경로 `POST /api/cron/promo-posts`가 `NEEDS_REVIEW` 게시물을 만든다. CI는 DB를 직접 건드리지 않는다.

**Tech Stack:** Remotion 4.0.380 · React 19 · TypeScript (Node 22.18+ 타입 제거 실행) · Next.js 16 App Router · Prisma 5 · Vitest 4 · GitHub Actions · @vercel/blob 2.8.0

**Spec:** `docs/superpowers/specs/2026-10-15-promo-video-rotation-design.md`

## Global Constraints

- 패키지 매니저는 pnpm만. 새 라이브러리 설치 금지 (zod는 video에만 있고 루트엔 없음 → 루트 검증은 수동 narrowing).
- `any` 금지, `unknown` + 타입 좁히기. 불안전한 `as` 금지 — 외부 JSON은 타입 가드로 좁힌다.
- 함수 20줄 이내 지향, 축약어 금지 (`req`→`request`, `res`→`response`).
- 영상 숫자는 cosmicpath 엔진값만. 조작된 점수·퍼센트·소셜 프루프 금지.
- 문구 금지어: `판정`, `직답`, `권고`, `최적기`, `100%`, `보장`, `guarantee`, `verdict`. 가격은 `$9.99`만, 궁합 가격 노출 금지.
- Threads 본문(캡션) 480자 이하 (넘으면 스레드 분할됨).
- 엔진은 프로덕션과 같은 진입점으로 호출: 사주 `calculateOracleSajuProfile`(+`mapToLegacySaju`), 궁합 `calculateCompatibility`(생일은 `YYYY-MM-DDTHH:mm:00+09:00`, timezone `Asia/Seoul`), 추출은 `TZ=UTC`.
- 브랜드: KO → `cosmicpath`, EN → `cosmicpath-global`.
- 커밋 메시지: conventional commits, 한국어 (`feat: …`, `test: …`). `git add`는 파일 지정, `-A`/`.` 금지.
- `video/` 아래 순수 TS 모듈(`video/src/promo/*.ts`)은 remotion/React를 import 하지 않고, 상대 import에 `.ts` 확장자를 붙인다 (러너가 Node로 직접 import).

## Review Focus

1. **슬롯이 아닌 요일에 수동 실행** (예: 화요일) → 직전 슬롯(월요일)과 같은 회차가 나와야 한다. Task 1 테스트가 고정.
2. **오래된 스냅샷** (가장 강한 날이 렌더 날짜보다 과거) → 렌더 전에 막혀야 한다. Task 3 테스트가 고정.
3. **엔진 문구 깨짐** (EN 헤드라인 `Next year 9M` 류) → 렌더 전에 막혀야 한다. Task 3 테스트가 고정.
4. **480자 넘는 캡션** → 문구 단계(Task 2 전 조합 테스트)와 앱 경로(Task 9, 400) 양쪽에서 거부.
5. **일부 브랜드만 실패/중복 재실행** → 앱 경로는 해당 item만 `skipped`(`brand_not_found`/`already_queued`)로 돌려주고 나머지는 생성. Task 9 테스트가 고정.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `video/src/promo/types.ts` (신규) | 공용 타입·상수: 언어, 포맷, 주제, 인물, 회차, 컴포지션 ID, 길이 |
| `video/src/promo/rotation.ts` (신규) | 날짜 → 회차(포맷·주제·인물·훅) 결정 |
| `video/src/promo/copy.ts` (신규) | 모든 문구(주제·훅·캡션·댓글·화면 UI) + 캡션 조립 |
| `video/src/promo/snapshot.ts` (신규) | 엔진 스냅샷 타입, 형태 가드, 이상 감지 |
| `video/scripts/extract-report-data.ts` (재작성) | cosmicpath 엔진 실행 → 스냅샷 JSON |
| `video/src/data/promo-preview.json` (신규, 기존 `promo-report-data.json` 대체) | Studio 미리보기용 props |
| `video/src/components/PromoScenes.tsx` (신규) | 포맷 공용 장면: 훅, 질문, 마무리 |
| `video/src/components/ReportTourScenes.tsx` (기존 `PromoReportTour.tsx` 이름 변경) | ① 리포트 투어 01~04 장면, props 기반 |
| `video/src/compositions/PromoReportTour.tsx` (기존 `PromoViral.tsx` 이름 변경) | ① 포맷 컴포지션 |
| `video/src/compositions/PromoRace.tsx` (신규) | ② A vs B 레이스 |
| `video/src/compositions/PromoMatch.tsx` (신규) | ③ 궁합 매치 |
| `video/src/compositions/PromoExperiment.tsx` (신규) | ④ 7일 실험 |
| `video/src/Root.tsx` (수정) | 포맷 4종 등록 |
| `video/scripts/render-promo-job.mjs` (신규) | 회차→추출→검증→렌더→정규화→업로드→등록 |
| `video/scripts/queue-promo-posts.mjs` (삭제) | 러너+앱 경로로 대체 |
| `src/lib/promo/promo-post-service.ts` (신규) | 본문 파싱, 게시물 생성, UTM 링크 |
| `src/app/api/cron/promo-posts/route.ts` (신규) | 인증 + 서비스 호출 |
| `.github/workflows/render-promo.yml` (신규) | 월·목 스케줄 실행 |
| `docs/api-spec.md` (수정) | 새 cron 경로 계약 |

---

### Task 1: 회차 선택 로직

**Files:**
- Create: `video/src/promo/types.ts`
- Create: `video/src/promo/rotation.ts`
- Test: `video/src/promo/rotation.test.ts`
- Modify: `vitest.config.ts` (include에 promo 테스트 추가)
- Modify: `video/tsconfig.json` (`allowImportingTsExtensions`)
- Modify: `video/src/components/PromoKit.tsx:7` (`PromoLang`을 types.ts에서 가져오기)

**Interfaces:**
- Produces:
  - `type PromoLang = "ko" | "en"`, `type PromoFormat = "reportTour" | "race" | "match" | "experiment"`, `type PromoTopic = "contact" | "career" | "confession" | "sideJob" | "marriage" | "partnership"`, `type Gender = "female" | "male"`
  - `interface Persona { birthDate: string; birthTime: string; gender: Gender }`
  - `interface PromoVariant { date; lang; slot; format; topic; hookIndex; persona: Persona; guest: Persona }`
  - `RELATION_TOPICS`, `COMPOSITION_ID: Record<PromoFormat, string>`, `FORMAT_FRAMES: Record<PromoFormat, number>`
  - `slotFor(date: string): number`, `pickPromoVariant(date: string, lang: PromoLang, overrides?: VariantOverrides): PromoVariant`

- [ ] **Step 1: 설정 두 줄 수정**

`vitest.config.ts`의 include를 다음으로:
```ts
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "video/src/promo/**/*.test.ts"],
```
`video/tsconfig.json` compilerOptions에 추가:
```json
    "allowImportingTsExtensions": true,
```

- [ ] **Step 2: 타입 파일 작성** — `video/src/promo/types.ts`

```ts
// types.ts — shared vocabulary for the promo rotation (pure TS: no remotion/React imports,
// because scripts/render-promo-job.mjs imports this directly under Node type stripping).
import type { PromoSnapshot } from "./snapshot.ts";

export type PromoLang = "ko" | "en";
export type PromoFormat = "reportTour" | "race" | "match" | "experiment";
export type PromoTopic = "contact" | "career" | "confession" | "sideJob" | "marriage" | "partnership";
export type Gender = "female" | "male";

export interface Persona {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: Gender;
}

export interface PromoVariant {
  date: string; // KST render date, YYYY-MM-DD
  lang: PromoLang;
  slot: number;
  format: PromoFormat;
  topic: PromoTopic;
  hookIndex: number;
  persona: Persona;
  guest: Persona;
}

// Type alias (not interface) so Remotion accepts it as Record<string, unknown> props.
export type PromoProps = { lang: PromoLang; variant: PromoVariant; snapshot: PromoSnapshot };

export const RELATION_TOPICS: readonly PromoTopic[] = ["contact", "confession", "marriage", "partnership"];

export const COMPOSITION_ID: Record<PromoFormat, string> = {
  reportTour: "PromoReportTour",
  race: "PromoRace",
  match: "PromoMatch",
  experiment: "PromoExperiment",
};

export const PROMO_FPS = 30;
export const FORMAT_FRAMES: Record<PromoFormat, number> = { reportTour: 1350, race: 600, match: 600, experiment: 600 };
```

> `snapshot.ts`는 Task 3에서 만든다. Task 1에서는 타입 import가 끊기지 않게 최소 파일을 같이 만든다:
> `video/src/promo/snapshot.ts` 내용: `export interface PromoSnapshot { asOf: string }` (Task 3에서 전체로 교체).

- [ ] **Step 3: 실패하는 테스트 작성** — `video/src/promo/rotation.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { pickPromoVariant, slotFor } from "./rotation.ts";
import { RELATION_TOPICS } from "./types.ts";

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe("slotFor", () => {
  it("counts Monday/Thursday slots from 2026-10-19", () => {
    expect(slotFor("2026-10-19")).toBe(0);
    expect(slotFor("2026-10-22")).toBe(1);
    expect(slotFor("2026-10-26")).toBe(2);
  });

  it("maps a non-slot weekday to the previous slot", () => {
    expect(slotFor("2026-10-20")).toBe(slotFor("2026-10-19"));
    expect(slotFor("2026-10-25")).toBe(slotFor("2026-10-22"));
  });

  it("clamps dates before the rotation start to slot 0", () => {
    expect(slotFor("2026-10-15")).toBe(0);
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => slotFor("")).toThrow();
    expect(() => slotFor("2026-13-01")).toThrow();
    expect(() => slotFor("2026-02-30")).toThrow();
  });
});

describe("pickPromoVariant", () => {
  it("is deterministic for the same date and language", () => {
    expect(pickPromoVariant("2026-11-02", "ko")).toEqual(pickPromoVariant("2026-11-02", "ko"));
  });

  it("shows all four formats within two weeks in Korean", () => {
    const formats = [0, 3, 7, 10].map((offset) => pickPromoVariant(addDays("2026-10-19", offset), "ko").format);
    expect(new Set(formats).size).toBe(4);
  });

  it("uses only relationship topics on match slots", () => {
    for (let week = 0; week < 12; week += 1) {
      const variant = pickPromoVariant(addDays("2026-10-26", week * 14), "ko");
      expect(variant.format).toBe("match");
      expect(RELATION_TOPICS).toContain(variant.topic);
    }
  });

  it("replaces match with race in English", () => {
    expect(pickPromoVariant("2026-10-26", "en").format).toBe("race");
    expect(pickPromoVariant("2026-10-26", "en", { format: "match" }).format).toBe("race");
  });

  it("rejects a non-relationship topic override on the match format", () => {
    expect(() => pickPromoVariant("2026-10-26", "ko", { topic: "career" })).toThrow(/relation topic/);
  });

  it("applies format and topic overrides", () => {
    const variant = pickPromoVariant("2026-10-19", "ko", { format: "experiment", topic: "sideJob" });
    expect(variant).toMatchObject({ format: "experiment", topic: "sideJob" });
  });

  it("builds valid personas with opposite-gender guests", () => {
    for (let day = 0; day < 60; day += 1) {
      const { persona, guest } = pickPromoVariant(addDays("2026-10-19", day), "ko");
      for (const person of [persona, guest]) {
        expect(person.birthDate).toMatch(/^(199\d|200[01])-(0[1-9]|1[0-2])-(0[1-9]|1\d|2[0-8])$/);
        expect(person.birthTime).toMatch(/^([01]\d|2[0-3]):(00|30)$/);
      }
      expect(guest.gender).not.toBe(persona.gender);
    }
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `pnpm vitest run video/src/promo/rotation.test.ts`
Expected: FAIL — `Failed to resolve import "./rotation.ts"`

- [ ] **Step 5: 구현** — `video/src/promo/rotation.ts`

```ts
// rotation.ts — date → promo variant. Pure and deterministic: the same KST date always yields the
// same format, topic, persona and hook, so a re-run of a failed slot reproduces the same video.
import { RELATION_TOPICS } from "./types.ts";
import type { Gender, Persona, PromoFormat, PromoLang, PromoTopic, PromoVariant } from "./types.ts";

export const ROTATION_START = "2026-10-19"; // a Monday
export const FORMATS: readonly PromoFormat[] = ["reportTour", "race", "match", "experiment"];
export const TOPICS: readonly PromoTopic[] = ["contact", "career", "confession", "sideJob", "marriage", "partnership"];
const DAY_MS = 86_400_000;
const SLOT_WEEKDAYS = new Set([1, 4]); // Monday, Thursday (UTC weekday of the KST calendar date)
const HOOK_COUNT = 3;

export interface VariantOverrides {
  format?: PromoFormat;
  topic?: PromoTopic;
}

function toUtcDay(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new Error(`invalid date: "${date}"`);
  }
  return ms;
}

// ponytail: linear day walk, ~100 iterations per year of rotation; switch to arithmetic if it ever matters
export function slotFor(date: string): number {
  const target = toUtcDay(date);
  let count = 0;
  for (let day = toUtcDay(ROTATION_START); day <= target; day += DAY_MS) {
    if (SLOT_WEEKDAYS.has(new Date(day).getUTCDay())) count += 1;
  }
  return Math.max(0, count - 1);
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function personaFor(seed: string, gender: Gender): Persona {
  const next = seededRandom(seed);
  const year = 1990 + Math.floor(next() * 12);
  const month = 1 + Math.floor(next() * 12);
  const day = 1 + Math.floor(next() * 28);
  const hour = Math.floor(next() * 24);
  const minute = next() < 0.5 ? 0 : 30;
  return { birthDate: `${year}-${pad(month)}-${pad(day)}`, birthTime: `${pad(hour)}:${pad(minute)}`, gender };
}

function pickTopic(slot: number, format: PromoFormat, override?: PromoTopic): PromoTopic {
  if (format !== "match") return override ?? TOPICS[slot % TOPICS.length] ?? "career";
  if (override && !RELATION_TOPICS.includes(override)) {
    throw new Error(`match format needs a relation topic, got "${override}"`);
  }
  return override ?? RELATION_TOPICS[Math.floor(slot / FORMATS.length) % RELATION_TOPICS.length] ?? "contact";
}

export function pickPromoVariant(date: string, lang: PromoLang, overrides: VariantOverrides = {}): PromoVariant {
  const slot = slotFor(date);
  const picked = overrides.format ?? FORMATS[slot % FORMATS.length] ?? "reportTour";
  const format: PromoFormat = lang === "en" && picked === "match" ? "race" : picked; // match screens are Korean-only
  const gender: Gender = slot % 2 === 0 ? "female" : "male";
  return {
    date,
    lang,
    slot,
    format,
    topic: pickTopic(slot, format, overrides.topic),
    hookIndex: Math.floor(slot / FORMATS.length) % HOOK_COUNT,
    persona: personaFor(date, gender),
    guest: personaFor(`${date}:guest`, gender === "female" ? "male" : "female"),
  };
}
```

- [ ] **Step 6: PromoKit이 공용 타입을 쓰게 수정** — `video/src/components/PromoKit.tsx`

`export type PromoLang = "ko" | "en";` 줄을 다음으로 교체:
```ts
export type { PromoLang } from "../promo/types.ts";
```

- [ ] **Step 7: 통과 확인**

Run: `pnpm vitest run video/src/promo/rotation.test.ts && (cd video && pnpm typecheck)`
Expected: 테스트 전부 PASS, typecheck 에러 없음

- [ ] **Step 8: 커밋**

```bash
git add vitest.config.ts video/tsconfig.json video/src/promo/types.ts video/src/promo/snapshot.ts video/src/promo/rotation.ts video/src/promo/rotation.test.ts video/src/components/PromoKit.tsx
git commit -m "feat: 홍보 영상 회차 선택 로직 추가"
```

---

### Task 2: 문구 모듈 + 사용자 검토 체크포인트

**Files:**
- Create: `video/src/promo/copy.ts`
- Test: `video/src/promo/copy.test.ts`

**Interfaces:**
- Consumes: Task 1 타입 (`PromoLang`, `PromoFormat`, `PromoTopic`, `PromoVariant`, `RELATION_TOPICS`)
- Produces:
  - `interface TopicCopy { question; forkA; forkB; experiment: readonly [string, string, string, string]; ifThen: readonly [string, string]; stopRule; ask }`
  - `TOPIC_COPY: Record<PromoLang, Record<PromoTopic, TopicCopy>>`
  - `TOPIC_LABEL: Record<PromoLang, Record<PromoTopic, string>>`
  - `UI_COPY: Record<PromoLang, UiCopy>` (아래 정의)
  - `hookLines(variant: PromoVariant): string[]`
  - `buildCaption(variant: PromoVariant): string`
  - `buildCommentTemplate(lang: PromoLang, format: PromoFormat): string` (반드시 `{{link}}` 포함)
  - `landingPathFor(format: PromoFormat): string`
  - `personaLine(lang: PromoLang, persona: Persona): string`
  - `BANNED_PHRASES: readonly string[]`

- [ ] **Step 1: 실패하는 테스트 작성** — `video/src/promo/copy.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  BANNED_PHRASES, HOOKS, TOPIC_COPY, UI_COPY,
  buildCaption, buildCommentTemplate, hookLines, landingPathFor,
} from "./copy.ts";
import { pickPromoVariant, FORMATS, TOPICS } from "./rotation.ts";
import type { PromoLang, PromoVariant } from "./types.ts";

const LANGS: PromoLang[] = ["ko", "en"];
const allVariants = (): PromoVariant[] =>
  LANGS.flatMap((lang) =>
    FORMATS.flatMap((format) =>
      TOPICS.map((topic) => ({ ...pickPromoVariant("2026-10-19", lang), format, topic })),
    ),
  );

const allText = (): string[] => [
  ...JSON.stringify([TOPIC_COPY, HOOKS, UI_COPY]).split('"'),
  ...allVariants().flatMap((variant) => [buildCaption(variant), ...hookLines(variant)]),
  ...LANGS.flatMap((lang) => FORMATS.map((format) => buildCommentTemplate(lang, format))),
];

describe("promo copy", () => {
  it("has three hooks of one to three lines per language and format", () => {
    for (const lang of LANGS) for (const format of FORMATS) {
      expect(HOOKS[lang][format]).toHaveLength(3);
      for (const hook of HOOKS[lang][format]) expect(hook.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every caption within the 480-char Threads part limit and adds the disclaimer", () => {
    for (const variant of allVariants()) {
      const caption = buildCaption(variant);
      expect([...caption].length).toBeLessThanOrEqual(480);
      expect(caption).toContain(variant.lang === "ko" ? "숫자는 엔진 실제 계산값" : "real engine numbers");
    }
  });

  it("resolves every {question} placeholder", () => {
    for (const variant of allVariants()) {
      expect([buildCaption(variant), ...hookLines(variant)].join(" ")).not.toMatch(/\{question\}/);
    }
  });

  it("never uses banned phrases or percentages", () => {
    for (const text of allText()) {
      for (const phrase of BANNED_PHRASES) expect(text).not.toContain(phrase);
      expect(text).not.toMatch(/\d\s*%/);
    }
  });

  it("puts a link placeholder in every first comment", () => {
    for (const lang of LANGS) for (const format of FORMATS) {
      expect(buildCommentTemplate(lang, format)).toContain("{{link}}");
    }
  });

  it("sends the match format to the love funnel and the rest to /start", () => {
    expect(landingPathFor("match")).toBe("/start?context=love");
    for (const format of ["reportTour", "race", "experiment"] as const) expect(landingPathFor(format)).toBe("/start");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run video/src/promo/copy.test.ts`
Expected: FAIL — `Failed to resolve import "./copy.ts"`

- [ ] **Step 3: 구현** — `video/src/promo/copy.ts`

```ts
// copy.ts — every user-visible string for the promo rotation, plus caption assembly.
// Rules (cosmicpath docs/product.md): numbers only from engines, no 판정/직답/권고/최적기,
// price only $9.99, sample copy is labelled as a sample screen. copy.test.ts enforces them.
import type { Persona, PromoFormat, PromoLang, PromoTopic, PromoVariant } from "./types.ts";

export interface TopicCopy {
  question: string;
  forkA: string;
  forkB: string;
  experiment: readonly [string, string, string, string]; // Day 1, 3, 5, 7
  ifThen: readonly [string, string];
  stopRule: string;
  ask: string;
}

export interface UiCopy {
  questionLabel: string;
  sampleNote: string;
  outro: readonly [string, string];
  cta: string;
  ctaMatch: string;
  price: string;
  disclaimer: string;
  race: { leanA: string; leanB: string; even: string; peak: string; low: string; ask: string };
  match: { title: string; saju: string; astro: string; num: string; overall: string; combine: string; clash: string; yes: string; no: string; ask: string };
  experiment: { when: string; bestDay: string; stopTitle: string; save: string; sample: string };
}

export const BANNED_PHRASES: readonly string[] = ["판정", "직답", "권고", "최적기", "100%", "보장", "guarantee", "verdict"];

export const TOPIC_COPY: Record<PromoLang, Record<PromoTopic, TopicCopy>> = {
  ko: {
    contact: {
      question: "먼저 연락할까, 기다릴까?", forkA: "이번 주 먼저 연락하기", forkB: "한 달 더 기다리기",
      experiment: ["Day 1 보낼 첫 문장 한 줄 써두기", "Day 3 가벼운 안부 한 번 보내기", "Day 5 답장 온도 기록하기", "Day 7 계속할지 기준과 비교하기"],
      ifThen: ["답이 이어지면 → 만날 약속 제안", "읽고 답이 없으면 → 2주 거리 두기"],
      stopRule: "내가 더 불안해지기만 하면 멈춤", ask: "먼저 연락 vs 기다리기, 너는 지금 어느 쪽임?",
    },
    career: {
      question: "이직할까, 버틸까?", forkA: "지금 이직 준비 시작", forkB: "6개월 버티며 성과 쌓기",
      experiment: ["Day 1 이력서 한 곳 업데이트", "Day 3 관심 회사 3곳 정리", "Day 5 지원서 1곳 제출", "Day 7 반응 기록하고 기준 비교"],
      ifThen: ["면접 제안이 오면 → 움직임", "반응이 없으면 → 기준 재점검"],
      stopRule: "불안이 기대보다 커지면 멈춤", ask: "이직할까 버틸까, 너는 지금 뭐 고민 중임?",
    },
    confession: {
      question: "고백할까, 더 지켜볼까?", forkA: "이번 달 안에 고백", forkB: "3개월 더 지켜보기",
      experiment: ["Day 1 하고 싶은 말 한 줄로 줄이기", "Day 3 둘이 보는 약속 하나 잡기", "Day 5 반응 신호 기록하기", "Day 7 말할지 기준과 비교하기"],
      ifThen: ["둘만의 약속에 먼저 응하면 → 말해보기", "약속을 계속 미루면 → 속도 늦추기"],
      stopRule: "어색해질 신호가 쌓이면 멈춤", ask: "고백 vs 더 지켜보기, 너라면?",
    },
    sideJob: {
      question: "부업 시작할까, 본업에 집중할까?", forkA: "이번 달 부업 시작", forkB: "본업 성과 먼저",
      experiment: ["Day 1 하루 1시간 확보하기", "Day 3 작은 결과물 하나 만들기", "Day 5 한 명에게 보여주기", "Day 7 쓴 시간과 반응 기록"],
      ifThen: ["반응이 오면 → 시간 늘리기", "본업이 흔들리면 → 주말로만 줄이기"],
      stopRule: "본업 평가가 떨어지면 멈춤", ask: "부업 시작 vs 본업 집중, 너는 지금 어느 쪽임?",
    },
    marriage: {
      question: "이 사람이랑 결혼 준비해도 될까?", forkA: "내년 결혼 준비 시작", forkB: "1년 더 만나보기",
      experiment: ["Day 1 돈·집·일 기준 각자 적기", "Day 3 서로 기준 맞춰보기", "Day 5 안 맞는 한 가지 이야기하기", "Day 7 대화 뒤 마음 기록하기"],
      ifThen: ["기준 차이를 같이 풀면 → 준비 시작", "같은 문제로 반복해 싸우면 → 속도 늦추기"],
      stopRule: "대화가 매번 같은 곳에서 막히면 멈춤", ask: "결혼 준비 vs 더 만나보기, 너는 지금 어디쯤임?",
    },
    partnership: {
      question: "동업 제안, 받을까 혼자 갈까?", forkA: "동업 제안 받기", forkB: "혼자 먼저 시작",
      experiment: ["Day 1 역할·지분 기준 적기", "Day 3 상대 기준 들어보기", "Day 5 작은 일 하나 같이 해보기", "Day 7 일한 방식 기록하기"],
      ifThen: ["역할 정리가 깔끔하면 → 조건 문서화", "돈 얘기를 피하면 → 혼자 시작"],
      stopRule: "약속한 마감이 두 번 밀리면 멈춤", ask: "동업 vs 혼자, 너라면 어느 쪽임?",
    },
  },
  en: {
    contact: {
      question: "Text first, or wait?", forkA: "Text them this week", forkB: "Wait one more month",
      experiment: ["Day 1 Write the first line you'd send", "Day 3 Send one light check-in", "Day 5 Note how warm the reply is", "Day 7 Compare it to your criteria"],
      ifThen: ["Replies keep going → suggest meeting up", "Read, no reply → step back two weeks"],
      stopRule: "If it only makes you more anxious, stop", ask: "Text first or wait: which one are you right now?",
    },
    career: {
      question: "Quit my job, or stay?", forkA: "Start job hunting now", forkB: "Stay 6 months, build results",
      experiment: ["Day 1 Update your CV for one role", "Day 3 List three companies you'd join", "Day 5 Send one application", "Day 7 Log replies, check your criteria"],
      ifThen: ["Interview offer → move", "No replies → recheck criteria"],
      stopRule: "Anxiety outweighs upside → pause", ask: "Quit or stay: what are you stuck on right now?",
    },
    confession: {
      question: "Confess, or keep watching?", forkA: "Say it this month", forkB: "Watch for 3 more months",
      experiment: ["Day 1 Shrink what you want to say to one line", "Day 3 Make one plan, just the two of you", "Day 5 Note the signals you get back", "Day 7 Compare them to your criteria"],
      ifThen: ["They say yes to plans first → say it", "They keep postponing → slow down"],
      stopRule: "If awkward signals pile up, stop", ask: "Confess or wait: what would you do?",
    },
    sideJob: {
      question: "Start a side hustle, or focus on my job?", forkA: "Start the side hustle this month", forkB: "Win at the day job first",
      experiment: ["Day 1 Block one hour a day", "Day 3 Make one small thing", "Day 5 Show it to one person", "Day 7 Log hours spent and reactions"],
      ifThen: ["People respond → add more hours", "Day job slips → weekends only"],
      stopRule: "If your day-job reviews drop, stop", ask: "Side hustle or day job: where are you leaning?",
    },
    marriage: {
      question: "Should we start planning a wedding?", forkA: "Start planning next year", forkB: "Date one more year",
      experiment: ["Day 1 Each write your money, home, work rules", "Day 3 Compare your lists", "Day 5 Talk through one mismatch", "Day 7 Write down how you feel after"],
      ifThen: ["You solve gaps together → start planning", "Same fight on repeat → slow down"],
      stopRule: "If every talk stalls at the same spot, stop", ask: "Plan the wedding or keep dating: where are you at?",
    },
    partnership: {
      question: "Take the partnership offer, or go solo?", forkA: "Accept the partnership", forkB: "Start solo first",
      experiment: ["Day 1 Write your rules for roles and equity", "Day 3 Hear their rules", "Day 5 Do one small project together", "Day 7 Note how you worked together"],
      ifThen: ["Roles are clear → put terms in writing", "They dodge money talk → go solo"],
      stopRule: "If agreed deadlines slip twice, stop", ask: "Partner up or go solo: which would you pick?",
    },
  },
};

export const TOPIC_LABEL: Record<PromoLang, Record<PromoTopic, string>> = {
  ko: { contact: "연락", career: "이직", confession: "고백", sideJob: "부업", marriage: "결혼", partnership: "동업" },
  en: { contact: "Texting", career: "Job", confession: "Confession", sideJob: "Side hustle", marriage: "Marriage", partnership: "Partnership" },
};

// Lines may use {question}; the last line is the punch line.
export const HOOKS: Record<PromoLang, Record<PromoFormat, readonly (readonly string[])[]>> = {
  ko: {
    reportTour: [
      ["운세 앱이 말했다", "“좋은 흐름이 오고 있어요”", "그래서… 뭘 하라는 건데?"],
      ["사주 봤더니", "“때를 기다리세요”", "그 때가 언젠데?"],
      ["무료 운세는 늘", "“다 잘 될 거예요”", "결정은 결국 내 몫이더라"],
    ],
    race: [
      ["{question}", "엔진한테 12개월 돌려봄"],
      ["{question}", "달마다 어느 쪽 신호가 센지 세봄"],
      ["{question}", "감 말고 12개월 흐름으로 봄"],
    ],
    match: [
      ["“이거 너랑 나 돌려볼까?”", "생일 두 개 넣어봄"],
      ["궁합, 감으로 보지 말고", "계산 엔진으로 돌려봄"],
      ["둘이 잘 맞는지", "생일 두 개면 계산됨"],
    ],
    experiment: [
      ["{question}", "고민만 하지 말고 7일만 실험해봐"],
      ["결정 못 하겠으면", "7일짜리 실험부터"],
      ["{question}", "저장해두고 이번 주에 해봐"],
    ],
  },
  en: {
    reportTour: [
      ["My horoscope app said", "“Good things are coming.”", "…okay, but what do I DO?"],
      ["My reading said", "“Wait for the right time.”", "…and when is that?"],
      ["Free readings always say", "“It'll all work out.”", "The decision is still mine."],
    ],
    race: [
      ["{question}", "I ran 12 months through the engines"],
      ["{question}", "Counting which side each month leans"],
      ["{question}", "12 months of flow, not gut feeling"],
    ],
    match: [
      ["“Should we run us?”", "Two birthdays in"],
      ["Skip the vibes check", "Run the compatibility math"],
      ["Are we a match?", "Two birthdays is all it takes"],
    ],
    experiment: [
      ["{question}", "Stop overthinking. Run a 7-day test"],
      ["Can't decide?", "Start with a 7-day experiment"],
      ["{question}", "Save this and try it this week"],
    ],
  },
};

const CAPTION_BODY: Record<PromoLang, Record<PromoFormat, string>> = {
  ko: {
    reportTour:
      "운세 앱이 \"좋은 흐름이 오고 있어요\" 하면 솔직히 그래서 뭘 하라는 건지 모르겠더라.\n\n그래서 리포트 안을 그냥 다 까봤음.\n사주 4주, 12개월 흐름, 좋은 날·조심할 날, 자미두수 12궁까지. 엔진이 먼저 계산하고 AI는 해석만 함.\n마지막엔 7일 동안 뭘 해볼지, 언제 접을지까지 나옴.\n\n대신 결정해주진 않음. 결정할 기준을 줌.",
    race:
      "{question}\n\n감으로 고르지 말고 엔진한테 12개월 돌려봤음.\n달마다 A 쪽으로 기우는 달, B 쪽으로 기우는 달이 갈림. 제일 강한 달까지 나옴.\n\n대신 결정해주진 않음. 결정할 기준을 줌.",
    match:
      "궁합 감으로 보지 말고 생일 두 개 넣어봤음.\n사주·점성·수비학 점수가 따로 나오고, 천간합·지지충까지 보여줌.\n\n이거 너랑 나 돌려볼까?",
    experiment:
      "{question}\n\n고민만 하지 말고 7일만 실험해보는 거임.\nDay 1부터 Day 7까지 할 일, 어떤 조건이면 갈지, 언제 접을지까지.\n\n저장해두고 이번 주에 해봐.",
  },
  en: {
    reportTour:
      "My horoscope app said \"good things are coming.\" Cool. So what do I actually do?\n\nSo here's everything inside the report: Four Pillars, a 12-month flow, good days vs risky days, a Ziwei chart. The engines do the math first. AI only interprets.\nIt ends with a 7-day experiment and a stop rule: when to walk away.\n\nIt won't decide for you. It gives you the criteria.",
    race:
      "{question}\n\nI didn't pick on gut feeling. I ran 12 months through the engines.\nSome months lean A, some lean B, and you see the strongest month.\n\nIt won't decide for you. It gives you the criteria.",
    match:
      "Skip the vibes check. I put two birthdays in.\nSaju, astrology and numerology each get a score, plus stem combines and branch clashes.\n\nShould we run us?",
    experiment:
      "{question}\n\nStop overthinking and run a 7-day experiment.\nWhat to do from Day 1 to Day 7, which conditions say go, and when to walk away.\n\nSave this and try it this week.",
  },
};

const CAPTION_DISCLAIMER: Record<PromoLang, string> = {
  ko: "(영상 속 인물은 가상, 숫자는 엔진 실제 계산값)",
  en: "(Fictional person in the video, real engine numbers.)",
};

const COMMENT: Record<PromoLang, { default: string; match: string }> = {
  ko: { default: "무료 진단부터 돌려봐 → {{link}}", match: "둘이 같이 돌려보기 → {{link}}" },
  en: { default: "Start with the free reading → {{link}}", match: "Run it together → {{link}}" },
};

export const UI_COPY: Record<PromoLang, UiCopy> = {
  ko: {
    questionLabel: "질문은 딱 하나",
    sampleNote: "가상 인물 예시 · 숫자는 엔진 실제 계산값",
    outro: ["대신 결정해주지 않아요", "결정할 기준을 줘요"],
    cta: "무료 진단부터 시작",
    ctaMatch: "둘이 같이 돌려보기",
    price: "7일 결정 패킷 $9.99",
    disclaimer: "사주·점성 해석은 참고용이며, 최종 결정은 본인의 판단입니다",
    race: { leanA: "A쪽으로 기운 달", leanB: "B쪽으로 기운 달", even: "균형", peak: "가장 강한 달", low: "가장 약한 달", ask: "너라면 A야 B야?" },
    match: { title: "궁합 계산 예시", saju: "사주", astro: "점성술", num: "수비학", overall: "종합", combine: "천간합", clash: "지지충", yes: "있음", no: "없음", ask: "이거 너랑 나 돌려볼까?" },
    experiment: { when: "첫 실행 적합 구간", bestDay: "가장 강한 날", stopTitle: "접을 신호", save: "저장해두고 이번 주에 해봐", sample: "예시 화면" },
  },
  en: {
    questionLabel: "Ask one question",
    sampleNote: "Fictional sample · numbers are real engine output",
    outro: ["We don't decide for you.", "We give you the criteria."],
    cta: "Start with a free reading",
    ctaMatch: "Run it together",
    price: "7-Day Decision Packet $9.99",
    disclaimer: "For reference only. The final decision is yours.",
    race: { leanA: "Months leaning A", leanB: "Months leaning B", even: "Even", peak: "Strongest month", low: "Weakest month", ask: "A or B, what's your call?" },
    match: { title: "Compatibility sample", saju: "Saju", astro: "Astrology", num: "Numerology", overall: "Overall", combine: "Stem combine", clash: "Branch clash", yes: "Yes", no: "No", ask: "Should we run us?" },
    experiment: { when: "First-move window", bestDay: "Strongest day", stopTitle: "Stop rule", save: "Save this, try it this week", sample: "Sample screen" },
  },
};

const fill = (text: string, topic: TopicCopy) => text.replaceAll("{question}", topic.question);

export function hookLines(variant: PromoVariant): string[] {
  const hooks = HOOKS[variant.lang][variant.format];
  const hook = hooks[variant.hookIndex % hooks.length] ?? hooks[0] ?? [];
  return hook.map((line) => fill(line, TOPIC_COPY[variant.lang][variant.topic]));
}

export function buildCaption(variant: PromoVariant): string {
  const topic = TOPIC_COPY[variant.lang][variant.topic];
  return [fill(CAPTION_BODY[variant.lang][variant.format], topic), CAPTION_DISCLAIMER[variant.lang], topic.ask].join("\n\n");
}

export function buildCommentTemplate(lang: PromoLang, format: PromoFormat): string {
  return format === "match" ? COMMENT[lang].match : COMMENT[lang].default;
}

export function landingPathFor(format: PromoFormat): string {
  return format === "match" ? "/start?context=love" : "/start";
}

export function personaLine(lang: PromoLang, persona: Persona): string {
  const date = persona.birthDate.replaceAll("-", ".");
  return lang === "ko" ? `가상 인물 · ${date} ${persona.birthTime} · 서울` : `Fictional sample · ${date} ${persona.birthTime} · Seoul`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run video/src/promo/copy.test.ts && (cd video && pnpm typecheck)`
Expected: PASS. 480자 테스트가 실패하면 해당 `CAPTION_BODY`/`ask`를 줄인다 (가장 긴 조합: EN reportTour + marriage).

- [ ] **Step 5: 커밋**

```bash
git add video/src/promo/copy.ts video/src/promo/copy.test.ts
git commit -m "feat: 홍보 영상 문구 모듈 추가"
```

- [ ] **Step 6: ⛔ 사용자 검토 체크포인트**

`TOPIC_COPY`, `HOOKS`, `CAPTION_BODY`, `COMMENT`, `UI_COPY` 내용을 사용자에게 보여주고 승인을 받는다. 수정 요청은 이 파일에만 반영 → Step 4 재실행 → `fix: 홍보 영상 문구 수정` 커밋. **승인 전에는 Task 3 이후로 진행하지 않는다.**

---

### Task 3: 스냅샷 타입·형태 가드·이상 감지

**Files:**
- Modify (전체 교체): `video/src/promo/snapshot.ts`
- Test: `video/src/promo/snapshot.test.ts`

**Interfaces:**
- Consumes: `Persona`, `PromoFormat`, `PromoProps`, `PromoVariant` (Task 1)
- Produces:
  - `interface PromoSnapshot` (아래 정의 그대로 — 추출 스크립트와 컴포지션이 이 이름·필드를 쓴다)
  - `validateSnapshot(snapshot: PromoSnapshot, format: PromoFormat): string[]` (빈 배열 = 정상)
  - `parsePromoSnapshot(value: unknown): PromoSnapshot` (형태가 아니면 throw)
  - `parsePromoProps(value: unknown): PromoProps` (형태가 아니면 throw)

- [ ] **Step 1: 실패하는 테스트 작성** — `video/src/promo/snapshot.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parsePromoProps, parsePromoSnapshot, validateSnapshot, type PromoSnapshot } from "./snapshot.ts";
import { pickPromoVariant } from "./rotation.ts";

const months = Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1, nameEn: "Jan", average: 40 + i * 3, phase: "NEGOTIATE" }));

function makeSnapshot(overrides: Partial<PromoSnapshot> = {}): PromoSnapshot {
  return {
    asOf: "2026-10-19",
    lang: "ko",
    persona: { birthDate: "1996-03-14", birthTime: "10:30", gender: "female" },
    guest: { birthDate: "1994-11-02", birthTime: "07:00", gender: "male" },
    saju: {
      dayMaster: "경",
      pillars: { hour: { stem: "신", branch: "사" }, day: { stem: "경", branch: "술" }, month: { stem: "신", branch: "묘" }, year: { stem: "병", branch: "자" } },
      elements: [{ stem: "fire", branch: "water" }, { stem: "metal", branch: "wood" }, { stem: "metal", branch: "earth" }, { stem: "metal", branch: "fire" }],
    },
    heatmap: { bestDay: { date: "2026-10-25", score: 90, reasonKo: "임신일 식신", reasonEn: "Ren Shen day" }, months },
    scenario: {
      headline: "지금 이직 준비 시작 쪽 흐름이 우세 — 내년 9월 구간 주목",
      peakLabel: "9월 ('27)",
      timeline: months.map((m, i) => ({ label: `${m.month}월`, action: m.average, best: i === 11 ? "A" : "EQUAL" })),
    },
    ziwei: {
      mingGongBranch: "酉", wuxingJu: "화육국", wuxingJuEn: "Fire", quanPalace: "관록궁",
      palaces: Array.from({ length: 12 }, (_, i) => ({ name: `궁${i}`, nameEn: `P${i}`, branch: "子", stars: [{ ko: "천기", en: "Tian Ji", category: "main" }] })),
    },
    match: { overall: 66, saju: 55, astro: 80, num: 60, hostElement: "금", guestElement: "금", hostSign: "Pisces", guestSign: "Scorpio", hostDayMaster: "경", guestDayMaster: "신", tianganHe: false, dizhiChong: false },
    ...overrides,
  };
}

describe("validateSnapshot", () => {
  it("accepts a healthy snapshot", () => {
    expect(validateSnapshot(makeSnapshot(), "match")).toEqual([]);
  });

  it("rejects a flat or short timeline", () => {
    const flat = makeSnapshot({ scenario: { ...makeSnapshot().scenario, timeline: months.map((m) => ({ label: `${m.month}월`, action: 55, best: "EQUAL" as const })) } });
    expect(validateSnapshot(flat, "race")).toContain("timeline is flat");
    const short = makeSnapshot({ scenario: { ...makeSnapshot().scenario, timeline: [] } });
    expect(validateSnapshot(short, "race").join()).toMatch(/expected 12/);
  });

  it("rejects a best day that is already in the past", () => {
    const stale = makeSnapshot({ heatmap: { ...makeSnapshot().heatmap, bestDay: { date: "2026-10-01", score: 90, reasonKo: "x", reasonEn: "x" } } });
    expect(validateSnapshot(stale, "reportTour").join()).toMatch(/before 2026-10-19/);
  });

  it("rejects broken engine text such as 'Next year 9M'", () => {
    const broken = makeSnapshot({ scenario: { ...makeSnapshot().scenario, headline: "Option A shows the stronger flow — watch Next year 9M" } });
    expect(validateSnapshot(broken, "race").join()).toMatch(/broken text/);
  });

  it("requires in-range match scores only for the match format", () => {
    const noMatch = makeSnapshot({ match: null });
    expect(validateSnapshot(noMatch, "race")).toEqual([]);
    expect(validateSnapshot(noMatch, "match")).toContain("match format without match scores");
    const bad = makeSnapshot({ match: { ...makeSnapshot().match!, astro: 140 } });
    expect(validateSnapshot(bad, "match")).toContain("match score out of 0-100");
  });
});

describe("parse guards", () => {
  it("round-trips a snapshot through JSON", () => {
    expect(parsePromoSnapshot(JSON.parse(JSON.stringify(makeSnapshot())))).toEqual(makeSnapshot());
  });

  it("throws on a non-snapshot", () => {
    expect(() => parsePromoSnapshot({ asOf: "2026-10-19" })).toThrow(/snapshot/);
    expect(() => parsePromoSnapshot(null)).toThrow(/snapshot/);
  });

  it("parses full props and rejects an unknown format", () => {
    const variant = pickPromoVariant("2026-10-19", "ko");
    expect(parsePromoProps({ lang: "ko", variant, snapshot: makeSnapshot() }).variant.format).toBe(variant.format);
    expect(() => parsePromoProps({ lang: "ko", variant: { ...variant, format: "vlog" }, snapshot: makeSnapshot() })).toThrow(/props/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run video/src/promo/snapshot.test.ts`
Expected: FAIL — `validateSnapshot is not exported` 류

- [ ] **Step 3: 구현** — `video/src/promo/snapshot.ts` 전체 교체

```ts
// snapshot.ts — the engine output one promo video is rendered from. Produced by
// scripts/extract-report-data.ts from cosmicpath's real engines; validated before rendering.
import type { Persona, PromoFormat, PromoProps, PromoVariant } from "./types.ts";

export interface Pillar { stem: string; branch: string }

export interface PromoSnapshot {
  asOf: string;
  lang: "ko" | "en";
  persona: Persona;
  guest: Persona | null;
  saju: {
    dayMaster: string;
    pillars: { hour: Pillar; day: Pillar; month: Pillar; year: Pillar };
    elements: Array<{ stem: string; branch: string }>; // order: year, month, day, hour
  };
  heatmap: {
    bestDay: { date: string; score: number; reasonKo: string; reasonEn: string } | null;
    months: Array<{ year: number; month: number; nameEn: string; average: number; phase: string }>;
  };
  scenario: {
    headline: string;
    peakLabel: string | null;
    timeline: Array<{ label: string; action: number; best: "A" | "B" | "EQUAL" }>;
  };
  ziwei: {
    mingGongBranch: string;
    wuxingJu: string;
    wuxingJuEn: string;
    quanPalace: string;
    palaces: Array<{ name: string; nameEn: string; branch: string; stars: Array<{ ko: string; en: string; category: string }> }>;
  };
  match: {
    overall: number; saju: number; astro: number; num: number;
    hostElement: string; guestElement: string; hostSign: string; guestSign: string;
    hostDayMaster: string; guestDayMaster: string; tianganHe: boolean; dizhiChong: boolean;
  } | null;
}

const BROKEN_TEXT = /\b\d+M\b|undefined|NaN|\[object/;
const inScore = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;

function timelineProblems(snapshot: PromoSnapshot): string[] {
  const actions = snapshot.scenario.timeline.map((point) => point.action);
  const problems: string[] = [];
  if (actions.length !== 12) problems.push(`timeline has ${actions.length} months, expected 12`);
  if (!actions.every(inScore)) problems.push("timeline action score out of 0-100");
  if (actions.length > 1 && actions.every((action) => action === actions[0])) problems.push("timeline is flat");
  return problems;
}

function textProblems(snapshot: PromoSnapshot): string[] {
  const bestDay = snapshot.heatmap.bestDay;
  const texts = [
    snapshot.scenario.headline,
    snapshot.scenario.peakLabel ?? "",
    ...snapshot.scenario.timeline.map((point) => point.label),
    ...(bestDay ? [bestDay.reasonKo, bestDay.reasonEn] : []),
  ];
  return texts.filter((text) => !text.trim() || BROKEN_TEXT.test(text)).map((text) => `broken text: "${text}"`);
}

function matchProblems(match: PromoSnapshot["match"]): string[] {
  if (!match) return ["match format without match scores"];
  return [match.overall, match.saju, match.astro, match.num].every(inScore) ? [] : ["match score out of 0-100"];
}

export function validateSnapshot(snapshot: PromoSnapshot, format: PromoFormat): string[] {
  const problems = [...timelineProblems(snapshot), ...textProblems(snapshot)];
  const bestDay = snapshot.heatmap.bestDay;
  if (!bestDay) problems.push("no best day");
  else if (bestDay.date < snapshot.asOf) problems.push(`best day ${bestDay.date} is before ${snapshot.asOf}`);
  if (snapshot.ziwei.palaces.length !== 12) problems.push(`ziwei has ${snapshot.ziwei.palaces.length} palaces, expected 12`);
  if (format === "match") problems.push(...matchProblems(snapshot.match));
  return problems;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const hasKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && keys.every((key) => key in value);

function isPromoSnapshot(value: unknown): value is PromoSnapshot {
  if (!hasKeys(value, ["asOf", "lang", "persona", "saju", "heatmap", "scenario", "ziwei", "match"])) return false;
  return typeof value.asOf === "string"
    && hasKeys(value.saju, ["dayMaster", "pillars", "elements"])
    && hasKeys(value.heatmap, ["bestDay", "months"]) && Array.isArray(value.heatmap.months)
    && hasKeys(value.scenario, ["headline", "peakLabel", "timeline"]) && Array.isArray(value.scenario.timeline)
    && hasKeys(value.ziwei, ["palaces", "quanPalace"]) && Array.isArray(value.ziwei.palaces);
}

export function parsePromoSnapshot(value: unknown): PromoSnapshot {
  if (!isPromoSnapshot(value)) throw new Error("not a promo snapshot");
  return value;
}

const FORMATS = new Set(["reportTour", "race", "match", "experiment"]);
const TOPICS = new Set(["contact", "career", "confession", "sideJob", "marriage", "partnership"]);

function isPromoVariant(value: unknown): value is PromoVariant {
  return hasKeys(value, ["date", "lang", "slot", "format", "topic", "hookIndex", "persona", "guest"])
    && FORMATS.has(String(value.format)) && TOPICS.has(String(value.topic))
    && (value.lang === "ko" || value.lang === "en") && typeof value.hookIndex === "number";
}

export function parsePromoProps(value: unknown): PromoProps {
  if (!hasKeys(value, ["lang", "variant", "snapshot"]) || !isPromoVariant(value.variant) || (value.lang !== "ko" && value.lang !== "en")) {
    throw new Error("not promo props");
  }
  return { lang: value.lang, variant: value.variant, snapshot: parsePromoSnapshot(value.snapshot) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run video/src/promo && (cd video && pnpm typecheck)`
Expected: rotation·copy·snapshot 테스트 전부 PASS, typecheck 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add video/src/promo/snapshot.ts video/src/promo/snapshot.test.ts
git commit -m "feat: 홍보 영상 엔진 스냅샷 검증 추가"
```

---

### Task 4: 엔진 추출 스크립트 일반화 + 미리보기 데이터

**Files:**
- Modify (전체 재작성): `video/scripts/extract-report-data.ts`
- Create: `video/src/data/promo-preview.json`
- Delete: `video/src/data/promo-report-data.json` (Task 5에서 참조 제거 후 삭제 — 이 Task에서는 생성만)

**Interfaces:**
- Consumes: `PromoVariant`, `Persona` (Task 1), `PromoSnapshot` (Task 3), `TOPIC_COPY` (Task 2)
- Produces: CLI `node video/scripts/extract-report-data.ts --input <variant-input.json> --out <snapshot.json>` (cwd = cosmicpath 루트, `TZ=UTC`). 입력 JSON 형태: `{ "variant": PromoVariant, "scenarioA": string, "scenarioB": string, "question": string }`. 출력은 `PromoSnapshot`.

- [ ] **Step 1: 스크립트 재작성** — `video/scripts/extract-report-data.ts`

```ts
// extract-report-data.ts — run cosmicpath's real engines for one promo variant and write a PromoSnapshot.
// The persona is fictional; every number in the video comes from this run.
// Engines are called through the same entry points production uses (paid report: calculateOracleSajuProfile;
// /match: calculateCompatibility with an offset datetime). Production runs on UTC, so run with TZ=UTC.
// cosmicpath's engine files need its own TS require hook (registerTypeScriptLoader): plain type stripping
// cannot load modules that import types as values.
//   cd <cosmicpath> && TZ=UTC node <thread-uploader>/video/scripts/extract-report-data.ts --input in.json --out out.json
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { Persona, PromoVariant } from "../src/promo/types.ts";
import type { PromoSnapshot } from "../src/promo/snapshot.ts";

interface ExtractInput { variant: PromoVariant; scenarioA: string; scenarioB: string; question: string }

const { values } = parseArgs({ options: { input: { type: "string" }, out: { type: "string" } } });
if (!values.input || !values.out) throw new Error("usage: --input variant-input.json --out snapshot.json");

const root = process.cwd();
const { registerTypeScriptLoader } = await import(pathToFileURL(`${root}/scripts/report-test-data/ts-loader.ts`).href);
registerTypeScriptLoader();
const load = createRequire(`${root}/package.json`);
// require() is untyped at this cross-repo boundary (engine types live in cosmicpath). The fields read
// below are checked by parsePromoSnapshot + validateSnapshot before anything is rendered.
const engine = (file: string) => load(`${root}/src/${file}`);
const { calculateOracleSajuProfile } = engine("lib/saju/saju-engine.ts");
const { mapToLegacySaju } = engine("app/api/reading/route-helpers.ts");
const { calculateRollingTimingHeatmap } = engine("lib/engines/timing-heatmap.ts");
const { calculateScenarioDecision, getPeakActionPoint } = engine("lib/engines/scenario-engine.ts");
const { calculateZiweiChart } = engine("lib/engines/ziwei.ts");
const { ziweiPalaceToEnglish, ziweiStarToEnglish, ziweiBureauToEnglish } = engine("lib/saju-terms-en.ts");
const { calculateCompatibility } = engine("lib/match/match-calculator.ts");

const input: ExtractInput = JSON.parse(readFileSync(values.input, "utf8"));
const { variant } = input;
const [asOfYear, asOfMonth] = variant.date.split("-").map(Number);

async function sajuFor(persona: Persona) {
  const profile = await calculateOracleSajuProfile({ birthDate: persona.birthDate, birthTime: persona.birthTime, gender: persona.gender, cityName: "Seoul" });
  return mapToLegacySaju(profile);
}

function englishHeadline(recommended: string, peakLabel: string | null): string {
  const lean = recommended === "OPTION_A" ? "Option A shows the stronger flow"
    : recommended === "OPTION_B" ? "Option B shows the stronger flow" : "Neither option clearly leads";
  return `${lean} — watch ${peakLabel ?? ""}`;
}

function matchFor(host: Persona, guest: Persona): PromoSnapshot["match"] {
  const at = (persona: Persona) => new Date(`${persona.birthDate}T${persona.birthTime}:00+09:00`);
  const result = calculateCompatibility(
    { name: "A", birthDate: at(host), timezone: "Asia/Seoul", gender: host.gender },
    { name: "B", birthDate: at(guest), timezone: "Asia/Seoul", gender: guest.gender },
  );
  return {
    overall: result.overallScore, saju: result.sajuScore, astro: result.astroScore, num: result.numScore,
    hostElement: result.hostElement, guestElement: result.guestElement, hostSign: result.hostSign, guestSign: result.guestSign,
    hostDayMaster: result.hostDayMaster, guestDayMaster: result.guestDayMaster, tianganHe: Boolean(result.tianganHe), dizhiChong: Boolean(result.dizhiChong),
  };
}

const saju = await sajuFor(variant.persona);
const heatmap = calculateRollingTimingHeatmap(saju, asOfYear, asOfMonth, variant.date);
const scenario = calculateScenarioDecision({
  scenarioA: input.scenarioA, scenarioB: input.scenarioB, question: input.question,
  weeklyHeatmap: heatmap, saju, targetYear: asOfYear, startMonth: asOfMonth, language: variant.lang,
});
const peak = getPeakActionPoint(scenario);
const peakLabel: string | null = peak ? (variant.lang === "ko" ? peak.formattedLabelKo : peak.formattedLabelEn) : null;
// Same call the paid report's Ziwei chart makes (premium-report.tsx).
const ziwei = calculateZiweiChart(new Date(variant.persona.birthDate), Number(variant.persona.birthTime.slice(0, 2)), variant.persona.gender);
const pillar = (value: { stem: string; branch: string }) => ({ stem: value.stem, branch: value.branch });

const snapshot: PromoSnapshot = {
  asOf: variant.date,
  lang: variant.lang,
  persona: variant.persona,
  guest: variant.format === "match" ? variant.guest : null,
  saju: {
    dayMaster: saju.dayMaster,
    pillars: { hour: pillar(saju.hourPillar), day: pillar(saju.dayPillar), month: pillar(saju.monthPillar), year: pillar(saju.yeonPillar) },
    elements: saju.elements,
  },
  heatmap: {
    bestDay: heatmap.bestDay ? { date: heatmap.bestDay.date, score: heatmap.bestDay.score, reasonKo: heatmap.bestDay.reasonKo, reasonEn: heatmap.bestDay.reasonEn } : null,
    months: heatmap.months.map((month: { year: number; month: number; monthNameEn: string; averageScore: number; dominantPhase: string }) => ({
      year: month.year, month: month.month, nameEn: month.monthNameEn, average: month.averageScore, phase: month.dominantPhase,
    })),
  },
  scenario: {
    headline: variant.lang === "ko" ? scenario.verdictHeadlineKo : englishHeadline(scenario.recommendedOption, peakLabel),
    peakLabel,
    timeline: scenario.timeline.map((point: { formattedLabelKo: string; formattedLabelEn: string; actionScore: number; bestOption: "A" | "B" | "EQUAL" }) => ({
      label: variant.lang === "ko" ? point.formattedLabelKo : point.formattedLabelEn, action: point.actionScore, best: point.bestOption,
    })),
  },
  ziwei: {
    mingGongBranch: ziwei.mingGongBranch,
    wuxingJu: ziwei.wuxingJu.name,
    wuxingJuEn: ziweiBureauToEnglish(ziwei.wuxingJu.name),
    quanPalace: ziwei.siHuaSummary["화권"].palace,
    palaces: ziwei.palaceList.map((palace: { name: string; branch: string; stars: Array<{ name: string; nameEn?: string; category: string }> }) => ({
      name: palace.name, nameEn: ziweiPalaceToEnglish(palace.name), branch: palace.branch,
      stars: palace.stars.map((star) => ({ ko: star.name, en: star.nameEn ?? ziweiStarToEnglish(star.name), category: star.category })),
    })),
  },
  match: variant.format === "match" ? matchFor(variant.persona, variant.guest) : null,
};

writeFileSync(values.out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${values.out}`);
```

- [ ] **Step 2: 미리보기 입력 만들기 + 추출 실행 (궁합 포함 회차)**

```bash
SCRATCH=$(mktemp -d)
cd video && node --input-type=module -e "
import { pickPromoVariant } from './src/promo/rotation.ts';
import { TOPIC_COPY } from './src/promo/copy.ts';
const variant = pickPromoVariant('2026-10-26', 'ko');
const topic = TOPIC_COPY.ko[variant.topic];
process.stdout.write(JSON.stringify({ variant, scenarioA: topic.forkA, scenarioB: topic.forkB, question: topic.question }));
" > $SCRATCH/input.json && cd ..
(cd ../cosmicpath && TZ=UTC node --no-warnings ../threads-uploader/video/scripts/extract-report-data.ts --input $SCRATCH/input.json --out $SCRATCH/snapshot.json)
```
Expected: `wrote …/snapshot.json`

- [ ] **Step 3: 스냅샷 검증 통과 확인 + 미리보기 파일 저장**

```bash
cd video && node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import { parsePromoSnapshot, validateSnapshot } from './src/promo/snapshot.ts';
const input = JSON.parse(readFileSync('$SCRATCH/input.json', 'utf8'));
const snapshot = parsePromoSnapshot(JSON.parse(readFileSync('$SCRATCH/snapshot.json', 'utf8')));
const problems = validateSnapshot(snapshot, input.variant.format);
if (problems.length) { console.error(problems); process.exit(1); }
writeFileSync('src/data/promo-preview.json', JSON.stringify({ lang: 'ko', variant: input.variant, snapshot }, null, 2) + '\n');
console.log('preview ok', input.variant.format, input.variant.topic, snapshot.saju.dayMaster, snapshot.match);
" && cd ..
```
Expected: `preview ok match <관계 주제> <일간> { overall: …, … }` — 점수는 모두 0–100.

- [ ] **Step 4: 시간대 무관성 확인** (같은 입력, KST로 한 번 더)

```bash
(cd ../cosmicpath && TZ=Asia/Seoul node --no-warnings ../threads-uploader/video/scripts/extract-report-data.ts --input $SCRATCH/input.json --out $SCRATCH/snapshot-kst.json)
diff $SCRATCH/snapshot.json $SCRATCH/snapshot-kst.json && echo "TZ independent"
```
Expected: `TZ independent`. 다르면 멈추고 보고한다 (프로덕션 UTC 기준값을 쓰도록 `TZ=UTC` 고정은 유지).

- [ ] **Step 5: 커밋**

```bash
git add video/scripts/extract-report-data.ts video/src/data/promo-preview.json
git commit -m "feat: 홍보 영상 엔진 추출을 회차 입력 기반으로 일반화"
```

---

### Task 5: 공용 장면 분리 + ① 리포트 투어를 props 기반으로

**Files:**
- Create: `video/src/components/PromoScenes.tsx`
- Rename: `video/src/components/PromoReportTour.tsx` → `video/src/components/ReportTourScenes.tsx`
- Rename: `video/src/compositions/PromoViral.tsx` → `video/src/compositions/PromoReportTour.tsx`
- Modify: `video/src/Root.tsx`
- Delete: `video/src/data/promo-report-data.json`

**Interfaces:**
- Consumes: `PromoProps`, `RELATION_TOPICS`, `FORMAT_FRAMES`, `PROMO_FPS` (Task 1), `UI_COPY`, `TOPIC_COPY`, `TOPIC_LABEL`, `hookLines`, `personaLine` (Task 2), `PromoSnapshot` (Task 3)
- Produces:
  - `HookScene({ lines: readonly string[]; len: number })`
  - `QuestionScene({ label: string; question: string; persona: string; len: number })`
  - `OutroScene({ lang: PromoLang; match: boolean })`
  - `SampleNote({ lang: PromoLang; top: number })`
  - `PromoReportTour: React.FC<PromoProps>` (컴포지션 ID `PromoReportTour`)
  - `PREVIEW_PROPS: PromoProps` (`video/src/promo/preview.ts`, Root 기본값)

- [ ] **Step 1: 공용 장면 파일 작성** — `video/src/components/PromoScenes.tsx`

```tsx
// PromoScenes.tsx — scenes shared by every promo format: hook, one question, outro/CTA.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, Rise, textBase, useEnter, useExit } from "./PromoKit";
import { UI_COPY } from "../promo/copy.ts";
import type { PromoLang } from "../promo/types.ts";

export const HookScene: React.FC<{ lines: readonly string[]; len: number }> = ({ lines, len }) => {
  const frame = useCurrentFrame();
  const punchAt = 14 + (lines.length - 1) * 14;
  const punch = useEnter(punchAt, 9);
  const shake = frame > punchAt && frame < punchAt + 12 ? Math.sin(frame * 3) * 8 : 0;
  const lead = lines.slice(0, -1);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, opacity: useExit(len) }}>
      {lead.map((line, index) => (
        <Rise key={index} delay={index * 10} style={{ marginTop: index === 0 ? 0 : 28 }}>
          <div style={{ ...textBase, fontSize: index === 0 ? 52 : 72, fontWeight: index === 0 ? 600 : 800, color: index === 0 ? C.dim : C.text }}>{line}</div>
        </Rise>
      ))}
      <div style={{ ...textBase, marginTop: 80, fontSize: 86, fontWeight: 900, color: C.goldHi, opacity: punch, transform: `scale(${0.6 + punch * 0.4}) translateX(${shake}px)` }}>
        {lines[lines.length - 1]}
      </div>
    </AbsoluteFill>
  );
};

export const QuestionScene: React.FC<{ label: string; question: string; persona: string; len: number }> = ({ label, question, persona, len }) => {
  const frame = useCurrentFrame();
  const chars = Math.floor(interpolate(frame, [10, 40], [0, question.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caret = Math.floor(frame / 8) % 2 === 0 ? 1 : 0;
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: 80, opacity: useExit(len, 8) }}>
      <Rise><div style={{ ...textBase, fontSize: 48, color: C.dim, fontWeight: 600, marginBottom: 40 }}>{label}</div></Rise>
      <Rise delay={4}>
        <div style={{ padding: "48px 40px", borderRadius: 36, background: C.card, border: `3px solid ${C.gold}`, boxShadow: `0 0 80px ${C.gold}33` }}>
          <div style={{ ...textBase, fontSize: 72, fontWeight: 800, minHeight: 100 }}>
            {question.slice(0, chars)}<span style={{ opacity: caret, color: C.goldHi }}>|</span>
          </div>
        </div>
      </Rise>
      <Rise delay={28} style={{ marginTop: 36 }}><div style={{ ...textBase, fontSize: 34, color: C.dim }}>{persona}</div></Rise>
    </AbsoluteFill>
  );
};

export const SampleNote: React.FC<{ lang: PromoLang; top: number }> = ({ lang, top }) => (
  <div style={{ position: "absolute", top, width: "100%", ...textBase, fontSize: 28, color: C.dim }}>{UI_COPY[lang].sampleNote}</div>
);

export const OutroScene: React.FC<{ lang: PromoLang; match: boolean }> = ({ lang, match }) => {
  const ui = UI_COPY[lang];
  const cta = useEnter(30, 12);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      <Rise><div style={{ ...textBase, fontSize: 60, fontWeight: 700, color: C.dim }}>{ui.outro[0]}</div></Rise>
      <Rise delay={10} style={{ marginTop: 20 }}><div style={{ ...textBase, fontSize: 80, fontWeight: 900, color: C.goldHi }}>{ui.outro[1]}</div></Rise>
      <div style={{ marginTop: 100, opacity: cta, transform: `translateY(${(1 - cta) * 40}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ ...textBase, fontSize: 46, fontWeight: 800, color: C.bg, background: C.goldHi, padding: "26px 56px", borderRadius: 999 }}>{match ? ui.ctaMatch : ui.cta}</div>
        {match ? null : <div style={{ ...textBase, fontSize: 36, marginTop: 30 }}>{ui.price}</div>}
        <div style={{ ...textBase, fontSize: 58, fontWeight: 900, marginTop: 50, letterSpacing: "0.02em" }}>cosmicpath.app</div>
      </div>
      <div style={{ position: "absolute", bottom: 120, ...textBase, fontSize: 26, color: C.dim, opacity: cta, padding: "0 80px" }}>{ui.disclaimer}</div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: 미리보기 props 모듈** — `video/src/promo/preview.ts`

```ts
// preview.ts — Studio default props for every promo composition (validated, no casts).
import preview from "../data/promo-preview.json";
import { parsePromoProps } from "./snapshot.ts";
import type { PromoFormat, PromoProps } from "./types.ts";

const base = parsePromoProps(preview);

export function previewProps(format: PromoFormat): PromoProps {
  return { ...base, variant: { ...base.variant, format } };
}
```

- [ ] **Step 3: 파일 이름 변경**

```bash
git mv video/src/components/PromoReportTour.tsx video/src/components/ReportTourScenes.tsx
git mv video/src/compositions/PromoViral.tsx video/src/compositions/PromoReportTour.tsx
```

- [ ] **Step 4: `ReportTourScenes.tsx`를 props 기반으로**

다음을 정확히 바꾼다.
1. `import data from "../data/promo-report-data.json";` 삭제 → 추가:
   ```ts
   import type { PromoSnapshot } from "../promo/snapshot.ts";
   import type { PromoTopic } from "../promo/types.ts";
   import { TOPIC_LABEL } from "../promo/copy.ts";
   ```
2. `type TourProps = { lang: PromoLang; len: number };` →
   ```ts
   type TourProps = { lang: PromoLang; len: number; snapshot: PromoSnapshot; topic: PromoTopic };
   ```
3. `elementCounts()` → `elementCounts(snapshot: PromoSnapshot)`, 본문 `data.saju.elements` → `snapshot.saju.elements`. `ElementBars`는 `{ lang, snapshot }` props를 받고 `elementCounts(snapshot)` 호출.
4. `SajuTourScene`: `({ lang, len, snapshot })`, 본문의 `data.` → `snapshot.`, `<ElementBars lang={lang} snapshot={snapshot} />`.
5. `FlowBar` props에 `year: number | undefined; prevYear: number | undefined` 추가하고 내부 `data.heatmap.months[...]` 두 줄 삭제. `FlowTourScene`:
   ```tsx
   export const FlowTourScene: React.FC<TourProps> = ({ lang, len, snapshot }) => {
     const frame = useCurrentFrame();
     const s = snapshot.scenario;
     const { peak, low } = peakAndLow(s.timeline);
     const headline = useEnter(80, 12);
     const title = lang === "ko" ? "다음 12개월, 언제 움직일지" : "When to move, by month";
     const axis = lang === "ko" ? "월별 행동 지수 · A안 vs B안" : "Monthly action index · A vs B";
     const months = snapshot.heatmap.months;
     // ...JSX 동일, 막대 렌더만:
     // <FlowBar key={p.label} point={p} index={i} year={months[i]?.year} prevYear={months[i - 1]?.year} tone={...} />
     // verdict 자리에는 s.headline
   ```
6. `MonthTile`의 month 타입 → `PromoSnapshot["heatmap"]["months"][number]`. KO 이름은 `${month.year % 100}.${month.month}월` 유지, EN은 `${month.nameEn.slice(0, 3)} '${month.year % 100}`. `HeatmapTourScene`: `({ lang, len, snapshot })`, `data.` → `snapshot.`.
7. 자미두수: `const FOCUS_PALACE = "관록궁";` 삭제 →
   ```ts
   const FOCUS_PALACE_BY_TOPIC: Record<PromoTopic, string> = {
     career: "관록궁", sideJob: "재백궁", partnership: "노복궁", contact: "부처궁", confession: "부처궁", marriage: "부처궁",
   };
   const PALACE_MEANING: Record<string, { ko: string; en: string }> = {
     관록궁: { ko: "직업", en: "Career" }, 재백궁: { ko: "돈", en: "Wealth" }, 노복궁: { ko: "동료·파트너", en: "Partners" }, 부처궁: { ko: "연애·배우자", en: "Spouse" },
   };
   ```
   `PalaceCell` props에 `focusPalace: string` 추가, `palace.name === FOCUS_PALACE` → `palace.name === focusPalace`, palace 타입 → `PromoSnapshot["ziwei"]["palaces"][number]`.
   `ZiweiTourScene`:
   ```tsx
   export const ZiweiTourScene: React.FC<TourProps> = ({ lang, len, snapshot, topic }) => {
     const callout = useEnter(64, 12);
     const z = snapshot.ziwei;
     const focusPalace = FOCUS_PALACE_BY_TOPIC[topic];
     const meaning = PALACE_MEANING[focusPalace] ?? { ko: "", en: "" };
     const focus = z.palaces.find((p) => p.name === focusPalace);
     const stars = (focus?.stars ?? []).filter((s) => s.category === "main").map((s) => s[lang]).join(", ");
     const quan = z.quanPalace === focusPalace;
     const title = lang === "ko" ? "삶의 12영역: 자미두수 명반" : "Ziwei: 12 life areas";
     const center = lang === "ko" ? [`명궁 ${z.mingGongBranch}`, z.wuxingJu] : [`Life palace ${z.mingGongBranch}`, `${z.wuxingJuEn} bureau`];
     const note = lang === "ko"
       ? `${TOPIC_LABEL.ko[topic]} 질문 → ${focusPalace}(${meaning.ko}) · ${stars}${quan ? " 화권" : ""}`
       : `${TOPIC_LABEL.en[topic]} question → ${meaning.en} palace · ${stars}${quan ? " (Power)" : ""}`;
     // JSX 동일, PalaceCell에 focusPalace={focusPalace} 전달
   ```

- [ ] **Step 5: `compositions/PromoReportTour.tsx`를 props 기반으로**

1. 상단 import 정리:
   ```tsx
   import { ensurePretendard } from "../load-fonts";
   import { C, Rise, Starfield, textBase, useEnter, useExit } from "../components/PromoKit";
   import { HookScene, OutroScene, QuestionScene } from "../components/PromoScenes";
   import { FlowTourScene, HeatmapTourScene, SajuTourScene, TourKicker, TOUR_TOTAL, ZiweiTourScene } from "../components/ReportTourScenes";
   import { TOPIC_COPY, UI_COPY, hookLines, personaLine } from "../promo/copy.ts";
   import { RELATION_TOPICS, type PromoLang, type PromoProps } from "../promo/types.ts";
   ```
   `import data from "../data/promo-report-data.json";`, `PROMO_FPS`/`PROMO_DURATION` export, `PromoViralProps`, 로컬 `HookScene`/`QuestionScene`/`OutroScene` 정의를 삭제한다.
2. `Copy` 타입에서 `hook`, `questionLabel`, `persona`, `question`, `forkA`, `forkB`, `cards`, `pairTitle`, `pairLeft`, `pairRight`, `pairResult`, `pairHook`, `outro`, `cta`, `price`, `disclaimer` 를 지우고 `COPY` 상수 이름을 `REPORT_UI`로 바꿔 남은 정적 문구(`painTitle`, `pains`, `engineTop`, `engineBottom`, `engines`, `timeFix`, `reportTag`, `reportTitle`, `sample`, `callouts`)만 둔다. 그리고 회차별 값을 합치는 함수를 추가:
   ```tsx
   type ReportUi = {
     painTitle: string; pains: [string, string, string]; engineTop: string; engineBottom: string; engines: string[];
     timeFix: string; reportTag: string; reportTitle: string; sample: string; callouts: string[];
   };
   // const REPORT_UI: Record<PromoLang, ReportUi> = { ko: {…기존 COPY.ko의 해당 필드 그대로…}, en: {…} };
   type ReportCard = { title: string; body: string; tone?: "danger" };
   type Pair = { title: string; left: [string, string]; right: [string, string]; result: string; hook: string };
   type Copy = ReportUi & { question: string; forkA: string; forkB: string; cards: ReportCard[]; pair: Pair };

   const REVIEW_PAIR: Record<PromoLang, Pair> = {
     ko: { title: "그리고 7일 뒤", left: ["Day 1", "내 계획"], right: ["Day 7", "실제 결과"], result: "결과 대조", hook: "내 선택을 현실과 맞춰봄" },
     en: { title: "Then, 7 days later", left: ["Day 1", "Your plan"], right: ["Day 7", "What happened"], result: "Decision Review", hook: "Your call, checked against reality." },
   };

   function buildCopy({ lang, variant, snapshot }: PromoProps): Copy {
     const topic = TOPIC_COPY[lang][variant.topic];
     const when = lang === "ko" ? `첫 실행 적합 구간: ${snapshot.scenario.peakLabel ?? ""}` : `First-move window: ${snapshot.scenario.peakLabel ?? ""}`;
     const relation = lang === "ko" && RELATION_TOPICS.includes(variant.topic);
     const dot = (date: string) => date.replaceAll("-", ". ");
     const pair: Pair = relation
       ? { title: "고민이 '우리'라면", left: ["나", dot(variant.persona.birthDate)], right: ["너", dot(variant.guest.birthDate)], result: "궁합 Decision Note", hook: "“이거 너랑 나 돌려볼까?”" }
       : REVIEW_PAIR[lang];
     const titles = lang === "ko" ? ["언제", "7일 실험", "조건: if / then", "접을 신호"] : ["When", "7-day experiment", "If / then rules", "Stop rule"];
     return {
       ...REPORT_UI[lang], question: topic.question, forkA: topic.forkA, forkB: topic.forkB, pair,
       cards: [
         { title: titles[0] ?? "", body: when },
         { title: titles[1] ?? "", body: `${topic.experiment[0]} → ${topic.experiment[3]}` },
         { title: titles[2] ?? "", body: topic.ifThen.join("\n") },
         { title: titles[3] ?? "", body: topic.stopRule, tone: "danger" },
       ],
     };
   }
   ```
   `PairScene`의 `copy.pairTitle/pairLeft/pairRight/pairResult/pairHook` → `copy.pair.title/left/right/result/hook`.
3. `SceneProps`를 `{ copy: Copy; props: PromoProps; len: number }`로 바꾸고, 장면 테이블을 다음으로 교체:
   ```tsx
   const SCENE_COMPONENTS: Record<(typeof SCENES)[number]["id"], React.FC<SceneProps>> = {
     hook: ({ props, len }) => <HookScene lines={hookLines(props.variant)} len={len} />,
     pains: ({ copy, len }) => <PainsScene copy={copy} len={len} />,
     engines: ({ copy, len }) => <EnginesScene copy={copy} len={len} />,
     question: ({ copy, props, len }) => (
       <QuestionScene label={UI_COPY[props.lang].questionLabel} question={copy.question} persona={personaLine(props.lang, props.variant.persona)} len={len} />
     ),
     saju: ({ props, len }) => <SajuTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
     flow: ({ props, len }) => <FlowTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
     heatmap: ({ props, len }) => <HeatmapTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
     ziwei: ({ props, len }) => <ZiweiTourScene lang={props.lang} len={len} snapshot={props.snapshot} topic={props.variant.topic} />,
     report: ({ copy, props, len }) => <ReportScene copy={copy} lang={props.lang} len={len} />,
     pair: ({ copy, len }) => <PairScene copy={copy} len={len} />,
     outro: ({ props }) => <OutroScene lang={props.lang} match={false} />,
   };

   export const PromoReportTour: React.FC<PromoProps> = (props) => {
     const copy = buildCopy(props);
     return (
       <AbsoluteFill style={{ backgroundColor: C.bg }}>
         <Starfield />
         {SCENES.map((s) => {
           const SceneComponent = SCENE_COMPONENTS[s.id];
           return (
             <Sequence key={s.id} from={s.from} durationInFrames={s.len} name={s.id}>
               <SceneComponent copy={copy} props={props} len={s.len} />
             </Sequence>
           );
         })}
       </AbsoluteFill>
     );
   };
   ```
   `ReportScene`의 시그니처는 `React.FC<{ copy: Copy; lang: PromoLang; len: number }>`로, `PainsScene`/`EnginesScene`/`PairScene`은 `{ copy: Copy; len: number }` 그대로.

- [ ] **Step 6: Root에 포맷 등록 (이 Task에서는 ①만)** — `video/src/Root.tsx`

PromoViral 관련 import와 `(["ko","en"] as const).map(...)` 블록을 삭제하고 다음으로 교체:
```tsx
import { PromoReportTour } from "./compositions/PromoReportTour";
import { previewProps } from "./promo/preview.ts";
import { FORMAT_FRAMES, PROMO_FPS } from "./promo/types.ts";
// ...RemotionRoot 안 맨 앞:
      <Composition
        id="PromoReportTour"
        component={PromoReportTour}
        defaultProps={previewProps("reportTour")}
        width={1080}
        height={1920}
        fps={PROMO_FPS}
        durationInFrames={FORMAT_FRAMES.reportTour}
      />
```

- [ ] **Step 7: 옛 데이터 삭제 + 타입체크**

```bash
git rm video/src/data/promo-report-data.json
cd video && pnpm typecheck && cd ..
```
Expected: 에러 없음. `promo-report-data.json`을 참조하는 곳이 남아 있으면 에러 → 해당 참조를 `props.snapshot`으로 바꾼다.

- [ ] **Step 8: 스틸로 확인**

```bash
cd video && mkdir -p out/check && for f in 80 380 480 630 755 870 1080 1170 1300; do
  pnpm exec remotion still src/index.ts PromoReportTour out/check/tour-$f.png --frame=$f --scale=0.5 --log=error; done; cd ..
```
Expected: 훅 → 질문(가상 인물 줄) → 사주 → 흐름 → 히트맵 → 자미두수(주제 궁 강조) → 패킷('언제'에 엔진 최고 달) → 궁합 쌍(관계 주제 KO) → CTA가 모두 보이고 글자 겹침 없음. 스틸을 직접 열어 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add video/src/components/PromoScenes.tsx video/src/components/ReportTourScenes.tsx video/src/compositions/PromoReportTour.tsx video/src/promo/preview.ts video/src/Root.tsx
git commit -m "refactor: 리포트 투어 홍보 영상을 회차 props 기반으로 전환"
```

---

### Task 6: ② A vs B 레이스

**Files:**
- Create: `video/src/compositions/PromoRace.tsx`
- Modify: `video/src/Root.tsx`

**Interfaces:**
- Consumes: `HookScene`, `QuestionScene`, `OutroScene`, `SampleNote` (Task 5), `PromoKit`, `UI_COPY`, `TOPIC_COPY`, `hookLines`, `personaLine` (Task 2), `PromoProps` (Task 1)
- Produces: `PromoRace: React.FC<PromoProps>` (컴포지션 ID `PromoRace`, 600 frames)

- [ ] **Step 1: 컴포지션 작성** — `video/src/compositions/PromoRace.tsx`

```tsx
// PromoRace.tsx — format ②: "A vs B" race over the next 12 months (20s).
// Each month card flips to the side the scenario engine leans (actionScore > 65 → A, < 45 → B);
// the scoreboard tallies the engine's own bestOption values. No number here is typed by hand.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { ensurePretendard } from "../load-fonts";
import { C, Starfield, textBase, useEnter, useExit } from "../components/PromoKit";
import { HookScene, OutroScene, QuestionScene, SampleNote } from "../components/PromoScenes";
import { TOPIC_COPY, UI_COPY, hookLines, personaLine } from "../promo/copy.ts";
import type { PromoProps } from "../promo/types.ts";

void ensurePretendard();

const RACE_START = 20;
const MONTH_STEP = 20;
const LEAN_COLOR = { A: C.goldHi, B: C.indigo, EQUAL: "rgba(245,241,232,0.22)" } as const;
type Point = PromoProps["snapshot"]["scenario"]["timeline"][number];

function tally(timeline: Point[], revealed: number) {
  const shown = timeline.slice(0, revealed);
  return { a: shown.filter((p) => p.best === "A").length, b: shown.filter((p) => p.best === "B").length };
}

const ScoreSide: React.FC<{ label: string; option: string; count: number; color: string }> = ({ label, option, count, color }) => (
  <div style={{ width: 440, padding: "28px 20px", borderRadius: 28, background: C.card, border: `3px solid ${color}` }}>
    <div style={{ ...textBase, fontSize: 30, color: C.dim }}>{label}</div>
    <div style={{ ...textBase, fontSize: 120, fontWeight: 900, color }}>{count}</div>
    <div style={{ ...textBase, fontSize: 30, fontWeight: 700 }}>{option}</div>
  </div>
);

const MonthCard: React.FC<{ point: Point; index: number }> = ({ point, index }) => {
  const flip = useEnter(RACE_START + index * MONTH_STEP, 13);
  const color = LEAN_COLOR[point.best];
  return (
    <div style={{ width: 220, height: 150, borderRadius: 22, border: `3px solid ${flip > 0.5 ? color : C.border}`, background: flip > 0.5 ? `${color}22` : C.card, transform: `rotateX(${(1 - flip) * 90}deg)`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ ...textBase, fontSize: 30, fontWeight: 700 }}>{point.label}</div>
      <div style={{ ...textBase, fontSize: 46, fontWeight: 900, color, opacity: flip }}>{point.best === "EQUAL" ? "–" : point.best} · {point.action}</div>
    </div>
  );
};

const RaceScene: React.FC<PromoProps & { len: number }> = ({ lang, variant, snapshot, len }) => {
  const frame = useCurrentFrame();
  const ui = UI_COPY[lang].race;
  const topic = TOPIC_COPY[lang][variant.topic];
  const revealed = Math.max(0, Math.min(12, Math.floor((frame - RACE_START) / MONTH_STEP) + 1));
  const { a, b } = tally(snapshot.scenario.timeline, revealed);
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <div style={{ position: "absolute", top: 150, width: "100%", display: "flex", justifyContent: "center", gap: 40 }}>
        <ScoreSide label={ui.leanA} option={`A · ${topic.forkA}`} count={a} color={LEAN_COLOR.A} />
        <ScoreSide label={ui.leanB} option={`B · ${topic.forkB}`} count={b} color={LEAN_COLOR.B} />
      </div>
      <div style={{ position: "absolute", top: 620, left: 60, width: 960, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, perspective: 1200 }}>
        {snapshot.scenario.timeline.map((point, index) => <MonthCard key={point.label} point={point} index={index} />)}
      </div>
      <SampleNote lang={lang} top={1360} />
    </AbsoluteFill>
  );
};

const VerdictScene: React.FC<PromoProps & { len: number }> = ({ lang, snapshot, len }) => {
  const ui = UI_COPY[lang].race;
  const peak = useEnter(0, 11);
  const ask = useEnter(36, 12);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70, opacity: useExit(len) }}>
      <div style={{ ...textBase, fontSize: 40, color: C.gold, opacity: peak }}>{ui.peak}</div>
      <div style={{ ...textBase, fontSize: 120, fontWeight: 900, color: C.goldHi, transform: `scale(${0.6 + peak * 0.4})` }}>{snapshot.scenario.peakLabel}</div>
      <div style={{ ...textBase, fontSize: 44, fontWeight: 800, marginTop: 40, lineHeight: 1.3, opacity: peak }}>{snapshot.scenario.headline}</div>
      <div style={{ ...textBase, fontSize: 60, fontWeight: 900, marginTop: 80, opacity: ask, transform: `translateY(${(1 - ask) * 40}px)` }}>{ui.ask}</div>
    </AbsoluteFill>
  );
};

export const PromoRace: React.FC<PromoProps> = (props) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Starfield />
    <Sequence from={0} durationInFrames={70} name="hook"><HookScene lines={hookLines(props.variant)} len={70} /></Sequence>
    <Sequence from={70} durationInFrames={60} name="question">
      <QuestionScene label={UI_COPY[props.lang].questionLabel} question={TOPIC_COPY[props.lang][props.variant.topic].question} persona={personaLine(props.lang, props.variant.persona)} len={60} />
    </Sequence>
    <Sequence from={130} durationInFrames={300} name="race"><RaceScene {...props} len={300} /></Sequence>
    <Sequence from={430} durationInFrames={95} name="verdict"><VerdictScene {...props} len={95} /></Sequence>
    <Sequence from={525} durationInFrames={75} name="outro"><OutroScene lang={props.lang} match={false} /></Sequence>
  </AbsoluteFill>
);
```

- [ ] **Step 2: Root 등록** — `video/src/Root.tsx`에 import와 Composition 추가

```tsx
import { PromoRace } from "./compositions/PromoRace";
// ...
      <Composition id="PromoRace" component={PromoRace} defaultProps={previewProps("race")}
        width={1080} height={1920} fps={PROMO_FPS} durationInFrames={FORMAT_FRAMES.race} />
```

- [ ] **Step 3: 타입체크 + 스틸 확인**

```bash
cd video && pnpm typecheck && for f in 40 100 260 400 470 560; do
  pnpm exec remotion still src/index.ts PromoRace out/check/race-$f.png --frame=$f --scale=0.5 --log=error; done; cd ..
```
Expected: 에러 없음. 스틸: 훅(질문+펀치) → 질문 → 점수판 숫자가 공개된 달만큼 올라가고 카드 색이 A/B/균형으로 갈림 → 최고 달 + 엔진 헤드라인 + "너라면 A야 B야?" → CTA. 점수판 최종값이 미리보기 스냅샷 `timeline`의 A·B 개수와 같은지 대조한다.

- [ ] **Step 4: 커밋**

```bash
git add video/src/compositions/PromoRace.tsx video/src/Root.tsx
git commit -m "feat: A vs B 레이스 홍보 영상 포맷 추가"
```

---

### Task 7: ③ 궁합 매치 (KO)

**Files:**
- Create: `video/src/compositions/PromoMatch.tsx`
- Modify: `video/src/Root.tsx`

**Interfaces:**
- Consumes: Task 5 공용 장면, `UI_COPY.match`, `hookLines`, `personaLine` (Task 2), `PromoProps`
- Produces: `PromoMatch: React.FC<PromoProps>` (ID `PromoMatch`, 600 frames). `snapshot.match`/`snapshot.guest`가 null이면 렌더 대신 오류 문구를 그린다 (러너의 검증이 먼저 막으므로 방어용).

- [ ] **Step 1: 컴포지션 작성** — `video/src/compositions/PromoMatch.tsx`

```tsx
// PromoMatch.tsx — format ③ (Korean only): two fictional birthdays through the real /match calculator.
// Scores, elements, signs and 천간합/지지충 come from match-calculator.calculateCompatibility.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ensurePretendard } from "../load-fonts";
import { C, Starfield, textBase, useEnter, useExit } from "../components/PromoKit";
import { HookScene, OutroScene, SampleNote } from "../components/PromoScenes";
import { UI_COPY, hookLines } from "../promo/copy.ts";
import type { Persona, PromoLang, PromoProps } from "../promo/types.ts";

void ensurePretendard();

type Match = NonNullable<PromoProps["snapshot"]["match"]>;

const BirthCard: React.FC<{ persona: Persona; dayMaster: string; element: string; sign: string; side: -1 | 1 }> = ({ persona, dayMaster, element, sign, side }) => {
  const enter = useEnter(side === -1 ? 0 : 8, 12);
  return (
    <div style={{ width: 430, padding: "40px 24px", borderRadius: 32, background: C.card, border: `3px solid ${side === -1 ? C.gold : C.indigo}`, opacity: enter, transform: `translateX(${side * (1 - enter) * 500}px)` }}>
      <div style={{ ...textBase, fontSize: 34, color: C.dim }}>{persona.birthDate.replaceAll("-", ". ")}</div>
      <div style={{ ...textBase, fontSize: 64, fontWeight: 900, marginTop: 12 }}>{dayMaster} · {element}</div>
      <div style={{ ...textBase, fontSize: 32, color: C.dim, marginTop: 12 }}>{sign}</div>
    </div>
  );
};

const ScoreBar: React.FC<{ label: string; value: number; delay: number }> = ({ label, value, delay }) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [delay, delay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 30 }}>
      <div style={{ ...textBase, width: 180, textAlign: "right", fontSize: 38, fontWeight: 700 }}>{label}</div>
      <div style={{ width: 560, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${value * grow}%`, height: "100%", borderRadius: 22, background: C.gold }} />
      </div>
      <div style={{ ...textBase, width: 100, fontSize: 44, fontWeight: 900, color: C.goldHi, opacity: grow }}>{Math.round(value * grow)}</div>
    </div>
  );
};

const Badge: React.FC<{ label: string; on: boolean; lang: PromoLang; delay: number }> = ({ label, on, lang, delay }) => {
  const enter = useEnter(delay, 12);
  const ui = UI_COPY[lang].match;
  return (
    <div style={{ ...textBase, fontSize: 38, fontWeight: 800, padding: "18px 36px", borderRadius: 999, border: `3px solid ${on ? C.emerald : C.border}`, color: on ? C.emerald : C.dim, opacity: enter }}>
      {label} {on ? ui.yes : ui.no}
    </div>
  );
};

const MatchScene: React.FC<{ lang: PromoLang; match: Match; host: Persona; guest: Persona; len: number }> = ({ lang, match, host, guest, len }) => {
  const ui = UI_COPY[lang].match;
  const overall = useEnter(200, 11);
  return (
    <AbsoluteFill style={{ opacity: useExit(len) }}>
      <div style={{ position: "absolute", top: 110, width: "100%", ...textBase, fontSize: 40, fontWeight: 800, color: C.gold }}>{ui.title}</div>
      <SampleNote lang={lang} top={170} />
      <div style={{ position: "absolute", top: 260, width: "100%", display: "flex", justifyContent: "center", gap: 40 }}>
        <BirthCard persona={host} dayMaster={match.hostDayMaster} element={match.hostElement} sign={match.hostSign} side={-1} />
        <BirthCard persona={guest} dayMaster={match.guestDayMaster} element={match.guestElement} sign={match.guestSign} side={1} />
      </div>
      <div style={{ position: "absolute", top: 640, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ScoreBar label={ui.saju} value={match.saju} delay={60} />
        <ScoreBar label={ui.astro} value={match.astro} delay={100} />
        <ScoreBar label={ui.num} value={match.num} delay={140} />
      </div>
      <div style={{ position: "absolute", top: 1010, width: "100%", opacity: overall, transform: `scale(${0.6 + overall * 0.4})` }}>
        <div style={{ ...textBase, fontSize: 40, color: C.dim }}>{ui.overall}</div>
        <div style={{ ...textBase, fontSize: 160, fontWeight: 900, color: C.goldHi }}>{match.overall}</div>
      </div>
      <div style={{ position: "absolute", top: 1330, width: "100%", display: "flex", justifyContent: "center", gap: 30 }}>
        <Badge label={ui.combine} on={match.tianganHe} lang={lang} delay={250} />
        <Badge label={ui.clash} on={match.dizhiChong} lang={lang} delay={262} />
      </div>
      <div style={{ position: "absolute", top: 1520, width: "100%", ...textBase, fontSize: 56, fontWeight: 900, opacity: useEnter(285, 12) }}>{ui.ask}</div>
    </AbsoluteFill>
  );
};

export const PromoMatch: React.FC<PromoProps> = ({ lang, variant, snapshot }) => {
  const { match, guest } = snapshot;
  if (!match || !guest) {
    return <AbsoluteFill style={{ backgroundColor: C.bg, justifyContent: "center", ...textBase, fontSize: 40 }}>match snapshot missing</AbsoluteFill>;
  }
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Starfield />
      <Sequence from={0} durationInFrames={70} name="hook"><HookScene lines={hookLines(variant)} len={70} /></Sequence>
      <Sequence from={70} durationInFrames={360} name="match"><MatchScene lang={lang} match={match} host={snapshot.persona} guest={guest} len={360} /></Sequence>
      <Sequence from={430} durationInFrames={170} name="outro"><OutroScene lang={lang} match /></Sequence>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Root 등록**

```tsx
import { PromoMatch } from "./compositions/PromoMatch";
// ...
      <Composition id="PromoMatch" component={PromoMatch} defaultProps={previewProps("match")}
        width={1080} height={1920} fps={PROMO_FPS} durationInFrames={FORMAT_FRAMES.match} />
```

- [ ] **Step 3: 타입체크 + 스틸 확인**

```bash
cd video && pnpm typecheck && for f in 40 110 230 300 380 520; do
  pnpm exec remotion still src/index.ts PromoMatch out/check/match-$f.png --frame=$f --scale=0.5 --log=error; done; cd ..
```
Expected: 에러 없음. 생일 카드 2장 → 사주/점성/수비학 막대가 미리보기 스냅샷 `match` 값까지 차오름 → 종합 점수 → 천간합/지지충 배지 → "이거 너랑 나 돌려볼까?" → CTA("둘이 같이 돌려보기", 가격 줄 없음). 숫자가 `promo-preview.json`의 `match`와 같은지 대조.

- [ ] **Step 4: 커밋**

```bash
git add video/src/compositions/PromoMatch.tsx video/src/Root.tsx
git commit -m "feat: 궁합 매치 홍보 영상 포맷 추가"
```

---

### Task 8: ④ 7일 실험

**Files:**
- Create: `video/src/compositions/PromoExperiment.tsx`
- Modify: `video/src/Root.tsx`

**Interfaces:**
- Consumes: Task 5 공용 장면, `TOPIC_COPY`, `UI_COPY.experiment`, `hookLines`, `personaLine`, `PromoProps`
- Produces: `PromoExperiment: React.FC<PromoProps>` (ID `PromoExperiment`, 600 frames)

- [ ] **Step 1: 컴포지션 작성** — `video/src/compositions/PromoExperiment.tsx`

```tsx
// PromoExperiment.tsx — format ④: a 7-day experiment checklist (20s), built to be saved.
// Only the "when" window and strongest day are engine values; the steps are labelled as a sample screen.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ensurePretendard } from "../load-fonts";
import { C, Starfield, textBase, useEnter, useExit } from "../components/PromoKit";
import { HookScene, OutroScene, QuestionScene, SampleNote } from "../components/PromoScenes";
import { TOPIC_COPY, UI_COPY, hookLines, personaLine } from "../promo/copy.ts";
import type { PromoProps } from "../promo/types.ts";

void ensurePretendard();

const CHECK_START = 30;
const CHECK_STEP = 55;

const CheckItem: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const enter = useEnter(index * 8, 13);
  const check = useEnter(CHECK_START + index * CHECK_STEP, 10);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 24, padding: "26px 30px", borderRadius: 24, background: C.card, border: `2px solid ${check > 0.5 ? C.emerald : C.border}`, opacity: enter }}>
      <div style={{ width: 54, height: 54, borderRadius: 14, border: `4px solid ${C.emerald}`, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 26, height: 14, borderLeft: `6px solid ${C.emerald}`, borderBottom: `6px solid ${C.emerald}`, transform: `rotate(-45deg) scale(${check})`, marginTop: -6 }} />
      </div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 38, fontWeight: 700, opacity: 0.6 + check * 0.4 }}>{text}</div>
    </div>
  );
};

const StopBanner: React.FC<{ title: string; rule: string; ifThen: readonly [string, string] }> = ({ title, rule, ifThen }) => {
  const enter = useEnter(CHECK_START + CHECK_STEP * 2 - 15, 11);
  return (
    <div style={{ marginTop: 34, padding: "28px 32px", borderRadius: 24, border: `4px solid ${C.rose}`, background: "rgba(244,63,94,0.12)", opacity: enter, transform: `translateX(${(1 - enter) * 600}px)` }}>
      <div style={{ ...textBase, textAlign: "left", fontSize: 38, fontWeight: 900, color: "#fda4af" }}>{title}: {rule}</div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 32, color: C.dim, marginTop: 12, whiteSpace: "pre-line" }}>{ifThen.join("\n")}</div>
    </div>
  );
};

const ChecklistScene: React.FC<PromoProps & { len: number }> = ({ lang, variant, snapshot, len }) => {
  const ui = UI_COPY[lang].experiment;
  const topic = TOPIC_COPY[lang][variant.topic];
  const best = snapshot.heatmap.bestDay;
  return (
    <AbsoluteFill style={{ padding: "120px 70px", opacity: useExit(len) }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ ...textBase, fontSize: 28, fontWeight: 700, color: C.bg, background: C.goldHi, padding: "8px 20px", borderRadius: 999 }}>{ui.sample}</span>
        <span style={{ ...textBase, fontSize: 30, color: C.gold }}>{ui.when}: {snapshot.scenario.peakLabel}</span>
      </div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 30, color: C.dim, marginTop: 14 }}>{ui.bestDay}: {best ? `${best.date} · ${best.score}` : "-"}</div>
      <div style={{ ...textBase, textAlign: "left", fontSize: 60, fontWeight: 900, marginTop: 30 }}>{topic.question}</div>
      <CheckItem text={topic.experiment[0]} index={0} />
      <CheckItem text={topic.experiment[1]} index={1} />
      <StopBanner title={ui.stopTitle} rule={topic.stopRule} ifThen={topic.ifThen} />
      <CheckItem text={topic.experiment[2]} index={2} />
      <CheckItem text={topic.experiment[3]} index={3} />
      <SampleNote lang={lang} top={1780} />
    </AbsoluteFill>
  );
};

const SaveScene: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const pop = useEnter(0, 10);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, opacity: useExit(len) }}>
      <div style={{ ...textBase, fontSize: 84, fontWeight: 900, color: C.goldHi, transform: `scale(${0.6 + pop * 0.4})` }}>{text}</div>
    </AbsoluteFill>
  );
};

export const PromoExperiment: React.FC<PromoProps> = (props) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Starfield />
    <Sequence from={0} durationInFrames={70} name="hook"><HookScene lines={hookLines(props.variant)} len={70} /></Sequence>
    <Sequence from={70} durationInFrames={50} name="question">
      <QuestionScene label={UI_COPY[props.lang].questionLabel} question={TOPIC_COPY[props.lang][props.variant.topic].question} persona={personaLine(props.lang, props.variant.persona)} len={50} />
    </Sequence>
    <Sequence from={120} durationInFrames={300} name="checklist"><ChecklistScene {...props} len={300} /></Sequence>
    <Sequence from={420} durationInFrames={90} name="save"><SaveScene text={UI_COPY[props.lang].experiment.save} len={90} /></Sequence>
    <Sequence from={510} durationInFrames={90} name="outro"><OutroScene lang={props.lang} match={false} /></Sequence>
  </AbsoluteFill>
);
```

- [ ] **Step 2: Root 등록**

```tsx
import { PromoExperiment } from "./compositions/PromoExperiment";
// ...
      <Composition id="PromoExperiment" component={PromoExperiment} defaultProps={previewProps("experiment")}
        width={1080} height={1920} fps={PROMO_FPS} durationInFrames={FORMAT_FRAMES.experiment} />
```

- [ ] **Step 3: 타입체크 + 스틸 확인**

```bash
cd video && pnpm typecheck && for f in 40 100 170 260 330 400 460 560; do
  pnpm exec remotion still src/index.ts PromoExperiment out/check/exp-$f.png --frame=$f --scale=0.5 --log=error; done; cd ..
```
Expected: 에러 없음. '예시 화면' 배지 + 엔진 '언제'·가장 강한 날 → Day1·3 체크 → 빨간 접을 신호 배너 → Day5·7 체크 → "저장해두고 이번 주에 해봐" → CTA. 화면 아래 1920px 안에 체크리스트가 모두 들어가는지 확인 (넘치면 `CheckItem` 폰트/패딩을 줄인다).

- [ ] **Step 4: 커밋**

```bash
git add video/src/compositions/PromoExperiment.tsx video/src/Root.tsx
git commit -m "feat: 7일 실험 홍보 영상 포맷 추가"
```

---

### Task 9: 앱 등록 경로 `POST /api/cron/promo-posts`

**Files:**
- Modify: `docs/api-spec.md` (Cron API 표, 먼저)
- Create: `src/lib/promo/promo-post-service.ts`
- Create: `src/app/api/cron/promo-posts/route.ts`
- Test: `src/app/api/cron/promo-posts/promo-posts.test.ts`

**Interfaces:**
- Consumes: `verifyCronSecret` (`src/lib/cron-auth.ts`), `isVideoMediaUrl` (`src/lib/media-url.ts`), `prisma` (`src/lib/prisma.ts`)
- Produces (러너가 의존):
  - 요청 `POST /api/cron/promo-posts`, 헤더 `Authorization: Bearer <CRON_SECRET>`, 본문 `{ date: "YYYY-MM-DD", items: PromoPostItem[] }`
  - `interface PromoPostItem { brandSlug: string; videoUrl: string; content: string; commentTemplate: string; landingPath: string; format: string; topic: string }`
  - 응답 200 `{ results: Array<{ brandSlug: string; postId: string } | { brandSlug: string; skipped: "brand_not_found" | "already_queued" }> }`, 401, 400 `{ error }`

- [ ] **Step 1: API 계약 문서화** — `docs/api-spec.md` Cron API 표(`/api/cron/trends` 행 다음)에 추가

```markdown
| `POST` | `/api/cron/promo-posts` | 홍보 영상 로테이션 등록 (CI `render-promo-job.mjs` 전용, `Authorization: Bearer CRON_SECRET`). 본문 `{ date: "YYYY-MM-DD", items: [{ brandSlug, videoUrl, content, commentTemplate, landingPath, format, topic }] }`. 검증: `videoUrl` https + `.mp4`, `content` 1–480자, `commentTemplate`에 `{{link}}`, `landingPath`는 `/start`로 시작, items 1–4개 — 위반 시 400. item마다 `formulaId = video:promo:<date>`로 브랜드당 1개만 만들고(이미 있으면 `skipped: "already_queued"`, 브랜드 없으면 `skipped: "brand_not_found"`), `NEEDS_REVIEW` Post(`imageUrls=[videoUrl]`, `topic="<format>:<topic>"`) 생성 후 `linkUrl = https://cosmicpath.app<landingPath>` + `utm_source=threads&utm_campaign=promo-rotation&utm_content=<postId>`, `firstComment`는 `{{link}}` 치환. 응답 `{ results }` |
```

- [ ] **Step 2: 실패하는 테스트 작성** — `src/app/api/cron/promo-posts/promo-posts.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  brand: { findUnique: vi.fn() },
  post: {
    findFirst: vi.fn(),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "p1", ...data })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { POST } from "./route";

const item = (overrides: Record<string, unknown> = {}) => ({
  brandSlug: "cosmicpath",
  videoUrl: "https://blob.example/videos/cosmicpath/promo.mp4",
  content: "본문",
  commentTemplate: "무료 진단부터 돌려봐 → {{link}}",
  landingPath: "/start",
  format: "race",
  topic: "career",
  ...overrides,
});
const request = (body: unknown, auth = "Bearer secret") =>
  new NextRequest("http://localhost/api/cron/promo-posts", { method: "POST", body: JSON.stringify(body), headers: { authorization: auth } });

describe("POST /api/cron/promo-posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "secret");
    db.brand.findUnique.mockResolvedValue({ id: "b1", slug: "cosmicpath" });
    db.post.findFirst.mockResolvedValue(null);
  });

  it("rejects a missing or wrong secret", async () => {
    expect((await POST(request({ date: "2026-10-19", items: [item()] }, "Bearer nope"))).status).toBe(401);
  });

  it("rejects malformed bodies", async () => {
    for (const body of [
      { items: [item()] },
      { date: "2026-10-19", items: [] },
      { date: "2026-10-19", items: [item({ videoUrl: "http://blob.example/a.mp4" })] },
      { date: "2026-10-19", items: [item({ videoUrl: "https://blob.example/a.mov" })] },
      { date: "2026-10-19", items: [item({ content: "가".repeat(481) })] },
      { date: "2026-10-19", items: [item({ commentTemplate: "no link" })] },
      { date: "2026-10-19", items: [item({ landingPath: "https://evil.example" })] },
    ]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("creates a NEEDS_REVIEW video post with a UTM first comment", async () => {
    const body = await (await POST(request({ date: "2026-10-19", items: [item({ landingPath: "/start?context=love" })] }))).json();
    expect(body.results).toEqual([{ brandSlug: "cosmicpath", postId: "p1" }]);
    expect(db.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        brandId: "b1", status: "NEEDS_REVIEW", formulaId: "video:promo:2026-10-19", topic: "race:career",
        imageUrls: JSON.stringify(["https://blob.example/videos/cosmicpath/promo.mp4"]),
      }),
    });
    const update = db.post.update.mock.calls[0]?.[0] as { data: { linkUrl: string; firstComment: string; utmContent: string } };
    const link = new URL(update.data.linkUrl);
    expect(link.origin + link.pathname).toBe("https://cosmicpath.app/start");
    expect(Object.fromEntries(link.searchParams)).toEqual({ context: "love", utm_source: "threads", utm_campaign: "promo-rotation", utm_content: "p1" });
    expect(update.data.firstComment).toBe(`무료 진단부터 돌려봐 → ${update.data.linkUrl}`);
    expect(update.data.utmContent).toBe("p1");
  });

  it("skips an already queued brand and a missing brand without failing the others", async () => {
    db.post.findFirst.mockResolvedValueOnce({ id: "old" });
    db.brand.findUnique
      .mockResolvedValueOnce({ id: "b1", slug: "cosmicpath" })
      .mockResolvedValueOnce(null);
    const body = await (await POST(request({ date: "2026-10-19", items: [item(), item({ brandSlug: "ghost" })] }))).json();
    expect(body.results).toEqual([
      { brandSlug: "cosmicpath", skipped: "already_queued" },
      { brandSlug: "ghost", skipped: "brand_not_found" },
    ]);
    expect(db.post.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm vitest run src/app/api/cron/promo-posts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 4: 서비스 구현** — `src/lib/promo/promo-post-service.ts`

```ts
import { prisma } from "@/lib/prisma";
import { isVideoMediaUrl } from "@/lib/media-url";

export interface PromoPostItem {
  brandSlug: string;
  videoUrl: string;
  content: string;
  commentTemplate: string;
  landingPath: string;
  format: string;
  topic: string;
}

export type PromoPostResult =
  | { brandSlug: string; postId: string }
  | { brandSlug: string; skipped: "brand_not_found" | "already_queued" };

const SITE_ORIGIN = "https://cosmicpath.app";
const MAX_CONTENT_CHARS = 480; // longer captions get split into a Threads chain
const ITEM_KEYS = ["brandSlug", "videoUrl", "content", "commentTemplate", "landingPath", "format", "topic"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function parseItem(value: unknown): PromoPostItem | null {
  if (!isRecord(value) || !ITEM_KEYS.every((key) => typeof value[key] === "string")) return null;
  const item: PromoPostItem = {
    brandSlug: String(value.brandSlug), videoUrl: String(value.videoUrl), content: String(value.content),
    commentTemplate: String(value.commentTemplate), landingPath: String(value.landingPath), format: String(value.format), topic: String(value.topic),
  };
  const contentLength = [...item.content].length;
  const valid = item.videoUrl.startsWith("https://") && isVideoMediaUrl(item.videoUrl)
    && contentLength > 0 && contentLength <= MAX_CONTENT_CHARS
    && item.commentTemplate.includes("{{link}}") && item.landingPath.startsWith("/start");
  return valid ? item : null;
}

export function parsePromoPostsBody(body: unknown): { date: string; items: PromoPostItem[] } | { error: string } {
  if (!isRecord(body) || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return { error: "date (YYYY-MM-DD) is required" };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 4) return { error: "items must have 1-4 entries" };
  const items = body.items.map(parseItem);
  if (items.some((item) => item === null)) return { error: "invalid item: https .mp4 videoUrl, 1-480 char content, {{link}} comment and /start landing path required" };
  return { date: body.date, items: items.filter((item): item is PromoPostItem => item !== null) };
}

export function buildPromoLink(landingPath: string, postId: string): string {
  const url = new URL(landingPath, SITE_ORIGIN);
  url.searchParams.set("utm_source", "threads");
  url.searchParams.set("utm_campaign", "promo-rotation");
  url.searchParams.set("utm_content", postId);
  return url.toString();
}

async function queueOne(date: string, item: PromoPostItem): Promise<PromoPostResult> {
  const brand = await prisma.brand.findUnique({ where: { slug: item.brandSlug } });
  if (!brand) return { brandSlug: item.brandSlug, skipped: "brand_not_found" };
  const formulaId = `video:promo:${date}`;
  const existing = await prisma.post.findFirst({ where: { brandId: brand.id, formulaId } });
  if (existing) return { brandSlug: item.brandSlug, skipped: "already_queued" };
  const post = await prisma.post.create({
    data: {
      brandId: brand.id, content: item.content, imageUrls: JSON.stringify([item.videoUrl]), scheduledAt: new Date(),
      status: "NEEDS_REVIEW", formulaId, topic: `${item.format}:${item.topic}`, qualityReasons: JSON.stringify(["영상 포스트: 승인 후 발행"]),
    },
  });
  const linkUrl = buildPromoLink(item.landingPath, post.id);
  await prisma.post.update({
    where: { id: post.id },
    data: { linkUrl, utmContent: post.id, firstComment: item.commentTemplate.replace("{{link}}", linkUrl) },
  });
  return { brandSlug: item.brandSlug, postId: post.id };
}

// Sequential on purpose: at most 2 items per run, and it keeps the per-brand duplicate check simple.
export async function queuePromoPosts(date: string, items: PromoPostItem[]): Promise<PromoPostResult[]> {
  const results: PromoPostResult[] = [];
  for (const item of items) results.push(await queueOne(date, item));
  return results;
}
```

- [ ] **Step 5: 라우트 구현** — `src/app/api/cron/promo-posts/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { parsePromoPostsBody, queuePromoPosts } from "@/lib/promo/promo-post-service";

/**
 * POST /api/cron/promo-posts  { date, items: PromoPostItem[] }
 * Called by the CI promo renderer after uploading videos. Each item becomes one NEEDS_REVIEW
 * Threads video post per brand and date; the operator approves it before it is published.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = parsePromoPostsBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  return NextResponse.json({ results: await queuePromoPosts(parsed.date, parsed.items) });
}
```

- [ ] **Step 6: 통과 확인**

Run: `pnpm vitest run src/app/api/cron/promo-posts && pnpm typecheck && pnpm lint`
Expected: 4개 테스트 PASS, typecheck·lint 에러/경고 없음

- [ ] **Step 7: 커밋**

```bash
git add docs/api-spec.md src/lib/promo/promo-post-service.ts src/app/api/cron/promo-posts/route.ts src/app/api/cron/promo-posts/promo-posts.test.ts
git commit -m "feat: 홍보 영상 검토 대기 등록 cron 경로 추가"
```

---

### Task 10: 러너 `render-promo-job.mjs`

**Files:**
- Create: `video/scripts/render-promo-job.mjs`
- Modify: `video/package.json` (scripts에 `"render-promo": "node scripts/render-promo-job.mjs"`)

**Interfaces:**
- Consumes: `pickPromoVariant` (Task 1), `TOPIC_COPY`, `buildCaption`, `buildCommentTemplate`, `landingPathFor` (Task 2), `parsePromoSnapshot`, `validateSnapshot` (Task 3), `COMPOSITION_ID` (Task 1), 추출 CLI (Task 4), `POST /api/cron/promo-posts` (Task 9)
- Produces: CLI `node video/scripts/render-promo-job.mjs [--date YYYY-MM-DD] [--format F] [--topic T] [--lang ko|en] [--dry-run]`. 종료 코드: 모든 lang 성공 0, 하나라도 실패 1. 환경변수: `COSMICPATH_DIR`(기본 `../../cosmicpath`), dry-run이 아니면 `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` 필수. 시스템 `ffmpeg` 필요.

- [ ] **Step 1: 러너 작성** — `video/scripts/render-promo-job.mjs`

```js
// render-promo-job.mjs — twice-weekly promo rotation (render-promo.yml):
// pick variant → cosmicpath engines → validate → Remotion render → normalize → Blob → queue NEEDS_REVIEW posts.
// Like render-job.mjs, the runner never touches the database; /api/cron/promo-posts owns all writes.
// Imports the pure TS modules in src/promo directly (Node 22.18+ type stripping).
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { put } from "@vercel/blob";
import { pickPromoVariant } from "../src/promo/rotation.ts";
import { TOPIC_COPY, buildCaption, buildCommentTemplate, landingPathFor } from "../src/promo/copy.ts";
import { parsePromoSnapshot, validateSnapshot } from "../src/promo/snapshot.ts";
import { COMPOSITION_ID } from "../src/promo/types.ts";

const run = promisify(execFile);
const videoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_BY_LANG = { ko: "cosmicpath", en: "cosmicpath-global" };
const EXEC = { maxBuffer: 32 * 1024 * 1024, timeout: 10 * 60 * 1000 };

const { values } = parseArgs({
  options: {
    date: { type: "string", default: "" },
    format: { type: "string", default: "" },
    topic: { type: "string", default: "" },
    lang: { type: "string", default: "" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"];
const date = values.date || new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // KST today
const overrides = { ...(values.format && { format: values.format }), ...(values.topic && { topic: values.topic }) };
const langs = values.lang ? [values.lang] : ["ko", "en"];
const cosmicpathDir = process.env.COSMICPATH_DIR || path.resolve(videoDir, "../../cosmicpath");

if (!dryRun) {
  for (const name of ["APP_URL", "CRON_SECRET", "BLOB_READ_WRITE_TOKEN"]) {
    if (!process.env[name]) throw new Error(`${name} is not set`);
  }
}

async function extractSnapshot(variant, workDir) {
  const topic = TOPIC_COPY[variant.lang][variant.topic];
  const inputPath = path.join(workDir, `${variant.lang}-input.json`);
  const outputPath = path.join(workDir, `${variant.lang}-snapshot.json`);
  await writeFile(inputPath, JSON.stringify({ variant, scenarioA: topic.forkA, scenarioB: topic.forkB, question: topic.question }));
  await run(process.execPath, ["--no-warnings", path.join(videoDir, "scripts/extract-report-data.ts"), "--input", inputPath, "--out", outputPath],
    { ...EXEC, cwd: cosmicpathDir, env: { ...process.env, TZ: "UTC" } }); // production engines run on UTC
  const snapshot = parsePromoSnapshot(JSON.parse(await readFile(outputPath, "utf8")));
  const problems = validateSnapshot(snapshot, variant.format);
  if (problems.length > 0) throw new Error(`snapshot rejected: ${problems.join("; ")}`);
  return snapshot;
}

async function renderVideo(variant, snapshot, workDir) {
  const propsPath = path.join(workDir, `${variant.lang}-props.json`);
  const rawPath = path.join(workDir, `${variant.lang}-raw.mp4`);
  const finalPath = path.join(dryRun ? path.join(videoDir, "out") : workDir, `promo-${date}-${variant.lang}-${variant.format}.mp4`);
  await writeFile(propsPath, JSON.stringify({ lang: variant.lang, variant, snapshot }));
  await run(path.join(videoDir, "node_modules/.bin/remotion"),
    ["render", "src/index.ts", COMPOSITION_ID[variant.format], rawPath, `--props=${propsPath}`, "--log=error"], { ...EXEC, cwd: videoDir });
  // Remotion's JPEG frames come out as full-range yuvj420p; Threads wants plain yuv420p + AAC 48kHz.
  await run("ffmpeg", ["-loglevel", "error", "-y", "-i", rawPath, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-color_range", "tv", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", finalPath], EXEC);
  return finalPath;
}

async function uploadVideo(variant, file) {
  const blob = await put(`videos/${BRAND_BY_LANG[variant.lang]}/promo-${date}-${variant.format}.mp4`, await readFile(file), {
    access: "public", contentType: "video/mp4", addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

async function queuePosts(items) {
  const response = await fetch(`${process.env.APP_URL.replace(/\/$/, "")}/api/cron/promo-posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ date, items }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`/api/cron/promo-posts → ${response.status} ${JSON.stringify(body)}`);
  return body.results;
}

async function produce(lang, workDir) {
  const variant = pickPromoVariant(date, lang, overrides);
  console.log(`[${lang}] slot ${variant.slot} · ${variant.format} · ${variant.topic} · hook ${variant.hookIndex} · ${variant.persona.birthDate}`);
  const snapshot = await extractSnapshot(variant, workDir);
  const file = await renderVideo(variant, snapshot, workDir);
  if (dryRun) {
    console.log(`[${lang}] dry run → ${file}\n${buildCaption(variant)}`);
    return null;
  }
  return {
    brandSlug: BRAND_BY_LANG[lang], videoUrl: await uploadVideo(variant, file), content: buildCaption(variant),
    commentTemplate: buildCommentTemplate(lang, variant.format), landingPath: landingPathFor(variant.format),
    format: variant.format, topic: variant.topic,
  };
}

const workDir = await mkdtemp(path.join(tmpdir(), "promo-"));
const items = [];
let failed = false;
for (const lang of langs) {
  try {
    const item = await produce(lang, workDir);
    if (item) items.push(item);
  } catch (error) {
    failed = true;
    console.error(`[${lang}] ❌ ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (items.length > 0) {
  try {
    console.log(JSON.stringify(await queuePosts(items)));
  } catch (error) {
    failed = true;
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: package.json 스크립트 추가** — `video/package.json`의 `scripts`에

```json
    "render-promo": "node scripts/render-promo-job.mjs",
```

- [ ] **Step 3: 로컬 리허설 — 포맷 4종 KO + EN 3종**

```bash
cd video
for format in reportTour race match experiment; do node scripts/render-promo-job.mjs --dry-run --lang ko --date 2026-10-19 --format $format; done
for format in reportTour race experiment; do node scripts/render-promo-job.mjs --dry-run --lang en --date 2026-10-19 --format $format; done
for f in out/promo-2026-10-19-*.mp4; do ffprobe -v error -show_entries stream=codec_name,pix_fmt,sample_rate:format=duration -of csv=p=0 "$f"; done
cd ..
```
Expected: 7번 모두 종료 코드 0, 각 실행이 회차 줄과 캡션을 출력. ffprobe: `h264,yuv420p` + `aac,48000`, 길이 45초(reportTour)/20초(나머지). `--format match --topic career` 같은 잘못된 조합은 `match format needs a relation topic`으로 실패해야 한다:
```bash
cd video && node scripts/render-promo-job.mjs --dry-run --lang ko --date 2026-10-19 --format match --topic career; echo "exit $?"; cd ..
```
Expected: `exit 1`과 `relation topic` 메시지.

- [ ] **Step 4: 영상 프레임 확인** — 포맷마다 3장씩 뽑아 직접 본다

```bash
cd video/out && for f in promo-2026-10-19-*.mp4; do for t in 2 10 17; do
  ffmpeg -loglevel error -y -ss $t -i "$f" -frames:v 1 -vf scale=360:-1 "${f%.mp4}-$t.png"; done; done; cd ../..
```
Expected: 7개 영상 모두 글자 겹침·잘림 없음, EN 화면에 한국어 문구 없음(가상 인물 줄 포함), 숫자가 각 영상의 스냅샷과 일치.

- [ ] **Step 5: 커밋**

```bash
git add video/scripts/render-promo-job.mjs video/package.json
git commit -m "feat: 홍보 영상 로테이션 러너 추가"
```

---

### Task 11: 스케줄 워크플로 + 정리

**Files:**
- Create: `.github/workflows/render-promo.yml`
- Delete: `video/scripts/queue-promo-posts.mjs` (러너 + 앱 경로로 대체)
- Modify: `docs/superpowers/specs/2026-10-15-promo-video-rotation-design.md` (구현과 달라진 두 곳 반영)

**Interfaces:**
- Consumes: 러너 CLI (Task 10), GitHub Secrets `COSMICPATH_READ_TOKEN`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, Variables `APP_URL`
- Produces: 월·목 KST 06:30 자동 실행 + 수동 실행(date/format/topic/dry_run)

- [ ] **Step 1: 워크플로 작성** — `.github/workflows/render-promo.yml`

```yaml
name: Render Promo Rotation

on:
  schedule:
    # 월·목 KST 06:30 — 아침에 승인할 홍보 영상(KO/EN) 준비
    - cron: '30 21 * * 0,3'
  workflow_dispatch:
    inputs:
      date:
        description: 'KST 날짜 YYYY-MM-DD (비우면 오늘)'
        required: false
        default: ''
      format:
        description: '포맷 덮어쓰기'
        type: choice
        options: ['', reportTour, race, match, experiment]
        default: ''
      topic:
        description: '주제 덮어쓰기'
        type: choice
        options: ['', contact, career, confession, sideJob, marriage, partnership]
        default: ''
      dry_run:
        description: '렌더만 하고 업로드·등록 안 함'
        type: boolean
        default: false

concurrency:
  group: render-promo
  cancel-in-progress: false

jobs:
  render:
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4

      - name: Checkout cosmicpath engines (read-only)
        uses: actions/checkout@v4
        with:
          repository: KIMYOUNGGWANG/cosmicpath
          token: ${{ secrets.COSMICPATH_READ_TOKEN }}
          path: cosmicpath

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: |
            video/pnpm-lock.yaml
            cosmicpath/pnpm-lock.yaml

      - name: Install CJK fonts and ffmpeg
        run: sudo apt-get update -qq && sudo apt-get install -y -qq fonts-noto-cjk ffmpeg

      - name: Install compositor
        working-directory: video
        run: |
          pnpm install --frozen-lockfile
          pnpm exec remotion browser ensure

      - name: Install cosmicpath engines
        working-directory: cosmicpath
        run: |
          pnpm install --frozen-lockfile --ignore-scripts
          pnpm exec prisma generate

      - name: Render, upload, and queue for review
        working-directory: video
        env:
          APP_URL: ${{ vars.APP_URL || 'https://thread-uploader.vercel.app' }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
          COSMICPATH_DIR: ${{ github.workspace }}/cosmicpath
          PROMO_DATE: ${{ inputs.date }}
          PROMO_FORMAT: ${{ inputs.format }}
          PROMO_TOPIC: ${{ inputs.topic }}
          PROMO_DRY_RUN: ${{ inputs.dry_run }}
        run: |
          args=(--date "$PROMO_DATE" --format "$PROMO_FORMAT" --topic "$PROMO_TOPIC")
          if [ "$PROMO_DRY_RUN" = "true" ]; then args+=(--dry-run); fi
          node scripts/render-promo-job.mjs "${args[@]}"

      - name: Keep dry-run videos
        if: ${{ inputs.dry_run }}
        uses: actions/upload-artifact@v4
        with:
          name: promo-dry-run
          path: video/out/promo-*.mp4
          retention-days: 3
```

> 입력값은 `env:`로 넘기고 셸에서 따옴표로 쓴다 (워크플로 입력을 `run:`에 직접 끼워 넣으면 셸 주입 위험).

- [ ] **Step 2: YAML 문법 확인**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('.github/workflows/render-promo.yml','utf8');if(/\t/.test(t))throw new Error('tab in yaml');console.log('ok', t.split('\n').length)"` 와 `git diff --check`
Expected: `ok <줄 수>`, diff 경고 없음. (`actionlint`가 설치돼 있으면 `actionlint .github/workflows/render-promo.yml`도 실행)

- [ ] **Step 3: 옛 일회성 스크립트 삭제**

```bash
git rm video/scripts/queue-promo-posts.mjs
```

- [ ] **Step 4: 스펙의 달라진 두 곳 반영** — `docs/superpowers/specs/2026-10-15-promo-video-rotation-design.md`

§5 마지막 두 줄을 다음으로 교체:
```markdown
- ①은 기존 `PromoViral`을 `PromoReportTour`(props 기반)로 바꾼 것이다. `PromoViralKo/En` 컴포지션 ID는 없애고, 4개 포맷 모두 `src/data/promo-preview.json`을 Studio 기본 props로 쓴다.
- 컴포지션 props `{ lang, variant, snapshot }`는 Zod 대신 `snapshot.ts`의 타입 가드(`parsePromoProps`)와 `validateSnapshot`으로 검증한다 — 러너와 Studio 미리보기가 같은 검증을 쓰도록.
```
§7 첫 문단의 실행 방법을 다음으로 교체:
```markdown
cosmicpath 루트에서 `TZ=UTC node <thread-uploader>/video/scripts/extract-report-data.ts --input … --out …`로 실행한다. cosmicpath 엔진 일부가 타입을 값처럼 import 해서 Node 타입 제거만으로는 못 읽으므로, cosmicpath의 `scripts/report-test-data/ts-loader.ts`(`registerTypeScriptLoader`)로 불러온다.
```

- [ ] **Step 5: 커밋**

```bash
git add .github/workflows/render-promo.yml docs/superpowers/specs/2026-10-15-promo-video-rotation-design.md
git commit -m "ci: 홍보 영상 월·목 로테이션 워크플로 추가"
```

---

### Task 12: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 검사**

```bash
pnpm typecheck && pnpm lint && pnpm test && (cd video && pnpm typecheck)
```
Expected: 전부 통과. `pnpm test`에 `video/src/promo/*` 3개 파일과 `promo-posts.test.ts`가 포함돼 있는지 출력에서 확인.

- [ ] **Step 2: 기존 매일 설명 영상 회귀 확인**

```bash
cd video && pnpm exec remotion still src/index.ts TikTokExplainer out/check/tiktok.png --frame=30 --scale=0.5 --log=error && cd ..
```
Expected: 에러 없이 렌더 (Root 변경이 기존 컴포지션을 깨지 않음).

- [ ] **Step 3: 사용자에게 1회 설정 요청 + 첫 수동 실행 안내**

사용자에게 전달:
1. GitHub Secrets `COSMICPATH_READ_TOKEN` (cosmicpath 전용 fine-grained, Contents: Read)
2. GitHub Secrets `BLOB_READ_WRITE_TOKEN`을 public 스토어 토큰으로 교체
3. 브랜치 푸시·병합 후 Actions → "Render Promo Rotation" → `dry_run: true`로 수동 실행 → 아티팩트 영상 확인 → 이상 없으면 `dry_run: false`로 한 번 실행해 대시보드에 KO/EN 검토 대기 게시물이 생기는지 확인

(push·병합은 사용자 승인 후에만.)
