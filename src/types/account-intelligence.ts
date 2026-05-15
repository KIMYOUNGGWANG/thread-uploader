export type AccountInsightActionType =
  | "reply_now"
  | "boost_format"
  | "reduce_format"
  | "link_ratio_warning"
  | "quality_warning"
  | "watch_post";

export type AccountInsightPriority = "high" | "medium" | "low";

export interface AccountInsightAction {
  id: string;
  type: AccountInsightActionType;
  priority: AccountInsightPriority;
  title: string;
  detail: string;
  postId?: string;
  campaignId?: string;
  formulaId?: string;
  score?: number;
}

export interface AccountInsightMetrics {
  windowHours: number;
  totalPosts: number;
  publishedPosts: number;
  pendingPosts: number;
  linkedPosts: number;
  qualityFailedPosts: number;
  totalViews: number;
  totalReplies: number;
  totalReposts: number;
  totalClicks: number;
  totalConversions: number;
  avgPerformanceScore: number;
  metricsRefresh: {
    attempted: number;
    updated: number;
    failed: number;
  };
}

export interface AccountInsightSnapshot {
  id: string;
  brandId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  source: string;
  summary: string;
  actions: AccountInsightAction[];
  metrics: AccountInsightMetrics;
}
