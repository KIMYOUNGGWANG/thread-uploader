import type { CareerDecisionType, TikTokVideoFormatId } from "@/types/brand";
import type { TikTokSceneBeat } from "@/types/tiktok-video";

export interface TikTokQualityInput {
  formatId: TikTokVideoFormatId;
  spokenHook: string;
  script: string;
  captionOverlays: string[];
  onScreenText: string[];
  cta: string;
  sceneBeats: TikTokSceneBeat[];
}

export interface TikTokQualityResult {
  pass: boolean;
  score: number;
  profile: "tiktok_career_timing";
  reasons: string[];
  careerDecisionType?: CareerDecisionType;
}

const CAREER_ANXIETY_PATTERNS = [
  /이직/,
  /퇴사/,
  /버틸지/,
  /옮길지/,
  /번아웃/,
  /커리어/,
  /회사/,
  /일\b/,
  /직장/,
  /출근/,
  /연봉/,
  /상사/,
  /업무/,
  /그만둘/,
];

const COSMICPATH_PATTERNS = [
  /타이밍/,
  /흐름/,
  /성향/,
  /결정\s*패턴/,
  /운의\s*리듬/,
  /사주/,
  /타로/,
  /점성술/,
  /운세/,
  /리듬/,
];

const COMMENT_CTA_PATTERNS = [
  /댓글/,
  /남겨/,
  /적어/,
  /써줘/,
  /A\/B\/C/i,
  /상황/,
  /어느\s*쪽/,
  /체크/,
  /저장/,
  /공유/,
];

const GENERIC_SELF_HELP_PATTERNS = [
  /좋은 일이 올 거예요/,
  /좋은 일이 올 거야/,
  /스스로를 믿으세요/,
  /작은 변화가 큰 기적/,
  /포기하지 마세요/,
  /당신은 할 수 있어/,
  /언젠가 다 잘될/,
];

const CERTAINTY_PATTERNS = [
  /무조건/,
  /반드시 성공/,
  /100%/,
  /확실히 돈/,
  /치료/,
  /진단합니다/,
  /법적으로/,
  /투자하면/,
];

const DECISION_PATTERNS: Array<{ type: CareerDecisionType; patterns: RegExp[] }> = [
  { type: "stay", patterns: [/버팀형/, /버티/, /남아/, /유지/, /숨\s*고르/, /기다리/] },
  { type: "move", patterns: [/이동형/, /옮기/, /이직/, /퇴사/, /전환/, /나가/] },
  { type: "prepare", patterns: [/준비형/, /준비/, /정리/, /포트폴리오/, /지원/, /조건/] },
];

const CLASSIFICATION_FORMATS = new Set<TikTokVideoFormatId>([
  "career_timing_diagnosis",
  "comment_diagnosis",
]);

export function checkTikTokVideoQuality(input: TikTokQualityInput): TikTokQualityResult {
  const reasons: string[] = [];
  let score = 0;
  const firstCaption = input.captionOverlays.find((caption) => caption.trim()) ?? "";
  const firstText = input.onScreenText.find((text) => text.trim()) ?? "";
  const hookSurface = [input.spokenHook, firstCaption, firstText].join("\n");
  const fullSurface = [
    hookSurface,
    input.script,
    input.cta,
    input.sceneBeats.map((beat) => `${beat.visualDirection} ${beat.narration}`).join("\n"),
  ].join("\n");

  if (input.spokenHook.trim().length >= 8 && input.spokenHook.trim().length <= 80) {
    score += 20;
  } else {
    reasons.push("0-2초 spoken hook이 없거나 너무 깁니다");
  }

  if (CAREER_ANXIETY_PATTERNS.some((pattern) => pattern.test(hookSurface))) {
    score += 20;
  } else {
    reasons.push("첫 hook/caption에 커리어 불안이 없습니다");
  }

  if (COSMICPATH_PATTERNS.some((pattern) => pattern.test(fullSurface))) {
    score += 20;
  } else {
    reasons.push("CosmicPath 타이밍/흐름 언어가 없습니다");
  }

  if (COMMENT_CTA_PATTERNS.some((pattern) => pattern.test(input.cta)) || COMMENT_CTA_PATTERNS.some((pattern) => pattern.test(input.script))) {
    score += 15;
  } else {
    reasons.push("댓글/상황 공유 CTA가 없습니다");
  }

  const careerDecisionType = detectCareerDecisionType(fullSurface);
  if (!CLASSIFICATION_FORMATS.has(input.formatId) || careerDecisionType || hasDecisionFrame(fullSurface)) {
    score += 15;
  } else {
    reasons.push("버팀형/이동형/준비형 분류가 불명확합니다");
  }

  if (GENERIC_SELF_HELP_PATTERNS.some((pattern) => pattern.test(fullSurface))) {
    reasons.push("generic 자기계발 문장이 포함되어 있습니다");
  } else {
    score += 5;
  }

  if (CERTAINTY_PATTERNS.some((pattern) => pattern.test(fullSurface))) {
    reasons.push("과도한 보장/의학·법률·금융 확정 표현이 있습니다");
  } else {
    score += 5;
  }

  return {
    pass: reasons.length === 0 && score >= 85,
    score,
    profile: "tiktok_career_timing",
    reasons,
    ...(careerDecisionType && { careerDecisionType }),
  };
}

function detectCareerDecisionType(surface: string): CareerDecisionType | undefined {
  return DECISION_PATTERNS.find(({ patterns }) => (
    patterns.filter((pattern) => pattern.test(surface)).length >= 2
  ))?.type;
}

function hasDecisionFrame(surface: string): boolean {
  return /버팀형[\s\S]*이동형[\s\S]*준비형/.test(surface)
    || /A[\s\S]*B[\s\S]*C/.test(surface)
    || /세\s*가지/.test(surface);
}
