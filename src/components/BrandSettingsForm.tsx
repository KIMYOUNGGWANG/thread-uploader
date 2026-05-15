"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Trash2, RefreshCw, Settings,
  Sparkles, FileText, Users, MessageSquare, Zap, Key, TrendingUp, Radar, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "sonner";
import type { BrandConfig, BrandFormula, CampaignConfig, QualityProfileId, ViralDiscoveryConfig } from "@/types/brand";
import type { ViralAdapterId } from "@/types/viral";

interface InitialData {
  name: string;
  accessToken: string;
  threadsUserId: string;
  tokenExpiry: string;
  config: BrandConfig;
}

interface BrandSettingsFormProps {
  brandId: string;
  brandName: string;
  brandSlug: string;
  initialData: InitialData;
}

type Tab = "basic" | "ai" | "campaign" | "topics" | "targets" | "situations" | "hooks" | "ctas" | "formulas" | "trending" | "viral";

export function BrandSettingsForm({ brandId, brandName, brandSlug, initialData }: BrandSettingsFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [isSaving, setIsSaving] = useState(false);

  // 기본 정보
  const [name, setName] = useState(initialData.name);
  const [accessToken, setAccessToken] = useState(initialData.accessToken);
  const [threadsUserId, setThreadsUserId] = useState(initialData.threadsUserId);
  const [tokenExpiry, setTokenExpiry] = useState(initialData.tokenExpiry);

  // AI 설정
  const [systemPrompt, setSystemPrompt] = useState(initialData.config.systemPrompt);
  const [websiteUrl, setWebsiteUrl] = useState(initialData.config.websiteUrl);

  // 리스트형 설정
  const [topics, setTopics] = useState<string[]>(initialData.config.topics);
  const [targets, setTargets] = useState<string[]>(initialData.config.targets);
  const [situations, setSituations] = useState<string[]>(initialData.config.situations);
  const [hookTypes, setHookTypes] = useState<string[]>(initialData.config.hookTypes ?? []);
  const [ctaTypes, setCtaTypes] = useState<string[]>(initialData.config.ctaTypes ?? []);

  // 공식
  const [formulas, setFormulas] = useState<BrandFormula[]>(initialData.config.formulas);
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>(initialData.config.campaigns);
  const [activeCampaignId, setActiveCampaignId] = useState(initialData.config.activeCampaignId ?? initialData.config.campaigns[0]?.id ?? "");
  const [qualityProfile, setQualityProfile] = useState<QualityProfileId>(initialData.config.qualityProfile);

  // 트렌딩 토픽
  const [trendingTopics, setTrendingTopics] = useState<string[]>(
    initialData.config.trendingTopics ?? []
  );
  const [viralKeywords, setViralKeywords] = useState<string[]>(
    initialData.config.viralDiscovery.keywords
  );
  const [competitorHandles, setCompetitorHandles] = useState<string[]>(
    initialData.config.viralDiscovery.competitorHandles
  );
  const [excludedTerms, setExcludedTerms] = useState<string[]>(
    initialData.config.viralDiscovery.excludedTerms
  );
  const [maxExamplesPerRun, setMaxExamplesPerRun] = useState(
    initialData.config.viralDiscovery.maxExamplesPerRun
  );
  const [minViralScore, setMinViralScore] = useState(
    initialData.config.viralDiscovery.minViralScore
  );
  const [viralAdapters, setViralAdapters] = useState(
    initialData.config.viralDiscovery.adapters
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          accessToken,
          threadsUserId,
          tokenExpiry: new Date(tokenExpiry).toISOString(),
          brandConfig: {
            systemPrompt,
            websiteUrl,
            topics,
            targets,
            situations,
            hookTypes,
            ctaTypes,
            formulas,
            campaigns,
            activeCampaignId,
            qualityProfile,
            trendingTopics,
            viralDiscovery: {
              keywords: viralKeywords,
              competitorHandles,
              excludedTerms,
              maxExamplesPerRun,
              minViralScore,
              adapters: viralAdapters,
            },
          } satisfies BrandConfig,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "저장 실패");
      toast.success("설정이 저장되었습니다 ✅");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setIsSaving(false);
    }
  }, [brandId, name, accessToken, threadsUserId, tokenExpiry, systemPrompt, websiteUrl, topics, targets, situations, hookTypes, ctaTypes, formulas, campaigns, activeCampaignId, qualityProfile, trendingTopics, viralKeywords, competitorHandles, excludedTerms, maxExamplesPerRun, minViralScore, viralAdapters, router]);

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "basic", label: "기본 정보", icon: <Key className="w-4 h-4" /> },
    { id: "ai", label: "AI 설정", icon: <Sparkles className="w-4 h-4" /> },
    { id: "campaign", label: "캠페인", icon: <Target className="w-4 h-4" />, badge: campaigns.length },
    { id: "topics", label: "주제", icon: <FileText className="w-4 h-4" />, badge: topics.length },
    { id: "targets", label: "타겟", icon: <Users className="w-4 h-4" />, badge: targets.length },
    { id: "situations", label: "상황", icon: <MessageSquare className="w-4 h-4" />, badge: situations.length },
    { id: "hooks", label: "훅", icon: <Zap className="w-4 h-4" />, badge: hookTypes.length },
    { id: "ctas", label: "CTA", icon: <TrendingUp className="w-4 h-4" />, badge: ctaTypes.length },
    { id: "formulas", label: "공식", icon: <Zap className="w-4 h-4" />, badge: formulas.length },
    { id: "trending", label: "트렌딩", icon: <TrendingUp className="w-4 h-4" />, badge: trendingTopics.length },
    { id: "viral", label: "바이럴 소스", icon: <Radar className="w-4 h-4" />, badge: viralKeywords.length + competitorHandles.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/brands/${brandSlug}`)}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="p-2 bg-gradient-to-br from-violet-500/30 to-indigo-500/30 rounded-xl border border-violet-500/20">
              <Settings className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{brandName} — 브랜드 설정</h1>
              <p className="text-xs text-slate-400">AI 생성 설정 및 Threads 연결 관리</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isSaving
              ? <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />저장 중...</>
              : <><Save className="w-4 h-4 mr-1.5" />저장</>
            }
          </Button>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tab.badge > 0 ? "bg-violet-500/20 text-violet-300" : "bg-slate-700 text-slate-500"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === "basic" && (
          <BasicTab
            name={name} setName={setName}
            accessToken={accessToken} setAccessToken={setAccessToken}
            threadsUserId={threadsUserId} setThreadsUserId={setThreadsUserId}
            tokenExpiry={tokenExpiry} setTokenExpiry={setTokenExpiry}
          />
        )}
        {activeTab === "ai" && (
          <AiTab
            systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt}
            websiteUrl={websiteUrl} setWebsiteUrl={setWebsiteUrl}
          />
        )}
        {activeTab === "campaign" && (
          <CampaignTab
            campaigns={campaigns}
            setCampaigns={setCampaigns}
            activeCampaignId={activeCampaignId}
            setActiveCampaignId={setActiveCampaignId}
            qualityProfile={qualityProfile}
            setQualityProfile={setQualityProfile}
          />
        )}
        {activeTab === "topics" && (
          <ListTab
            label="주제"
            description="AI가 콘텐츠를 생성할 때 사용할 주제 목록입니다. 브랜드 특화 키워드/개념을 추가하세요."
            placeholder="예: 화개살 (스님도 파계시키는 매력)"
            items={topics}
            setItems={setTopics}
          />
        )}
        {activeTab === "targets" && (
          <ListTab
            label="타겟 독자"
            description="AI가 타겟팅할 독자 페르소나입니다. 구체적일수록 콘텐츠 톤이 정확해집니다."
            placeholder="예: 20대 후반 직장인"
            items={targets}
            setItems={setTargets}
          />
        )}
        {activeTab === "situations" && (
          <ListTab
            label="상황/맥락"
            description="독자가 처한 상황이나 맥락입니다. AI가 공감대를 형성하는 콘텐츠를 만들 때 활용합니다."
            placeholder="예: 퇴사/이직 마려울 때"
            items={situations}
            setItems={setSituations}
          />
        )}
        {activeTab === "hooks" && (
          <ListTab
            label="훅 유형"
            description="첫 문장에서 어떤 심리적 각도를 테스트할지 정의합니다. 성과 학습의 핵심 실험 축입니다."
            placeholder="예: 반전형 훅"
            items={hookTypes}
            setItems={setHookTypes}
          />
        )}
        {activeTab === "ctas" && (
          <ListTab
            label="CTA 유형"
            description="첫 댓글이나 본문 끝에서 어떤 행동을 유도할지 정의합니다."
            placeholder="예: 댓글 유도"
            items={ctaTypes}
            setItems={setCtaTypes}
          />
        )}
        {activeTab === "formulas" && (
          <FormulasTab formulas={formulas} setFormulas={setFormulas} />
        )}
        {activeTab === "trending" && (
          <ListTab
            label="트렌딩 토픽"
            description="이번 주 핫한 시즌/이슈 키워드. 콘텐츠 생성 시 기존 주제와 함께 랜덤으로 사용됩니다. 매주 1회 업데이트하세요."
            placeholder="예: 수성 역행 2026년 5월"
            items={trendingTopics}
            setItems={setTrendingTopics}
          />
        )}
        {activeTab === "viral" && (
          <ViralSourcesTab
            keywords={viralKeywords}
            setKeywords={setViralKeywords}
            competitorHandles={competitorHandles}
            setCompetitorHandles={setCompetitorHandles}
            excludedTerms={excludedTerms}
            setExcludedTerms={setExcludedTerms}
            maxExamplesPerRun={maxExamplesPerRun}
            setMaxExamplesPerRun={setMaxExamplesPerRun}
            minViralScore={minViralScore}
            setMinViralScore={setMinViralScore}
            adapters={viralAdapters}
            setAdapters={setViralAdapters}
          />
        )}
      </main>
    </div>
  );
}

/* ─────────────────────────────── Basic Tab ─────────────────────────────── */
function BasicTab({
  name, setName,
  accessToken, setAccessToken,
  threadsUserId, setThreadsUserId,
  tokenExpiry, setTokenExpiry,
}: {
  name: string; setName: (v: string) => void;
  accessToken: string; setAccessToken: (v: string) => void;
  threadsUserId: string; setThreadsUserId: (v: string) => void;
  tokenExpiry: string; setTokenExpiry: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="브랜드 정보" description="브랜드 이름과 Threads API 연결 정보를 관리합니다.">
        <Field label="브랜드 이름">
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
            placeholder="예: CosmicPath"
          />
        </Field>
        <Field label="Threads Access Token" hint="Meta 개발자 콘솔에서 발급">
          <input
            type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
            className={INPUT_CLASS}
            placeholder="THQAA..."
          />
        </Field>
        <Field label="Threads User ID">
          <input
            type="text" value={threadsUserId} onChange={(e) => setThreadsUserId(e.target.value)}
            className={INPUT_CLASS}
            placeholder="123456789"
          />
        </Field>
        <Field label="토큰 만료일">
          <input
            type="date" value={tokenExpiry} onChange={(e) => setTokenExpiry(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
      </SectionCard>
    </div>
  );
}

/* ──────────────────────────────── AI Tab ───────────────────────────────── */
function AiTab({
  systemPrompt, setSystemPrompt,
  websiteUrl, setWebsiteUrl,
}: {
  systemPrompt: string; setSystemPrompt: (v: string) => void;
  websiteUrl: string; setWebsiteUrl: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="시스템 프롬프트" description="AI가 콘텐츠를 생성할 때 항상 따르는 핵심 지침입니다. 브랜드 톤, 금지 사항, 출력 형식을 명시하세요.">
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={14}
          className={`${INPUT_CLASS} font-mono text-xs resize-y`}
          placeholder={`예시:\n너는 [브랜드명] SNS 담당자야.\n\n규칙:\n1. 반말 사용\n2. 해시태그 1개만\n3. 6-12줄 길이\n...`}
        />
        <p className="text-xs text-slate-500 mt-1">
          현재 {systemPrompt.length}자 · 출력 형식(구분자 등)은 반드시 포함하세요
        </p>
      </SectionCard>

      <SectionCard title="웹사이트 URL" description="첫 댓글에 UTM 링크로 자동 삽입됩니다.">
        <Field label="URL (도메인만, https:// 제외 가능)">
          <input
            type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
            className={INPUT_CLASS}
            placeholder="예: cosmicpath.app"
          />
        </Field>
        <p className="text-xs text-slate-500">
          실제 링크 예시: <span className="text-slate-400 font-mono">{websiteUrl || "yourbrand.com"}?utm_source=threads&utm_medium=social&utm_campaign=공식id</span>
        </p>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────────── Campaign Tab ───────────────────────────── */
function CampaignTab({
  campaigns,
  setCampaigns,
  activeCampaignId,
  setActiveCampaignId,
  qualityProfile,
  setQualityProfile,
}: {
  campaigns: CampaignConfig[];
  setCampaigns: (items: CampaignConfig[]) => void;
  activeCampaignId: string;
  setActiveCampaignId: (value: string) => void;
  qualityProfile: QualityProfileId;
  setQualityProfile: (value: QualityProfileId) => void;
}) {
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0];

  const updateCampaign = (patch: Partial<CampaignConfig>) => {
    if (!activeCampaign) return;
    setCampaigns(campaigns.map((campaign) => (
      campaign.id === activeCampaign.id ? { ...campaign, ...patch } : campaign
    )));
  };

  const updatePlaybook = (key: keyof CampaignConfig["replyPlaybook"], value: string) => {
    if (!activeCampaign) return;
    updateCampaign({
      replyPlaybook: {
        ...activeCampaign.replyPlaybook,
        [key]: value,
      },
    });
  };

  const updateQualityProfile = (nextProfile: QualityProfileId) => {
    setQualityProfile(nextProfile);
    updateCampaign({ qualityProfile: nextProfile });
  };

  if (!activeCampaign) {
    return (
      <SectionCard title="캠페인 설정" description="활성 캠페인을 찾을 수 없습니다. 기본 브랜드 설정을 다시 저장하세요.">
        <p className="text-sm text-slate-400">캠페인 데이터가 없습니다.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="활성 캠페인" description="CosmicPath 커리어 wedge 실험에 사용할 캠페인과 품질 프로필입니다.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Active campaign">
            <select
              value={activeCampaign.id}
              onChange={(event) => setActiveCampaignId(event.target.value)}
              className={INPUT_CLASS}
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Quality profile">
            <select
              value={qualityProfile}
              onChange={(event) => updateQualityProfile(event.target.value as QualityProfileId)}
              className={INPUT_CLASS}
            >
              <option value="career_decision">career_decision</option>
              <option value="saju_viral">saju_viral</option>
            </select>
          </Field>
          <Field label="Landing URL">
            <input
              value={activeCampaign.landingUrl}
              onChange={(event) => updateCampaign({ landingUrl: event.target.value })}
              className={INPUT_CLASS}
              placeholder="/career/uncertainty"
            />
          </Field>
          <Field label="UTM campaign">
            <input
              value={activeCampaign.utmCampaign}
              onChange={(event) => updateCampaign({ utmCampaign: event.target.value })}
              className={INPUT_CLASS}
              placeholder="career_timing_wedge_399"
            />
          </Field>
          <Field label="하루 목표">
            <input
              type="number"
              min={1}
              max={12}
              value={activeCampaign.dailyPostTarget}
              onChange={(event) => updateCampaign({ dailyPostTarget: clampNumberInput(event.target.value, 1, 12, 3) })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="링크 cadence" hint="3이면 3개 중 1개">
            <input
              type="number"
              min={1}
              max={12}
              value={activeCampaign.linkCadenceEvery}
              onChange={(event) => updateCampaign({ linkCadenceEvery: clampNumberInput(event.target.value, 1, 12, 3) })}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          UTM: utm_source=threads · utm_campaign={activeCampaign.utmCampaign} · utm_content=postId
        </p>
      </SectionCard>

      <SectionCard title="3종 포스트 공식" description="캠페인 생성 시 이 공식들만 회전시키며 테스트합니다.">
        <div className="grid gap-3 md:grid-cols-3">
          {activeCampaign.formulas.map((formula) => (
            <div key={formula.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-violet-300">{formula.id}</span>
                <span className="text-xs text-slate-500">w{formula.weight}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-white">{formula.name}</p>
              <p className="mt-1 text-xs text-slate-400">{formula.instruction}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Reply Playbook" description="자동 댓글은 하지 않고, 대시보드에서 복사 가능한 답글 템플릿만 제공합니다.">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["stay", "move", "prepare", "cta"] as const).map((key) => (
            <Field key={key} label={replyPlaybookLabel(key)}>
              <textarea
                value={activeCampaign.replyPlaybook[key]}
                onChange={(event) => updatePlaybook(key, event.target.value)}
                rows={4}
                className={`${INPUT_CLASS} resize-y`}
              />
            </Field>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ──────────────────────────────── List Tab ─────────────────────────────── */
function ListTab({
  label, description, placeholder, items, setItems,
}: {
  label: string;
  description: string;
  placeholder: string;
  items: string[];
  setItems: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState("");

  const add = () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems([...items, trimmed]);
    setNewItem("");
  };

  const remove = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
  };

  return (
    <SectionCard title={label} description={description}>
      {/* Add input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text" value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${INPUT_CLASS} flex-1`}
          placeholder={placeholder}
        />
        <Button onClick={add} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          아직 {label}이 없습니다. 위에서 추가하세요.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg group">
              <span className="text-xs text-slate-500 w-5 shrink-0">{i + 1}</span>
              <span className="flex-1 text-sm text-slate-200">{item}</span>
              <button
                onClick={() => remove(i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400 text-slate-500 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">총 {items.length}개</p>
    </SectionCard>
  );
}

