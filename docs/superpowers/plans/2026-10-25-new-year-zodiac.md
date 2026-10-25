# 2027 신년 띠별 콕 집기 글 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신년 시즌 글에 `ny_zodiac` 유형을 추가한다. 글마다 주제 하나를 골라 그 주제의 띠만 출생년도와 함께 콕 집는다.

**Architecture:**
- 띠 값(12띠 주제·출생년도·관계 주제 8개)은 `new-year-2027-data.ts`에 둔다.
- brief 생성과 값 검사는 `new-year-content.ts`에 둔다.
- 유형 등록과 배정 순환은 `new-year-season.ts`·`viral-intent-modes.ts`에 둔다.
- 생성 루프는 `slotIndex`를 값 검사까지 넘긴다. 주제가 `slotIndex`로 정해지기 때문이다.

**Tech Stack:** TypeScript, vitest, npm (기존 저장소 관행)

**Spec:** `docs/superpowers/specs/2026-10-25-new-year-zodiac-design.md` (상위: `docs/superpowers/specs/2026-10-24-new-year-season-design.md`)

## Global Constraints

- npm 사용. 새 의존성 금지. 스키마 변경 금지. `any` 금지(`unknown` + 좁히기).
- 함수 20줄 이하. 커밋 메시지는 한국어 conventional commits.
- 띠 주제 태그: 쥐·돼지=`money`, 호랑이·토끼=`express`, 뱀·말=`peers`, 원숭이·닭=`role`, 소·용·양·개=`learn`.
- 관계 주제: 합=돼지·토끼·말("사람이 들어오기 쉬운"), 충·형=소·개("자리·관계가 바뀌기 쉬운", 중립 표현), 자기 해=양.
- 출생년도: 1968~2007, 지지 = (연도 − 4) mod 12 (0=子). 데이터는 4자리로 저장하고, KO 글은 2자리 숫자를 큰 수부터 "95·83·71·07년생"으로 쓴다(조사한 상위 글과 같은 순서). EN 글은 4자리 오름차순으로 쓴다.
- KO 띠 목록 줄에는 번호를 붙이지 않는다. 순위 표현("1위", "TOP", "순위", "#1", "No. 1")을 금지한다.
- 첫 줄에 띠 이름을 쓰지 않는다. 띠 기준 안내(입춘·2월 4일·Feb 4·Lichun·Ipchun 중 하나)는 필수다. KO는 "사주"나 "운세"를 넣는다. 삼합·육합·방합 용어는 금지한다.
- EN 입춘 표기는 "Ipchun"이다(기존 `normalizeIpchunSpelling` 관행). 첫 줄은 60자 이하 평서문이고 물음표 금지다.
- 해의 띠(양/Goat)는 어느 주제 글에서도 언급할 수 있다. "2026 말띠 해·Fire Horse year" 같은 해 이름 표현은 띠 언급으로 세지 않는다.
- 신년 칸 수는 그대로다. KO 20칸 순환 비율은 zodiac 6 · ranking 4 · ipchun 5 · monthly 3 · pick 2로 한다. EN은 zodiac → ipchun → zodiac → pick 순환이고, 번호 선택지 상한이 차면 pick을 ipchun으로 바꾼다.

## Review Focus

1. **"말", "양", "개", "용", "소" 같은 일반 단어.** "말이 많아지는", "소소한", "개인" 같은 말을 띠로 세지 않아야 한다. KO는 "X띠"만 센다. (Task 2 테스트)
2. **EN 글의 "2026 Fire Horse year"/"Year of the Fire Goat".** 해 이름이라 주제 밖 띠 실패가 나면 안 된다. (Task 2 테스트)
3. **"호랑이띠"와 "범띠".** 둘 다 같은 띠로 인식해야 한다. 한쪽만 인식하면 정상 글이 조용히 버려진다. (Task 2 테스트)
4. **연달아 나온 두 띠 글의 주제.** 같은 주제가 반복되면 안 된다. KO 초반·정점, EN 모두 해당한다. (Task 3 테스트)
5. **기존 신년 통합 테스트(정점 5칸 → 신년 2개, 일반 샘플 글).** 그대로 통과해야 한다. 순환의 0·1번째가 띠 글이 아니어야 하는 이유다. (Task 3·4)

