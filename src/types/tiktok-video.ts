import type { CareerDecisionType, TikTokVideoFormatId } from "@/types/brand";

export type TikTokVideoDraftStatus = "DRAFT" | "APPROVED" | "UPLOADED_MANUAL" | "ARCHIVED";
export type TikTokQualityProfileId = "tiktok_career_timing";

export interface TikTokSceneBeat {
  startSecond: number;
  endSecond: number;
  visualDirection: string;
  narration: string;
}

export interface TikTokVideoMetricResponse {
  draftId: string;
  measuredAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profileClicks: number;
  landingClicks: number;
  conversions: number;
  performanceScore: number;
}

export interface TikTokVideoDraftResponse {
  id: string;
  brandId: string;
  campaignId: string;
  formatId: TikTokVideoFormatId;
  status: TikTokVideoDraftStatus;
  title: string;
  spokenHook: string;
  script: string;
  sceneBeats: TikTokSceneBeat[];
  captionOverlays: string[];
  onScreenText: string[];
  hashtags: string[];
  cta: string;
  landingUrl: string | null;
  utmContent: string | null;
  qualityProfile: TikTokQualityProfileId;
  qualityPass: boolean;
  qualityScore: number;
  qualityReasons: string[];
  careerDecisionType?: CareerDecisionType;
  durationSeconds: number;
  renderTarget: {
    format: "webm";
    width: 1080;
    height: 1920;
    fps: 30;
  };
  createdAt: string;
  updatedAt: string;
  latestMetric?: TikTokVideoMetricResponse | null;
}

export interface TikTokSummaryResponse {
  brandId: string;
  campaignId: string;
  totals: {
    drafts: number;
    approved: number;
    manualUploads: number;
    qualityPassed: number;
    qualityFailed: number;
  };
  topFormats: Array<{
    formatId: TikTokVideoFormatId;
    count: number;
    avgPerformanceScore: number;
  }>;
  recommendations: string[];
  recentDrafts: TikTokVideoDraftResponse[];
}
