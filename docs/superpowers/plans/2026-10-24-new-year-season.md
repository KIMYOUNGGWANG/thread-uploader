# 2027 신년 시즌 콘텐츠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 11/24~2/6 동안 cosmicpath·cosmicpath-global의 Threads 글 일부와 매일 영상을 신년 콘텐츠로 바꿔 `/2027/sample`로 보내고, 글 단위 결제를 집계한다.

**Architecture:** 시즌 판정·유형 배정·2027 사주 데이터·사실 검사는 `src/lib/new-year/`의 순수 함수로 둔다. `generatePostsForBrand`는 각 칸의 예정 발행 시각을 생성 전에 계산해 신년 칸이면 모드 선택을 건너뛰고 신년 모드·자료(brief)·고정 첫 댓글 링크를 쓴다. 신년 모드는 `WINNER_REPLAY_MODE`처럼 순환(`VIRAL_INTENT_MODES`) 밖에 두고, 학습(Thompson)에서는 뺀다.

**Tech Stack:** TypeScript, Next.js App Router, Prisma, vitest. 명령은 이 저장소 관행대로 `npx vitest run`, `npx tsc --noEmit`, `npx eslint`.

**Spec:** `docs/superpowers/specs/2026-10-24-new-year-season-design.md`

## Global Constraints

- 시즌 기간은 KST 날짜, **예정 발행 시각** 기준. KO 11/24~12/14 20%(5칸 중 1), 12/15~1/31 40%(5칸 중 2), 2/1~2/6 20%. EN 12/15~2/6 25%(4칸 중 1). 2/7 00:00 KST부터 0%.
- 대상 브랜드는 slug `cosmicpath`(ko), `cosmicpath-global`(en) 둘뿐. 다른 브랜드는 절대 신년 칸이 생기지 않는다.
- 긴급 정지: 환경변수 `NEW_YEAR_SEASON_DISABLED=1`이면 모든 신년 칸이 0.
- 유형 ID: `ny_ranking`, `ny_ipchun`, `ny_monthly`, `ny_pick`. 배정 비율 ① 35% · ② 30% · ③ 20% · ④ 15%, 시즌 중 고정.
- 링크 목적지: KO `https://www.cosmicpath.app/2027/sample`, EN `https://www.cosmicpath.app/en/2027/sample`. 파라미터 `utm_campaign=new_year_2027`, `source=threads`, `pid=<Post id>`, `fid=<유형 ID>`(+ `buildTrackedUrl` 기본 `ref`, `utm_source=threads`, `utm_medium=social`).
- 신년 글 첫 댓글은 LLM 문장을 버리고 고정 문구 + 단축 링크(`/r/{id}`)만: KO `내 2027 캘린더, 샘플 먼저 보기:\n{link}` / EN `See a sample 2027 calendar first:\n{link}`.
- 사주 값(십신·월주·절입일·입춘)은 `src/lib/new-year/new-year-2027-data.ts`에서만 나온다. LLM이 순위·달·간지를 정하지 않는다.
- 첫 줄 사주 전제 금지(`findFirstLineChartGate`), 운세 과장·할인·카운트다운·지어낸 숫자 금지 — 기존 게이트를 신년 글에도 전부 적용.
- cosmicpath 저장소는 수정하지 않는다(읽기·엔진 대조만).
- DB 스키마 변경 없음.

## Review Focus

1. **시즌 경계의 KST 변환:** 11/23 23:30 KST(=11/23 14:30 UTC)는 시즌 밖, 11/24 00:10 KST(=11/23 15:10 UTC)는 시즌 안, 2/6 23:59 KST 안, 2/7 00:00 KST 밖. UTC 날짜로 자르면 9시간 어긋난다 → Task 1 테스트.
2. **다른 브랜드:** 이 앱에는 cosmicpath 외 브랜드도 있다. 신년 칸은 두 slug에서만 → Task 1·Task 4 테스트.
3. **LLM이 다른 일간·간지를 섞음:** 분류 글의 한 줄에 다른 그룹 일간이 섞이거나, "5월 병오" 같은 틀린 월주가 나오면 게이트에서 떨어져야 한다 → Task 3 테스트.
4. **번호 선택지 상한이 찬 날의 `ny_pick`:** 상한이 차 있으면 다른 신년 유형으로 바뀌어야 한다(게이트만 믿으면 재시도만 태우고 버려진다) → Task 1 테스트.
5. **신년 글이 학습 중앙값을 끌어올림:** 신년 글 조회수가 Thompson 보상 기준(중앙값)에 섞이면 평소 모드가 손해 → Task 5 테스트.