/* ───────────────────────────── Viral Sources Tab ───────────────────────── */
function ViralSourcesTab({
  keywords,
  setKeywords,
  competitorHandles,
  setCompetitorHandles,
  excludedTerms,
  setExcludedTerms,
  maxExamplesPerRun,
  setMaxExamplesPerRun,
  minViralScore,
  setMinViralScore,
  adapters,
  setAdapters,
}: {
  keywords: string[];
  setKeywords: (items: string[]) => void;
  competitorHandles: string[];
  setCompetitorHandles: (items: string[]) => void;
  excludedTerms: string[];
  setExcludedTerms: (items: string[]) => void;
  maxExamplesPerRun: number;
  setMaxExamplesPerRun: (value: number) => void;
  minViralScore: number;
  setMinViralScore: (value: number) => void;
  adapters: ViralDiscoveryConfig["adapters"];
  setAdapters: (items: ViralDiscoveryConfig["adapters"]) => void;
}) {
  const toggleAdapter = (id: ViralAdapterId) => {
    setAdapters(adapters.map((adapter) => (
      adapter.id === id ? { ...adapter, enabled: !adapter.enabled } : adapter
    )));
  };

  return (
    <div className="space-y-6">
      <ListTab
        label="키워드 소스"
        description="Threads TOP 검색에 사용할 키워드입니다. 비어 있으면 브랜드 주제와 트렌딩 토픽을 폴백으로 사용합니다."
        placeholder="예: 사주 연애운"
        items={keywords}
        setItems={setKeywords}
      />
      <ListTab
        label="경쟁 계정 핸들"
        description="@ 없이 저장합니다. 해당 공개 프로필의 최근 글을 바이럴 레퍼런스로 수집합니다."
        placeholder="예: cosmicpath_official"
        items={competitorHandles}
        setItems={(items) => setCompetitorHandles(items.map((item) => item.replace(/^@/, "")))}
      />
      <ListTab
        label="제외어"
        description="이 단어가 포함된 레퍼런스는 저장하지 않습니다. 브랜드 리스크나 원치 않는 주제를 막을 때 사용합니다."
        placeholder="예: 정치"
        items={excludedTerms}
        setItems={setExcludedTerms}
      />

      <SectionCard title="수집 실행 설정" description="저장된 소스로 한 번에 얼마나 넓게 수집할지와 어떤 어댑터를 켤지 정합니다.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="실행당 최대 레퍼런스" hint="1~50">
            <input
              type="number"
              min={1}
              max={50}
              value={maxExamplesPerRun}
              onChange={(e) => setMaxExamplesPerRun(clampNumberInput(e.target.value, 1, 50, 15))}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="최소 바이럴 점수" hint="0이면 모두 저장">
            <input
              type="number"
              min={0}
              value={minViralScore}
              onChange={(e) => setMinViralScore(clampNumberInput(e.target.value, 0, 1000000, 0))}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {adapters.map((adapter) => (
            <label key={adapter.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5">
              <span>
                <span className="block text-sm font-medium text-slate-200">{adapterLabel(adapter.id)}</span>
                <span className="block text-xs text-slate-500">{adapterDescription(adapter.id)}</span>
              </span>
              <input
                type="checkbox"
                checked={adapter.enabled}
                onChange={() => toggleAdapter(adapter.id)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
              />
            </label>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function clampNumberInput(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function replyPlaybookLabel(key: keyof CampaignConfig["replyPlaybook"]): string {
  const labels: Record<keyof CampaignConfig["replyPlaybook"], string> = {
    stay: "버팀형 답변",
    move: "이동형 답변",
    prepare: "준비형 답변",
    cta: "CTA 답변",
  };
  return labels[key];
}

function adapterLabel(id: ViralAdapterId): string {
  const labels: Record<ViralAdapterId, string> = {
    owned_posts: "내 게시물",
    threads_keyword: "Threads 키워드",
    threads_profile: "경쟁 프로필",
    manual: "수동 레퍼런스",
  };
  return labels[id];
}

function adapterDescription(id: ViralAdapterId): string {
  const descriptions: Record<ViralAdapterId, string> = {
    owned_posts: "성과 있는 발행 글을 다시 학습",
    threads_keyword: "저장 키워드와 브랜드 토픽 검색",
    threads_profile: "경쟁 계정 공개 글 수집",
    manual: "직접 붙여넣은 레퍼런스 저장",
  };
  return descriptions[id];
}

/* ─────────────────────────────── Formulas Tab ──────────────────────────── */
function FormulasTab({
  formulas, setFormulas,
}: {
  formulas: BrandFormula[];
  setFormulas: (f: BrandFormula[]) => void;
}) {
  const [editing, setEditing] = useState<BrandFormula | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setEditing({ id: "", name: "", weight: 2, instruction: "" });
    setIsNew(true);
  };

  const save = (formula: BrandFormula) => {
    if (!formula.id.trim() || !formula.name.trim()) {
      toast.error("ID와 이름은 필수입니다");
      return;
    }
    if (isNew && formulas.some((f) => f.id === formula.id)) {
      toast.error("이미 존재하는 ID입니다");
      return;
    }
    if (isNew) {
      setFormulas([...formulas, formula]);
    } else {
      setFormulas(formulas.map((f) => (f.id === formula.id ? formula : f)));
    }
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => {
    if (!confirm(`'${id}' 공식을 삭제할까요?`)) return;
    setFormulas(formulas.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="콘텐츠 공식"
        description="AI가 콘텐츠를 생성할 때 사용할 공식 목록입니다. 각 공식의 weight가 클수록 더 자주 사용됩니다."
        action={
          <Button onClick={openNew} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-4 h-4 mr-1" />공식 추가
          </Button>
        }
      >
        {formulas.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            공식이 없습니다. AI 생성을 사용하려면 최소 1개 이상 추가하세요.
          </div>
        ) : (
          <div className="space-y-2">
            {formulas.map((formula) => (
              <div
                key={formula.id}
                className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-1.5 py-0.5 bg-violet-500/20 text-violet-300 rounded">{formula.id}</span>
                    <span className="text-sm font-medium text-white">{formula.name}</span>
                    <span className="text-xs text-slate-400">가중치 {formula.weight}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditing({ ...formula }); setIsNew(false); }}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-colors"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => remove(formula.id)}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{formula.instruction}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Edit Modal */}
      {editing && (
        <FormulaEditModal
          formula={editing}
          isNew={isNew}
          onChange={setEditing}
          onSave={save}
          onClose={() => { setEditing(null); setIsNew(false); }}
        />
      )}
    </div>
  );
}

function FormulaEditModal({
  formula, isNew, onChange, onSave, onClose,
}: {
  formula: BrandFormula;
  isNew: boolean;
  onChange: (f: BrandFormula) => void;
  onSave: (f: BrandFormula) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">{isNew ? "공식 추가" : "공식 편집"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID" hint="영문/숫자/언더바">
              <input
                type="text" value={formula.id}
                onChange={(e) => onChange({ ...formula, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                disabled={!isNew}
                className={`${INPUT_CLASS} ${!isNew ? "opacity-50 cursor-not-allowed" : ""}`}
                placeholder="contrarian"
              />
            </Field>
            <Field label="이름">
              <input
                type="text" value={formula.name}
                onChange={(e) => onChange({ ...formula, name: e.target.value })}
                className={INPUT_CLASS}
                placeholder="반직관 훅"
              />
            </Field>
          </div>

          <Field label="가중치" hint="숫자가 클수록 더 자주 사용 (1~6)">
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={6} value={formula.weight}
                onChange={(e) => onChange({ ...formula, weight: Number(e.target.value) })}
                className="flex-1 accent-violet-500"
              />
              <span className="text-white font-bold w-4 text-center">{formula.weight}</span>
            </div>
          </Field>

          <Field label="지침 (Instruction)" hint="AI가 이 공식으로 콘텐츠를 생성할 때 따르는 상세 규칙">
            <textarea
              value={formula.instruction}
              onChange={(e) => onChange({ ...formula, instruction: e.target.value })}
              rows={6}
              className={`${INPUT_CLASS} resize-y text-xs font-mono`}
              placeholder="이 공식의 작성 방식을 상세히 설명하세요..."
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-5">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-700 text-slate-300">취소</Button>
          <Button onClick={() => onSave(formula)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
            {isNew ? "추가" : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Shared UI ─────────────────────────────── */
const INPUT_CLASS = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent";

function SectionCard({
  title, description, children, action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">
        {label}
        {hint && <span className="text-xs text-slate-500 font-normal ml-2">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
