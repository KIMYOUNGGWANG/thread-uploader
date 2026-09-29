"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AccountHealthState } from "@/types/brand";

interface AccountHealthBannerProps {
  brandId: string;
  brandSlug: string;
  brandName: string;
  accountHealth?: AccountHealthState | null;
  onHealthChange?: () => void;
}

export function AccountHealthBanner({
  brandId,
  brandName,
  accountHealth,
  onHealthChange,
}: AccountHealthBannerProps) {
  const [currentHealth, setCurrentHealth] = useState<AccountHealthState | null | undefined>(accountHealth);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (accountHealth) {
      setCurrentHealth(accountHealth);
    } else {
      fetch(`/api/brands/${brandId}/health`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.accountHealth) {
            setCurrentHealth(data.accountHealth);
          }
        })
        .catch(() => {});
    }
  }, [brandId, accountHealth]);

  const activeHealth = currentHealth ?? accountHealth;
  const status = activeHealth?.status || "HEALTHY";
  const isShadowban = status === "SHADOWBAN_SUSPECTED";
  const isWarning = status === "WARNING";
  const isRecovery = status === "RECOVERY";
  const isHealthy = status === "HEALTHY";

  // Banner theme styling
  const bannerStyle = isShadowban
    ? "bg-rose-950/40 border-rose-800/60 shadow-rose-950/30"
    : isWarning
    ? "bg-amber-950/30 border-amber-800/50 shadow-amber-950/20"
    : isRecovery
    ? "bg-blue-950/30 border-blue-800/50 shadow-blue-950/20"
    : "bg-slate-900/60 border-slate-800/80";

  const badgeStyle = isShadowban
    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
    : isWarning
    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
    : isRecovery
    ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  // On-demand re-evaluation
  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/health`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "헬스 평가 실패");

      if (data.accountHealth) {
        setCurrentHealth(data.accountHealth);
      }
      toast.success(`계정 헬스 재평가 완료: ${data.accountHealth?.status || "정상"}`);
      onHealthChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "헬스 평가 중 오류가 발생했습니다.");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Manual status override
  const handleToggleOverride = async () => {
    const targetStatus = isShadowban ? "HEALTHY" : "SHADOWBAN_SUSPECTED";
    const confirmMessage = isShadowban
      ? "섀도우밴 자율 치유 모드를 해제하고 정상(HEALTHY) 상태로 강제 복구하시겠습니까?"
      : "계정을 섀도우밴 의심(자율 치유 모드) 상태로 강제 전환하시겠습니까? (외부 링크가 차단되고 WARMUP 포스트만 일일 1개 발행됩니다)";

    if (!window.confirm(confirmMessage)) return;

    setIsOverriding(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: `운영자 수동 모드 전환 (${targetStatus})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "상태 변경 실패");

      if (data.accountHealth) {
        setCurrentHealth(data.accountHealth);
      }
      toast.success(`계정 헬스 상태가 '${targetStatus}'(으)로 변경되었습니다.`);
      onHealthChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "상태 변경 중 오류가 발생했습니다.");
    } finally {
      setIsOverriding(false);
    }
  };

  const recentAvg = activeHealth?.metrics?.recentAverageViews ?? 0;
  const baselineAvg = activeHealth?.metrics?.baselineAverageViews ?? 0;
  const dropPct = activeHealth?.metrics?.dropPercentage ?? 0;
  const maxDaily = activeHealth?.healingDirective?.maxDailyPosts ?? 5;
  const todayCount = activeHealth?.publishedTodayCount ?? 0;
  const tier = (activeHealth?.trustTier || "established").toUpperCase();

  return (
    <div
      className={cn(
        "rounded-xl border backdrop-blur-sm p-4 mb-6 transition-all duration-300 shadow-lg",
        bannerStyle
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Status Icon & Headlines */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "p-2.5 rounded-xl border mt-0.5 shrink-0",
              isShadowban
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                : isWarning
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : isRecovery
                ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
            )}
          >
            {isShadowban ? (
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            ) : isWarning ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isRecovery ? (
              <Sparkles className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white tracking-wide">
                계정 안전 & 헬스 콕핏 ({brandName})
              </h3>
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1",
                  badgeStyle
                )}
              >
                {isShadowban && "🚨 섀도우밴 감지 (자율 치유 모드)"}
                {isWarning && "▲ 도달률 경고 구간"}
                {isRecovery && "✦ 회복 진행 중"}
                {isHealthy && "● 정상 운항 중"}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700/60">
                Trust Tier: {tier}
              </span>
            </div>

            {/* Metrics Overview Line */}
            <div className="flex items-center gap-4 text-xs text-slate-300 mt-1.5 flex-wrap">
              <span>
                오늘 발행량:{" "}
                <strong className={isShadowban && todayCount >= maxDaily ? "text-rose-400" : "text-emerald-400"}>
                  {todayCount}
                </strong>{" "}
                / {maxDaily}건
              </span>
              <span className="text-slate-500">•</span>
              <span>
                T+6h 최근 도달률: <strong>{recentAvg}뷰</strong>
                {baselineAvg > 0 && (
                  <span className={cn("ml-1 font-mono", dropPct >= 50 ? "text-rose-400" : "text-slate-400")}>
                    (기준 {baselineAvg}뷰 대비 {dropPct > 0 ? `-${dropPct}%` : "정상"})
                  </span>
                )}
              </span>
              {isShadowban && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-rose-300 font-medium bg-rose-950/60 px-2 py-0.5 rounded">
                    외부 링크 전면 차단 / WARMUP 포스트 우선 소비
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="h-8 px-2.5 text-xs bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200"
            title="최근 포스트 메트릭을 기반으로 계정 건강 상태를 즉시 재계산합니다"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isEvaluating && "animate-spin")} />
            {isEvaluating ? "평가 중..." : "헬스 재평가"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleOverride}
            disabled={isOverriding}
            className={cn(
              "h-8 px-2.5 text-xs border transition-all",
              isShadowban
                ? "bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border-emerald-700/50"
                : "bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border-rose-700/50"
            )}
            title="운영자 권한으로 섀도우밴 자율 치유 모드를 강제 설정하거나 해제합니다"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            {isShadowban ? "강제 정상 복귀" : "웜업 모드 강제 전환"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails((prev) => !prev)}
            className="h-8 px-1.5 text-slate-400 hover:text-white"
            title="상세 진단 사유 보기"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Collapsible Diagnosis Details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>상세 진단 리포트 및 치유 지침:</span>
          </div>
          {activeHealth?.reasons && activeHealth.reasons.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-400">
              {activeHealth.reasons.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 pl-5">별도 이상 징후가 발견되지 않았습니다.</p>
          )}
          {activeHealth?.healingDirective?.actionMessage && (
            <p className="pl-5 text-amber-300/90 font-medium">
              지침: {activeHealth.healingDirective.actionMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
