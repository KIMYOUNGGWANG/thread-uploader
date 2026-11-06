// Deterministic readability checks for Korean saju posts (saju_viral profile).
// Everyday words (사주·팔자·운세·궁합, 상관·인성·지지·천간, 60갑자 names) and collision-prone
// terms (세운 = "세운 계획", 사주원국 = double count with 원국) are deliberately left out.
export const SAJU_JARGON_TERMS: readonly string[] = [
  "편인", "식신", "재성", "관성", "비견", "겁재", "정인", "편관", "정관", "정재", "편재", "식상", "비겁",
  "도화살", "역마살", "화개살", "홍염살", "원진살", "귀문관살",
  "천을귀인", "문창귀인", "월덕귀인",
  "원국", "대운", "일간", "일주", "신강", "신약", "용신", "교운기", "삼합", "방합",
];

// Terms that collide with everyday words get a guard (regex source) so the everyday sense is not counted.
const TERM_GUARDS: Readonly<Record<string, string>> = {
  일주: "(?<!(?:세계|전국|국토)\\s?)일주(?![일년])", // 일주일, 세계일주
  관성: "(?<!습)관성", // 습관성
  식상: "식상(?![하한])", // 식상하다/식상한 멘트
  비견: "비견(?!되|됨)", // 비견되다
  일간: "일간(?!지)", // 일간지
  정관: "(?<!고)정관(?!\\s*수술)", // 고정관념, 정관 수술
  대운: "대운(?!하)", // 대운하
  신약: "신약(?!\\s*개발)", // 신약 개발
  편인: "편인(?![데지가]|\\s*(?:거|걸|것|듯|사람|쪽))", // 빠른 편인 사람, 하는 편인지/편인데
  비겁: "비겁(?![하한해했함])", // 비겁하게/비겁한
};

const TERM_PATTERNS: ReadonlyArray<{ term: string; re: RegExp }> = SAJU_JARGON_TERMS.map((term) => ({
  term,
  re: new RegExp(TERM_GUARDS[term] ?? term),
}));

const READER_SAJU_RE = /(^|[^가-힣])(네|너의?|니|본인|당신의?)\s*사주/; // left boundary: "그렇네 사주", "보니 사주"

// Every Hangul syllable with a ㅆ final (했 갔 봤 줬 었 았 였 ...): past-tense contractions.
// 있 (present: "시간 있어") and 겠 (future: "고르겠어") also end in ㅆ but are not past tense, so they are excluded.
const NON_PAST_SS = new Set(["있", "겠"]);
const PAST_SYLLABLES = Array.from({ length: 19 * 21 }, (_, i) => String.fromCharCode(0xac00 + i * 28 + 20))
  .filter((ch) => !NON_PAST_SS.has(ch))
  .join("");
// Stops at a sentence end so "난 2번. 너는 골랐어?" is not one claim, and a past ending right before "?" is a question to the reader.
const INVENTED_STORY_RE = new RegExp(`(^|\\s)(난|나도|나는|내가)\\s[^\\n.!?？]{0,60}(다가|[${PAST_SYLLABLES}][음어다](?![?？]))`);

export function findJargonTerms(text: string): string[] {
  return TERM_PATTERNS.filter(({ re }) => re.test(text)).map(({ term }) => term);
}

function lastQuestionSentence(post: string): string | null {
  // Line 1 is the hook (beginner_qa must open with a question), so the closing question is looked for after it.
  const body = post.trim().split("\n").slice(1).join("\n");
  const end = body.lastIndexOf("?");
  if (end === -1) return null;
  const before = body.slice(0, end);
  const start = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"));
  return body.slice(start + 1, end + 1);
}

// A saju account telling readers to skip fortunes ("운세 볼 시간에 숫자부터 세라") argues against its own feed:
// the 2026-11 posts that read this way all sat at one reaction.
const FORTUNE_DISMISSAL_RE = /(운세|사주)\s*(볼|보는|확인할)\s*시간에|운세\s*탓(이)?\s*아|운세보다\s*[^\n.]{0,12}(먼저|부터)/;
// Homework endings ("세 개만 적어", "오늘 할 일:") give nothing to save, share or tag; the breakout posts end on a punchline.
const HOMEWORK_RE = /오늘\s*할\s*일|(적어|세어|메모해|기록해|체크해|정리해)\s*(봐|둬|놔|보자)|(적어|세라)(?=[\s.!]|$)|세봐라?(?=[\s.!]|$)/;
const HOMEWORK_TAIL_LINES = 3;

