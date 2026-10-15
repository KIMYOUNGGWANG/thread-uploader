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

export interface ZiweiFocus { palace: string; meaningKo: string; meaningEn: string; stars: readonly string[]; quan: boolean }

// A palace may have no main star (it borrows from the opposite palace); then the star part is dropped.
export function ziweiNote(lang: PromoLang, topic: PromoTopic, focus: ZiweiFocus): string {
  const head = lang === "ko"
    ? `${TOPIC_LABEL.ko[topic]} 질문 → ${focus.palace}(${focus.meaningKo})`
    : `${TOPIC_LABEL.en[topic]} question → ${focus.meaningEn} palace`;
  if (focus.stars.length === 0) return head;
  const power = focus.quan ? (lang === "ko" ? " 화권" : " (Power)") : "";
  return `${head} · ${focus.stars.join(", ")}${power}`;
}
