// Brand topic lists written into brandConfig.topics by /api/cron/apply-topic-plan.
// 2026-11-06 peer comparison (docs/research/2026-11-06-competitor-post-comparison.md):
// - KR saju accounts (76, 499 posts): love 24%, money 23%, timing 38%, luck rituals 16%, career 9%, decisions 16%.
//   Ours: decisions 61%, career 48%, luck 4%. The old topics were product framings ("~할지 판정", "기준").
//   They stay one topic out of fourteen; the product angle lives in the link comment.
// - EN astrology accounts (64, 371 posts): 51% start from a Western sign or element group (1.6x likes), 1% Eastern.
export const COSMICPATH_TOPICS: readonly string[] = [
  // 연애·궁합 (4)
  "도화·홍염·화개: 연애에서 사람 끄는 매력 살 3종",
  "헤어져도 다시 돌아오는 인연이 있는 사주",
  "일간별 연애 스타일과 끌리는 상대",
  "놓치면 안 되는 궁합: 천을귀인으로 만난 사이",
  // 돈 (3)
  "진술축미 돈 창고와 창고 문이 열리는 시기",
  "돈이 붙는 사주 특징: 식신생재와 재성",
  "띠별 2027 정미년 재물 흐름",
  // 시기 (3)
  "입동부터 대설까지 띠별·일간별 흐름",
  "2027 정미년 미리보기: 풀리는 띠와 조심할 띠",
  "대운 바뀌기 직전 나타나는 신호",
  // 개운·행운 (2)
  "일간별 개운법: 나한테 맞는 색·방향·습관",
  "귀인이 들어오는 사람의 공통점: 천을귀인·문창귀인",
  // 기질 (1)
  "혼자 있어야 충전되는 사주: 화개와 인성",
  // 일·재능 (1)
  "공부 머리 vs 일 머리: 인성과 식상",
];

export const COSMICPATH_GLOBAL_TOPICS: readonly string[] = [
  "Water signs (Cancer, Scorpio, Pisces) and what Korean saju adds to their chart",
  "Fire signs who burn out first, and what Korean saju looks at",
  "Your big three, plus the Korean birth-year animal you didn't know you had",
  "Saturn return at 29 and the Korean 10-year luck cycle",
  "Earth signs and money: what Korean saju says about saving",
  "Air signs in love: the Korean compatibility check",
  "Scorpio season and the Korean winter month that starts Nov 7",
  "2027 Fire Goat year: what Korean saju says for each zodiac animal",
];

export const TOPIC_PLANS: Readonly<Record<string, readonly string[]>> = {
  cosmicpath: COSMICPATH_TOPICS,
  "cosmicpath-global": COSMICPATH_GLOBAL_TOPICS,
};
