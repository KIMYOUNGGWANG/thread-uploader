/**
 * Threads Profile Funnel Optimizer
 *
 * Maximizes conversion from viral reach to landing page / app signups.
 * In Threads, the profile bio is the primary 150-character revenue hub.
 *
 * Enforces:
 * 1. 150-char strict limit (Threads hard limit)
 * 2. Who-What-How Formula + Arrow CTA (↓)
 * 3. 10 curated discoverability Topic Tags
 * 4. Campaign-aligned UTM Link-in-Bio URL generator
 */

import { BrandConfig, CampaignConfig } from "@/types/brand";
import { buildTrackedUrl } from "./tracking-url";

export interface OptimizedProfileBioResult {
  bio: string;
  charCount: number;
  withinLimit: boolean;
  topicTags: string[];
  trackedBioUrl: string;
  recommendations: string[];
}

export interface ProfileBioOptions {
  brandName?: string;
  targetAudience?: string;
  offerPromise?: string;
  credibilityProof?: string;
  ctaText?: string;
  landingUrl?: string;
  campaignId?: string;
}

const DOMAIN_DEFAULT_TAGS: Record<string, string[]> = {
  saju_viral: [
    "사주", "운세", "신살", "화개살", "도화살", "대운", "이직타이밍", "궁합", "자미두수", "성향분석"
  ],
  career_decision: [
    "이직", "퇴사", "연봉협상", "커리어", "직무전환", "직장인", "번아웃", "포트폴리오", "잡체인지", "워라밸"
  ],
  product_growth: [
    "생산성", "업무자동화", "SaaS", "프리랜서", "스타트업", "시간절약", "성장", "툴추천", "작업효율", "1인기업"
  ],
};

export const THREADS_BIO_MAX_LENGTH = 150;

/**
 * Generate a high-converting 150-character Who-What-How bio for Threads profiles
 */
export function generateOptimizedProfileBio(
  config: BrandConfig,
  campaign?: CampaignConfig | null,
  options: ProfileBioOptions = {}
): OptimizedProfileBioResult {
  const qualityProfile = campaign?.qualityProfile ?? config.qualityProfile ?? "saju_viral";
  const brandName = options.brandName ?? config.productProfile?.productName ?? "CosmicPath";
  const target = options.targetAudience ?? config.targets?.[0] ?? "인생 분기점에 선 사람";
  const promise = options.offerPromise ?? config.productProfile?.offerPromise ?? "실수 없는 선택 타이밍 판정";
  const proof = options.credibilityProof ?? "5대 엔진 교차 분석";
  const cta = options.ctaText ?? "내 진짜 타이밍 확인하기 ↓";

  // Build 3-line Who-What-How structure
  // Line 1: Who & What
  // Line 2: Proof / How
  // Line 3: Arrow CTA
  let candidateLines = [
    `${target}을 위한 ${promise}.`,
    `${proof} 기반 팩트 판정.`,
    `${cta}`,
  ];

  let candidateBio = candidateLines.join("\n");

  // If candidate exceeds 150 characters, iteratively compress
  if (candidateBio.length > THREADS_BIO_MAX_LENGTH) {
    candidateLines = [
      `${target}의 ${promise}.`,
      `${proof}.`,
      `${cta}`,
    ];
    candidateBio = candidateLines.join("\n");
  }

  if (candidateBio.length > THREADS_BIO_MAX_LENGTH) {
    candidateBio = `${promise}. ${proof}.\n${cta}`;
  }

  // Final emergency trim ensuring <= 150 chars
  if (candidateBio.length > THREADS_BIO_MAX_LENGTH) {
    candidateBio = candidateBio.slice(0, 148).trim() + "…";
  }

  // Curate 10 topic tags
  const defaultTags = DOMAIN_DEFAULT_TAGS[qualityProfile] ?? DOMAIN_DEFAULT_TAGS.saju_viral;
  const configTopics = (config.topics ?? []).slice(0, 5);
  const combinedTags = Array.from(new Set([...configTopics, ...defaultTags])).slice(0, 10);

  // Generate tracked Bio URL
  const rawLanding = options.landingUrl ?? campaign?.landingUrl ?? config.productProfile?.landingUrl ?? config.websiteUrl ?? "https://cosmicpath.app";
  const trackedBioUrl = buildTrackedUrl(rawLanding, {
    source: "threads_bio",
    track: "track_c",
    formulaId: "profile_hub",
  });

  const recommendations: string[] = [];
  if (candidateBio.length < 50) {
    recommendations.push("바이오가 다소 짧습니다. 신뢰도 증빙(수치 또는 전문성)을 보강하세요.");
  }
  if (!candidateBio.includes("↓")) {
    recommendations.push("프로필 링크로 유도하는 하향 화살표(↓)를 배치하세요.");
  }

  return {
    bio: candidateBio,
    charCount: candidateBio.length,
    withinLimit: candidateBio.length <= THREADS_BIO_MAX_LENGTH,
    topicTags: combinedTags,
    trackedBioUrl,
    recommendations,
  };
}
