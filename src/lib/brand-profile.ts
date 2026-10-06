export type ContentFormat = "SINGLE_CARD" | "CAROUSEL" | "TEXT_ONLY";

export interface BrandFidelityConfig {
  formalTonePattern?: string;
  identityMarkers: string[];
  relationshipMarkers?: string[];
  relationshipContrastMarkers?: string[];
  prohibitedPhrases?: string[];
  supportedFormats: ContentFormat[];
}

export interface BrandProfile {
  slug: string;
  name: string;
  language: "ko" | "en";
  persona: string;
  tone: string;
  targetAudience: string[];
  coreTopics: string[];
  fidelity: BrandFidelityConfig;
}

const DEFAULT_KO_IDENTITY_MARKERS = [
  "화개살",
  "도화살",
  "홍염살",
  "문창귀인",
  "천을귀인",
  "진술축미",
  "신금",
  "경금",
  "갑목",
  "을목",
  "병화",
  "정화",
  "무토",
  "기토",
  "임수",
  "계수",
  "비견",
  "겁재",
  "편관",
  "정관",
  "역마살",
];

const DEFAULT_EN_IDENTITY_MARKERS = [
  "Saturn Return",
  "Pluto Transit",
  "Rising Sign",
  "Moon Sign",
  "Sun Sign",
  "Midheaven",
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
  "8th House",
  "12th House",
  "North Node",
];

export function resolveBrandProfile(
  brandConfigJson: string | null | undefined,
  brandSlug: string,
  brandName: string
): BrandProfile {
  let parsedConfig: Record<string, any> = {};
  if (brandConfigJson) {
    try {
      parsedConfig = JSON.parse(brandConfigJson);
    } catch {
      parsedConfig = {};
    }
  }

  const isGlobal = brandSlug.includes("global") || parsedConfig.language === "en";
  const language = parsedConfig.language || (isGlobal ? "en" : "ko");

  const defaultIdentityMarkers = language === "en" ? DEFAULT_EN_IDENTITY_MARKERS : DEFAULT_KO_IDENTITY_MARKERS;

  return {
    slug: brandSlug,
    name: brandName,
    language,
    persona:
      parsedConfig.persona ||
      (language === "en"
        ? "Astrological timing strategist and reality-check mentor"
        : "사주 대운 및 커리어 타이밍 현실 자각 멘토"),
    tone:
      parsedConfig.tone ||
      (language === "en" ? "provocative, sharp, analytical" : "도발적, 날카로움, 직설적 반말 톤"),
    targetAudience: parsedConfig.targetAudience || (
      language === "en"
        ? ["Ambitious 20s-30s professionals", "Career pivot seekers"]
        : ["2030 직장인", "이직/퇴사 고민자", "스타트업/테크 시니어"]
    ),
    coreTopics: parsedConfig.coreTopics || (
      language === "en"
        ? ["Career Timing", "Wealth Traps", "Relationship Reality"]
        : ["대운 교운기", "커리어 이직 타이밍", "손절선과 돈 그릇"]
    ),
    fidelity: {
      identityMarkers: parsedConfig.fidelity?.identityMarkers || defaultIdentityMarkers,
      relationshipMarkers: parsedConfig.fidelity?.relationshipMarkers || (
        language === "en"
          ? ["dating", "relationship", "ex", "breakup", "toxic", "chemistry"]
          : ["연애", "궁합", "애인", "남친", "여친", "헤어", "손절", "관계", "재회"]
      ),
      relationshipContrastMarkers: parsedConfig.fidelity?.relationshipContrastMarkers || (
        language === "en"
          ? ["never", "vs", "clash", "ruin", "drain", "contrast", "karmic"]
          : ["절대", "vs", "대비", "만나면", "헤어지", "망", "놓치", "파멸", "귀인", "원진", "상극"]
      ),
      prohibitedPhrases: parsedConfig.fidelity?.prohibitedPhrases || (
        language === "en"
          ? ["manifest your dreams", "everything happens for a reason", "just believe in yourself"]
          : ["좋은 일이 올 거예요", "스스로를 믿으세요", "당신은 할 수 있어", "포기하지 마세요"]
      ),
      supportedFormats: parsedConfig.fidelity?.supportedFormats || ["SINGLE_CARD", "CAROUSEL", "TEXT_ONLY"],
    },
  };
}
