"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, Sparkles, RotateCcw, CheckCircle2, AlertCircle, RefreshCw, Calendar, Pencil, Wand2, BarChart2, ChevronDown, ChevronUp, Zap, LogOut, ArrowLeft, Settings, BrainCircuit, Target, Flame, Radar, ExternalLink, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/FileDropzone";
import { PostCard } from "@/components/PostCard";
import { parseExcelFile, parseMarkdownFile, ParsedPost, validatePost } from "@/lib/parser";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import type { AccountInsightSnapshot } from "@/types/account-intelligence";

interface FormulaStats {
  formulaId: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
  engagementScore: number;
}

interface AnalyticsData {
  total: number;
  evaluated: number;
  byFormula: FormulaStats[];
  topFormula: FormulaStats | null;
  bottomFormula: FormulaStats | null;
  message?: string;
}

interface GrowthPattern {
  dimension: string;
  value: string;
  count: number;
  avgScore: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
}

interface GrowthData {
  sampleSize: number;
  memory: {
    updatedAt: string;
    sampleSize: number;
    avgScore: number;
    winners: GrowthPattern[];
    weakSignals: GrowthPattern[];
    recommendations: string[];
  };
  topPatterns: GrowthPattern[];
  weakPatterns: GrowthPattern[];
  recentPosts: Array<{
    id: string;
    formulaId: string | null;
    topic: string | null;
    hookType: string | null;
    ctaType: string | null;
    score: number;
    tier: string;
  }>;
}

interface ViralPatternData {
  id: string;
  dimension: string;
  value: string;
  sourceCount: number;
  avgViralScore: number;
  confidence: number;
  recommendation: string;
  exampleIds: string[];
}

interface ViralExampleData {
  id: string;
  source: string;
  authorUsername: string | null;
  permalink: string | null;
  content: string;
  publishedAt: string | null;
  discoveredAt: string;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  shares: number | null;
  engagementRate: number | null;
  viralScore: number;
  hookType: string | null;
  topic: string | null;
  emotionalDriver: string | null;
  structureType: string | null;
  ctaType: string | null;
  patternSummary: string | null;
  keyTakeaway: string | null;
}

interface ViralSourceError {
  adapter: string;
  source: string;
  message: string;
}

interface ViralData {
  sampleSize: number;
  memory: {
    updatedAt: string;
    sampleSize: number;
    avgViralScore: number;
    sourceMix: Record<string, number>;
    topPatterns: Array<{
      dimension: string;
      value: string;
      count: number;
      avgViralScore: number;
      confidence: number;
      recommendation: string;
      exampleIds: string[];
    }>;
    recommendations: string[];
  };
  topPatterns: ViralPatternData[];
  examples: ViralExampleData[];
  saved?: number;
  errors?: ViralSourceError[];
}

interface CampaignPostData {
  id: string;
  content: string;
  scheduledAt: string;
  publishedAt: string | null;
  createdAt: string;
  status: string;
  firstComment: string | null;
  linkUrl: string | null;
  utmContent: string | null;
  qualityProfile: string | null;
  qualityPass: boolean | null;
  qualityReasons: string[];
  campaignFormulaId: string | null;
  careerDecisionType: string | null;
  views: number;
  replies: number;
  reposts: number;
  clicks: number;
  conversions: number;
  manualPaidConversions: number;
  performanceScore: number;
  performanceTier: string;
}

interface CampaignSummaryData {
  campaign: {
    id: string;
    name: string;
    landingUrl: string;
    dailyPostTarget: number;
    linkCadenceEvery: number;
  };
  todayScheduled: CampaignPostData[];
  linkRatio: {
    linked: number;
    total: number;
    percent: number;
  };
  quality: {
    passed: number;
    failed: number;
    unknown: number;
    total: number;
  };
  metrics: {
    views: number;
    replies: number;
    reposts: number;
    clicks: number;
    conversions: number;
    manualPaidConversions: number;
  };
  scoreWeights: {
    replies: number;
    reposts: number;
    views: number;
    clicksConversions: number;
  };
  replyPlaybook: Record<"stay" | "move" | "prepare" | "cta", string>;
}

interface CampaignMetricDraft {
  clicks: string;
  conversions: string;
  manualPaidConversions: string;
}

interface AccountIntelligenceData {
  latest: AccountInsightSnapshot | null;
  history: AccountInsightSnapshot[];
}

interface ManualReferenceFormState {
  content: string;
  permalink: string;
  authorUsername: string;
  views: string;
  likes: string;
  replies: string;
  reposts: string;
  quotes: string;
  shares: string;
}

interface DBPost {
  id: string;
  content: string;
  imageUrls: string[];
  scheduledAt: string;
  publishedAt: string | null;
  status: string;
  threadsId: string | null;
  createdAt: string;
  errorLog: string | null;
  firstComment: string | null;
  formulaId: string | null;
  topic: string | null;
  targetAudience: string | null;
  hookType: string | null;
  ctaType: string | null;
  qualityScore: number | null;
  performanceScore: number | null;
  performanceTier: string | null;
  qualityProfile: string | null;
  qualityPass: boolean | null;
  qualityReasons: string[];
  campaignId: string | null;
  campaignFormulaId: string | null;
  careerDecisionType: string | null;
  linkUrl: string | null;
  utmContent: string | null;
  clicks: number | null;
  conversions: number | null;
  manualPaidConversions: number | null;
}

interface DashboardProps {
  brandId: string;
  brandName: string;
  brandSlug: string;
}

const EMPTY_MANUAL_REFERENCE: ManualReferenceFormState = {
  content: "",
  permalink: "",
  authorUsername: "",
  views: "",
  likes: "",
  replies: "",
  reposts: "",
  quotes: "",
  shares: "",
};

const MANUAL_METRIC_FIELDS: Array<{
  key: keyof Pick<ManualReferenceFormState, "views" | "likes" | "replies" | "reposts" | "quotes" | "shares">;
  label: string;
}> = [
  { key: "views", label: "조회" },
  { key: "likes", label: "좋아요" },
  { key: "replies", label: "댓글" },
  { key: "reposts", label: "리포스트" },
  { key: "quotes", label: "인용" },
  { key: "shares", label: "공유" },
];