---

### Task 1: 시즌 판정과 유형 배정 (순수 함수)

**Files:**
- Create: `src/lib/new-year/new-year-season.ts`
- Test: `src/lib/new-year/new-year-season.test.ts`

**Interfaces:**
- Produces:
  - `export type NewYearModeId = "ny_ranking" | "ny_ipchun" | "ny_monthly" | "ny_pick"`
  - `export type NewYearLang = "ko" | "en"`
  - `export const NEW_YEAR_BRANDS: Record<string, NewYearLang>` = `{ cosmicpath: "ko", "cosmicpath-global": "en" }`
  - `export function isNewYearModeId(id: string | null | undefined): id is NewYearModeId`
  - `export function newYearSlotMode(input: { brandSlug: string; plannedAt: Date; slotIndex: number; choicesCapped: boolean; env?: NodeJS.ProcessEnv }): NewYearModeId | null`

- [ ] **Step 1: Write the failing tests**

```ts
const kst = (iso: string) => new Date(`${iso}+09:00`);
const slot = (brandSlug: string, at: string, slotIndex: number, choicesCapped = false) =>
  newYearSlotMode({ brandSlug, plannedAt: kst(at), slotIndex, choicesCapped, env: {} });

it("KST 경계: 11/23 23:30은 밖, 11/24 00:10은 안", () => {
  expect(slot("cosmicpath", "2026-11-23T23:30:00", 0)).toBeNull();
  expect(slot("cosmicpath", "2026-11-24T00:10:00", 0)).not.toBeNull();
});
it("2/6 23:59 KST는 안, 2/7 00:00 KST는 밖", () => {
  expect(slot("cosmicpath", "2027-02-06T23:59:00", 0)).not.toBeNull();
  expect(slot("cosmicpath", "2027-02-07T00:00:00", 0)).toBeNull();
});
it("KO 비율: 초반 5칸 중 1, 정점 5칸 중 2, 끝 5칸 중 1", () => {
  const count = (at: string) => [0, 1, 2, 3, 4].filter((i) => slot("cosmicpath", at, i)).length;
  expect(count("2026-12-01T12:00:00")).toBe(1);
  expect(count("2027-01-10T12:00:00")).toBe(2);
  expect(count("2027-02-03T12:00:00")).toBe(1);
});
it("EN은 12/15부터 4칸 중 1", () => {
  const count = (at: string) => [0, 1, 2, 3].filter((i) => slot("cosmicpath-global", at, i)).length;
  expect(count("2026-12-01T12:00:00")).toBe(0);
  expect(count("2027-01-10T12:00:00")).toBe(1);
});
it("다른 브랜드는 시즌 중에도 null", () => {
  expect([0, 1, 2, 3, 4].map((i) => slot("other-brand", "2027-01-10T12:00:00", i))).toEqual([null, null, null, null, null]);
});
it("NEW_YEAR_SEASON_DISABLED=1이면 null", () => {
  expect(newYearSlotMode({ brandSlug: "cosmicpath", plannedAt: kst("2027-01-10T12:00:00"), slotIndex: 0, choicesCapped: false, env: { NEW_YEAR_SEASON_DISABLED: "1" } })).toBeNull();
});
it("정점 구간 신년 칸 100개의 유형 비율이 35/30/20/15", () => {
  const modes = Array.from({ length: 250 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i)).filter(Boolean);
  const share = (id: string) => modes.filter((m) => m === id).length / modes.length;
  expect(share("ny_ranking")).toBeCloseTo(0.35, 2);
  expect(share("ny_ipchun")).toBeCloseTo(0.30, 2);
  expect(share("ny_monthly")).toBeCloseTo(0.20, 2);
  expect(share("ny_pick")).toBeCloseTo(0.15, 2);
});
it("연속한 두 신년 칸은 유형이 다르다 (같은 날 같은 유형 두 번 없음)", () => {
  const modes = Array.from({ length: 100 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i)).filter(Boolean);
  modes.slice(1).forEach((mode, i) => expect(mode).not.toBe(modes[i]));
});
it("2/1~2/6에는 신년 칸의 절반 이상이 ny_ipchun", () => {
  const modes = Array.from({ length: 40 }, (_, i) => slot("cosmicpath", "2027-02-03T12:00:00", i)).filter(Boolean);
  expect(modes.filter((m) => m === "ny_ipchun").length).toBeGreaterThanOrEqual(modes.length / 2);
});
it("번호 선택지 상한이 차면 ny_pick 대신 다른 유형", () => {
  const modes = Array.from({ length: 100 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i, true)).filter(Boolean);
  expect(modes).not.toContain("ny_pick");
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/new-year/new-year-season.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 3: Implement `newYearSlotMode`**

KST 날짜는 `plannedAt.getTime() + 9h`의 UTC 날짜로 구한다. 구간 표(시작·끝 KST 날짜, 주기 `period`, 칸 위치 `positions`)를 상수 하나로 둔다: KO `[11/24~12/14: period 5, [0]]`, `[12/15~1/31: period 5, [0, 2]]`, `[2/1~2/6: period 5, [0]]`; EN `[12/15~2/6: period 4, [0]]`. 신년 칸 여부는 `positions.includes(slotIndex % period)`. 유형은 신년 칸 순번(`nthNewYearSlot`, slotIndex에서 계산)으로 아래 20칸 순환에서 고른다(7·6·4·3, 인접 중복 없음):

```ts
const MODE_CYCLE: NewYearModeId[] = [
  "ny_ranking", "ny_ipchun", "ny_monthly", "ny_ranking", "ny_pick", "ny_ipchun", "ny_ranking", "ny_monthly", "ny_ipchun", "ny_ranking",
  "ny_pick", "ny_ipchun", "ny_ranking", "ny_monthly", "ny_ipchun", "ny_ranking", "ny_pick", "ny_ipchun", "ny_ranking", "ny_monthly",
];
```

(마지막 칸을 `ny_monthly`로 둬서 순환이 처음으로 돌아갈 때도 `ny_ranking`이 연달아 나오지 않는다.) 2/1~2/6 구간은 짝수 순번이면 `ny_ipchun`, 홀수면 순환값(그 값이 `ny_ipchun`이면 `ny_ranking`). `choicesCapped`이고 결과가 `ny_pick`이면 `ny_monthly`로 바꾼다(순환에서 `ny_pick`의 앞뒤는 항상 `ny_ranking`·`ny_ipchun`이라 연속 중복이 생기지 않는다).

- [ ] **Step 4: Run** the test — Expected: PASS

- [ ] **Step 5: Commit** `git add src/lib/new-year/new-year-season.ts src/lib/new-year/new-year-season.test.ts && git commit -m "feat: 신년 시즌 칸 판정과 유형 배정 추가"`

---

### Task 2: 2027 사주 데이터 (엔진 대조)

**Files:**
- Create: `src/lib/new-year/new-year-2027-data.ts`
- Test: `src/lib/new-year/new-year-2027-data.test.ts`

**Interfaces:**
- Produces:
  - `export type NewYearTag = "express" | "peers" | "learn" | "role" | "money"`
  - `export const DAY_MASTER_2027: Record<string, { tenGod: string; tag: NewYearTag }>` (키: `갑목`…`계수`)
  - `export const NEW_YEAR_TAGS: Record<NewYearTag, { ko: string; en: string; videoSubject: string; videoMeaning: string }>`
  - `export const MONTHS_2027: ReadonlyArray<{ month: number; pillar: string; pillarHanja: string; startsOn: string }>` (12개, `month` 1~12, `startsOn` `"2027-MM-DD"`)
  - `export const IPCHUN_2027: { date: string; timeKst: string }`

설계 §5의 "연지 未와의 합·충"은 일간(천간)에는 적용되지 않으므로 넣지 않는다(합·충은 지지끼리의 관계). 일간 관계는 연간 丁 기준 십신만 쓴다.

- [ ] **Step 1: Write the failing test** — 값 고정:

```ts
expect(Object.fromEntries(Object.entries(DAY_MASTER_2027).map(([k, v]) => [k, v.tenGod]))).toEqual({
  갑목: "상관", 을목: "식신", 병화: "겁재", 정화: "비견", 무토: "정인",
  기토: "편인", 경금: "정관", 신금: "편관", 임수: "정재", 계수: "편재",
});
expect(DAY_MASTER_2027.갑목.tag).toBe("express"); expect(DAY_MASTER_2027.정화.tag).toBe("peers");
expect(DAY_MASTER_2027.무토.tag).toBe("learn"); expect(DAY_MASTER_2027.신금.tag).toBe("role");
expect(DAY_MASTER_2027.계수.tag).toBe("money");
expect(MONTHS_2027.map((m) => m.pillar)).toEqual(["신축", "임인", "계묘", "갑진", "을사", "병오", "정미", "무신", "기유", "경술", "신해", "임자"]);
expect(MONTHS_2027[1].startsOn).toBe(IPCHUN_2027.date);
expect(IPCHUN_2027.date).toBe("2027-02-04");
```

태그 규칙: 식신·상관 → `express`, 비견·겁재 → `peers`, 정인·편인 → `learn`, 정관·편관 → `role`, 정재·편재 → `money`. `NEW_YEAR_TAGS` 문구(그대로 쓴다):

| tag | ko | videoSubject | videoMeaning |
|---|---|---|---|
| express | 하고 싶은 말·재주를 밖으로 꺼내기 쉬운 해 | 2027년 할 말이 많아지는 사람 | 생각과 재주를 밖으로 꺼내기 쉬운 해예요. |
| peers | 나와 닮은 사람·경쟁자가 늘기 쉬운 해 | 2027년 닮은 사람이 늘어나는 사람 | 나와 닮은 사람과 경쟁자가 늘어나기 쉬운 해예요. |
| learn | 배우고 채우며 기반을 다지기 쉬운 해 | 2027년 배울 게 많아지는 사람 | 배우고 채우며 기반을 다지기 쉬운 해예요. |
| role | 책임과 자리가 생기기 쉬운 해 | 2027년 맡는 일이 늘어나는 사람 | 책임과 자리가 생기기 쉬운 해예요. |
| money | 돈이 들고 나는 흐름이 바빠지기 쉬운 해 | 2027년 돈 흐름이 바빠지는 사람 | 돈이 들어오고 나가는 흐름이 바빠지기 쉬운 해예요. |

`en`은 같은 뜻의 짧은 영어 한 줄(구현자 작성).

- [ ] **Step 2: Run** `npx vitest run src/lib/new-year/new-year-2027-data.test.ts` — Expected: FAIL

- [ ] **Step 3: 엔진 대조** — cosmicpath에서 2027 월주·절입일·입춘 시각을 뽑는다(읽기만, 파일 생성 금지):

Run: `cd ~/Desktop/projects/cosmicpath && pnpm exec tsx -e "import {calculateSaju} from './src/lib/engines/saju'; import {calculateWeeklyTimingHeatmap} from './src/lib/engines/timing-heatmap'; /* 임의 원국 하나로 2027 heatmap의 월별 월주·시작일 출력 */"`
Expected: 1~12월 월주가 위 테스트와 같다. 절입일·입춘 시각은 엔진 출력값을 `startsOn`·`IPCHUN_2027.timeKst`에 그대로 쓴다(테스트의 2/4와 다르면 테스트를 엔진 값으로 고친다). 사용한 함수·실행일을 파일 머리말 주석에 남긴다.

- [ ] **Step 4: Implement** the data file with the verified values. Run the test — Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "feat: 2027 정미년 일간 십신·월주 데이터 추가"`