---

### Task 1: 띠 데이터

**Files:**
- Modify: `src/lib/new-year/new-year-2027-data.ts` (파일 끝에 추가)
- Test: `src/lib/new-year/new-year-2027-data.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Zodiac2027 {
    ko: string;              // "쥐" … "돼지" (호랑이는 "호랑이")
    aliases: readonly string[]; // 호랑이: ["범"], 나머지 []
    branch: string;          // "子" … "亥"
    en: string;              // "Rat" … "Pig" (Goat, Rooster)
    tag: NewYearTag;
    birthYears: readonly number[]; // 1968~2007, 오름차순
  }
  export const ZODIAC_2027: readonly Zodiac2027[]; // 子丑寅卯辰巳午未申酉戌亥 순 (index = 지지 번호)
  export type ZodiacTopicId = NewYearTag | "harmony" | "clash" | "own_year";
  export interface ZodiacTopic { id: ZodiacTopicId; ko: string; en: string; animals: readonly string[] } // animals = ZODIAC_2027[].ko
  export const ZODIAC_TOPICS: readonly ZodiacTopic[]; // 정확히 이 순서:
  //   money, harmony, express, clash, peers, own_year, role, learn
  export const YEAR_ANIMAL_2027 = "양";
  ```
- 오행 주제 5개의 `ko`/`en`은 `NEW_YEAR_TAGS[tag].ko/.en`을 그대로 쓴다.
- 관계 주제 3개 문구:
  - harmony: KO "사람이 들어오기 쉬운 해" / EN "A year when new people are likely to come your way."
  - clash: KO "자리나 관계가 바뀌기 쉬운 해" / EN "A year when your place or relationships are likely to shift."
  - own_year: KO "자기 띠의 해를 맞는 해" / EN "A year that is your own zodiac year."
