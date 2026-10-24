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
  일주: "일주(?!일)", // 일주일
  관성: "(?<!습)관성", // 습관성
  식상: "식상(?![하한])", // 식상하다/식상한 멘트
  비견: "비견(?!되|됨)", // 비견되다
  일간: "일간(?!지)", // 일간지
  정관: "정관(?!\\s*수술)", // 정관 수술
  대운: "대운(?!하)", // 대운하
  신약: "신약(?!\\s*개발)", // 신약 개발
};

const TERM_PATTERNS: ReadonlyArray<{ term: string; re: RegExp }> = SAJU_JARGON_TERMS.map((term) => ({
  term,
  re: new RegExp(TERM_GUARDS[term] ?? term),
}));

const READER_SAJU_RE = /(네|너의?|니|본인|당신의?)\s*사주/;

// Every Hangul syllable with a ㅆ final (했 갔 봤 줬 었 았 였 ...): past-tense contractions.
// 있 (present: "시간 있어") and 겠 (future: "고르겠어") also end in ㅆ but are not past tense, so they are excluded.
const NON_PAST_SS = new Set(["있", "겠"]);
const PAST_SYLLABLES = Array.from({ length: 19 * 21 }, (_, i) => String.fromCharCode(0xac00 + i * 28 + 20))
  .filter((ch) => !NON_PAST_SS.has(ch))
  .join("");
const INVENTED_STORY_RE = new RegExp(`(^|\\s)(난|나도|나는|내가)\\s[^\\n]{0,60}(다가|[${PAST_SYLLABLES}][음어다])`);

export function findJargonTerms(text: string): string[] {
  return TERM_PATTERNS.filter(({ re }) => re.test(text)).map(({ term }) => term);
}

function lastQuestionSentence(post: string): string | null {
  const end = post.lastIndexOf("?");
  if (end === -1) return null;
  const before = post.slice(0, end);
  const start = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"));
  return post.slice(start + 1, end + 1);
}

export function checkReadabilityRules(post: string, firstComment: string): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const terms = findJargonTerms(post);
  if (terms.length >= 2) {
    reasons.push(`사주 용어 ${terms.length}개(${terms.join(", ")}): 1개까지만, 쓰면 바로 쉬운 말로 풀어줘`);
  }

  const commentText = firstComment
    .split("\n")
    .filter((line) => !/https?:\/\//.test(line))
    .join("\n");
  const question = lastQuestionSentence(post) ?? "";
  const unanswerable =
    findJargonTerms(question).length > 0 ||
    findJargonTerms(commentText).length > 0 ||
    READER_SAJU_RE.test(question) ||
    READER_SAJU_RE.test(commentText);
  if (unanswerable) {
    reasons.push("독자가 답할 수 없는 질문: 자기 경험만으로 답할 수 있게");
  }

  if (INVENTED_STORY_RE.test(commentText)) {
    reasons.push("첫 댓글에 지어낸 1인칭 경험담 금지");
  }

  return { pass: reasons.length === 0, reasons };
}
