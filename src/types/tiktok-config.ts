import { clampNumber, isRecord, normalizeIdentifier, normalizeText } from "@/types/config-normalizers";
import { CAREER_TIMING_WEDGE_399 } from "@/types/campaign";

export type TikTokVideoFormatId =
  | "career_timing_diagnosis"
  | "self_classification"
  | "saveable_tool"
  | "quiet_contrarian"
  | "friend_share"
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
      id: "self_classification",
      name: "자기분류 셀프체크형",
      weight: 3,
      instruction: "A/B/C 또는 버팀형/이동형/준비형 중 하나를 화면 안에서 혼자 고르게 해서 운영자 답글 없이도 참여가 완결되게 만든다.",
    },
    {
      id: "saveable_tool",
      name: "저장형 판단 도구",
      weight: 2,
      instruction: "퇴사/이직/번아웃 판단 전에 다시 볼 체크리스트나 순서표를 영상 구조로 만든다.",
    },
    {
      id: "quiet_contrarian",
      name: "조용한 반전형",
      weight: 2,
      instruction: "흔한 운세/타이밍 믿음을 차분히 뒤집고 저장, 프로필 확인, 행동선 정리로 연결한다.",
    },
    {
      id: "friend_share",
      name: "친구 공유형",
      weight: 2,
      instruction: "같은 이직/퇴사 고민을 하는 친구에게 보내주고 싶게 구체 상황을 짚는다.",
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
    || input === "self_classification"
    || input === "saveable_tool"
    || input === "quiet_contrarian"
    || input === "friend_share"
    || input === "saju_myth_busting"
    || input === "landing_teaser"
    ? input
    : fallback;
}
