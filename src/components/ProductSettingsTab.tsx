import type { Dispatch, SetStateAction } from "react";
import { ProductCampaignStartPanel } from "@/components/ProductCampaignStartPanel";
import type {
  ActiveExperiment,
  BrandFormula,
  CampaignConfig,
  ProductProfile,
  ProductPrimaryChannel,
  ExperimentStage,
  ExperimentStatus,
} from "@/types/brand";

const INPUT_CLASS = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500";
const PRODUCT_READINESS_LABEL = "세팅 준비도";
const START_SEVEN_DAY_CAMPAIGN_LABEL = "7일 캠페인 시작";

interface ProductSettingsTabProps {
  brandId: string;
  productProfile: ProductProfile;
  setProductProfile: Dispatch<SetStateAction<ProductProfile>>;
  activeExperiment: ActiveExperiment;
  setActiveExperiment: Dispatch<SetStateAction<ActiveExperiment>>;
  systemPrompt: string;
  topics: string[];
  formulas: BrandFormula[];
  campaigns: CampaignConfig[];
  activeCampaignId: string;
}

export function ProductSettingsTab({
  brandId,
  productProfile,
  setProductProfile,
  activeExperiment,
  setActiveExperiment,
  systemPrompt,
  topics,
  formulas,
  campaigns,
  activeCampaignId,
}: ProductSettingsTabProps) {
  const updateProfile = (patch: Partial<ProductProfile>) => {
    setProductProfile((current) => ({ ...current, ...patch }));
  };

  const updateExperiment = (patch: Partial<ActiveExperiment>) => {
    setActiveExperiment((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="space-y-6">
      <ProductCampaignStartPanel
        brandId={brandId}
        productProfile={productProfile}
        activeExperiment={activeExperiment}
        systemPrompt={systemPrompt}
        topics={topics}
        formulas={formulas}
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        readinessLabel={PRODUCT_READINESS_LABEL}
        startLabel={START_SEVEN_DAY_CAMPAIGN_LABEL}
      />

      <ProductSection title="제품 프로필" description="이 제품의 포지셔닝과 마케팅 실험 기준입니다.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ProductField label="제품명">
            <input
              value={productProfile.productName}
              onChange={(event) => updateProfile({ productName: event.target.value })}
              className={INPUT_CLASS}
              placeholder="InvoiceFlow"
            />
          </ProductField>
          <ProductField label="주요 채널">
            <select
              value={productProfile.primaryChannel}
              onChange={(event) => updateProfile({ primaryChannel: parseProductPrimaryChannel(event.target.value) })}
              className={INPUT_CLASS}
            >
              <option value="threads">Threads</option>
              <option value="tiktok">TikTok</option>
              <option value="manual">Manual</option>
            </select>
          </ProductField>
          <ProductField label="한 줄 설명">
            <input
              value={productProfile.oneLineDescription}
              onChange={(event) => updateProfile({ oneLineDescription: event.target.value })}
              className={INPUT_CLASS}
              placeholder="견적서 작성 시간을 줄이는 프리랜서 도구"
            />
          </ProductField>
          <ProductField label="타깃 고객">
            <input
              value={productProfile.targetCustomer}
              onChange={(event) => updateProfile({ targetCustomer: event.target.value })}
              className={INPUT_CLASS}
              placeholder="1인 프리랜서"
            />
          </ProductField>
          <ProductField label="오퍼 약속">
            <input
              value={productProfile.offerPromise}
              onChange={(event) => updateProfile({ offerPromise: event.target.value })}
              className={INPUT_CLASS}
              placeholder="견적서를 5분 안에 보내게 한다"
            />
          </ProductField>
          <ProductField label="랜딩 URL">
            <input
              value={productProfile.landingUrl}
              onChange={(event) => updateProfile({ landingUrl: event.target.value })}
              className={INPUT_CLASS}
              placeholder="/invoice"
            />
          </ProductField>
          <ProductField label="핵심 지표">
            <input
              value={productProfile.primaryMetric}
              onChange={(event) => updateProfile({ primaryMetric: event.target.value })}
              className={INPUT_CLASS}
              placeholder="views"
            />
          </ProductField>
          <ProductField label="전환 지표">
            <input
              value={productProfile.conversionMetric}
              onChange={(event) => updateProfile({ conversionMetric: event.target.value })}
              className={INPUT_CLASS}
              placeholder="conversions"
            />
          </ProductField>
        </div>
        <ProductField label="포지셔닝 메모">
          <textarea
            value={productProfile.positioningNotes}
            onChange={(event) => updateProfile({ positioningNotes: event.target.value })}
            rows={4}
            className={`${INPUT_CLASS} resize-y`}
            placeholder="이 제품에서 지켜야 할 메시지, 금지어, 차별점"
          />
        </ProductField>
      </ProductSection>

      <ProductSection title="현재 실험" description="이번 7일 증거 스프린트에서 판단할 가설입니다.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ProductField label="실험명">
            <input
              value={activeExperiment.name}
              onChange={(event) => updateExperiment({ name: event.target.value })}
              className={INPUT_CLASS}
              placeholder="Baseline growth loop"
            />
          </ProductField>
          <ProductField label="상태">
            <select
              value={activeExperiment.status}
              onChange={(event) => updateExperiment({ status: parseExperimentStatus(event.target.value) })}
              className={INPUT_CLASS}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </select>
          </ProductField>
          <ProductField label="단계">
            <select
              value={activeExperiment.stage}
              onChange={(event) => updateExperiment({ stage: parseExperimentStage(event.target.value) })}
              className={INPUT_CLASS}
            >
              <option value="content">content</option>
              <option value="landing">landing</option>
              <option value="conversion">conversion</option>
            </select>
          </ProductField>
          <ProductField label="기간">
            <input
              type="number"
              min={1}
              max={90}
              value={activeExperiment.durationDays}
              onChange={(event) => updateExperiment({ durationDays: clampNumberInput(event.target.value, 1, 90, 7) })}
              className={INPUT_CLASS}
            />
          </ProductField>
          <ProductField label="핵심 지표">
            <input
              value={activeExperiment.primaryMetric}
              onChange={(event) => updateExperiment({ primaryMetric: event.target.value })}
              className={INPUT_CLASS}
            />
          </ProductField>
          <ProductField label="가드레일">
            <input
              value={activeExperiment.guardrailMetric}
              onChange={(event) => updateExperiment({ guardrailMetric: event.target.value })}
              className={INPUT_CLASS}
            />
          </ProductField>
        </div>
        <ProductField label="가설">
          <textarea
            value={activeExperiment.hypothesis}
            onChange={(event) => updateExperiment({ hypothesis: event.target.value })}
            rows={4}
            className={`${INPUT_CLASS} resize-y`}
          />
        </ProductField>
      </ProductSection>
    </div>
  );
}

function ProductSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ProductField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function clampNumberInput(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function parseProductPrimaryChannel(value: string): ProductPrimaryChannel {
  return value === "threads" || value === "tiktok" || value === "manual" ? value : "threads";
}

function parseExperimentStatus(value: string): ExperimentStatus {
  return value === "active" || value === "paused" || value === "completed" ? value : "active";
}

function parseExperimentStage(value: string): ExperimentStage {
  return value === "content" || value === "landing" || value === "conversion" ? value : "content";
}