---

### Task 3: 신년 모드·자료(brief)·사실 검사

**Files:**
- Modify: `src/lib/viral-intent-modes.ts` (ID 유니온 1-14, `ENGLISH_VIRAL_MODE_LABELS` 379~, `resolveViralIntentMode` 372)
- Create: `src/lib/new-year/new-year-content.ts`
- Test: `src/lib/new-year/new-year-content.test.ts`

**Interfaces:**
- Consumes: Task 1 `NewYearModeId`, `NewYearLang`; Task 2 데이터
- Produces:
  - `viral-intent-modes.ts`: `ViralIntentModeId`에 4개 ID 추가, `export const NEW_YEAR_MODES: Record<NewYearModeId, ViralIntentMode>`(순환 밖), 영어 라벨 4개, `resolveViralIntentMode`가 신년 ID를 받으면 해당 모드를 돌려준다.
  - `export function buildNewYearBrief(modeId: NewYearModeId, lang: NewYearLang, slotIndex: number): string`
  - `export function checkNewYearFacts(post: string, modeId: NewYearModeId, lang: NewYearLang): string[]` (빈 배열 = 통과)
  - `export function buildNewYearLink(postId: string, modeId: NewYearModeId, lang: NewYearLang): string`
  - `export function newYearFirstComment(lang: NewYearLang, shortLink: string): string`

