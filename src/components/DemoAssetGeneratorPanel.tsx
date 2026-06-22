"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { 
  RefreshCw, Sparkles, Sliders, Globe, AlertCircle, CheckCircle, 
  Download, Copy, Play, Image, FileText, Check, Cpu, Loader2
} from "lucide-react";
import { toast } from "sonner";
import type { 
  DemoAssetJobResponse, DemoAssetStyle
} from "../types/demo-asset";

interface DemoAssetGeneratorPanelProps {
  brandId: string;
}

const STYLE_DETAILS: Array<{
  id: DemoAssetStyle;
  name: string;
  desc: string;
  emoji: string;
  badgeColor: string;
}> = [
  {
    id: "clean-product-demo",
    name: "Minimalist Premium Dark",
    desc: "글래스모피즘 & 디바이스 Y축 플로팅 + Z-axis 튕김 트랜지션 (프리미엄 테크/SaaS 앱 추천)",
    emoji: "✨",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  {
    id: "problem-solution-demo",
    name: "Interactive Split-Screen",
    desc: "상하 2단 분할 스토리텔링 대화형 흐름 (일상 유틸리티 및 문제 해결형 앱 추천)",
    emoji: "💬",
    badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  },
  {
    id: "feature-walkthrough",
    name: "Bento Grid Showcase",
    desc: "카드 격자 스태거드 오프닝 레이아웃 (기능이 다양하고 대시보드 화면이 중심인 앱 추천)",
    emoji: "🍱",
    badgeColor: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  },
  {
    id: "social-proof-teaser",
    name: "Kinetic Typography",
    desc: "초대형 볼드 텍스트 팝업 중심의 퀵 컷 스타일 (1020 숏폼 소셜 바이럴 마케팅 추천)",
    emoji: "⚡",
    badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  },
  {
    id: "both",
    name: "Both (All-in-One)",
    desc: "마케팅용 바이럴 영상과 프리미엄 제품 데모 영상을 동시에 생성 (권장)",
    emoji: "🚀",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
];

export default function DemoAssetGeneratorPanel({ brandId }: DemoAssetGeneratorPanelProps) {
  const [productUrl, setProductUrl] = useState("");
  const [style, setStyle] = useState<DemoAssetStyle>("clean-product-demo");
  const [videoCount, setVideoCount] = useState(1);
  const [imageCount, setImageCount] = useState(3);
  const [productContext, setProductContext] = useState("");

  const [jobs, setJobs] = useState<DemoAssetJobResponse[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [activeAssetTab, setActiveAssetTab] = useState<Record<string, "video" | "image" | "plan">>({});
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);

  // Fetch jobs
  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingJobs(true);
    try {
      const response = await fetch(`/api/demo-assets/jobs?brandId=${brandId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch demo asset jobs");
      }
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error(error);
      toast.error("작업 내역을 가져오는데 실패했습니다.");
    } finally {
      if (!silent) setIsLoadingJobs(false);
    }
  }, [brandId]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Polling for active jobs
  const hasActiveJob = useMemo(() => {
    const activeStatuses = ["QUEUED", "CAPTURING", "PLANNING", "RENDERING"];
    return jobs.some(job => activeStatuses.includes(job.status));
  }, [jobs]);

  useEffect(() => {
    if (!hasActiveJob) return;

    const interval = setInterval(() => {
      fetchJobs(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [hasActiveJob, fetchJobs]);

  // Submit new job
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productUrl.trim()) {
      toast.error("제품 URL을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/demo-assets/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          productUrl,
          style,
          videoCount,
          imageCount,
          productContext: productContext.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "작업 요청에 실패했습니다.");
      }

      toast.success("데모 에셋 생성 작업이 큐에 추가되었습니다!");
      setProductUrl("");
      setProductContext("");
      // Expand the newly created job
      setExpandedJobId(data.id);
      fetchJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "작업 요청 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Regenerate job
  const handleRegenerate = async (jobId: string) => {
    try {
      const response = await fetch(`/api/demo-assets/jobs/${jobId}/regenerate`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "재작업 요청에 실패했습니다.");
      }
      toast.success("재시작 요청 완료!");
      fetchJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "재시작 실패");
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "QUEUED": return "대기 중";
      case "CAPTURING": return "화면 캡처 중...";
      case "PLANNING": return "AI 크리에이티브 기획 중...";
      case "RENDERING": return "미디어 렌더링 중...";
      case "READY": return "생성 완료";
      case "FAILED_CAPTURE": return "캡처 실패";
      case "FAILED_PLAN": return "AI 기획 실패";
      case "FAILED_RENDER": return "렌더링 실패";
      case "FAILED_QUALITY": return "품질 검증 실패";
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    const isSpinning = ["CAPTURING", "PLANNING", "RENDERING"].includes(status);
    if (isSpinning) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (status === "QUEUED") return <Cpu className="w-4 h-4 text-slate-400" />;
    if (status === "READY") return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    return <AlertCircle className="w-4 h-4 text-rose-500" />;
  };

  const getStatusClass = (status: string) => {
    if (status === "READY") return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (status.startsWith("FAILED_")) return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    if (status === "QUEUED") return "bg-slate-800 text-slate-400 border border-slate-700";
    return "bg-violet-500/10 text-violet-400 border border-violet-500/20";
  };

  const getCreativePlan = (job: DemoAssetJobResponse) => {
    const planArtifact = job.captureArtifacts?.find(
      art => art.type === "METADATA" && art.metaData?.includes("creative_plan")
    );
    if (!planArtifact?.metaData) return null;
    try {
      const parsed = JSON.parse(planArtifact.metaData);
      return parsed.plan;
    } catch {
      return null;
    }
  };

  const handleCopyPlan = (jobId: string, planText: string) => {
    navigator.clipboard.writeText(planText);
    setCopiedPlanId(jobId);
    toast.success("기획서 스크립트가 클립보드에 복사되었습니다.");
    setTimeout(() => setCopiedPlanId(null), 2000);
  };

  return (
    <div className="space-y-6 text-slate-205 p-4 md:p-6 bg-slate-900/60 rounded-xl border border-slate-800 backdrop-blur-md">
      
      {/* 🚀 New Generation Request Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            URL 기반 제품 데모 에셋 생성기
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            제품 URL을 기반으로 모바일 화면을 캡처하고 기획안 작성 후 Remotion으로 9:16 비디오 및 프로모션 이미지를 자동 생성합니다.
          </p>
        </div>

        <div className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-slate-400" />
              제품 URL (Product Landing Page)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                required
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors placeholder-slate-600"
              />
            </div>
          </div>

          {/* Context Override */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              추가 제품 설명 및 소구포인트 (선택사항)
            </label>
            <textarea
              value={productContext}
              onChange={(e) => setProductContext(e.target.value)}
              placeholder="예: AI 비서 기능 강조, 홈 화면 대시보드의 데이터를 캡처에 중점적으로 활용해줘."
              rows={2}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors placeholder-slate-600 resize-none"
            />
          </div>

          {/* Visual Style Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-slate-400" />
              렌더링 비주얼 스타일 선택
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {STYLE_DETAILS.map((styleOpt) => (
                <div
                  key={styleOpt.id}
                  onClick={() => setStyle(styleOpt.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    style === styleOpt.id
                      ? "bg-slate-950 border-violet-500/80 shadow-md shadow-violet-950/20"
                      : "bg-slate-950/50 border-slate-850 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{styleOpt.emoji}</span>
                    <span className="font-semibold text-sm text-slate-100">{styleOpt.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{styleOpt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Video & Image Count Steppers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">동영상 생성 수 (1-5개)</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setVideoCount(v => Math.max(1, v - 1))}
                  className="w-9 h-9 rounded-lg bg-slate-850 border border-slate-800 hover:bg-slate-800 text-lg flex items-center justify-center font-bold"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-semibold">{videoCount}</span>
                <button
                  type="button"
                  onClick={() => setVideoCount(v => Math.min(5, v + 1))}
                  className="w-9 h-9 rounded-lg bg-slate-850 border border-slate-800 hover:bg-slate-800 text-lg flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">이미지 생성 수 (1-12개)</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setImageCount(v => Math.max(1, v - 1))}
                  className="w-9 h-9 rounded-lg bg-slate-850 border border-slate-800 hover:bg-slate-800 text-lg flex items-center justify-center font-bold"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-semibold">{imageCount}</span>
                <button
                  type="button"
                  onClick={() => setImageCount(v => Math.min(12, v + 1))}
                  className="w-9 h-9 rounded-lg bg-slate-850 border border-slate-800 hover:bg-slate-800 text-lg flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isSubmitting ? "생성 작업 대기 중..." : "데모 에셋 생성 시작"}
        </button>
      </form>

      {/* 📋 Past Jobs List */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            데모 생성 이력 및 결과
            {isLoadingJobs && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          </h3>
          <button
            type="button"
            onClick={() => fetchJobs()}
            className="p-1.5 rounded-lg bg-slate-850 border border-slate-800 hover:bg-slate-800 text-xs text-slate-400 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500 border border-dashed border-slate-800 rounded-lg">
            아직 생성된 에셋이 없습니다. 제품 URL을 입력해 에셋을 생성해보세요.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              const tab = activeAssetTab[job.id] || "video";
              const plan = getCreativePlan(job);

              return (
                <div 
                  key={job.id} 
                  className="bg-slate-950/80 rounded-xl border border-slate-850 overflow-hidden transition-all"
                >
                  {/* Card Header (Click to toggle expand) */}
                  <div
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                    className="p-4 flex flex-col gap-2 md:flex-row md:items-center justify-between cursor-pointer hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200 break-all">{job.productUrl}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(job.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className={`px-2 py-0.5 rounded border ${STYLE_DETAILS.find(s => s.id === job.style)?.badgeColor}`}>
                          {STYLE_DETAILS.find(s => s.id === job.style)?.name}
                        </span>
                        <span>비디오 {job.videoCount}개</span>
                        <span>이미지 {job.imageCount}개</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(job.status)}`}>
                        {getStatusIcon(job.status)}
                        {getStatusText(job.status)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-900 bg-slate-950 p-4 space-y-4">
                      {/* Active or Failed Job detail */}
                      {!["READY", "FAILED_CAPTURE", "FAILED_PLAN", "FAILED_RENDER", "FAILED_QUALITY"].includes(job.status) && (
                        <div className="flex items-center gap-3 p-3 bg-violet-950/10 border border-violet-950/30 rounded-lg text-sm text-violet-400">
                          <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                          <div>
                            <p className="font-semibold">{getStatusText(job.status)}</p>
                            <p className="text-xs text-slate-500 mt-0.5">서버 백그라운드 워커가 파이프라인 단계를 처리 중입니다. 페이지가 자동으로 업데이트됩니다.</p>
                          </div>
                        </div>
                      )}

                      {job.status.startsWith("FAILED_") && (
                        <div className="p-3 bg-rose-950/10 border border-rose-950/30 rounded-lg space-y-3">
                          <div className="flex items-start gap-2.5 text-sm text-rose-400">
                            <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">작업 처리 중 에러 발생</p>
                              <p className="text-xs text-rose-300/80 mt-1 break-all bg-slate-900 p-2 rounded border border-rose-950/20 font-mono">
                                {job.errorReason || "알 수 없는 에러가 발생했습니다."}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegenerate(job.id);
                              }}
                              className="flex items-center gap-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              다시 시도하기
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Ready State / Asset Display */}
                      {job.status === "READY" && (
                        <div className="space-y-4">
                          {/* Tabs */}
                          <div className="flex border-b border-slate-850">
                            <button
                              type="button"
                              onClick={() => setActiveAssetTab(curr => ({ ...curr, [job.id]: "video" }))}
                              className={`px-4 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                                tab === "video"
                                  ? "border-violet-500 text-violet-400"
                                  : "border-transparent text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <Play className="w-3.5 h-3.5" />
                              비디오 ({job.renderedAssets?.filter(a => a.type === "VIDEO").length || 0})
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveAssetTab(curr => ({ ...curr, [job.id]: "image" }))}
                              className={`px-4 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                                tab === "image"
                                  ? "border-violet-500 text-violet-400"
                                  : "border-transparent text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <Image className="w-3.5 h-3.5" />
                              이미지 ({job.renderedAssets?.filter(a => a.type === "IMAGE").length || 0})
                            </button>
                            {plan && (
                              <button
                                type="button"
                                onClick={() => setActiveAssetTab(curr => ({ ...curr, [job.id]: "plan" }))}
                                className={`px-4 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                                  tab === "plan"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                AI 기획서
                              </button>
                            )}
                          </div>

                          {/* Tab Contents */}
                          <div className="py-2">
                            {/* Videos Tab */}
                            {tab === "video" && (
                              <div className="grid gap-4 sm:grid-cols-2">
                                {(job.renderedAssets || [])
                                  .filter(a => a.type === "VIDEO")
                                  .map((asset, index) => {
                                    const isPlaceholder = asset.fileSize < 1024;
                                    return (
                                      <div key={asset.id} className="bg-slate-900 rounded-lg p-3 border border-slate-850 space-y-3">
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                          <span className="font-semibold text-slate-300">
                                            비디오 #{index + 1} {asset.style && `· ${STYLE_DETAILS.find(s => s.id === asset.style)?.name || asset.style}`}
                                          </span>
                                          <span>{(asset.fileSize / 1024).toFixed(1)} KB</span>
                                        </div>
                                        
                                        {/* Video preview / placeholder details */}
                                        {isPlaceholder ? (
                                          <div className="aspect-[9/16] bg-slate-950 rounded-md border border-slate-900 p-4 flex flex-col justify-between text-xs text-slate-400 select-none">
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-1.5 text-amber-500">
                                                <Cpu className="w-3.5 h-3.5" />
                                                <span>Placeholder Video Manifest</span>
                                              </div>
                                              <p className="text-[10px] text-slate-500 leading-normal break-all font-mono bg-slate-900 p-2 rounded">
                                                ID: {asset.id}<br/>
                                                SHA256: {asset.sha256.slice(0, 16)}...
                                              </p>
                                            </div>
                                            <div className="space-y-1">
                                              <p>스타일: {STYLE_DETAILS.find(s => s.id === asset.style)?.name}</p>
                                              <p>해상도: 1080 x 1920 (9:16)</p>
                                              <p className="text-slate-500 mt-1">실제 Remotion 비디오 렌더러 연동 테스트를 통과한 메타데이터 파일입니다.</p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="aspect-[9/16] bg-slate-950 rounded-md overflow-hidden border border-slate-900 relative group">
                                            <video
                                              src={asset.downloadUrl || `/api/demo-assets/downloads?token=${asset.id}`}
                                              controls
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        )}

                                        <div className="flex gap-2">
                                          <a
                                            href={(asset.downloadUrl || "") + "&download=true"}
                                            download
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs py-1.5 rounded font-semibold transition-colors border border-slate-800 text-center"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                            다운로드
                                          </a>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}

                            {/* Images Tab */}
                            {tab === "image" && (
                              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                                {(job.renderedAssets || [])
                                  .filter(a => a.type === "IMAGE")
                                  .map((asset, index) => {
                                    const isPlaceholder = asset.fileSize < 1024;
                                    return (
                                      <div key={asset.id} className="bg-slate-900 rounded-lg p-2.5 border border-slate-850 space-y-2">
                                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                                          <span className="font-semibold text-slate-300">
                                            이미지 #{index + 1} {asset.style && `· ${STYLE_DETAILS.find(s => s.id === asset.style)?.name || asset.style}`}
                                          </span>
                                          <span>{(asset.fileSize / 1024).toFixed(1)} KB</span>
                                        </div>

                                        {isPlaceholder ? (
                                          <div className="aspect-[9/16] bg-slate-950 rounded border border-slate-900 p-2 flex flex-col justify-between text-[10px] text-slate-500 font-mono select-none">
                                            <div>
                                              <div className="flex items-center gap-1 text-cyan-500 font-sans font-semibold mb-1">
                                                <Image className="w-3 h-3" />
                                                <span>Placeholder</span>
                                              </div>
                                              <p className="break-all opacity-85 text-[8px]">SHA: {asset.sha256.slice(0, 10)}</p>
                                            </div>
                                            <p className="font-sans leading-normal">
                                              1080 x 1920<br/>
                                              {STYLE_DETAILS.find(s => s.id === asset.style)?.name}
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="aspect-[9/16] bg-slate-950 rounded overflow-hidden border border-slate-900">
                                            <img
                                              src={asset.downloadUrl || `/api/demo-assets/downloads?token=${asset.id}`}
                                              alt={`Rendered promotion screenshot #${index + 1}`}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        )}

                                        <a
                                          href={(asset.downloadUrl || "") + "&download=true"}
                                          download
                                          className="w-full flex items-center justify-center gap-1 bg-slate-805 hover:bg-slate-800 text-slate-205 text-[11px] py-1 rounded font-semibold transition-colors border border-slate-800"
                                        >
                                          <Download className="w-3 h-3" />
                                          다운로드
                                        </a>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}

                            {/* Creative Plan Tab */}
                            {tab === "plan" && plan && (
                              <div className="bg-slate-900 rounded-lg p-4 border border-slate-850 space-y-4 text-sm">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                  <span className="font-bold text-slate-205 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-violet-500" />
                                    AI 생성 숏폼 광고 시나리오 기획서
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const text = `[광고 시나리오 기획서]\n제품 URL: ${job.productUrl}\n스타일: ${plan.style}\n\n[주요 씬 리스트]\n${plan.scenes.map((s: any, i: number) => `Scene ${i + 1} (${(s.durationFrames/plan.fps).toFixed(1)}s):\n- 비주얼: ${s.visualDirection}\n- 오디오/자막: ${s.elements.map((e: any) => e.text).join(", ")}`).join("\n\n")}\n\n[소셜 본문]\n본문: ${plan.caption}\n해시태그: ${plan.hashtags?.join(" ")}`;
                                      handleCopyPlan(job.id, text);
                                    }}
                                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs px-2.5 py-1 rounded transition-colors"
                                  >
                                    {copiedPlanId === job.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedPlanId === job.id ? "복사됨!" : "기획서 전체 복사"}
                                  </button>
                                </div>

                                <div className="space-y-4">
                                  {/* Overview */}
                                  <div className="grid gap-2 grid-cols-2 text-[11px] bg-slate-950 p-2.5 rounded border border-slate-850">
                                    <div><span className="text-slate-500">전체 길이:</span> <span className="font-semibold text-slate-300">{(plan.totalDurationFrames / plan.fps).toFixed(1)}초 ({plan.totalDurationFrames} 프레임)</span></div>
                                    <div><span className="text-slate-500">프레임 레이트:</span> <span className="font-semibold text-slate-300">{plan.fps} FPS</span></div>
                                    <div><span className="text-slate-500">추출 키워드:</span> <span className="font-semibold text-slate-300">{plan.keywords?.slice(0, 5).join(", ") || "없음"}</span></div>
                                    <div><span className="text-slate-500">추출 타깃층:</span> <span className="font-semibold text-slate-300">{plan.targetAudience || "일반 사용자"}</span></div>
                                  </div>

                                  {/* Scene list */}
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">비디오 씬 스크립트 구성</h4>
                                    <div className="space-y-2">
                                      {plan.scenes.map((scene: any, index: number) => (
                                        <div key={index} className="bg-slate-950/60 p-3 rounded-lg border border-slate-850/60 space-y-1.5">
                                          <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span className="font-semibold text-slate-400">Scene {index + 1} ({scene.type})</span>
                                            <span>{(scene.durationFrames / plan.fps).toFixed(1)}초</span>
                                          </div>
                                          <p className="text-xs text-slate-300 leading-normal"><span className="text-slate-500 font-medium">비주얼:</span> {scene.visualDirection}</p>
                                          {scene.elements.filter((e: any) => e.type === "SUBTITLE").map((el: any, i: number) => (
                                            <p key={i} className="text-xs text-violet-400 font-medium leading-normal"><span className="text-slate-500 font-medium">자막:</span> "{el.text}"</p>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Social text */}
                                  <div className="space-y-2.5 pt-2 border-t border-slate-850">
                                    <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">추천 게시물 캡션</h4>
                                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
                                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{plan.caption}</p>
                                      <p className="text-xs text-violet-400 leading-relaxed break-all">{plan.hashtags?.join(" ")}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
