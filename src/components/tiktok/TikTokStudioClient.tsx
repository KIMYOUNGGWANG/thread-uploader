"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Video,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Flame,
  Clock,
  Layers,
  Download,
  Loader2,
} from "lucide-react";
import { toast, Toaster } from "sonner";

interface TikTokStudioClientProps {
  brandId: string;
  brandName: string;
  brandSlug: string;
}

const DAY_MASTERS = [
  "갑목 (甲木)",
  "을목 (乙木)",
  "병화 (丙火)",
  "정화 (丁火)",
  "무토 (戊土)",
  "기토 (己土)",
  "경금 (庚金)",
  "신금 (辛金)",
  "임수 (壬水)",
  "계수 (癸水)",
];

export function TikTokStudioClient({
  brandId,
  brandName,
  brandSlug,
}: TikTokStudioClientProps) {
  const [selectedDayMaster, setSelectedDayMaster] = useState("병화 (丙火)");
  const [selectedTone, setSelectedTone] = useState<"mysterious" | "urgent" | "encouraging">("mysterious");
  const [topic, setTopic] = useState("2026 하반기 대운 사주 재물운");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const [currentDraft, setCurrentDraft] = useState<any>(null);
  const [draftsList, setDraftsList] = useState<any[]>([]);

  // Fetch drafts history
  const fetchDrafts = async () => {
    try {
      const res = await fetch(`/api/tiktok/drafts?brandId=${brandId}`);
      const data = await res.json();
      if (data.success && data.drafts) {
        setDraftsList(data.drafts);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, [brandId]);

  // Handle Script Generation
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const dayMasterClean = selectedDayMaster.split(" ")[0] ?? "병화";
      const res = await fetch("/api/tiktok/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          topic,
          dayMaster: dayMasterClean,
          tone: selectedTone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentDraft(data.draft);
        toast.success("9:16 숏폼 대본과 스토리보드가 생성되었습니다!");
        fetchDrafts();
      } else {
        toast.error(data.error || "대본 생성에 실패했습니다.");
      }
    } catch (err: any) {
      toast.error(err.message || "오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-poll when any draft is QUEUED or RENDERING
  useEffect(() => {
    const hasActiveJob =
      currentDraft?.status === "QUEUED" ||
      currentDraft?.status === "RENDERING" ||
      draftsList.some((d) => d.status === "QUEUED" || d.status === "RENDERING");

    if (!hasActiveJob) return;

    const interval = setInterval(() => {
      fetchDrafts();
      if (currentDraft) {
        fetch(`/api/tiktok/drafts?brandId=${brandId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.success && d.drafts) {
              const updated = d.drafts.find((x: any) => x.id === currentDraft.id);
              if (updated) setCurrentDraft(updated);
            }
          })
          .catch(() => {});
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentDraft?.id, currentDraft?.status, draftsList, brandId]);

  // Handle Remotion Video Render
  const handleRender = async (dryRun: boolean = true) => {
    if (!currentDraft) return;
    setIsRendering(true);

    try {
      const res = await fetch("/api/tiktok/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: currentDraft.id,
          dryRun,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentDraft(data.draft);
        if (dryRun) {
          toast.success("Remotion RenderSpec 규격 검증 완료 (dryRun)");
        } else {
          toast.success(
            "렌더링 큐 등록 완료! 로컬 워커(npm run worker:tiktok)에서 인코딩됩니다.",
            { duration: 6000 }
          );
        }
        fetchDrafts();
      } else {
        toast.error(data.error || "렌더링 처리에 실패했습니다.");
      }
    } catch (err: any) {
      toast.error(err.message || "오류가 발생했습니다.");
    } finally {
      setIsRendering(false);
    }
  };

  const scenes = currentDraft ? JSON.parse(currentDraft.sceneBeats || "[]") : [];

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 p-6">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between border-b border-slate-800/80 pb-5 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/brands/${brandSlug}`}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            {brandName} 대시보드로 복귀
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className="p-2 bg-gradient-to-tr from-pink-500/20 to-purple-500/20 text-pink-400 rounded-xl border border-pink-500/30">
              <Video className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                TikTok 숏폼 크리에이터 스튜디오
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  9:16 Remotion Engine
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Pexels 슬롭 없이, 순수 React 코드로 고전환 사주 카드뉴스 숏폼을 자동 렌더링합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Script Generation Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-400" />
              숏폼 기획 & 일주 선택
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  타깃 일주 (Day Master)
                </label>
                <select
                  value={selectedDayMaster}
                  onChange={(e) => setSelectedDayMaster(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  {DAY_MASTERS.map((dm) => (
                    <option key={dm} value={dm}>
                      {dm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  주제 / 후킹 키워드
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  placeholder="예: 2026 하반기 대운 사주 재물운"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  후킹 톤앤매너
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["mysterious", "urgent", "encouraging"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTone(t)}
                      className={`text-xs py-2 px-3 rounded-lg border font-medium transition-all ${
                        selectedTone === t
                          ? "bg-purple-600/20 border-purple-500 text-purple-300"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      {t === "mysterious" ? "미스터리" : t === "urgent" ? "🚨 경고" : "희망/격려"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    대본 & 스토리보드 생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI 9:16 숏폼 대본 생성
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Drafts History */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              최근 생성된 숏폼 드래프트 ({draftsList.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {draftsList.length === 0 ? (
                <p className="text-xs text-slate-500">생성된 드래프트가 없습니다.</p>
              ) : (
                draftsList.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setCurrentDraft(d)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      currentDraft?.id === d.id
                        ? "bg-purple-950/30 border-purple-500/60 text-white"
                        : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="font-semibold text-slate-200 truncate">{d.title}</div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>{d.durationSeconds}초</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono ${
                          d.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Storyboard & Video Renderer */}
        <div className="lg:col-span-8 space-y-6">
          {currentDraft ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
              {/* Draft Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      품질 점수 {currentDraft.qualityScore}점
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      약 {currentDraft.durationSeconds}초 9:16
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">{currentDraft.title}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRender(true)}
                    disabled={isRendering}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    규격 검증 (Dry Run)
                  </button>
                  <button
                    onClick={() => handleRender(false)}
                    disabled={isRendering}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-pink-900/30 transition-all disabled:opacity-50"
                  >
                    {isRendering ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Remotion 렌더링 중...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Remotion 9:16 렌더링
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 3-Second Hook Spotlight */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 to-pink-950/30 border border-purple-800/40 mb-6">
                <div className="flex items-center gap-2 text-xs font-bold text-pink-400 mb-1">
                  <Flame className="w-4 h-4" />
                  첫 3초 시각적 & 음성 후킹 (Retention Guard)
                </div>
                <div className="text-sm font-semibold text-white">
                  &ldquo;{currentDraft.spokenHook}&rdquo;
                </div>
              </div>

              {/* 4 Scenes Timeline */}
              <div className="space-y-4 mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  4단계 씬 스토리보드 (Storyboard Pipeline)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenes.map((scene: any, idx: number) => (
                    <div
                      key={scene.sceneId || idx}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            Scene {idx + 1} · {scene.durationSeconds}초
                          </span>
                          <span className="text-[10px] uppercase font-bold text-purple-400">
                            {scene.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium leading-relaxed mb-2">
                          &ldquo;{scene.spokenLine}&rdquo;
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">화면: {scene.onScreenText?.[0] || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Render Status & Download */}
              {currentDraft.status === "QUEUED" && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-300">
                        백그라운드 렌더링 큐 대기 중 (QUEUED)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        로컬 터미널에서 워커를 실행해 렌더링을 시작하세요.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] bg-slate-900 px-2 py-1 rounded text-amber-300 border border-amber-900/50 font-mono">
                      npm run worker:tiktok:once
                    </code>
                  </div>
                </div>
              )}

              {currentDraft.status === "RENDERING" && (
                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/50 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-indigo-300">
                      로컬 워커가 Remotion 동영상을 렌더링 중입니다 (RENDERING)...
                    </div>
                    <div className="text-[11px] text-slate-400">
                      약 30초~1분 소요됩니다. 완료되면 자동으로 다운로드 정보가 표시됩니다.
                    </div>
                  </div>
                </div>
              )}

              {currentDraft.status === "FAILED" && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-rose-300">
                        렌더링 실패 (FAILED)
                      </div>
                      <div className="text-[11px] text-rose-300/80 truncate max-w-md">
                        {currentDraft.qualityReasons || "렌더링 중 오류가 발생했습니다."}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRender(false)}
                    className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    재시도
                  </button>
                </div>
              )}

              {currentDraft.status === "COMPLETED" && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-emerald-300">
                        Remotion 9:16 비디오 생성 완료
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                        {currentDraft.utmContent || "출력 완료"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toast.info("비디오 파일이 생성되었습니다: " + currentDraft.utmContent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    파일 정보
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <span className="p-4 bg-slate-900 rounded-2xl text-slate-600 mb-4">
                <Video className="w-8 h-8" />
              </span>
              <h3 className="text-sm font-bold text-slate-300">생성된 숏폼이 없습니다</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                좌측에서 일주와 주제를 선택한 후 &apos;AI 9:16 숏폼 대본 생성&apos; 버튼을 클릭하면
                4단계 스토리보드와 Remotion 렌더러가 활성화됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
