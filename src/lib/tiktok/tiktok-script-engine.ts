import { type SajuCardData, pillarsForDayMaster } from "./saju-types";
import type { PickCardData, RankCardData } from "./render-spec-types";
import type { TikTokFormatId } from "./tiktok-draft-service";

export interface TikTokSceneBeat {
  sceneId: string;
  durationSeconds: number;
  type: "kinetic-card" | "saju-card" | "placeholder" | "image" | "rank-card" | "pick-card";
  spokenLine: string;
  onScreenText: string[];
  visualProps?: {
    hookText?: string;
    subText?: string;
    badge?: string;
    colorScheme?: "neon-yellow" | "electric-purple" | "fire-red";
    sajuData?: SajuCardData;
    rankCard?: RankCardData;
    pickCard?: PickCardData;
  };
}

export interface TikTokScriptResult {
  // 없으면 tiktok_explainer_vertical (기존 드래프트 호환)
  formatId?: TikTokFormatId;
  title: string;
  spokenHook: string;
  fullScript: string;
  totalDurationSeconds: number;
  scenes: TikTokSceneBeat[];
  cta: string;
  hashtags: string[];
  qualityScore: number;
  qualityPass: boolean;
  qualityReasons?: string[];
}

export interface ScriptGenerationParams {
  topic: string;
  targetAudience?: string;
  dayMaster?: string; // e.g. "갑목", "병화", "무토"
  tone?: "urgent" | "mysterious" | "encouraging";
}

// 훅은 일간의 성향을 "왜?"로 묻고(Pull), 2번 장면이 그 일간의 상징으로 바로 답한다(Truth).
// 모든 일간에 똑같이 붙는 운세 약속(재물운 반등·귀인 등)은 쓰지 않는다.
interface DayMasterProfile {
  hook: string; // "{일간} 일간이 ___" 뒤에 붙는 질문
  symbol: string; // 2번 장면의 답 — 품질 게이트가 이 단어로 답을 확인한다
  nature: string; // "{일간} 일간은 ___"
  strength: string;
}

const DAY_MASTER_PROFILES: Record<string, DayMasterProfile> = {
  갑목: { hook: "한번 정하면 잘 안 굽히는 이유", symbol: "큰 나무", nature: "큰 나무예요. 위로 곧게 자라는 기운이라, 방향을 정하면 돌아가기보다 밀고 나가요.", strength: "곧은 추진력 · 책임감" },
  을목: { hook: "부드러워 보여도 끝까지 버티는 이유", symbol: "풀과 덩굴", nature: "풀과 덩굴이에요. 바람에 휘어도 꺾이지 않고, 틈을 찾아 결국 자리를 잡아요.", strength: "유연함 · 끈기" },
  병화: { hook: "기분이 얼굴에 다 드러나는 이유", symbol: "태양", nature: "태양이에요. 빛을 숨길 수 없는 기운이라, 감정도 생각도 밖으로 환하게 드러나요.", strength: "솔직함 · 분위기를 밝히는 힘" },
  정화: { hook: "가까운 사람한테 유독 세심한 이유", symbol: "촛불", nature: "촛불이에요. 멀리보다 가까운 곳을 오래 밝히는 기운이라, 곁에 있는 사람을 꼼꼼히 챙겨요.", strength: "섬세함 · 따뜻한 집중력" },
  무토: { hook: "웬만해선 흔들리지 않는 이유", symbol: "큰 산", nature: "큰 산이에요. 묵직하게 자리를 지키는 기운이라, 주변이 흔들려도 중심을 잡아요.", strength: "듬직함 · 신뢰" },
  기토: { hook: "남 챙기다 내 몫을 놓치는 이유", symbol: "논밭의 흙", nature: "논밭의 흙이에요. 씨앗을 품어 키우는 기운이라, 사람과 일을 먼저 돌보게 돼요.", strength: "포용력 · 키워내는 힘" },
  경금: { hook: "맺고 끊음이 칼 같은 이유", symbol: "바위와 원석", nature: "바위와 원석이에요. 단단하고 날이 선 기운이라, 아닌 건 아니라고 분명히 잘라요.", strength: "결단력 · 의리" },
  신금: { hook: "기준이 높아 쉽게 만족 못 하는 이유", symbol: "보석", nature: "다듬어진 보석이에요. 작은 흠도 보이는 기운이라, 스스로에게도 기준이 높아요.", strength: "안목 · 완성도" },
  임수: { hook: "생각이 끝없이 넓어지는 이유", symbol: "큰 강과 바다", nature: "큰 강과 바다예요. 멈추지 않고 흐르는 기운이라, 생각이 한곳에 머물지 않고 넓게 퍼져요.", strength: "넓은 시야 · 지략" },
  계수: { hook: "말 안 해도 분위기를 먼저 읽는 이유", symbol: "빗물과 이슬", nature: "빗물과 이슬이에요. 조용히 스며드는 기운이라, 말보다 공기의 변화를 먼저 느껴요.", strength: "직관 · 공감력" },
};