export function findLectureReason(post: string): string | null {
  const dismissal = post.match(FORTUNE_DISMISSAL_RE);
  if (dismissal) return `운세·사주를 깎아내리는 훈계("${dismissal[0]}"): 사주 계정이 사주 보지 말라고 하지 마`;
  const tail = post.split("\n").filter((line) => line.trim() !== "").slice(-HOMEWORK_TAIL_LINES).join("\n");
  const homework = post.match(/오늘\s*할\s*일/) ?? tail.match(HOMEWORK_RE);
  if (homework) return `숙제형 마무리("${homework[0]}"): 할 일 대신 판정을 세게 박는 한 줄이나 독자가 바로 답할 질문으로 끝내`;
  return null;
}

export interface ReadabilityOptions {
  // concept_hierarchy ranks 2-3 terms of one kind ("도화보다 센 홍염보다 센 화개"); everything else keeps 1.
  maxJargonTerms?: number;
}

export function checkReadabilityRules(post: string, firstComment: string, options: ReadabilityOptions = {}): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const maxTerms = options.maxJargonTerms ?? 1;

  const terms = findJargonTerms(post);
  if (terms.length > maxTerms) {
    reasons.push(`사주 용어 ${terms.length}개(${terms.join(", ")}): ${maxTerms}개까지만, 쓰면 바로 쉬운 말로 풀어줘`);
  }

  const lecture = findLectureReason(post);
  if (lecture) reasons.push(lecture);

  const commentText = firstComment
    .split("\n")
    .filter((line) => !/https?:\/\//.test(line))
    .join("\n");
  const question = lastQuestionSentence(post) ?? "";
  const hits = [...new Set([...findJargonTerms(question), ...findJargonTerms(commentText)])];
  if (hits.length > 0 || READER_SAJU_RE.test(question) || READER_SAJU_RE.test(commentText)) {
    reasons.push(`독자가 답할 수 없는 질문(${hits.join(", ") || "사주 구조"}): 마지막 질문·첫 댓글엔 사주 용어 없이, 자기 경험만으로 답할 수 있게`);
  }

  if (INVENTED_STORY_RE.test(commentText)) {
    reasons.push("첫 댓글에 지어낸 1인칭 경험담 금지");
  }

  return { pass: reasons.length === 0, reasons };
}

// Template cap: a post that ends in numbered choices, or opens with "X가 아니라 Y", may fill at most
// TEMPLATE_CAP of the last TEMPLATE_WINDOW posts so the account does not read as one mold.
export const TEMPLATE_CAP = 3;
export const TEMPLATE_WINDOW = 10;

const CHOICE_LINE_RE = /^\s*([1-3]|[A-C])[.)]?\s/;
const REVERSAL_RE = /아니라|아님(?![가-힣])|이 아니고/;

// Drafts sometimes put a blank line between choice 1 and 2; numbered choices read as one block.
export function tightenChoiceLines(post: string): string {
  const lines = post.split("\n");
  return lines
    .filter((line, i) => {
      if (line.trim() !== "") return true;
      const prev = lines.slice(0, i).reverse().find((l) => l.trim() !== "");
      const next = lines.slice(i + 1).find((l) => l.trim() !== "");
      return !(prev && next && CHOICE_LINE_RE.test(prev) && CHOICE_LINE_RE.test(next));
    })
    .join("\n");
}

// A numbered list (4+ items: "1. … 6.") is the best format on saju Threads (2026-11-06 peer comparison: 2.55x the
// account's usual likes; ours 168 vs 89 views). It used to count as a "pick 1/2/3" ending and hit this cap.
const LIST_ITEM_4PLUS_RE = /^\s*(?:[4-9]|\d{2,})[.)]\s/m;

export function endsWithNumberedChoices(post: string): boolean {
  if (LIST_ITEM_4PLUS_RE.test(post)) return false;
  return post.split("\n").filter((line) => CHOICE_LINE_RE.test(line)).length >= 2;
}

export function opensWithReversal(post: string): boolean {
  return REVERSAL_RE.test(post.split("\n").slice(0, 2).join("\n"));
}

export function checkTemplateCap(post: string, recent: readonly { content: string }[]): { pass: boolean; reasons: string[] } {
  const window = recent.slice(0, TEMPLATE_WINDOW);
  const reasons: string[] = [];
  const choices = window.filter((r) => endsWithNumberedChoices(r.content)).length;
  if (choices >= TEMPLATE_CAP && endsWithNumberedChoices(post)) {
    reasons.push(`최근 ${TEMPLATE_WINDOW}개 중 번호 선택지 글이 이미 ${choices}개: 다른 마무리로`);
  }
  const reversals = window.filter((r) => opensWithReversal(r.content)).length;
  if (reversals >= TEMPLATE_CAP && opensWithReversal(post)) {
    reasons.push(`최근 ${TEMPLATE_WINDOW}개 중 'X가 아니라 Y' 첫 줄이 이미 ${reversals}개: 다른 훅으로 (비교가 필요하면 '~보다'로)`);
  }
  return { pass: reasons.length === 0, reasons };
}
