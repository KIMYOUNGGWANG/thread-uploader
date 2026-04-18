"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Trash2, RefreshCw, Settings,
  Sparkles, FileText, Users, MessageSquare, Zap, Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "sonner";
import type { BrandConfig, BrandFormula } from "@/types/brand";

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

type Tab = "basic" | "ai" | "topics" | "targets" | "situations" | "formulas";

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

  // 공식
  const [formulas, setFormulas] = useState<BrandFormula[]>(initialData.config.formulas);

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
            formulas,
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
  }, [brandId, name, accessToken, threadsUserId, tokenExpiry, systemPrompt, websiteUrl, topics, targets, situations, formulas, router]);

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "basic", label: "기본 정보", icon: <Key className="w-4 h-4" /> },
    { id: "ai", label: "AI 설정", icon: <Sparkles className="w-4 h-4" /> },
    { id: "topics", label: "주제", icon: <FileText className="w-4 h-4" />, badge: topics.length },
    { id: "targets", label: "타겟", icon: <Users className="w-4 h-4" />, badge: targets.length },
    { id: "situations", label: "상황", icon: <MessageSquare className="w-4 h-4" />, badge: situations.length },
    { id: "formulas", label: "공식", icon: <Zap className="w-4 h-4" />, badge: formulas.length },
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
        {activeTab === "formulas" && (
          <FormulasTab formulas={formulas} setFormulas={setFormulas} />
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