// 모르는 일간: 문구는 만들되 답(상징)이 없으므로 게이트에서 떨어진다.
const UNKNOWN_PROFILE: DayMasterProfile = { hook: "가진 성향", symbol: "", nature: "", strength: "" };

const HOOK_MAX_CHARS = 30; // 3.5초 안에 읽히는 길이
const GAP_PATTERN = /이유|\?/;
const OVERPROMISE_PATTERN = /절대|반드시|무조건|놓치지\s*마|경고|대박|급상승|100%|확실히|귀인\s*발탁|재물운\s*반등|운명의\s*전환점/;

export interface ExplainerQuality {
  qualityScore: number;
  qualityPass: boolean;
  qualityReasons: string[];
}

export function evaluateExplainerQuality(
  script: Pick<TikTokScriptResult, "scenes" | "totalDurationSeconds">,
  dayMaster: string
): ExplainerQuality {
  const profile = DAY_MASTER_PROFILES[dayMaster];
  const hook = script.scenes[0]?.onScreenText[0] ?? "";
  const payoff = script.scenes[1]?.spokenLine ?? "";
  const allText = script.scenes.flatMap((scene) => [scene.spokenLine, ...scene.onScreenText]).join(" ");
  const overpromise = allText.match(OVERPROMISE_PATTERN)?.[0];

  const checks: [boolean, string][] = [
    [Boolean(profile), `일간 해설 데이터 없음: "${dayMaster}" 훅의 답을 줄 수 없음 (Truth)`],
    [hook.includes(dayMaster) && GAP_PATTERN.test(hook), "훅이 그 일간에게 질문을 열지 않음 (Pull)"],
    [hook.length <= HOOK_MAX_CHARS, `훅이 ${HOOK_MAX_CHARS}자를 넘어 첫 장면에 다 안 읽힘 (Pull)`],
    [Boolean(profile?.symbol) && payoff.includes(profile.symbol), "훅의 답이 바로 다음 장면에 없음 (Truth)"],
    [!overpromise, `과장·막연한 떡밥 문구: "${overpromise}" (Truth)`],
    [script.totalDurationSeconds >= 15 && script.totalDurationSeconds <= 30, "길이가 15~30초를 벗어남"],
  ];

  const qualityReasons = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
  return {
    qualityScore: Math.round((100 * (checks.length - qualityReasons.length)) / checks.length),
    qualityPass: qualityReasons.length === 0,
    qualityReasons,
  };
}

export function generateTikTokScript(params: ScriptGenerationParams): TikTokScriptResult {
  const { dayMaster = "병화", tone = "mysterious" } = params;
  const profile = DAY_MASTER_PROFILES[dayMaster] ?? UNKNOWN_PROFILE;

  // 1. Scene 1: 질문을 여는 훅 (일간별로 다름)
  const hookText = `${dayMaster} 일간이 ${profile.hook}`;
  const hookSpoken = `${hookText}, 사주로 보면 바로 보여요.`;

  // 2. Scene 2: 훅의 답 — 일간의 상징
  const scene2Spoken = `${dayMaster} 일간은 ${profile.nature}`;

  // 3. Scene 3: 명식 예시 — 일주 천간이 이 일간과 같아야 한다
  const scene3Spoken = `명식에서 일주 윗글자가 바로 '나'예요. 여기가 ${dayMaster} 일간이면, 강점은 ${profile.strength}.`;
  const sajuData: SajuCardData = {
    title: `${dayMaster} 일간 명식 예시`,
    subtitle: "일주 윗글자가 '나'예요",
    dayMaster,
    destinyKeyword: profile.strength,
    pillars: pillarsForDayMaster(dayMaster),
  };

  // 4. Scene 4: Soft CTA (전환 유도)
  const cta = "내 일간은 프로필 링크에서 1분이면 나와요.";
  const scene4Spoken = "내 일간이 뭔지 모르겠다면, 프로필 링크에서 1분이면 확인할 수 있어요.";

  const scenes: TikTokSceneBeat[] = [
    {
      sceneId: "scene-01-hook",
      durationSeconds: 3.5,
      type: "kinetic-card",
      spokenLine: hookSpoken,
      onScreenText: [hookText],
      visualProps: {
        hookText,
        subText: "사주 일간으로 보면 보여요",
        badge: `🔮 ${dayMaster} 일간`,
        colorScheme: tone === "urgent" ? "fire-red" : "electric-purple",
      },
    },
    {
      sceneId: "scene-02-answer",
      durationSeconds: 5.5,
      type: "placeholder",
      spokenLine: scene2Spoken,
      onScreenText: [`${dayMaster} = ${profile.symbol}`],
      visualProps: {
        hookText: profile.symbol,
      },
    },
    {
      sceneId: "scene-03-saju-card",
      durationSeconds: 7.0,
      type: "saju-card",
      spokenLine: scene3Spoken,
      onScreenText: ["일주 윗글자 = 나", profile.strength],
      visualProps: {
        sajuData,
      },
    },
    {
      sceneId: "scene-04-cta",
      durationSeconds: 4.0,
      type: "kinetic-card",
      spokenLine: scene4Spoken,
      onScreenText: [cta],
      visualProps: {
        hookText: "내 일간 확인하기",
        subText: "프로필 링크에서 1분",
        badge: "✨ 내 일간 찾기",
        colorScheme: "neon-yellow",
      },
    },
  ];

  const fullScript = scenes.map((s) => s.spokenLine).join(" ");
  const totalDurationSeconds = scenes.reduce((acc, s) => acc + s.durationSeconds, 0);

  return {
    title: `${dayMaster} 일간 해설: ${profile.hook}`,
    spokenHook: hookSpoken,
    fullScript,
    totalDurationSeconds,
    scenes,
    cta,
    hashtags: ["사주", "일간", `${dayMaster}일간`, "사주풀이", "운세"],
    ...evaluateExplainerQuality({ scenes, totalDurationSeconds }, dayMaster),
  };
}