export function Dashboard({ brandId, brandName, brandSlug }: DashboardProps) {
  const [posts, setPosts] = useState<DBPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showPublished, setShowPublished] = useState(false);
  const [insertAtFront, setInsertAtFront] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(21);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showGrowth, setShowGrowth] = useState(false);
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [isLoadingGrowth, setIsLoadingGrowth] = useState(false);
  const [isLearningGrowth, setIsLearningGrowth] = useState(false);
  const [showAccountIntelligence, setShowAccountIntelligence] = useState(false);
  const [accountIntelligence, setAccountIntelligence] = useState<AccountIntelligenceData | null>(null);
  const [isLoadingAccountIntelligence, setIsLoadingAccountIntelligence] = useState(false);
  const [isRunningAccountIntelligence, setIsRunningAccountIntelligence] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummaryData | null>(null);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(false);
  const [campaignMetricDrafts, setCampaignMetricDrafts] = useState<Record<string, CampaignMetricDraft>>({});
  const [savingCampaignMetricId, setSavingCampaignMetricId] = useState<string | null>(null);
  const [showViral, setShowViral] = useState(false);
  const [viral, setViral] = useState<ViralData | null>(null);
  const [isLoadingViral, setIsLoadingViral] = useState(false);
  const [isRunningViral, setIsRunningViral] = useState(false);
  const [isLearningViral, setIsLearningViral] = useState(false);
  const [showManualReference, setShowManualReference] = useState(false);
  const [manualReference, setManualReference] = useState<ManualReferenceFormState>(EMPTY_MANUAL_REFERENCE);
  const [isSavingManualReference, setIsSavingManualReference] = useState(false);

  const fetchPosts = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/posts?brandId=${brandId}`);
      const data = await response.json() as { posts?: DBPost[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "포스트 불러오기 실패");
      if (!Array.isArray(data.posts)) throw new Error("포스트 응답 형식이 올바르지 않습니다");
      setPosts(data.posts);
    } catch (err) {
      const message = err instanceof Error ? err.message : "포스트 불러오기 실패";
      setFetchError(message);
      toast.error(message);
    } finally {
      setIsFetching(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchPosts();
  }, [brandId, fetchPosts]);

  const loadAccountIntelligence = useCallback(async () => {
    setIsLoadingAccountIntelligence(true);
    try {
      const response = await fetch(`/api/account-intelligence?brandId=${brandId}`);
      const data = await response.json() as AccountIntelligenceData | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "계정 분석 불러오기 실패");
      setAccountIntelligence(data as AccountIntelligenceData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "계정 분석 불러오기 실패");
    } finally {
      setIsLoadingAccountIntelligence(false);
    }
  }, [brandId]);

  const handleToggleAccountIntelligence = useCallback(async () => {
    if (showAccountIntelligence) {
      setShowAccountIntelligence(false);
      return;
    }
    setShowAccountIntelligence(true);
    await loadAccountIntelligence();
  }, [loadAccountIntelligence, showAccountIntelligence]);

  const handleRunAccountIntelligence = useCallback(async () => {
    setIsRunningAccountIntelligence(true);
    try {
      const response = await fetch("/api/account-intelligence/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, fetchMetrics: true, windowHours: 48 }),
      });
      const data = await response.json() as { insight?: AccountInsightSnapshot; error?: string };
      if (!response.ok || !data.insight) throw new Error(data.error ?? "계정 분석 실행 실패");
      setAccountIntelligence((current) => ({
        latest: data.insight ?? null,
        history: [data.insight!, ...(current?.history ?? [])].slice(0, 8),
      }));
      toast.success("계정 분석 업데이트 완료");
      await fetchPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "계정 분석 실행 실패");
    } finally {
      setIsRunningAccountIntelligence(false);
    }
  }, [brandId, fetchPosts]);

  const loadCampaignSummary = useCallback(async () => {
    setIsLoadingCampaign(true);
    try {
      const response = await fetch(`/api/campaigns/summary?brandId=${brandId}`);
      const data = await response.json() as CampaignSummaryData | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "캠페인 데이터 불러오기 실패");
      const summary = data as CampaignSummaryData;
      setCampaignSummary(summary);
      setCampaignMetricDrafts(Object.fromEntries(summary.todayScheduled.map((post) => [
        post.id,
        {
          clicks: String(post.clicks),
          conversions: String(post.conversions),
          manualPaidConversions: String(post.manualPaidConversions),
        },
      ])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "캠페인 데이터 불러오기 실패");
    } finally {
      setIsLoadingCampaign(false);
    }
  }, [brandId]);

  const handleGenerate = useCallback(async () => {
    if (!confirm(`AI로 ${generateCount}개 포스트를 생성할까요? (약 1-2분 소요)`)) return;
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, count: generateCount, insertAtFront }),
      });
      const data = await response.json() as { count?: number; linkedCount?: number; campaignId?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "생성 실패");
      const linkText = data.linkedCount !== undefined ? ` · 링크 ${data.linkedCount}개` : "";
      toast.success(`${data.count}개 포스트 생성 완료${linkText}`);
      await fetchPosts();
      if (showCampaign) await loadCampaignSummary();
      if (showAccountIntelligence) await loadAccountIntelligence();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI 생성 실패");
    } finally {
      setIsGenerating(false);
    }
  }, [brandId, generateCount, insertAtFront, fetchPosts, loadAccountIntelligence, loadCampaignSummary, showAccountIntelligence, showCampaign]);

  const handleCreatePost = useCallback(async () => {
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, posts: [{ content: "", images: [], scheduledAt: null }] }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to create post");
      toast.success("새 글 작성 칸이 생성되었습니다");
      await fetchPosts();
    } catch {
      toast.error("글 작성 생성 실패");
    }
  }, [brandId, fetchPosts]);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      let parsedPosts: ParsedPost[] = [];
      if (file.name.endsWith(".xlsx")) {
        parsedPosts = parseExcelFile(await file.arrayBuffer());
      } else if (file.name.endsWith(".md")) {
        parsedPosts = parseMarkdownFile(await file.text());
      }
      if (parsedPosts.length === 0) { toast.error("No posts found in file"); return; }
      const validPosts = parsedPosts.filter((p) => validatePost(p).valid);
      if (validPosts.length === 0) { toast.error("유효한 포스트가 없습니다"); return; }

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, posts: validPosts, insertAtFront }),
      });
      const data = await response.json() as { count?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save posts");
      toast.success(`${data.count}개 포스트가 예약되었습니다! 🎉`);
      await fetchPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "파일 처리 실패");
    } finally {
      setIsLoading(false);
    }
  }, [brandId, insertAtFront, fetchPosts]);

  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete post");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("포스트 삭제됨");
    } catch {
      toast.error("삭제 실패");
    }
  }, []);

  const handleToggleAnalytics = useCallback(async () => {
    if (showAnalytics) { setShowAnalytics(false); return; }
    setShowAnalytics(true);
    setIsLoadingAnalytics(true);
    try {
      const response = await fetch(`/api/analytics?brandId=${brandId}`);
      setAnalytics(await response.json() as AnalyticsData);
    } catch {
      toast.error("성과 데이터 불러오기 실패");
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [showAnalytics, brandId]);

  const handleToggleGrowth = useCallback(async () => {
    if (showGrowth) { setShowGrowth(false); return; }
    setShowGrowth(true);
    setIsLoadingGrowth(true);
    try {
      const response = await fetch(`/api/growth?brandId=${brandId}`);
      const data = await response.json() as GrowthData | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "학습 데이터 불러오기 실패");
      setGrowth(data as GrowthData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "학습 데이터 불러오기 실패");
    } finally {
      setIsLoadingGrowth(false);
    }
  }, [showGrowth, brandId]);

  const handleLearnGrowth = useCallback(async () => {
    setIsLearningGrowth(true);
    try {
      const response = await fetch("/api/growth/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const data = await response.json() as GrowthData | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "학습 실패");
      setGrowth(data as GrowthData);
      toast.success("성과 패턴 학습 완료");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "학습 실패");
    } finally {
      setIsLearningGrowth(false);
    }
  }, [brandId]);

  const handleToggleCampaign = useCallback(async () => {
    if (showCampaign) {
      setShowCampaign(false);
      return;
    }
    setShowCampaign(true);
    await loadCampaignSummary();
  }, [loadCampaignSummary, showCampaign]);

  const handleCampaignDraftChange = useCallback((postId: string, field: keyof CampaignMetricDraft, value: string) => {
    setCampaignMetricDrafts((current) => ({
      ...current,
      [postId]: {
        ...(current[postId] ?? { clicks: "0", conversions: "0", manualPaidConversions: "0" }),
        [field]: value,
      },
    }));
  }, []);

  const handleSaveCampaignMetrics = useCallback(async (postId: string) => {
    const draft = campaignMetricDrafts[postId];
    if (!draft) return;

    setSavingCampaignMetricId(postId);
    try {
      const response = await fetch(`/api/posts/${postId}/campaign-metrics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clicks: optionalMetric(draft.clicks) ?? 0,
          conversions: optionalMetric(draft.conversions) ?? 0,
          manualPaidConversions: optionalMetric(draft.manualPaidConversions) ?? 0,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "캠페인 메트릭 저장 실패");
      toast.success("캠페인 메트릭 저장 완료");
      await Promise.all([loadCampaignSummary(), fetchPosts()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "캠페인 메트릭 저장 실패");
    } finally {
      setSavingCampaignMetricId(null);
    }
  }, [campaignMetricDrafts, fetchPosts, loadCampaignSummary]);

  const handleToggleViral = useCallback(async () => {
    if (showViral) { setShowViral(false); return; }
    setShowViral(true);
    setIsLoadingViral(true);
    try {
      const response = await fetch(`/api/viral?brandId=${brandId}`);
      const data = await response.json() as ViralData | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "바이럴 데이터 불러오기 실패");
      setViral(data as ViralData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "바이럴 데이터 불러오기 실패");
    } finally {
      setIsLoadingViral(false);
    }
  }, [showViral, brandId]);

  const handleRunViralLoop = useCallback(async () => {
    setIsRunningViral(true);
    try {
      const discoverResponse = await fetch("/api/viral/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, useSavedSources: true }),
      });
      const discoverData = await discoverResponse.json() as ViralData | { error?: string };
      if (!discoverResponse.ok) throw new Error((discoverData as { error?: string }).error ?? "바이럴 발견 실패");

      const learnResponse = await fetch("/api/viral/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const learnData = await learnResponse.json() as ViralData | { error?: string };
      if (!learnResponse.ok) throw new Error((learnData as { error?: string }).error ?? "바이럴 학습 실패");

      setViral({
        ...(learnData as ViralData),
        saved: (discoverData as ViralData).saved,
        errors: (discoverData as ViralData).errors,
      });
      const saved = (discoverData as ViralData).saved ?? 0;
      const errors = (discoverData as ViralData).errors ?? [];
      if (errors.length > 0) {
        toast.warning(`바이럴 루프 완료, 일부 외부 소스 실패 (${errors.length}건)`);
      } else {
        toast.success(`바이럴 루프 완료: ${saved}개 저장`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "바이럴 루프 실패");
    } finally {
      setIsRunningViral(false);
    }
  }, [brandId]);

  const handleSaveManualReference = useCallback(async () => {
    if (!manualReference.content.trim()) {
      toast.error("레퍼런스 본문을 입력하세요");
      return;
    }

    setIsSavingManualReference(true);
    try {
      const discoverResponse = await fetch("/api/viral/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          useSavedSources: false,
          includeOwnPosts: false,
          manualExamples: [{
            content: manualReference.content,
            authorUsername: optionalString(manualReference.authorUsername),
            permalink: optionalString(manualReference.permalink),
            views: optionalMetric(manualReference.views),
            likes: optionalMetric(manualReference.likes),
            replies: optionalMetric(manualReference.replies),
            reposts: optionalMetric(manualReference.reposts),
            quotes: optionalMetric(manualReference.quotes),
            shares: optionalMetric(manualReference.shares),
          }],
        }),
      });
      const discoverData = await discoverResponse.json() as ViralData | { error?: string };
      if (!discoverResponse.ok) throw new Error((discoverData as { error?: string }).error ?? "수동 레퍼런스 저장 실패");

      const learnResponse = await fetch("/api/viral/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const learnData = await learnResponse.json() as ViralData | { error?: string };
      if (!learnResponse.ok) throw new Error((learnData as { error?: string }).error ?? "바이럴 학습 실패");

      setViral({
        ...(learnData as ViralData),
        saved: (discoverData as ViralData).saved,
        errors: (discoverData as ViralData).errors,
      });
      setManualReference(EMPTY_MANUAL_REFERENCE);
      setShowManualReference(false);
      toast.success("수동 레퍼런스 저장 및 학습 완료");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "수동 레퍼런스 저장 실패");
    } finally {
      setIsSavingManualReference(false);
    }
  }, [brandId, manualReference]);

  const handleLearnViral = useCallback(async () => {
    setIsLearningViral(true);
    try {
      const response = await fetch("/api/viral/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const data = await response.json() as ViralData | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "바이럴 학습 실패");
      setViral(data as ViralData);
      toast.success("바이럴 패턴 학습 완료");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "바이럴 학습 실패");
    } finally {
      setIsLearningViral(false);
    }
  }, [brandId]);

  const handleOptimize = useCallback(async () => {
    if (!confirm("성과 데이터를 분석해 콘텐츠 공식 가중치를 자동 조정할까요?")) return;
    setIsOptimizing(true);
    try {
      const response = await fetch("/api/generate/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const data = await response.json() as { changes?: { boosted: string[]; reduced: string[] }; message?: string; error?: string };
      if (!response.ok) throw new Error(data.message ?? data.error ?? "최적화 실패");
      toast.success(`최적화 완료! 상승: ${data.changes?.boosted.join(", ")} / 하락: ${data.changes?.reduced.join(", ")}`);
      const analyticsRes = await fetch(`/api/analytics?brandId=${brandId}`);
      setAnalytics(await analyticsRes.json() as AnalyticsData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "최적화 실패");
    } finally {
      setIsOptimizing(false);
    }
  }, [brandId]);

  const handleReset = useCallback(async () => {
    if (!confirm("모든 PENDING 포스트를 삭제하시겠습니까?")) return;
    try {
      const response = await fetch(`/api/posts/reset?brandId=${brandId}`, { method: "DELETE" });
      const data = await response.json() as { count?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Reset failed");
      await fetchPosts();
      toast.info(`${data.count}개 대기 중인 포스트 삭제됨`);
    } catch {
      toast.error("초기화 실패");
    }
  }, [brandId, fetchPosts]);

  const handleLogout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) window.location.href = "/login";
      else toast.error("로그아웃 실패");
    } catch {
      toast.error("로그아웃 중 오류 발생");
    }
  }, []);

  const pendingCount = posts.filter((p) => p.status === "PENDING").length;
  const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length;
  const failedCount = posts.filter((p) => p.status === "FAILED").length;
  const visiblePosts = posts.filter((p) => showPublished || p.status !== "PUBLISHED" || Boolean(p.errorLog));
  const convertToCardPost = (dbPost: DBPost): ParsedPost => ({
    content: dbPost.content,
    images: dbPost.imageUrls,
    scheduledAt: new Date(dbPost.scheduledAt),
    firstComment: dbPost.firstComment ?? undefined,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/brands" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </Link>
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">{brandName}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">즉시 업로드 & 예약 발행</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {posts.length > 0 && (
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
                    <Calendar className="w-4 h-4" />{pendingCount} 예약
                  </div>
                )}
                {publishedCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />{publishedCount} 완료
                  </div>
                )}
                {failedCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />{failedCount} 실패
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              {posts.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={fetchPosts} disabled={isFetching}>
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />새로고침
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-1.5" />초기화
                  </Button>
                </>
              )}
              <Link href={`/brands/${brandSlug}/settings`}>
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/10">
                  <Settings className="w-4 h-4 mr-1.5" />설정
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
                <LogOut className="w-4 h-4 mr-1.5" />로그아웃
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {isFetching && posts.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : fetchError && posts.length === 0 ? (
          <div className="flex flex-col gap-4 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-full bg-red-100 dark:bg-red-950/50 p-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">포스트를 불러오지 못했습니다</h2>
                <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={fetchPosts}>
                <RefreshCw className="w-4 h-4 mr-1.5" />다시 불러오기
              </Button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="space-y-4">
            <FileDropzone onFileSelect={handleFileSelect} isLoading={isLoading} />
            <div className="flex items-center gap-3 p-5 bg-white dark:bg-slate-800 rounded-xl border border-violet-200 dark:border-violet-800 shadow-sm">
              <Wand2 className="w-5 h-5 text-violet-500 shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">파일 없이 AI로 바로 생성</span>
              <input
                type="number" min={7} max={300} step={7}
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="w-20 px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg text-center bg-transparent"
              />
              <span className="text-xs text-slate-400">개</span>
              <Button onClick={handleGenerate} disabled={isGenerating} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isGenerating ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                {isGenerating ? "생성 중..." : "AI 생성"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {fetchError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
              </div>
            )}

            {/* Summary Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{visiblePosts.length}</span>
                  <span className="text-slate-500 dark:text-slate-400">개 포스트{!showPublished && publishedCount > 0 && ` (+완료 ${publishedCount}개 숨김)`}</span>
                </div>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input type="checkbox" checked={showPublished} onChange={(e) => setShowPublished(e.target.checked)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  완료된 글 보기
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <label className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 sm:p-0 bg-slate-50 dark:bg-slate-900 sm:bg-transparent rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <span>맨 앞으로 추가</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={insertAtFront} onChange={(e) => setInsertAtFront(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-violet-600" />
                  </div>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={handleGenerate} disabled={isGenerating} className="bg-violet-600 hover:bg-violet-700 text-white flex-1 sm:flex-none">
                    {isGenerating ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                    {isGenerating ? "생성 중..." : `AI ${generateCount}개 생성`}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleCreatePost} className="bg-slate-600 hover:bg-slate-700 text-white flex-1 sm:flex-none">
                    <Pencil className="w-4 h-4 mr-1.5" />글 작성
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()} className="flex-1 sm:flex-none">
                    <Upload className="w-4 h-4 mr-1.5" />파일 추가
                  </Button>
                </div>
              </div>
              <input type="file" accept=".xlsx,.md" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
            </div>

            {/* Account Intelligence Panel */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <button onClick={handleToggleAccountIntelligence} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Account Intelligence
                  {accountIntelligence?.latest && (
                    <span className="text-xs text-slate-400 font-normal">
                      ({accountIntelligence.latest.actions.length} 액션)
                    </span>
                  )}
                </div>
                {showAccountIntelligence ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showAccountIntelligence && (
                <AccountIntelligencePanel
                  data={accountIntelligence}
                  isLoading={isLoadingAccountIntelligence}
                  isRunning={isRunningAccountIntelligence}
                  onRefresh={loadAccountIntelligence}
                  onRun={handleRunAccountIntelligence}
                />
              )}
            </div>

            {/* Campaign Experiment Panel */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <button onClick={handleToggleCampaign} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Target className="w-4 h-4 text-cyan-500" />
                  CosmicPath Campaign Engine
                  {campaignSummary && <span className="text-xs text-slate-400 font-normal">({campaignSummary.campaign.id})</span>}
                </div>
                {showCampaign ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showCampaign && (
                <CampaignSummaryPanel
                  summary={campaignSummary}
                  isLoading={isLoadingCampaign}
                  drafts={campaignMetricDrafts}
                  savingPostId={savingCampaignMetricId}
                  onRefresh={loadCampaignSummary}
                  onDraftChange={handleCampaignDraftChange}
                  onSaveMetrics={handleSaveCampaignMetrics}
                />
              )}
            </div>

            {/* Viral Discovery Panel */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <button onClick={handleToggleViral} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Viral Discovery Loop
                  {viral && viral.sampleSize > 0 && <span className="text-xs text-slate-400 font-normal">({viral.sampleSize}개 레퍼런스)</span>}
                </div>
                {showViral ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showViral && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4">
                  {isLoadingViral ? (
                    <div className="flex items-center justify-center py-6"><RefreshCw className="w-5 h-5 animate-spin text-rose-500" /></div>
                  ) : !viral || viral.sampleSize === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-slate-400">
                      <Radar className="w-8 h-8 opacity-40" />
                      <div>
                        <p>아직 바이럴 레퍼런스가 없습니다.</p>
                        <p className="text-xs">브랜드 토픽과 게시물 성과를 기준으로 후보를 찾습니다.</p>
                      </div>
                      <Button size="sm" onClick={handleRunViralLoop} disabled={isRunningViral} className="bg-rose-600 hover:bg-rose-700 text-white">
                        {isRunningViral ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Radar className="w-3.5 h-3.5 mr-1.5" />}
                        {isRunningViral ? "실행 중..." : "바이럴 찾고 학습"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowManualReference((value) => !value)} disabled={isSavingManualReference}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        수동 레퍼런스
                      </Button>
                      {showManualReference && (
                        <ManualReferenceForm
                          value={manualReference}
                          onChange={setManualReference}
                          onSubmit={handleSaveManualReference}
                          isSaving={isSavingManualReference}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 p-3">
                          <p className="text-xs text-rose-500 dark:text-rose-300">레퍼런스</p>
                          <p className="text-xl font-bold text-slate-800 dark:text-white">{viral.sampleSize.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400">평균 바이럴 점수</p>
                          <p className="text-xl font-bold text-slate-800 dark:text-white">{viral.memory.avgViralScore.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 p-3">
                          <p className="text-xs text-amber-600 dark:text-amber-300">학습 패턴</p>
                          <p className="text-xl font-bold text-slate-800 dark:text-white">{viral.topPatterns.length.toLocaleString()}</p>
                        </div>
                      </div>

                      {viral.memory.recommendations.length > 0 && (
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">바이럴 생성 지침</p>
                          <div className="space-y-1">
                            {viral.memory.recommendations.map((recommendation) => (
                              <p key={recommendation} className="text-sm text-slate-700 dark:text-slate-300">{recommendation}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <ViralPatternList patterns={viral.topPatterns.slice(0, 5)} />
                        <ViralExampleList examples={viral.examples.slice(0, 5)} />
                      </div>

                      {showManualReference && (
                        <ManualReferenceForm
                          value={manualReference}
                          onChange={setManualReference}
                          onSubmit={handleSaveManualReference}
                          isSaving={isSavingManualReference}
                        />
                      )}

                      {viral.errors && viral.errors.length > 0 && (
                        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">외부 소스 일부 실패</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">{viral.errors.slice(0, 2).map(formatViralSourceError).join(" / ")}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowManualReference((value) => !value)} disabled={isSavingManualReference || isRunningViral || isLearningViral} className="text-xs">
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          수동 레퍼런스
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleLearnViral} disabled={isLearningViral || isRunningViral} className="text-xs">
                          {isLearningViral ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />}
                          {isLearningViral ? "학습 중..." : "패턴만 재학습"}
                        </Button>
                        <Button size="sm" onClick={handleRunViralLoop} disabled={isRunningViral || isLearningViral} className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
                          {isRunningViral ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Radar className="w-3.5 h-3.5 mr-1.5" />}
                          {isRunningViral ? "실행 중..." : "바이럴 찾고 학습"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Growth Learning Panel */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <button onClick={handleToggleGrowth} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <BrainCircuit className="w-4 h-4 text-violet-500" />
                  Growth Learning Loop
                  {growth && growth.sampleSize > 0 && <span className="text-xs text-slate-400 font-normal">({growth.sampleSize}개 학습)</span>}
                </div>
                {showGrowth ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showGrowth && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4">
                  {isLoadingGrowth ? (
                    <div className="flex items-center justify-center py-6"><RefreshCw className="w-5 h-5 animate-spin text-violet-500" /></div>
                  ) : !growth || growth.sampleSize === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-slate-400">
                      <Target className="w-8 h-8 opacity-40" />
                      <div>
                        <p>아직 학습 가능한 성과 데이터가 없습니다.</p>
                        <p className="text-xs">메트릭 수집 후 패턴 학습을 실행하면 다음 생성 프롬프트에 반영됩니다.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleLearnGrowth} disabled={isLearningGrowth}>
                        {isLearningGrowth ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />}
                        지금 학습
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 p-3">
                          <p className="text-xs text-violet-500 dark:text-violet-300">학습 표본</p>
                          <p className="text-xl font-bold text-slate-800 dark:text-white">{growth.sampleSize.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400">평균 점수</p>
                          <p className="text-xl font-bold text-slate-800 dark:text-white">{growth.memory.avgScore.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 p-3">
                          <p className="text-xs text-emerald-600 dark:text-emerald-300">승자 패턴</p>
                          <p className="text-xl font-bold text-slate-800 dark:text-white">{growth.memory.winners.length.toLocaleString()}</p>
                        </div>
                      </div>

                      {growth.memory.recommendations.length > 0 && (
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">다음 배치 지침</p>
                          <div className="space-y-1">
                            {growth.memory.recommendations.map((recommendation) => (
                              <p key={recommendation} className="text-sm text-slate-700 dark:text-slate-300">{recommendation}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <PatternList title="잘 먹힌 패턴" patterns={growth.topPatterns.slice(0, 5)} />
                        <PatternList title="재실험 대상" patterns={growth.weakPatterns.slice(0, 5)} muted />
                      </div>

                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleLearnGrowth} disabled={isLearningGrowth} className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
                          {isLearningGrowth ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />}
                          {isLearningGrowth ? "학습 중..." : "성과 패턴 다시 학습"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Analytics Panel */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <button onClick={handleToggleAnalytics} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <BarChart2 className="w-4 h-4 text-violet-500" />
                  공식별 성과 분석
                  {analytics && analytics.total > 0 && <span className="text-xs text-slate-400 font-normal">({analytics.total}개 게시물 기준)</span>}
                </div>
                {showAnalytics ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showAnalytics && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4">
                  {isLoadingAnalytics ? (
                    <div className="flex items-center justify-center py-6"><RefreshCw className="w-5 h-5 animate-spin text-violet-500" /></div>
                  ) : analytics?.message || !analytics?.byFormula.length ? (
                    <div className="text-center py-6 text-sm text-slate-400">
                      <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      아직 수집된 성과 데이터가 없어요.<br />
                      <span className="text-xs">게시 후 2일이 지나면 자동으로 수집됩니다.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                              <th className="text-left pb-2 font-medium">공식</th>
                              <th className="text-right pb-2 font-medium">횟수</th>
                              <th className="text-right pb-2 font-medium">평균 조회</th>
                              <th className="text-right pb-2 font-medium">평균 좋아요</th>
                              <th className="text-right pb-2 font-medium">종합점수</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {analytics.byFormula.map((f, i) => (
                              <tr key={f.formulaId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                <td className="py-2 font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                  {i === 0 ? <span className="text-xs">🥇</span> : i === analytics.byFormula.length - 1 && analytics.byFormula.length > 1 ? <span className="text-xs">🔻</span> : <span className="w-4" />}
                                  {f.formulaId}
                                </td>
                                <td className="py-2 text-right text-slate-500">{f.count}</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-300">{f.avgViews.toLocaleString()}</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-300">{f.avgLikes.toLocaleString()}</td>
                                <td className="py-2 text-right font-semibold text-violet-600 dark:text-violet-400">{f.engagementScore.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end pt-1">
                        <Button size="sm" onClick={handleOptimize} disabled={isOptimizing} className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
                          {isOptimizing ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                          {isOptimizing ? "최적화 중..." : "공식 가중치 최적화"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Posts Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePosts.map((dbPost, index) => (
                <PostCard
                  key={dbPost.id}
                  post={convertToCardPost(dbPost)}
                  index={index}
                  isPosted={dbPost.status === "PUBLISHED"}
                  dbPostId={dbPost.id}
                  status={dbPost.status}
                  threadsId={dbPost.threadsId}
                  errorLog={dbPost.errorLog}
                  formulaId={dbPost.formulaId}
                  topic={dbPost.topic}
                  targetAudience={dbPost.targetAudience}
                  hookType={dbPost.hookType}
                  ctaType={dbPost.ctaType}
                  qualityScore={dbPost.qualityScore}
                  qualityProfile={dbPost.qualityProfile}
                  qualityPass={dbPost.qualityPass}
                  qualityReasons={dbPost.qualityReasons}
                  campaignId={dbPost.campaignId}
                  campaignFormulaId={dbPost.campaignFormulaId}
                  careerDecisionType={dbPost.careerDecisionType}
                  linkUrl={dbPost.linkUrl}
                  utmContent={dbPost.utmContent}
                  clicks={dbPost.clicks}
                  conversions={dbPost.conversions}
                  manualPaidConversions={dbPost.manualPaidConversions}
                  performanceScore={dbPost.performanceScore}
                  performanceTier={dbPost.performanceTier}
                  onUpdate={() => { }}
                  onDelete={() => handleDeletePost(dbPost.id)}
                  onRefresh={fetchPosts}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AccountIntelligencePanel({
  data,
  isLoading,
  isRunning,
  onRefresh,
  onRun,
}: {
  data: AccountIntelligenceData | null;
  isLoading: boolean;
  isRunning: boolean;
  onRefresh: () => void;
  onRun: () => void;
}) {
  const latest = data?.latest ?? null;

  if (isLoading) {
    return (
      <div className="border-t border-slate-100 dark:border-slate-700 p-6 flex justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="border-t border-slate-100 dark:border-slate-700 p-6 text-center text-sm text-slate-400">
        아직 계정 분석 스냅샷이 없습니다.
        <div className="mt-3">
          <Button size="sm" onClick={onRun} disabled={isRunning} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isRunning ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-1.5" />}
            {isRunning ? "분석 중..." : "지금 분석"}
          </Button>
        </div>
      </div>
    );
  }

  const metrics = latest.metrics;
  return (
    <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">{latest.summary}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatDateTime(latest.generatedAt)} · {metrics.metricsRefresh.updated}/{metrics.metricsRefresh.attempted} metrics updated
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} className="text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />새로고침
          </Button>
          <Button size="sm" onClick={onRun} disabled={isRunning} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            {isRunning ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-1.5" />}
            {isRunning ? "분석 중..." : "지금 분석"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="발행/예약" value={`${metrics.publishedPosts}/${metrics.pendingPosts}`} sub={`${metrics.windowHours}h window`} />
        <MetricTile label="댓글" value={String(metrics.totalReplies)} sub={`리포스트 ${metrics.totalReposts}`} />
        <MetricTile label="평균 점수" value={String(metrics.avgPerformanceScore)} sub={`조회 ${metrics.totalViews}`} />
        <MetricTile label="전환 신호" value={String(metrics.totalConversions)} sub={`클릭 ${metrics.totalClicks}`} />
      </div>

      {latest.actions.length === 0 ? (
        <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3 text-sm text-slate-400">
          지금 당장 처리할 액션은 없습니다.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {latest.actions.map((action) => (
            <div key={action.id} className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass(action.priority)}`}>
                  {priorityLabel(action.priority)}
                </span>
                <span className="text-xs text-slate-400">{actionTypeLabel(action.type)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">{action.title}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{action.detail}</p>
              {(action.formulaId || action.postId) && (
                <p className="mt-2 text-xs text-slate-400">
                  {action.formulaId && `포맷 ${action.formulaId}`}
                  {action.formulaId && action.postId && " · "}
                  {action.postId && `post ${action.postId.slice(0, 8)}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignSummaryPanel({
  summary,
  isLoading,
  drafts,
  savingPostId,
  onRefresh,
  onDraftChange,
  onSaveMetrics,
}: {
  summary: CampaignSummaryData | null;
  isLoading: boolean;
  drafts: Record<string, CampaignMetricDraft>;
  savingPostId: string | null;
  onRefresh: () => void;
  onDraftChange: (postId: string, field: keyof CampaignMetricDraft, value: string) => void;
  onSaveMetrics: (postId: string) => void;
}) {
  const copyPlaybook = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("답글 템플릿 복사됨");
    } catch {
      toast.error("복사 실패");
    }
  };

  if (isLoading) {
    return (
      <div className="border-t border-slate-100 dark:border-slate-700 p-6 flex justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="border-t border-slate-100 dark:border-slate-700 p-6 text-center text-sm text-slate-400">
        캠페인 데이터를 불러오지 못했습니다.
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />다시 불러오기
          </Button>
        </div>
      </div>
    );
  }

  const playbookEntries: Array<{ key: keyof CampaignSummaryData["replyPlaybook"]; label: string }> = [
    { key: "stay", label: "버팀형" },
    { key: "move", label: "이동형" },
    { key: "prepare", label: "준비형" },
    { key: "cta", label: "CTA" },
  ];

  return (
    <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">{summary.campaign.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            랜딩 {summary.campaign.landingUrl} · 하루 {summary.campaign.dailyPostTarget}개 · {summary.campaign.linkCadenceEvery}개 중 1개 링크
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} className="text-xs">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />새로고침
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="오늘 캠페인" value={`${summary.todayScheduled.length}`} sub={`목표 ${summary.campaign.dailyPostTarget}`} />
        <MetricTile label="링크 비율" value={`${summary.linkRatio.linked}/${summary.linkRatio.total}`} sub={`${summary.linkRatio.percent}%`} />
        <MetricTile label="Quality" value={`${summary.quality.passed}/${summary.quality.total}`} sub={summary.quality.failed ? `fail ${summary.quality.failed}` : "pass"} />
        <MetricTile label="반응" value={`${summary.metrics.replies} 댓글`} sub={`조회 ${summary.metrics.views} · 리포스트 ${summary.metrics.reposts}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">오늘 캠페인 포스트</p>
          {summary.todayScheduled.length === 0 ? (
            <p className="text-sm text-slate-400">오늘 생성/발행된 캠페인 포스트가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {summary.todayScheduled.map((post, index) => {
                const draft = drafts[post.id] ?? {
                  clicks: String(post.clicks),
                  conversions: String(post.conversions),
                  manualPaidConversions: String(post.manualPaidConversions),
                };
                return (
                  <div key={post.id} className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">#{index + 1} · {post.status} · {post.campaignFormulaId ?? "formula"}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        post.qualityPass
                          ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      }`}>
                        {post.qualityPass ? "PASS" : "FAIL"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{post.content}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {post.linkUrl ? "링크 포함" : "링크 없음"} · 댓글 {post.replies} · 리포스트 {post.reposts} · {careerDecisionLabel(post.careerDecisionType ?? "")}
                    </p>
                    {post.linkUrl && <p className="mt-1 break-all text-xs text-cyan-600 dark:text-cyan-300">{post.linkUrl}</p>}
                    {post.qualityReasons.length > 0 && <p className="mt-1 text-xs text-red-500">{post.qualityReasons.join(" / ")}</p>}
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <input
                        type="number"
                        min={0}
                        value={draft.clicks}
                        onChange={(event) => onDraftChange(post.id, "clicks", event.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                        placeholder="클릭"
                      />
                      <input
                        type="number"
                        min={0}
                        value={draft.conversions}
                        onChange={(event) => onDraftChange(post.id, "conversions", event.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                        placeholder="전환"
                      />
                      <input
                        type="number"
                        min={0}
                        value={draft.manualPaidConversions}
                        onChange={(event) => onDraftChange(post.id, "manualPaidConversions", event.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                        placeholder="유료전환"
                      />
                      <Button size="sm" variant="outline" onClick={() => onSaveMetrics(post.id)} disabled={savingPostId === post.id} className="text-xs">
                        {savingPostId === post.id ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                        저장
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Reply Playbook</p>
          <div className="space-y-2">
            {playbookEntries.map((entry) => (
              <button
                key={entry.key}
                onClick={() => copyPlaybook(summary.replyPlaybook[entry.key])}
                className="w-full rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 text-left hover:border-cyan-300 dark:hover:border-cyan-700"
              >
                <span className="block text-xs font-semibold text-cyan-600 dark:text-cyan-300">{entry.label}</span>
                <span className="mt-1 block text-sm text-slate-700 dark:text-slate-200">{summary.replyPlaybook[entry.key]}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            자동 댓글/DM은 실행하지 않습니다. 운영자가 상황에 맞는 템플릿만 복사해 답합니다.
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400">
        성과 점수 가중치: 댓글 {summary.scoreWeights.replies}% · 리포스트 {summary.scoreWeights.reposts}% · 조회 {summary.scoreWeights.views}% · 클릭/전환 {summary.scoreWeights.clicksConversions}%
      </div>
    </div>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900 p-3">
      <p className="text-xs text-cyan-600 dark:text-cyan-300">{label}</p>
      <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

function PatternList({
  title,
  patterns,
  muted = false,
}: {
  title: string;
  patterns: GrowthPattern[];
  muted?: boolean;
}) {
  if (patterns.length === 0) {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{title}</p>
        <p className="text-sm text-slate-400">표본이 더 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{title}</p>
      <div className="space-y-2">
        {patterns.map((pattern) => (
          <div key={`${pattern.dimension}-${pattern.value}`} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {dimensionLabel(pattern.dimension)} · {pattern.value}
              </p>
              <p className="text-xs text-slate-400">
                {pattern.count}회 · 조회 {pattern.avgViews.toLocaleString()} · 댓글 {pattern.avgReplies.toLocaleString()} · 리포스트 {pattern.avgReposts.toLocaleString()}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
              muted
                ? "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
            }`}>
              {pattern.avgScore.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManualReferenceForm({
  value,
  onChange,
  onSubmit,
  isSaving,
}: {
  value: ManualReferenceFormState;
  onChange: (value: ManualReferenceFormState) => void;
  onSubmit: () => void;
  isSaving: boolean;
}) {
  const update = (key: keyof ManualReferenceFormState, nextValue: string) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="w-full rounded-lg border border-rose-100 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/10 p-3 text-left">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">레퍼런스 본문</label>
          <textarea
            rows={5}
            value={value.content}
            onChange={(event) => update("content", event.target.value)}
            className="w-full resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            placeholder="바이럴된 글의 본문을 붙여넣기"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={value.permalink}
              onChange={(event) => update("permalink", event.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              placeholder="링크 선택"
            />
            <input
              value={value.authorUsername}
              onChange={(event) => update("authorUsername", event.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              placeholder="작성자 선택"
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">선택 메트릭</p>
          <div className="grid grid-cols-2 gap-2">
            {MANUAL_METRIC_FIELDS.map((field) => (
              <input
                key={field.key}
                type="number"
                min={0}
                value={value[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                placeholder={field.label}
              />
            ))}
          </div>
          <Button onClick={onSubmit} disabled={isSaving} size="sm" className="w-full bg-rose-600 hover:bg-rose-700 text-white">
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Flame className="w-3.5 h-3.5 mr-1.5" />}
            {isSaving ? "저장 중..." : "저장하고 학습"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ViralPatternList({ patterns }: { patterns: ViralPatternData[] }) {
  if (patterns.length === 0) {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">바이럴 패턴</p>
        <p className="text-sm text-slate-400">표본이 더 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">바이럴 패턴</p>
      <div className="space-y-2">
        {patterns.map((pattern) => (
          <div key={pattern.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {viralDimensionLabel(pattern.dimension)} · {pattern.value}
              </p>
              <p className="text-xs text-slate-400">
                {pattern.sourceCount}개 · 신뢰도 {pattern.confidence} · 평균 {pattern.avgViralScore.toLocaleString()}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-1 text-xs font-semibold">
              {pattern.avgViralScore.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViralExampleList({ examples }: { examples: ViralExampleData[] }) {
  if (examples.length === 0) {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">상위 레퍼런스</p>
        <p className="text-sm text-slate-400">아직 저장된 레퍼런스가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">상위 레퍼런스</p>
      <div className="space-y-3">
        {examples.map((example) => (
          <div key={example.id} className="space-y-1 border-b border-slate-50 dark:border-slate-700/50 last:border-0 last:pb-0 pb-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                {sourceLabel(example.source)} · {example.hookType ?? "훅 미분류"}
              </p>
              <span className="rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300 px-2 py-0.5 text-xs font-semibold">
                {example.viralScore.toLocaleString()}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{example.content}</p>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span>{example.patternSummary ?? "패턴 분석 대기"}</span>
              {example.permalink && (
                <a href={example.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600">
                  열기 <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function dimensionLabel(dimension: string): string {
  const labels: Record<string, string> = {
    formula: "공식",
    hook: "훅",
    topic: "주제",
    target: "타겟",
    cta: "CTA",
  };
  return labels[dimension] ?? dimension;
}

function viralDimensionLabel(dimension: string): string {
  const labels: Record<string, string> = {
    hook: "훅",
    topic: "주제",
    emotion: "감정",
    structure: "구조",
    cta: "CTA",
  };
  return labels[dimension] ?? dimension;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    own_post: "내 게시물",
    owned_posts: "내 게시물",
    manual: "수동 입력",
    threads_keyword: "키워드",
    threads_profile: "프로필",
  };
  return labels[source] ?? source;
}

function careerDecisionLabel(value: string): string {
  const labels: Record<string, string> = {
    stay: "버팀형",
    move: "이동형",
    prepare: "준비형",
  };
  return labels[value] ?? value;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function priorityClass(priority: string): string {
  const classes: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return classes[priority] ?? classes.low;
}

function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    high: "높음",
    medium: "보통",
    low: "낮음",
  };
  return labels[priority] ?? priority;
}

function actionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    reply_now: "답글",
    boost_format: "확대",
    reduce_format: "축소",
    link_ratio_warning: "링크",
    quality_warning: "품질",
    watch_post: "관찰",
  };
  return labels[type] ?? type;
}

function formatViralSourceError(error: ViralSourceError): string {
  return `${sourceLabel(error.adapter)}:${error.source} - ${error.message}`;
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalMetric(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
}