- `birthYears`는 규칙으로 계산한다(1968~2007 중 `(y − 4) % 12 === index`).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("12띠 태그와 별칭", () => {
  expect(ZODIAC_2027.map((z) => z.ko)).toEqual(["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]);
  expect(ZODIAC_2027.map((z) => z.tag)).toEqual(["money", "learn", "express", "express", "learn", "peers", "peers", "learn", "role", "role", "learn", "money"]);
  expect(ZODIAC_2027[2].aliases).toEqual(["범"]);
  expect(ZODIAC_2027.map((z) => z.en)).toEqual(["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"]);
});
it("출생년도는 1968~2007이고 지지 규칙과 맞다", () => {
  expect(ZODIAC_2027[0].birthYears).toEqual([1972, 1984, 1996]);
  expect(ZODIAC_2027[8].birthYears).toEqual([1968, 1980, 1992, 2004]);
  expect(ZODIAC_2027[11].birthYears).toEqual([1971, 1983, 1995, 2007]);
  ZODIAC_2027.forEach((z, i) => z.birthYears.forEach((y) => {
    expect(y >= 1968 && y <= 2007).toBe(true);
    expect((y - 4) % 12).toBe(i);
  }));
  expect(ZODIAC_2027.flatMap((z) => z.birthYears)).toHaveLength(40);
});
it("주제 8개와 띠", () => {
  expect(ZODIAC_TOPICS.map((t) => t.id)).toEqual(["money", "harmony", "express", "clash", "peers", "own_year", "role", "learn"]);
  const animals = Object.fromEntries(ZODIAC_TOPICS.map((t) => [t.id, t.animals]));
  expect(animals.harmony).toEqual(["돼지", "토끼", "말"]);
  expect(animals.clash).toEqual(["소", "개"]);
  expect(animals.own_year).toEqual(["양"]);
  expect(animals.learn).toEqual(["소", "용", "양", "개"]);
  expect(new Set(ZODIAC_TOPICS.flatMap((t) => t.animals))).toEqual(new Set(ZODIAC_2027.map((z) => z.ko)));
  expect(ZODIAC_TOPICS.every((t) => t.ko && t.en)).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/new-year/new-year-2027-data.test.ts` → Expected: FAIL (`ZODIAC_2027` is not exported)
- [ ] **Step 3: 구현** — 위 Interfaces 그대로. 파일 머리말 방식처럼 근거 주석 한 줄을 단다: "丁(음화) 기준 지지 대표 오행의 십신, 지장간 무시한 단순화".
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 5: 커밋**

```bash
git add src/lib/new-year/new-year-2027-data.ts src/lib/new-year/new-year-2027-data.test.ts
git commit -m "feat: 2027 신년 띠 데이터와 주제 8개 추가"
```

---

### Task 2: 띠 brief·주제 순환·값 검사

**Files:**
- Modify: `src/lib/new-year/new-year-content.ts`
- Modify: `src/lib/domain-registry.ts` (`ZODIAC_ANIMAL_PATTERNS`에 `export` 추가만)
- Test: `src/lib/new-year/new-year-content.test.ts`

**Interfaces:**
- Consumes: `ZODIAC_2027`, `ZODIAC_TOPICS`, `YEAR_ANIMAL_2027`, `ZodiacTopic` (Task 1). `ZODIAC_ANIMAL_PATTERNS` from `@/lib/domain-registry`. 이 패턴은 子→亥 순서라 index가 `ZODIAC_2027` index와 같다.
- Produces (export):
  ```ts
  export function zodiacTopicFor(slotIndex: number): ZodiacTopic; // ZODIAC_TOPICS[Math.floor(slotIndex / 5) % 8]
  export function buildZodiacBrief(lang: NewYearLang, slotIndex: number): string[]; // 헤더 없는 줄 목록 (buildNewYearBrief가 헤더를 붙임)
  export function checkZodiacFacts(post: string, slotIndex: number): string[]; // 문제 목록, 빈 배열 = 통과
  ```
- **`zodiacTopicFor`의 나눗셈 5:** 이 수가 연속 반복 없음을 보장한다. 신년 칸 순환에서 띠 글은 2~5칸 간격으로만 나온다(Task 3 순환). 그래서 연달아 나온 두 띠 글은 `floor(slotIndex/5)`가 1~5만큼 차이 나고, 8의 배수가 되지 않는다. 이 이유를 주석으로 남긴다.
- **brief 내용 (KO, 순서대로):**
  - `- 주제: {topic.ko}`
  - 주제 띠마다 한 줄: `- 돼지띠 (95·83·71·07년생)`. 2자리 숫자를 큰 수부터, `·` 구분.
  - `- 2027년은 양띠 해(정미년)`
  - `- 사주에선 입춘(2월 4일)부터 띠를 바꿔 본다. 1월~2월 초생은 앞 해 띠일 수 있다.`
- **brief 내용 (EN):**
  - `- Theme: {topic.en}`
  - 띠마다 한 줄: `- Pig (born 1971, 1983, 1995, 2007)`. 4자리 오름차순.
  - `- 2027 is the Year of the Fire Goat`
  - `- In saju the zodiac year turns at Ipchun (Feb 4), not Lunar New Year, so early-February birthdays may count as the year before.`
- **`checkZodiacFacts` 판정 (문제 문구는 한국어, 기존 `checkNewYearFacts` 문구 스타일):**
  1. **띠 찾기.**
     - KO: `(쥐|소|호랑이|범|토끼|용|뱀|말|양|원숭이|닭|개|돼지)띠`. 범은 호랑이로 센다.
     - EN: `ZODIAC_ANIMAL_PATTERNS`로 찾는다.
     - 해 이름 표현은 찾기 전에 지운다. KO `/(말|양)띠\s*(의\s*)?해/g`. EN `/\b(?:year\s+of\s+the\s+)?(?:fire\s+)?(?:horse|goat)(?:\s+year)?\b/gi`는 "year"가 앞이나 뒤에 붙은 경우만 지운다.
  2. 주제 밖 띠가 있으면 `다른 주제의 띠: X`. 양은 항상 허용한다.
  3. 주제 띠가 하나도 없으면 `주제 띠가 없음`.
  4. **연도.** 한 줄 안의 띠와 연도를 같이 본다.
     - KO: `(\d{2}(?:\s*[·,/]\s*\d{2})*)\s*년생`에서 2자리를 뽑는다. 68 이상은 19xx, 미만은 20xx로 바꾼다.
     - EN: 줄 안의 `19\d{2}|20\d{2}`를 뽑는다. 2026·2027은 뺀다.
     - 그 줄의 띠 중 어느 것의 `birthYears`에도 없으면 `띠와 출생년도 불일치: {줄}`.
  5. 글 전체의 `19\d{2}|20\d{2}` 중 2026·2027·주제 띠 출생년도가 아닌 것은 `허용되지 않은 연도: {y}`.
  6. 첫 줄에 띠(1번 규칙)가 있으면 `첫 줄에 띠 이름`.
  7. `/입춘|2월\s*4일|Feb(?:ruary)?\.?\s*4|Lichun|Ipchun/i`가 없으면 `띠 기준 안내 없음`.
  8. `/\d\s*위|TOP\s*\d|순위|#\s*1\b|\bNo\.?\s*1\b/i`가 있으면 `순위 표현`.

- [ ] **Step 1: 실패하는 테스트 작성** (헬퍼: `HARMONY = 5` → `zodiacTopicFor(5).id === "harmony"`)

```ts
const KO_OK = [
  "2027년, 사람이 들어오기 쉬운 띠가 있어",
  "띠로 보는 사주 이야기야",
  "돼지띠 (95·83·71·07년생): 사람이 들어오기 쉬운 해",
  "토끼띠 (99·87·75년생): 새 인연이 붙기 쉬운 해",
  "말띠 (02·90·78년생): 사람이 늘기 쉬운 해",
  "사주에선 입춘(2월 4일)부터 띠를 바꿔 봐서 1월~2월 초생이면 앞 해 띠일 수 있어",
  "가족 띠도 찾아서 보내 줘",
].join("\n");
const EN_OK = [
  "Some zodiac signs meet more people in 2027.",
  "2027 is the Year of the Fire Goat.",
  "Pig (born 1971, 1983, 1995, 2007): new people are likely.",
  "Rabbit (born 1975, 1987, 1999): new ties come easier.",
  "Horse (born 1978, 1990, 2002): your circle may grow.",
  "In saju the year turns at Ipchun (Feb 4), so early-February birthdays may count as the year before.",
].join("\n");

it("주제 순환", () => {
  expect(zodiacTopicFor(0).id).toBe("money");
  expect(zodiacTopicFor(5).id).toBe("harmony");
  expect(zodiacTopicFor(40).id).toBe("money");
});
it("brief에는 그 주제 띠와 출생년도만 있다", () => {
  const ko = buildZodiacBrief("ko", 5).join("\n");
  expect(ko).toContain("돼지띠 (95·83·71·07년생)");
  expect(ko).not.toContain("쥐띠");
  expect(ko).toContain("입춘");
  const en = buildZodiacBrief("en", 5).join("\n");
  expect(en).toContain("Pig (born 1971, 1983, 1995, 2007)");
  expect(en).toContain("Ipchun");
});
it("올바른 KO·EN 글은 통과", () => {
  expect(checkZodiacFacts(KO_OK, 5)).toEqual([]);
  expect(checkZodiacFacts(EN_OK, 5)).toEqual([]);
});
it("주제 밖 띠·연도 불일치·범위 밖·첫 줄 띠·안내 없음·순위는 실패", () => {
  expect(checkZodiacFacts(KO_OK.replace("말띠 (02·90·78년생)", "쥐띠 (96·84·72년생)"), 5)).toEqual([expect.stringContaining("다른 주제의 띠")]);
  expect(checkZodiacFacts(KO_OK.replace("95·83·71·07", "96·83·71·07"), 5)).toEqual([expect.stringContaining("불일치")]);
  expect(checkZodiacFacts(KO_OK.replace("95·83·71·07", "59·83·71·07"), 5)).toEqual([expect.stringContaining("불일치")]);
  expect(checkZodiacFacts(`돼지띠 주목\n${KO_OK}`, 5)).toEqual([expect.stringContaining("첫 줄")]);
  expect(checkZodiacFacts(KO_OK.replace(/사주에선.*\n/, ""), 5)).toEqual([expect.stringContaining("띠 기준 안내")]);
  expect(checkZodiacFacts(KO_OK.replace("돼지띠", "1위 돼지띠"), 5)).toEqual([expect.stringContaining("순위")]);
  // 1991은 줄 불일치와 허용 연도 위반 둘 다에 걸린다.
  expect(checkZodiacFacts(EN_OK.replace("1990", "1991"), 5)).toEqual(expect.arrayContaining([expect.stringContaining("불일치")]));
  expect(checkZodiacFacts(`${EN_OK}\nBorn in 1985? Check again.`, 5)).toEqual([expect.stringContaining("1985")]);
});
it("일반 단어·해 이름·별칭은 띠로 잘못 세지 않는다", () => {
  expect(checkZodiacFacts(`${KO_OK}\n말이 많아지는 해, 소소한 개인 일정도 챙겨`, 5)).toEqual([]);
  expect(checkZodiacFacts(`${KO_OK}\n2026년 말띠 해가 지나고 2027년은 양띠 해야`, 5)).toEqual([]);
  expect(checkZodiacFacts(`${EN_OK}\nThe 2026 Fire Horse year is ending.`, 5)).toEqual([]);
  const tiger = buildZodiacBrief("ko", 10).join("\n"); // express 주제(호랑이·토끼)
  expect(tiger).toContain("호랑이띠");
  expect(checkZodiacFacts("2027년, 말과 재주를 꺼내기 쉬운 띠\n범띠 (98·86·74년생): 표현이 늘기 쉬운 해\n토끼띠 (99·87·75년생): 재주를 꺼내기 쉬운 해\n띠로 보는 사주, 입춘부터 띠를 바꿔 봐", 10)).toEqual([]);
});
```


- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/new-year/new-year-content.test.ts` → Expected: FAIL (`zodiacTopicFor` is not exported)
- [ ] **Step 3: 구현** — 위 판정 규칙대로 작성하고, 20줄 이하 헬퍼(띠 찾기, 줄별 연도, 전체 연도)로 나눈다. `domain-registry.ts`는 `const ZODIAC_ANIMAL_PATTERNS`를 `export const`로 바꾸는 것만 한다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/new-year/ src/lib/domain-registry.test.ts` → PASS
- [ ] **Step 5: 커밋**

```bash
git add src/lib/new-year/new-year-content.ts src/lib/new-year/new-year-content.test.ts src/lib/domain-registry.ts
git commit -m "feat: 신년 띠 글 brief와 값 검사 추가"
```

---

### Task 3: `ny_zodiac` 유형 등록과 배정 순환

**Files:**
- Modify: `src/lib/new-year/new-year-season.ts` (`NewYearModeId`, `NEW_YEAR_MODE_IDS`, `MODE_CYCLE`, EN 분기)
- Modify: `src/lib/new-year/new-year-content.ts` (`buildNewYearBrief`·`checkNewYearFacts` 분기)
- Modify: `src/lib/viral-intent-modes.ts` (`NEW_YEAR_MODES.ny_zodiac`, `ENGLISH_VIRAL_MODE_LABELS.ny_zodiac`)
- Test: `src/lib/new-year/new-year-season.test.ts`, `src/lib/new-year/new-year-content.test.ts`

**Interfaces:**
- Consumes: `buildZodiacBrief`, `checkZodiacFacts`, `zodiacTopicFor` (Task 2)
- Produces:
  - `NewYearModeId`에 `"ny_zodiac"`가 추가된다. `NEW_YEAR_MODE_IDS`의 끝에도 추가된다.
  - `checkNewYearFacts(post: string, modeId: NewYearModeId, slotIndex = 0): string[]`
    - `ny_zodiac`이면 기존 "20xx 연도" 루프 대신 `checkZodiacFacts`의 연도 규칙을 쓴다. 나머지 공통 검사(연간지 정미 등)는 그대로 돈다.
  - `buildNewYearBrief`의 `ny_zodiac` → `buildZodiacBrief(lang, slotIndex)`.
- **KO `MODE_CYCLE` (정확히 이 배열):**
  ```ts
  ["ny_ranking", "ny_ipchun", "ny_zodiac", "ny_monthly", "ny_ipchun", "ny_zodiac", "ny_pick", "ny_ranking", "ny_zodiac", "ny_ipchun",
   "ny_monthly", "ny_zodiac", "ny_ranking", "ny_pick", "ny_zodiac", "ny_ipchun", "ny_monthly", "ny_zodiac", "ny_ranking", "ny_ipchun"]
  ```
  - 띠 6, 랭킹 4, 입춘 5, 월별 3, 고르기 2개다.
  - 처음으로 넘어가는 자리를 포함해 같은 유형이 연달아 나오지 않는다. 고르기를 월별로 바꿔도 마찬가지다.
  - 띠 간격은 3~5칸이다.
  - 0·1번째는 랭킹·입춘이다. 기존 통합 테스트의 일반 샘플 글이 그대로 통과하게 하기 위해서다.
- **EN:** `["ny_zodiac", "ny_ipchun", "ny_zodiac", "ny_pick"][nth % 4]`. `choicesCapped`이고 결과가 `ny_pick`이면 `ny_ipchun`으로 바꾼다. 기존 주석("EN has no value checks…")은 새 사실에 맞게 고친다.
- **KO 모드 `ny_zodiac`:**
  - label `"2027 띠별 콕 집기"`, primaryMetric `"shares"`
  - instruction: [자료]의 주제 하나와 그 주제의 띠만 출생년도와 함께 콕 집어, 독자가 자기 띠를 찾게 한다.
  - rules: Global Constraints의 형식 규칙을 문장으로 옮긴다.
    - 첫 줄은 띠 이름 없이 주제를 단언한다.
    - 띠마다 한 줄, 번호 없이 "돼지띠 (95·83·71·07년생): …"로 쓴다. [자료]의 띠와 연도만 쓴다.
    - 입춘 기준 안내를 "~일 수 있어"로 한 줄 쓴다.
    - "사주"나 "운세"를 한 번 넣는다.
    - 삼합·육합 같은 용어와 순위 표현을 쓰지 않는다.
    - 단정하지 않는다.
    - 마무리 한 줄로 저장·공유를 권한다.
    - 본문에 링크를 넣지 않는다.
- **EN 라벨 `ny_zodiac`:**
  - label `"2027 Zodiac Spotlight"`
  - 같은 규칙을 영어로 쓰되 EN 차이를 반영한다.
    - 첫 줄은 60자 이하 평서문이다.
    - 연도는 4자리다.
    - 입춘은 "Ipchun"으로 쓴다.
    - 2027을 "Year of the Fire Goat"로 소개할 수 있다.

- [ ] **Step 1: 실패하는 테스트 작성** (season.test.ts — 기존 35/30/20/15 비율 테스트와 EN 테스트를 아래로 교체·추가)

```ts
it("정점 구간 신년 칸의 유형 비율이 30/20/25/15/10", () => {
  const modes = Array.from({ length: 250 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i)).filter(Boolean);
  const share = (id: string) => modes.filter((m) => m === id).length / modes.length;
  expect(share("ny_zodiac")).toBeCloseTo(0.3, 2);
  expect(share("ny_ranking")).toBeCloseTo(0.2, 2);
  expect(share("ny_ipchun")).toBeCloseTo(0.25, 2);
  expect(share("ny_monthly")).toBeCloseTo(0.15, 2);
  expect(share("ny_pick")).toBeCloseTo(0.1, 2);
});
it("번호 선택지 상한이 차도 연속 유형 중복이 없다", () => {
  const modes = Array.from({ length: 100 }, (_, i) => slot("cosmicpath", "2027-01-10T12:00:00", i, true)).filter(Boolean);
  expect(modes).not.toContain("ny_pick");
  modes.slice(1).forEach((m, i) => expect(m).not.toBe(modes[i]));
});
it("EN은 zodiac 50%, ranking·monthly 없음, 상한이면 pick 없음", () => {
  const en = (capped: boolean) => Array.from({ length: 200 }, (_, i) => slot("cosmicpath-global", "2027-01-10T12:00:00", i, capped)).filter(Boolean);
  expect(en(false).filter((m) => m === "ny_zodiac")).toHaveLength(25);
  expect(new Set(en(false))).toEqual(new Set(["ny_zodiac", "ny_ipchun", "ny_pick"]));
  expect(en(true)).not.toContain("ny_pick");
});
it("연달아 나온 두 띠 글은 주제가 다르다 (KO 초반·정점, EN)", () => {
  for (const [brand, at] of [["cosmicpath", "2026-12-01T12:00:00"], ["cosmicpath", "2027-01-10T12:00:00"], ["cosmicpath-global", "2027-01-10T12:00:00"]] as const) {
    const topics = Array.from({ length: 800 }, (_, i) => i).filter((i) => slot(brand, at, i) === "ny_zodiac").map((i) => zodiacTopicFor(i).id);
    expect(topics.length).toBeGreaterThan(10);
    topics.slice(1).forEach((t, i) => expect(t).not.toBe(topics[i]));
    expect(new Set(topics).size).toBe(8);
  }
});
it("isNewYearModeId(ny_zodiac)", () => {
  expect(isNewYearModeId("ny_zodiac")).toBe(true);
});
```

기존 EN 테스트 "EN은 값 검사가 없는 ny_ranking·ny_monthly를 쓰지 않고…"는 사실이 바뀌었으므로 위 EN 테스트로 대체한다. 연속 유형 검사(uncapped)는 위 테스트에 포함되거나 기존 것을 유지한다.

content.test.ts에 추가:

```ts
it("buildNewYearBrief·checkNewYearFacts가 ny_zodiac을 띠 함수로 보낸다", () => {
  expect(buildNewYearBrief("ny_zodiac", "ko", 5)).toContain("돼지띠");
  expect(checkNewYearFacts(KO_OK, "ny_zodiac", 5)).toEqual([]);
  expect(checkNewYearFacts(KO_OK.replace("말띠 (02·90·78년생)", "쥐띠 (96·84·72년생)"), "ny_zodiac", 5)).not.toEqual([]);
  expect(checkNewYearFacts(EN_OK, "ny_zodiac", 5)).toEqual([]); // 2007 같은 출생년도를 연도 위반으로 보지 않음
});
it("ny_zodiac KO·EN 모드가 등록돼 있다", () => {
  expect(NEW_YEAR_MODES.ny_zodiac.id).toBe("ny_zodiac");
  expect(ENGLISH_VIRAL_MODE_LABELS.ny_zodiac.label).toBe("2027 Zodiac Spotlight");
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/new-year/` → FAIL (비율·EN·ny_zodiac 미등록)
- [ ] **Step 3: 구현** — 위 Interfaces 그대로.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/new-year/ src/lib/viral-intent-modes.test.ts` 그리고 `npm run typecheck`
- [ ] **Step 5: 커밋**

```bash
git add src/lib/new-year/new-year-season.ts src/lib/new-year/new-year-season.test.ts src/lib/new-year/new-year-content.ts src/lib/new-year/new-year-content.test.ts src/lib/viral-intent-modes.ts
git commit -m "feat: 신년 띠 글 유형 등록과 배정 비율 조정"
```

---

### Task 4: 생성 연결, 스크립트 목록, 통합 테스트

**Files:**
- Modify: `src/lib/generate-posts.ts`
  - 실험 타입 두 곳(약 99행, 약 295행)에 `newYearSlotIndex?: number` 추가
  - 약 1190행에서 값 설정
  - 약 351행 `checkNewYearFacts(post, experiment.newYearMode, experiment.newYearSlotIndex ?? 0)`
- Modify: `scripts/new-year-report.mjs` (`NY_TYPES`), `scripts/analyze-post-response.mjs` (`NEW_YEAR_MODE_IDS`). 두 목록에 `"ny_zodiac"`을 추가한다.
- Test: `src/lib/generate-posts-new-year.test.ts`, 새 `src/lib/new-year/new-year-scripts.test.ts`

**Interfaces:**
- Consumes: `checkNewYearFacts(post, modeId, slotIndex)` (Task 3), `NEW_YEAR_MODE_IDS`

- [ ] **Step 1: 실패하는 테스트 작성**

generate-posts-new-year.test.ts에 추가한다.
- **slotIndex 계산:** 정점 KO, `postCount = 5`이면 첫 칸이 `slotIndex 5`이고 nth 2라서 `ny_zodiac`이다. 주제는 harmony다.
- **fixture 문구:** fixture는 기존 게이트(사주 키워드·전문용어 상한·첫 줄 규칙·읽기 규칙)를 모두 통과해야 한다. 게이트에 걸리면 규칙이 아니라 fixture 문구를 고친다.

```ts
const NY_ZODIAC_REPLY = "2027년, 사람이 들어오기 쉬운 띠가 있어\n\n띠로 보는 사주 이야기야\n돼지띠 (95·83·71·07년생): 사람이 들어오기 쉬운 해\n토끼띠 (99·87·75년생): 새 인연이 붙기 쉬운 해\n말띠 (02·90·78년생): 사람이 늘기 쉬운 해\n\n사주에선 입춘(2월 4일)부터 띠를 바꿔 봐서 1월~2월 초생이면 앞 해 띠일 수 있어\n가족 띠도 찾아서 보내 줘";

it("정점 KO의 띠 칸은 그 칸 주제의 띠 글을 저장한다", async () => {
  vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
  state.postCount = 5;
  state.reply = NY_ZODIAC_REPLY;
  await generatePostsForBrand(cosmicBrand, input);
  expect(state.created.map((p) => p.formulaId)).toEqual(["ny_zodiac"]);
  expect(state.requests.join("\n")).toContain("돼지띠");
});
it("띠 칸에 다른 주제 띠를 쓴 초안은 저장되지 않는다 (slotIndex가 값 검사에 전달됨)", async () => {
  vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
  state.postCount = 5;
  state.reply = NY_ZODIAC_REPLY.replace("말띠 (02·90·78년생)", "쥐띠 (96·84·72년생)");
  await generatePostsForBrand(cosmicBrand, input).catch(() => null);
  expect(state.created.filter((p) => p.formulaId === "ny_zodiac")).toHaveLength(0);
});
```

new-year-scripts.test.ts:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEW_YEAR_MODE_IDS } from "./new-year-season";

describe("스크립트의 신년 유형 목록", () => {
  it.each(["scripts/new-year-report.mjs", "scripts/analyze-post-response.mjs"])("%s가 모든 신년 유형을 안다", (file) => {
    const text = readFileSync(file, "utf8");
    for (const id of NEW_YEAR_MODE_IDS) expect(text, `${file}: ${id}`).toContain(`"${id}"`);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/generate-posts-new-year.test.ts src/lib/new-year/new-year-scripts.test.ts` → FAIL
  - 연결 전에는 값 검사가 `slotIndex` 0(money: 쥐·돼지)으로 판단해 토끼·말 줄을 거부한다. 그래서 **첫 번째 테스트가 실패해야 한다**. 이게 연결이 됐다는 증거다.
  - 두 번째 테스트는 연결 전에도 통과할 수 있다(회귀 방지용).
  - 스크립트 테스트는 목록에 `ny_zodiac`이 없어서 실패한다.
- [ ] **Step 3: 구현** — 위 Files 그대로.
- [ ] **Step 4: 전체 검증** — `npx vitest run src/lib/generate-posts-new-year.test.ts src/lib/new-year/` → PASS. 이어서 `npm test`, `npm run typecheck`, 변경 파일 eslint → 전부 통과(기존 무관 경고 제외)
- [ ] **Step 5: 커밋**

```bash
git add src/lib/generate-posts.ts src/lib/generate-posts-new-year.test.ts src/lib/new-year/new-year-scripts.test.ts scripts/new-year-report.mjs scripts/analyze-post-response.mjs
git commit -m "feat: 신년 띠 글을 생성 루프·리포트 스크립트에 연결"
```

---

## 머지 후 확인 (push·배포는 사용자 승인 후)

- 시즌 시작(11/24) 전에는 신년 칸이 배정되지 않으므로 운영 영향이 없다. 11/24 이후 첫 띠 글이 저장되는지, `scripts/new-year-report.mjs` 결과에 `ny_zodiac`이 따로 집계되는지 확인한다.
