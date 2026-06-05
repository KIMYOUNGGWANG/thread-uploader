import { clampNumber, isRecord, normalizeIdentifier, normalizeText } from "@/types/config-normalizers";
import { CAREER_TIMING_WEDGE_399 } from "@/types/campaign";

export type TikTokVideoFormatId =
  | "career_timing_diagnosis"
  | "comment_diagnosis"
  | "self_confession"
  | "saju_myth_busting"
  | "landing_teaser";

export interface TikTokVideoFormatConfig {
  id: TikTokVideoFormatId;
  name: string;
  weight: number;
  instruction: string;
}

export interface TikTokVideoConfig {
  enabled: boolean;
  parentCampaignId: string;
  defaultDurationSeconds: number;
  landingUrl: string;
  qualityProfile: "tiktok_career_timing";
  formats: TikTokVideoFormatConfig[];
}

export const TIKTOK_VIDEO_EXPERIMENT_DEFAULT: TikTokVideoConfig = {
  enabled: true,
  parentCampaignId: CAREER_TIMING_WEDGE_399.id,
  defaultDurationSeconds: 25,
  landingUrl: "/career/uncertainty",
  qualityProfile: "tiktok_career_timing",
  formats: [
    {
      id: "career_timing_diagnosis",
      name: "커리어 타이밍 진단형",
      weight: 3,
      instruction: "퇴사/이직/번아웃 고민을 0-2초 hook으로 열고 버팀형/이동형/준비형 중 어디에 가까운지 판단하게 만든다.",
    },
    {
      id: "comment_diagnosis",
      name: "댓글 진단형",
      weight: 3,
      instruction: "댓글에 A/B/C 또는 현재 상황을 남기게 하고, CosmicPath식 타이밍 언어로 분류해주는 구조를 만든다.",
    },
    {
      id: "self_confession",
      name: "자기고백 공감형",
      weight: 2,
      instruction: "퇴사 타이밍을 놓칠까 불안했던 자기고백에서 시작해 시청자가 자기 상황을 떠올리게 만든다.",
    },
    {
      id: "saju_myth_busting",
      name: "사주 오해 깨기형",
      weight: 2,
      instruction: "사주가 정답을 말해준다는 오해를 깨고, 결정 패턴과 타이밍을 읽는 도구로 재프레이밍한다.",
    },
    {
      id: "landing_teaser",
      name: "리포트 티저형",
      weight: 1,
      instruction: "커리어 흐름 리포트에서 확인할 수 있는 신호를 예고하되 과장된 보장 없이 프로필/링크 확인으로 연결한다.",
    },
  ],
};

export function normalizeTikTokVideoConfig(input: unknown, activeCampaignId: unknown): TikTokVideoConfig {
  const raw = isRecord(input) ? input : {};
  const defaults = TIKTOK_VIDEO_EXPERIMENT_DEFAULT;
  const enabled = typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled;
  return {
    enabled,
    parentCampaignId: normalizeIdentifier(raw.parentCampaignId ?? activeCampaignId, defaults.parentCampaignId),
    defaultDurationSeconds: clampNumber(raw.defaultDurationSeconds, 15, 60, defaults.defaultDurationSeconds),
    landingUrl: enabled ? normalizeText(raw.landingUrl, defaults.landingUrl) : "",
    qualityProfile: "tiktok_career_timing",
    formats: enabled ? normalizeTikTokVideoFormats(raw.formats, defaults.formats) : [],
  };
}

function normalizeTikTokVideoFormats(input: unknown, fallback: TikTokVideoFormatConfig[]): TikTokVideoFormatConfig[] {
  if (!Array.isArray(input)) return fallback;
  const formats = input
    .filter(isRecord)
    .map((format, index) => {
      const fallbackFormat = fallback[index] ?? fallback[0];
      return {
        id: normalizeTikTokVideoFormatId(format.id, fallbackFormat.id),
        name: normalizeText(format.name, fallbackFormat.name),
        weight: clampNumber(format.weight, 1, 6, fallbackFormat.weight),
        instruction: normalizeText(format.instruction, fallbackFormat.instruction),
      };
    });
  return formats.length ? formats : fallback;
}

function normalizeTikTokVideoFormatId(input: unknown, fallback: TikTokVideoFormatId): TikTokVideoFormatId {
  return input === "career_timing_diagnosis"
    || input === "comment_diagnosis"
    || input === "self_confession"
    || input === "saju_myth_busting"
    || input === "landing_teaser"
    ? input
    : fallback;
}
