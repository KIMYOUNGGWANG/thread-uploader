import { type SajuCardData, DEFAULT_SAJU_PILLARS } from "./saju-types";
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
}

export interface ScriptGenerationParams {
  topic: string;
  targetAudience?: string;
  dayMaster?: string; // e.g. "갑목", "병화", "무토"
  tone?: "urgent" | "mysterious" | "encouraging";
}

export function generateTikTokScript(params: ScriptGenerationParams): TikTokScriptResult {
  const { topic, targetAudience = "2030 직장인", dayMaster = "병화", tone = "mysterious" } = params;

  // 1. Scene 1: 3-Second Visual & Spoken Hook
  const hookBadge = tone === "urgent" ? "🚨 올해 운세 경고" : "🔮 2026 하반기 대운";
  const hookText = `${dayMaster} 일주, 이번 달 절대 놓치지 마세요`;
  const hookSub = "사주에 숨겨진 천을귀인이 움직이기 시작합니다";
  const hookSpoken = `만약 본인이나 주변에 ${dayMaster} 일주가 있다면, 올해 하반기 흐름을 반드시 확인하셔야 합니다.`;

  // 2. Scene 2: Problem & Agitation (고민/상황 심화)
  const scene2Spoken = `그동안 유독 일이 꼬이거나 인간관계에서 상처받으셨다면, 당신의 잘못이 아니라 사주 대운의 환절기를 지나고 계셨기 때문입니다.`;
  const scene2OnScreen = ["왜 상반기엔 답답했을까?", "대운의 환절기 영향"];

  // 3. Scene 3: Saju Core Revelation (만세력 오행 카드뉴스 표출)
  const scene3Spoken = `하지만 이번 달부터는 막혀있던 재물과 귀인 기운이 풀리며, 인생의 중요한 전환점을 맞이하게 됩니다.`;
  const sajuData: SajuCardData = {
    title: `${dayMaster} 하반기 명식 흐름`,
    subtitle: `${targetAudience} 맞춤 운세 분석`,
    dayMaster,
    destinyKeyword: "재물운 반등 · 귀인 발탁",
    pillars: DEFAULT_SAJU_PILLARS,
  };

  // 4. Scene 4: Soft CTA (전환 유도)
  const cta = "프로필 링크에서 내 정확한 만세력 오행을 1분 만에 확인해보세요.";
  const scene4Spoken = `나만의 정확한 사주 오행과 귀인 시기를 알고 싶다면, 프로필 링크에서 지금 바로 확인해보세요.`;

  const scenes: TikTokSceneBeat[] = [
    {
      sceneId: "scene-01-hook",
      durationSeconds: 3.5,
      type: "kinetic-card",
      spokenLine: hookSpoken,
      onScreenText: [hookText],
      visualProps: {
        hookText,
        subText: hookSub,
        badge: hookBadge,
        colorScheme: tone === "urgent" ? "fire-red" : "electric-purple",
      },
    },
    {
      sceneId: "scene-02-agitation",
      durationSeconds: 5.5,
      type: "placeholder",
      spokenLine: scene2Spoken,
      onScreenText: scene2OnScreen,
      visualProps: {
        hookText: "운명의 전환점",
      },
    },
    {
      sceneId: "scene-03-saju-card",
      durationSeconds: 7.0,
      type: "saju-card",
      spokenLine: scene3Spoken,
      onScreenText: ["핵심 대운 분석"],
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
        hookText: "내 만세력 무료 분석",
        subText: "프로필 링크에서 1분 확인",
        badge: "✨ 무료 테스트",
        colorScheme: "neon-yellow",
      },
    },
  ];

  const fullScript = scenes.map((s) => s.spokenLine).join(" ");
  const totalDurationSeconds = scenes.reduce((acc, s) => acc + s.durationSeconds, 0);

  // Quality check algorithm
  const qualityScore = Math.min(
    100,
    (hookSpoken.length > 10 ? 30 : 10) +
    (totalDurationSeconds >= 15 && totalDurationSeconds <= 30 ? 40 : 20) +
    (scenes.length === 4 ? 30 : 15)
  );

  return {
    title: `${dayMaster} 일주 2026 하반기 대운 분석`,
    spokenHook: hookSpoken,
    fullScript,
    totalDurationSeconds,
    scenes,
    cta,
    hashtags: ["사주", "운세", "2026운세", `${dayMaster}일주`, "재물운", "틱톡운세"],
    qualityScore,
    qualityPass: qualityScore >= 80,
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
