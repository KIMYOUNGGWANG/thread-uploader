"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, LogOut, RefreshCw, Settings, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "sonner";
import type { BrandResponse } from "@/types/brand";

export default function BrandsPage() {
  const [brands, setBrands] = useState<BrandResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const router = useRouter();

  const fetchBrands = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brands");
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json() as BrandResponse[] | { error: string };
      if (!res.ok) throw new Error((data as { error: string }).error ?? "브랜드 불러오기 실패");
      setBrands(data as BrandResponse[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "브랜드 불러오기 실패");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Threads Uploader</h1>
              <p className="text-xs text-slate-400">브랜드를 선택하세요</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowCreateForm(true)}
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              브랜드 추가
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-red-400 hover:bg-red-900/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-7 h-7 animate-spin text-violet-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0" />{error}
          </div>
        ) : brands.length === 0 && !showCreateForm ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">아직 브랜드가 없어요</h2>
            <p className="text-slate-400 text-sm mb-6">첫 번째 브랜드를 추가하고 Threads 자동화를 시작하세요</p>
            <Button onClick={() => setShowCreateForm(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Plus className="w-4 h-4 mr-1.5" />첫 브랜드 만들기
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Brand Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => router.push(`/brands/${brand.slug}`)}
                  className="group text-left p-5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-violet-500/50 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-violet-500/10 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500/30 to-indigo-500/30 rounded-xl flex items-center justify-center border border-violet-500/20">
                      <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors mt-1" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{brand.name}</h3>
                  <p className="text-xs text-slate-400 mb-3">@{brand.slug}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">
                      {brand.brandConfig.formulas.length}개 공식
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">
                      {brand.brandConfig.topics.length}개 주제
                    </span>
                  </div>
                </button>
              ))}

              {/* Add Brand Card */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="p-5 bg-slate-800/30 hover:bg-slate-800/60 border border-dashed border-slate-700 hover:border-violet-500/50 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[140px]"
              >
                <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-sm text-slate-400">브랜드 추가</span>
              </button>
            </div>
          </div>
        )}

        {/* Create Brand Modal */}
        {showCreateForm && (
          <CreateBrandModal
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => { setShowCreateForm(false); fetchBrands(); }}
          />
        )}
      </main>
    </div>
  );
}

function CreateBrandModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    accessToken: "",
    threadsUserId: "",
    tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug || value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          accessToken: form.accessToken,
          threadsUserId: form.threadsUserId,
          tokenExpiry: new Date(form.tokenExpiry).toISOString(),
          brandConfig: {
            systemPrompt: "",
            topics: [],
            targets: [],
            situations: [],
            websiteUrl: "",
            formulas: [],
          },
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "브랜드 생성 실패");
      toast.success("브랜드가 생성되었습니다!");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "브랜드 생성 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-violet-400" />새 브랜드 추가
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="브랜드 이름" required>
            <input
              type="text" required placeholder="예: CosmicPath"
              value={form.name} onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </Field>

          <Field label="Slug (URL용)" required hint="영문 소문자, 숫자, 하이픈만">
            <input
              type="text" required placeholder="cosmicpath"
              value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase() }))}
              pattern="[a-z0-9-]+"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </Field>

          <Field label="Threads Access Token" required>
            <input
              type="password" required placeholder="THQAA..."
              value={form.accessToken} onChange={(e) => setForm((p) => ({ ...p, accessToken: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </Field>

          <Field label="Threads User ID" required>
            <input
              type="text" required placeholder="123456789"
              value={form.threadsUserId} onChange={(e) => setForm((p) => ({ ...p, threadsUserId: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </Field>

          <Field label="토큰 만료일">
            <input
              type="date"
              value={form.tokenExpiry} onChange={(e) => setForm((p) => ({ ...p, tokenExpiry: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </Field>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <p className="text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg">
            💡 브랜드 생성 후 대시보드에서 <strong className="text-slate-300">콘텐츠 공식, 주제, 시스템 프롬프트</strong>를 설정할 수 있습니다.
          </p>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-slate-700 text-slate-300">취소</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {isSubmitting ? <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />생성 중...</> : "브랜드 만들기"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-xs text-slate-500 font-normal ml-2">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
