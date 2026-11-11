"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, PenLine, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ReferenceReviewItem } from "@/lib/reference-review";
import type { ReferenceDecision } from "@/lib/viral-analysis";
import type { ReferenceKind } from "@/lib/viral-intent-modes";

interface ReferenceTabProps {
  brandId: string;
  /** Called after a draft was created so the dashboard can show the review queue. */
  onDraftCreated?: () => void | Promise<void>;
}

type DraftOutcome =
  | { status: "created" }
  | { status: "dropped"; reasons: string[] }
  | { status: "duplicate" }
  | { status: "error"; message: string };

const KIND_OPTIONS: Array<{ id: ReferenceKind; label: string }> = [
  { id: "story", label: "사연형" },
  { id: "info", label: "정보형" },
];

type Filter = "all" | "pending" | "approved" | "rejected";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "pending", label: "대기" },
  { id: "approved", label: "승인" },
  { id: "rejected", label: "제외" },
];

function matchesFilter(item: ReferenceReviewItem, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return item.decision === null;
  return item.decision === filter;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export function ReferenceTab({ brandId, onDraftCreated }: ReferenceTabProps) {
  const [items, setItems] = useState<ReferenceReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  // One generation at a time: each one is a paid AI call and the server has no lock.
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchReferences = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/viral/references?brandId=${encodeURIComponent(brandId)}`);
      const data: unknown = await res.json();
      const list = typeof data === "object" && data !== null ? (data as { references?: unknown }).references : undefined;
      if (res.ok && Array.isArray(list)) {
        setItems(list as ReferenceReviewItem[]);
      } else {
        const message = typeof data === "object" && data !== null ? (data as { error?: unknown }).error : undefined;
        setLoadError(typeof message === "string" ? message : "레퍼런스를 불러오지 못했습니다.");
      }
    } catch {
      setLoadError("레퍼런스 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void fetchReferences();
  }, [fetchReferences]);

  const decide = async (id: string, decision: ReferenceDecision | null) => {
    const previous = items;
    setSavingId(id);
    // Optimistic: the card moves at once and snaps back if the save fails.
    setItems((current) => current.map((item) => (item.id === id ? { ...item, decision } : item)));
    try {
      const res = await fetch(`/api/viral/references/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, decision }),
      });
      if (!res.ok) throw new Error("save failed");
      toast.success(decision === "approved" ? "승인했어요. 생성에서 먼저 쓰여요." : decision === "rejected" ? "제외했어요. 이제 생성에 안 써요." : "되돌렸어요.");
    } catch {
      setItems(previous);
      toast.error("저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSavingId(null);
    }
  };

  const makeDraft = async (id: string, kind: ReferenceKind): Promise<DraftOutcome> => {
    setGeneratingId(id);
    try {
      const res = await fetch(`/api/viral/references/${encodeURIComponent(id)}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, kind }),
      });
      const data: unknown = await res.json().catch(() => null);
      const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
      if (!res.ok) return { status: "error", message: typeof record.error === "string" ? record.error : "초안을 만들지 못했어요." };
      if (record.status === "dropped" && Array.isArray(record.reasons)) {
        return { status: "dropped", reasons: record.reasons.filter((reason): reason is string => typeof reason === "string") };
      }
      if (record.status === "duplicate") return { status: "duplicate" };
      if (record.status === "created") {
        await onDraftCreated?.();
        return { status: "created" };
      }
      return { status: "error", message: "예상하지 못한 응답이에요." };
    } catch {
      return { status: "error", message: "초안 생성 중 오류가 발생했어요." };
    } finally {
      setGeneratingId(null);
    }
  };

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((item) => item.decision === null).length,
    approved: items.filter((item) => item.decision === "approved").length,
    rejected: items.filter((item) => item.decision === "rejected").length,
  }), [items]);
  const visible = items.filter((item) => matchesFilter(item, filter));

  return (
    <section className="space-y-5" aria-label="레퍼런스 해부">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">레퍼런스 해부</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">수집된 글을 훅·본문·구조로 쪼개서 보여줘요. 제외한 글은 생성에 쓰이지 않아요.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchReferences()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="상태 필터">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === id
                ? "bg-amber-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {label} <span className="opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchReferences()}>다시 시도</Button>
        </div>
      )}

      {isLoading && items.length === 0 && !loadError && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !loadError && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {items.length === 0
            ? "아직 수집된 레퍼런스가 없어요. 레퍼런스 레이더가 돌면 여기에 쌓여요."
            : "이 상태의 레퍼런스가 없어요."}
        </div>
      )}

      <ul className="space-y-4">
        {visible.map((item) => (
          <ReferenceCard key={item.id} item={item} saving={savingId === item.id} generating={generatingId === item.id} busy={generatingId !== null} onDecide={decide} onMakeDraft={makeDraft} />
        ))}
      </ul>
    </section>
  );
}

interface ReferenceCardProps {
  item: ReferenceReviewItem;
  saving: boolean;
  generating: boolean;
  busy: boolean;
  onDecide: (id: string, decision: ReferenceDecision | null) => void;
  onMakeDraft: (id: string, kind: ReferenceKind) => Promise<DraftOutcome>;
}

function ReferenceCard({ item, saving, generating, busy, onDecide, onMakeDraft }: ReferenceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<ReferenceKind>("story");
  const [outcome, setOutcome] = useState<DraftOutcome | null>(null);
  const labels = [
    { name: "훅", value: item.hookType },
    { name: "감정", value: item.emotionalDriver },
    { name: "구조", value: item.structureType },
    { name: "CTA", value: item.ctaType },
  ].filter((label): label is { name: string; value: string } => Boolean(label.value));
  const dimmed = item.decision === "rejected";

  return (
    <li className={`bg-white dark:bg-slate-800 rounded-2xl border p-5 shadow-sm transition-opacity ${
      item.decision === "approved" ? "border-emerald-300 dark:border-emerald-700" : "border-slate-200 dark:border-slate-700"
    } ${dimmed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{item.authorUsername ? `@${item.authorUsername}` : "작성자 미상"}</span>
        {item.publishedAt && <span>{formatDate(item.publishedAt)}</span>}
        {item.referenceScore !== null && <span>점수 {item.referenceScore}</span>}
        <span>{item.timesSeen}회 포착</span>
        {item.replayAttemptedAt && <span>최근 재작성 시도 {formatDate(item.replayAttemptedAt)}</span>}
        {item.decision === "approved" && <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-medium">승인됨</span>}
        {item.decision === "rejected" && <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-slate-600 dark:text-slate-300 font-medium">제외됨</span>}
        {item.permalink && (
          <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200">
            원문 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="mt-3 border-l-4 border-amber-500 pl-3">
        <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">훅 (첫 줄)</div>
        <p className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-100 break-words">{item.hook || "(빈 글)"}</p>
      </div>

      {item.body && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">본문</div>
          <p className={`whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300 break-words ${expanded ? "" : "line-clamp-4"}`}>{item.body}</p>
          {(item.body.length > 160 || item.body.split("\n").length > 4) && (
            <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-1 text-xs text-amber-700 dark:text-amber-400 hover:underline">
              {expanded ? "접기" : "더보기"}
            </button>
          )}
        </div>
      )}

      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {labels.map((label) => (
            <span key={label.name} className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200">
              <span className="text-slate-400 dark:text-slate-400">{label.name}</span> {label.value}
            </span>
          ))}
          <span className="text-[11px] text-slate-400">자동 분석</span>
        </div>
      )}

      {item.whyItWorks && (
        <p className="mt-3 flex gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
          <span>{item.whyItWorks}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.decision === null ? (
          <>
            <Button type="button" size="sm" disabled={saving} onClick={() => onDecide(item.id, "approved")}>
              <Check className="w-4 h-4 mr-1" /> 승인
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onDecide(item.id, "rejected")}>
              <X className="w-4 h-4 mr-1" /> 제외
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onDecide(item.id, null)}>
            <RotateCcw className="w-4 h-4 mr-1" /> 되돌리기
          </Button>
        )}

        {item.decision !== "rejected" && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <div role="radiogroup" aria-label="글 유형" className="inline-flex rounded-md bg-slate-100 dark:bg-slate-700 p-0.5 text-xs">
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === option.id}
                  disabled={busy}
                  onClick={() => setKind(option.id)}
                  className={`rounded px-2.5 py-1 font-medium transition-colors disabled:opacity-50 ${
                    kind === option.id ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setOutcome(null);
                setOutcome(await onMakeDraft(item.id, kind));
              }}
            >
              {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PenLine className="w-4 h-4 mr-1" />}
              {generating ? "만드는 중…" : "초안 만들기"}
            </Button>
          </div>
        )}
      </div>

      {generating && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" role="status">최대 1~2분 걸려요. 다른 카드는 끝날 때까지 잠깐 잠겨요.</p>}
      {!generating && item.decision !== "rejected" && !outcome && <p className="mt-2 text-[11px] text-slate-400">초안 만들기는 AI를 호출해요 (비용이 들어요).</p>}

      {outcome?.status === "created" && (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">초안 1개를 만들었어요. 피드의 승인 대기에서 확인하세요.</p>
      )}
      {outcome?.status === "duplicate" && (
        <p role="status" className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">이 레퍼런스로는 이미 초안을 만들었어요.</p>
      )}
      {outcome?.status === "error" && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{outcome.message}</p>
      )}
      {outcome?.status === "dropped" && (
        <div role="alert" className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          <p className="font-medium">품질 검사에서 탈락했어요. 다시 눌러 다른 유형으로 시도해 볼 수 있어요.</p>
          {outcome.reasons.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {outcome.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