모드 문구 원칙(정확한 문장은 구현자): ① `ny_ranking` "2027 일간별 분류" — 순위가 아니라 brief의 5개 결로 10개 일간을 묶어 보여준다(점수를 지어내지 않기 위해 "TOP N" 대신 분류). 첫 줄에 일간 이름 금지. ② `ny_ipchun` 사주의 해는 입춘부터 바뀐다는 반전. ③ `ny_monthly` 1~12월 월주 흐름을 저장형으로. ④ `ny_pick` 사람/일/돈 중 고르기, 번호 선택지로 끝남. 모든 모드: 단정 예언 금지, "~하기 쉬운" 수준.

- [ ] **Step 1: Write the failing tests**

```ts
it("ranking brief에 10개 일간과 각자의 결이 다 있다", () => {
  const brief = buildNewYearBrief("ny_ranking", "ko", 0);
  for (const [dm, { tag }] of Object.entries(DAY_MASTER_2027)) {
    expect(brief).toContain(dm);
    expect(brief).toContain(NEW_YEAR_TAGS[tag].ko);
  }
});
it("monthly brief에 12개 월주가 순서대로 있다", () => {
  const brief = buildNewYearBrief("ny_monthly", "ko", 0);
  const positions = MONTHS_2027.map((m) => brief.indexOf(m.pillar));
  expect(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]))).toBe(true);
});
it("한 줄에 다른 결의 일간이 섞이면 떨어진다", () => {
  expect(checkNewYearFacts("2027년 일간별로 바쁜 데가 달라\n갑목·을목: 할 말이 많아짐\n병화·임수: 사람이 늘어남", "ny_ranking", "ko"))
    .toEqual([expect.stringContaining("병화")]);
  expect(checkNewYearFacts("2027년 일간별로 바쁜 데가 달라\n갑목·을목: 할 말이 많아짐\n병화·정화: 사람이 늘어남", "ny_ranking", "ko")).toEqual([]);
});
it("틀린 월주는 떨어진다", () => {
  expect(checkNewYearFacts("5월 병오는 바쁜 달", "ny_monthly", "ko")).toEqual([expect.stringContaining("5월")]);
  expect(checkNewYearFacts("5월 을사, 6월 병오", "ny_monthly", "ko")).toEqual([]);
});
it("2026·2027 외 연도는 떨어진다", () => {
  expect(checkNewYearFacts("2028년엔 더 좋아짐", "ny_pick", "ko")).toEqual([expect.stringContaining("2028")]);
});
it("입춘 글은 입춘 날짜나 '입춘'을 말해야 한다", () => {
  expect(checkNewYearFacts("1월 신년운세는 사실 작년 운", "ny_ipchun", "ko")).not.toEqual([]);
  expect(checkNewYearFacts("사주의 해는 입춘부터 바뀜", "ny_ipchun", "ko")).toEqual([]);
});
it("링크에 추적 파라미터가 다 붙는다", () => {
  const url = new URL(buildNewYearLink("post_1", "ny_ranking", "ko"));
  expect(url.origin + url.pathname).toBe("https://www.cosmicpath.app/2027/sample");
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ source: "threads", utm_source: "threads", utm_campaign: "new_year_2027", pid: "post_1", fid: "ny_ranking" });
  expect(new URL(buildNewYearLink("p", "ny_pick", "en")).pathname).toBe("/en/2027/sample");
});
it("신년 모드 프롬프트는 첫 줄 사주 전제·지어낸 경험담을 요구하지 않는다", () => {
  for (const mode of Object.values(NEW_YEAR_MODES)) {
    expect(formatViralIntentModePrompt(mode)).not.toMatch(/본인 경험담으로|첫 줄에 .*일간/);
  }
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/new-year/new-year-content.test.ts` — Expected: FAIL

