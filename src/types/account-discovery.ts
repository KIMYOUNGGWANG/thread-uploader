export type DiscoveredAccountStatus = "candidate" | "watched" | "ignored";
export type DiscoveredAccountCategory = "career" | "saju" | "creator" | "competitor" | "adjacent" | "unknown";
export type DiscoveredAccountSource = "keyword_search" | "manual" | "profile_expand";
export type AccountPatternDimension = "hook" | "topic" | "emotion" | "structure" | "cta";

export interface DiscoveredAccountResponse {
  id: string;
  brandId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  profileUrl: string | null;
  status: DiscoveredAccountStatus;
  category: DiscoveredAccountCategory;
  relevanceScore: number;
  reason: string;
  source: DiscoveredAccountSource;
  sourceKeyword: string | null;
  lastDiscoveredAt: string;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPatternResponse {
  id: string;
  brandId: string;
  accountId: string | null;
  dimension: AccountPatternDimension;
  value: string;
  sourceCount: number;
  confidence: number;
  recommendation: string;
}
