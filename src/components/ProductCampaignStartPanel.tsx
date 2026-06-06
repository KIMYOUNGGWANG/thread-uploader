"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { generatePostsInChunks } from "@/lib/generate-client";
import { isValidCampaignLandingUrl } from "@/lib/product-auto-setup";
import type { ActiveExperiment, BrandFormula, CampaignConfig, ProductProfile } from "@/types/brand";

interface ProductCampaignStartPanelProps {
  brandId: string;
  productProfile: ProductProfile;
  activeExperiment: ActiveExperiment;
  systemPrompt: string;
  topics: string[];
  formulas: BrandFormula[];
  campaigns: CampaignConfig[];
  activeCampaignId: string;
  readinessLabel: string;
  startLabel: string;
}

interface SettingsReadiness {
  score: number;
  canStart: boolean;
  gaps: string[];
}

export function ProductCampaignStartPanel({
  brandId,
  productProfile,
  activeExperiment,
  systemPrompt,
  topics,
  formulas,
  campaigns,
  activeCampaignId,
  readinessLabel,
  startLabel,
}: ProductCampaignStartPanelProps) {
  const [isStarting, setIsStarting] = useState(false);
  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0] ?? null,
    [activeCampaignId, campaigns]
  );
  const readiness = useMemo(
    () => buildSettingsReadiness(productProfile, activeExperiment, systemPrompt, topics, formulas, activeCampaign),
    [activeCampaign, activeExperiment, formulas, productProfile, systemPrompt, topics]
  );
  const postCount = Math.max(1, activeExperiment.durationDays * (activeCampaign?.dailyPostTarget ?? 3));

  const handleStartCampaign = async () => {
    if (!readiness.canStart || isStarting) return;
    if (!window.confirm(`${activeExperiment.durationDays}일 캠페인으로 ${postCount}개 포스트를 생성할까요?`)) return;
    setIsStarting(true);
    try {
      const data = await generatePostsInChunks({
        brandId,
        count: postCount,
        campaignId: activeCampaign?.id,
        approvedCampaignStart: true,
        fallbackMessage: "캠페인 시작 실패",
      });
      toast.success(`${data.count}개 포스트가 생성되었습니다`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "캠페인 시작 실패");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{readinessLabel}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {readiness.canStart ? "저장된 설정 기준으로 캠페인을 시작할 수 있습니다." : "부족한 설정을 채우고 저장하면 캠페인을 시작할 수 있습니다."}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-bold text-white">{readiness.score}</div>
          <div className="text-xs text-slate-500">ready score</div>
        </div>
      </div>

      {readiness.gaps.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-amber-200">
          {readiness.gaps.map((gap) => (
            <li key={gap} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              {gap}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleStartCampaign}
        disabled={!readiness.canStart || isStarting}
        className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
      >
        {isStarting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
        {isStarting ? "캠페인 시작 중..." : startLabel}
      </button>
    </section>
  );
}

function buildSettingsReadiness(
  productProfile: ProductProfile,
  activeExperiment: ActiveExperiment,
  systemPrompt: string,
  topics: string[],
  formulas: BrandFormula[],
  activeCampaign: CampaignConfig | null
): SettingsReadiness {
  const gaps = [
    productProfile.oneLineDescription ? "" : "제품 한 줄 설명이 필요합니다.",
    productProfile.targetCustomer ? "" : "타깃 고객이 필요합니다.",
    productProfile.offerPromise ? "" : "오퍼 약속이 필요합니다.",
    productProfile.landingUrl ? "" : "랜딩 URL이 필요합니다.",
    productProfile.landingUrl && !isValidCampaignLandingUrl(productProfile.landingUrl) ? "랜딩 URL 형식이 필요합니다." : "",
    activeCampaign?.landingUrl ? "" : "캠페인 랜딩 URL이 필요합니다.",
    activeCampaign?.landingUrl && !isValidCampaignLandingUrl(activeCampaign.landingUrl) ? "캠페인 랜딩 URL 형식이 필요합니다." : "",
    systemPrompt.trim() ? "" : "시스템 프롬프트가 필요합니다.",
    topics.length > 0 ? "" : "최소 1개 이상의 주제가 필요합니다.",
    formulas.length > 0 || (activeCampaign?.formulas.length ?? 0) > 0 ? "" : "콘텐츠 공식이 필요합니다.",
    activeExperiment.status === "active" ? "" : "실험 상태를 active로 바꿔야 합니다.",
  ].filter(Boolean);
  const score = Math.max(0, 100 - gaps.length * 12);
  return {
    score,
    canStart: gaps.length === 0,
    gaps,
  };
}