// ---------------------------------------------------------------------------
// Instagram Reels (수동 업로드) — docs/experiments/2026-10-22-ig-reels-format.md
// 음악·내레이션 없음. CTA는 선택형만: 키워드 DM·"댓글 달면 해석" 금지.
// ---------------------------------------------------------------------------
export const IG_REELS_CTA = "저장해 두고 A/B/C 중 하나 골라 댓글";
const FORBIDDEN_CTA_PATTERN = /DM|댓글\s*달면/i;
const IG_DEFAULT_HASHTAGS = ["사주", "운세", "일간"];
const PICK_CARD_LABELS = ["A", "B", "C"] as const;

function assertAllowedCta(cta: string): void {
  if (FORBIDDEN_CTA_PATTERN.test(cta)) {
    throw new Error(`금지된 CTA 문구입니다 (키워드 DM·"댓글 달면" 류): ${cta}`);
  }
}

function buildIgScriptResult(
  formatId: TikTokFormatId,
  title: string,
  scene: TikTokSceneBeat,
  cta: string,
  hashtags: string[]
): TikTokScriptResult {
  return {
    formatId,
    title,
    spokenHook: title,
    fullScript: "",
    totalDurationSeconds: scene.durationSeconds,
    scenes: [scene],
    cta,
    hashtags,
    qualityScore: 100,
    qualityPass: true,
  };
}

export interface IgRankScriptParams {
  title: string;
  items: string[]; // 정확히 5개 (일간·띠 등 텍스트)
  cta?: string;
  hashtags?: string[];
}

export function buildIgRankScript(params: IgRankScriptParams): TikTokScriptResult {
  const { title, items, cta = IG_REELS_CTA, hashtags = IG_DEFAULT_HASHTAGS } = params;
  if (items.length !== 5) throw new Error(`랭킹 항목은 5개여야 합니다 (현재 ${items.length}개)`);
  assertAllowedCta(cta);
  const scene: TikTokSceneBeat = {
    sceneId: "scene-01-rank",
    durationSeconds: 10,
    type: "rank-card",
    spokenLine: "",
    onScreenText: [title, ...items],
    visualProps: { rankCard: { title, items } },
  };
  return buildIgScriptResult("ig_rank_10s", title, scene, cta, hashtags);
}

export interface IgPickCardScriptParams {
  question: string;
  cards: [string, string, string]; // A/B/C 카드 문구
  cta?: string;
  hashtags?: string[];
}

export function buildIgPickCardScript(params: IgPickCardScriptParams): TikTokScriptResult {
  const { question, cards, cta = IG_REELS_CTA, hashtags = IG_DEFAULT_HASHTAGS } = params;
  assertAllowedCta(cta);
  const pickCard: PickCardData = {
    question,
    cards: cards.map((text, index) => ({ label: PICK_CARD_LABELS[index] ?? "A", text })),
    cta,
    ctaAtSeconds: 12,
  };
  const scene: TikTokSceneBeat = {
    sceneId: "scene-01-pick",
    durationSeconds: 16,
    type: "pick-card",
    spokenLine: "",
    onScreenText: [question, cta],
    visualProps: { pickCard },
  };
  return buildIgScriptResult("ig_pickcard_16s", question, scene, cta, hashtags);
}