- [ ] **Step 3: Implement** — 링크는 `buildTrackedUrl(base, { postId, formulaId: modeId, utmCampaign: "new_year_2027" })`(`src/lib/tracking-url.ts`) 결과에 `source=threads`를 추가. 월주 검사는 `(\d{1,2})월` 뒤 12자 안의 한글 간지(`[갑을병정무기경신임계][자축인묘진사오미신유술해]`)를 `MONTHS_2027`과 대조. 분류 검사는 일간 이름이 2개 이상 나온 줄에서 태그가 모두 같은지. EN은 연도 검사와 입춘(`Feb 4`|`February 4`|`Lichun`) 검사만.

- [ ] **Step 4: Run** the test + `npx vitest run src/lib/viral-intent-modes.test.ts` — Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "feat: 신년 글 모드·자료·사실 검사 추가"`

---

### Task 4: 생성 루프에 신년 칸 연결

**Files:**
- Modify: `src/lib/generate-posts.ts` (`GrowthExperiment` ~88, gate 클로저 ~300-357, 프롬프트 ~648, 배치 루프 ~1046-1118, 예약 시각 ~1136-1155, 링크 ~1253-1320)
- Test: `src/lib/generate-posts-new-year.test.ts` (모킹은 `generate-posts-winner-replay.test.ts`와 같은 구성: Anthropic 요청 캡처, prisma 모킹, 길이 실험 null)

**Interfaces:**
- Consumes: Task 1 `newYearSlotMode`, `NEW_YEAR_BRANDS`; Task 3 `NEW_YEAR_MODES`, `buildNewYearBrief`, `checkNewYearFacts`, `buildNewYearLink`, `newYearFirstComment`
- Produces: `GrowthExperiment.newYearBrief?: string`, `GrowthExperiment.newYearMode?: NewYearModeId`; 함수 `async function resolveQueueBaseTime(brandId: string, insertAtFront: boolean, count: number, now: number): Promise<number>`(지금 1136~1155의 계산을 그대로 옮긴 것)

변경 요지:
1. `resolveQueueBaseTime`을 배치 루프 **앞**에서 호출하고, 저장 단계는 그 값을 그대로 쓴다.
2. 각 칸의 예정 시각 `baseTime + batchIndex * POST_INTERVAL_MS`와 `slotIndex = contextOffset + batchIndex`로 `newYearSlotMode`를 부른다(`choicesCapped`는 기존 계산값).
3. 신년 칸이면: `viralIntentMode = NEW_YEAR_MODES[id]`, `formula = selectCampaignFormulaForViralMode(sourceFormulas, mode)`(→ formulaId가 모드 ID가 됨), Thompson·quota 선택과 winner replay를 건너뛴다. `experiment.newYearMode`·`newYearBrief` 설정, `experiment.lengthTarget = undefined`, `experiment.shouldLink = true`, `closingFormat`은 `ny_pick`이면 `"choices"`, 아니면 `undefined`.
4. 프롬프트: `winnerReference`와 같은 자리에 `[신년 자료: 이 값만 쓰고 다른 일간·달·간지를 지어내지 마]\n${brief}`.
5. gate: `newYearMode`가 있으면 `checkNewYearFacts` 사유를 더한다(기존 게이트는 그대로).
6. 저장 후 링크: `newYearMode`가 있으면 `finalLinkUrl = buildNewYearLink(post.id, mode, lang)`, `firstComment = newYearFirstComment(lang, shortRedirectUrl)`(LLM 첫 댓글·bridgeHeader 대신). `lang = NEW_YEAR_BRANDS[brand.slug]`.

- [ ] **Step 1: Write the failing tests**

```ts
it("시즌 정점의 cosmicpath 5개 생성 중 2개가 신년 모드이고, 첫 댓글이 고정 문구+단축 링크", async () => {
  vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
  await generatePostsForBrand(cosmicBrand, { ...input, count: 5 });
  const ny = state.created.filter((p) => p.formulaId?.startsWith("ny_"));
  expect(ny).toHaveLength(2);
  expect(state.updates.filter((u) => u.linkUrl?.includes("/2027/sample"))).toHaveLength(2);
  expect(state.updates.find((u) => u.linkUrl?.includes("/2027/sample"))?.firstComment).toMatch(/^내 2027 캘린더, 샘플 먼저 보기:\nhttps?:\/\/.+\/r\//);
});
it("신년 칸의 프롬프트에 신년 자료가 들어간다", async () => {
  vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
  await generatePostsForBrand(cosmicBrand, { ...input, count: 5 });
  expect(state.requests.join("\n")).toContain("[신년 자료:");
});
it("시즌 전(10/30)에는 신년 칸이 없다", async () => {
  vi.setSystemTime(new Date("2026-10-30T03:00:00Z"));
  await generatePostsForBrand(cosmicBrand, { ...input, count: 5 });
  expect(state.created.filter((p) => p.formulaId?.startsWith("ny_"))).toHaveLength(0);
});
it("다른 브랜드는 시즌 정점에도 신년 칸이 없다", async () => {
  vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
  await generatePostsForBrand({ ...cosmicBrand, slug: "other-brand" } as Brand, { ...input, count: 5 });
  expect(state.created.filter((p) => p.formulaId?.startsWith("ny_"))).toHaveLength(0);
});
it("사실 검사에 걸린 신년 초안은 저장되지 않는다", async () => {
  vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
  state.reply = "2028년엔 다 잘 풀림"; // 연도 위반
  await generatePostsForBrand(cosmicBrand, { ...input, count: 5 }).catch(() => null);
  expect(state.created.filter((p) => p.formulaId?.startsWith("ny_"))).toHaveLength(0);
});
```

(`state.updates`는 `prisma.post.update` 모킹에서 `data`를 모은다. `vi.useFakeTimers({ toFake: ["Date"] })`로 시각만 고정.)

- [ ] **Step 2: Run** `npx vitest run src/lib/generate-posts-new-year.test.ts` — Expected: FAIL

- [ ] **Step 3: Implement** the six changes above.

- [ ] **Step 4: Run** the new test and the existing generation tests: `npx vitest run src/lib/generate-posts-new-year.test.ts src/lib/generate-posts-winner-replay.test.ts src/lib/generate-posts-english-remediation.test.ts src/app/api/generate` — Expected: PASS (기존 테스트는 시각이 시즌 밖이므로 그대로 통과해야 한다)

- [ ] **Step 5: Commit** `git commit -m "feat: 생성 루프에 신년 시즌 칸 연결"`

---

### Task 5: 학습에서 신년 글 제외

**Files:**
- Modify: `src/lib/growth-service.ts:101-114` (observations 필터)
- Test: `src/lib/growth-service.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 1 `isNewYearModeId`

- [ ] **Step 1: Write the failing test** — 평소 글 3개(조회 100, 120, 140)와 신년 글 2개(`formulaId: "ny_ranking"`, 조회 5000)로 학습을 돌렸을 때 저장된 `thompsonPriors`에 `ny_ranking` 키가 없고, 평소 글의 보상 계산 중앙값이 120 기준과 같다(신년 글을 뺀 결과와 같음). 기존 테스트의 학습 호출 구성을 그대로 쓴다.

- [ ] **Step 2: Run** `npx vitest run src/lib/growth-service.test.ts` — Expected: FAIL

- [ ] **Step 3: Implement** — observations 필터에 `.filter((p) => !isNewYearModeId(p.formulaId))` 한 줄.

- [ ] **Step 4: Run** — Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "feat: 신년 글을 모드 학습에서 제외"`

---

### Task 6: 매일 영상 2027 버전

**Files:**
- Modify: `src/lib/tiktok/tiktok-script-engine.ts` (`ScriptGenerationParams`, `evaluateExplainerQuality`, `generateTikTokScript`)
- Modify: `src/app/api/cron/video-jobs/next/route.ts` (`createDailyDraft`)
- Modify: `src/lib/new-year/new-year-season.ts` (`isKoNewYearSeason` 추가, Task 1의 구간 표 재사용)
- Test: `src/lib/tiktok/tiktok-engine.test.ts`

**Interfaces:**
- Consumes: Task 2 `DAY_MASTER_2027`, `NEW_YEAR_TAGS`; Task 1의 구간 표
- Produces(추가): `new-year-season.ts`의 `export function isKoNewYearSeason(date: Date, env?: NodeJS.ProcessEnv): boolean` — KO 시즌(11/24~2/6 KST) 안이고 긴급 정지가 아니면 true
- Produces: `ScriptGenerationParams.season?: "new_year_2027"`; `evaluateExplainerQuality(script, dayMaster, answer?: string)` — `answer`가 오면 상징 대신 그 단어로 답 검사

2027 버전 대본(KO, 이 문구 그대로):
- 1장면 훅: `${NEW_YEAR_TAGS[tag].videoSubject}, 왜 그럴까?` / 음성: `${videoSubject}, 사주로 보면 이유가 보여요.`
- 2장면 음성: `사주로 보면 2027년 정미년은 ${dayMaster} 일간에게 ${tenGod}의 해예요. ${videoMeaning}` / 화면: `${dayMaster} · 2027 ${tenGod}`
- 3장면: 기존 명식 카드, `destinyKeyword` = `2027 ${tenGod}`
- 4장면 CTA: `cta` = `프로필 링크 → 홈 맨 위 2027 캘린더`, 음성 = `내 2027년 달력이 궁금하면, 프로필 링크 들어가서 홈 맨 위 2027 캘린더를 눌러 보세요.`, 배지 `✨ 2027 캘린더`
- 게이트 답 단어: `tenGod`

- [ ] **Step 1: Write the failing tests**

```ts
it.each(DAY_MASTERS)("%s 2027 버전: 게이트 통과, 첫 줄 사주 전제 없음, 답에 일간·십신", (dayMaster) => {
  const script = generateTikTokScript({ topic: "사주", dayMaster, season: "new_year_2027" });
  expect(script.qualityReasons).toEqual([]);
  expect(findFirstLineChartGate(script.scenes[0].onScreenText[0])).toBeNull();
  expect(script.scenes[1].spokenLine).toContain(`${dayMaster} 일간에게 ${DAY_MASTER_2027[dayMaster].tenGod}의 해`);
  expect(script.cta).toBe("프로필 링크 → 홈 맨 위 2027 캘린더");
});
it("크론: KST 11/24 이후 생성분은 2027 버전, 11/23은 평소 버전", () => {
  // createDailyDraft가 쓰는 판정 함수 기준
  expect(isKoNewYearSeason(new Date("2026-11-23T14:30:00Z"))).toBe(false);
  expect(isKoNewYearSeason(new Date("2026-11-23T15:10:00Z"))).toBe(true);
  expect(isKoNewYearSeason(new Date("2027-02-06T14:59:00Z"))).toBe(true);
  expect(isKoNewYearSeason(new Date("2027-02-06T15:00:00Z"))).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/tiktok/` — Expected: FAIL

- [ ] **Step 3: Implement** — `season`이 있으면 위 문구로 장면을 만들고 게이트 `answer = tenGod`. 크론은 `season: isKoNewYearSeason(now) ? "new_year_2027" : undefined`를 넘긴다. `NEW_YEAR_SEASON_DISABLED=1`이면 `isKoNewYearSeason`도 false.

- [ ] **Step 4: Run** `npx vitest run src/lib/tiktok/ src/lib/new-year/` — Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "feat: 시즌 동안 매일 영상을 2027 버전으로 전환"`

---

### Task 7: 주간 리포트 스크립트

**Files:**
- Create: `scripts/new-year-report.mjs` (`scripts/brand-audit.mjs`처럼 `PrismaClient` 직접 사용, 읽기 전용)

**Interfaces:**
- Consumes: DB의 `Post`(formulaId `ny_*`, views, clicks, publishedAt), `ConversionEvent`(postId, eventType `paid_conversion`)
- Produces: 표준출력 표 — 브랜드 × 유형별: 글 수, 조회 중앙값, 1,000조회당 클릭, 결제 수 / 평소 글 조회 중앙값 / 시즌 누적 결제 수 대비 100건

- [ ] **Step 1: Write the self-test first** — 순수 집계 함수 `summarize(posts, conversions)`와 `--self-test` 플래그(`scripts/analyze-post-response.mjs`와 같은 방식). 고정 입력 4글·2결제에 대해 유형별 결제 수와 중앙값이 기대값과 같은지 `assert`로 확인.

- [ ] **Step 2: Run** `node scripts/new-year-report.mjs --self-test` — Expected: 첫 실행은 `summarize` 미구현으로 실패

- [ ] **Step 3: Implement** `summarize`와 DB 조회(기간: 2026-11-24 ~ 2027-02-06 KST, 두 brand slug). 쓰기 쿼리 없음.

- [ ] **Step 4: Run** `node scripts/new-year-report.mjs --self-test` — Expected: `self-test ok`

- [ ] **Step 5: Commit** `git commit -m "feat: 신년 시즌 주간 리포트 스크립트 추가"`

---

### Task 8: 전체 검증

- [ ] **Step 1:** `npx vitest run` — Expected: 기존 실패(`cron/publish/lock.test.ts`가 main에서도 실패하던 경우) 외 전부 PASS
- [ ] **Step 2:** `npx tsc --noEmit` — Expected: 출력 없음
- [ ] **Step 3:** `npx eslint src/lib/new-year src/lib/generate-posts.ts src/lib/growth-service.ts src/lib/tiktok src/app/api/cron/video-jobs` — Expected: 새 경고·오류 없음
