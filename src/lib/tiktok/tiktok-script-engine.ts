import { type SajuCardData, DEFAULT_SAJU_PILLARS } from "./saju-types";

export interface TikTokSceneBeat {
  sceneId: string;
  durationSeconds: number;
  type: "kinetic-card" | "saju-card" | "placeholder" | "image";
  spokenLine: string;
  onScreenText: string[];
  visualProps?: {
    hookText?: string;
    subText?: string;
    badge?: string;
    colorScheme?: "neon-yellow" | "electric-purple" | "fire-red";
    sajuData?: SajuCardData;
  };
}

export interface TikTokScriptResult {
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
