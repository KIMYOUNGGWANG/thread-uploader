"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { consecutiveGood, type Verdict } from "@/lib/video-factory/verdict";
import { isRecord } from "@/types/config-normalizers";

const GOAL = 5;
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";
const BADGE = "rounded-full px-2 py-0.5 text-sm font-semibold";
const BADGE_RENDERING = "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300";
const BADGE_DONE = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
const BADGE_FAILED = "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
const BADGE_NEUTRAL = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
const MEDIA = "aspect-[9/16] w-full rounded-lg bg-slate-100 dark:bg-slate-800";

const STATUS: Record<string, { label: string; className: string }> = {
  QUEUED: { label: "대기 중", className: BADGE_NEUTRAL },
  RENDERING: { label: "렌더 중", className: BADGE_RENDERING },
  COMPLETED: { label: "완료", className: BADGE_DONE },
  FAILED: { label: "실패", className: BADGE_FAILED },
};

export interface VideoDraftCardData {
  id: string;
  status: string;
  kstDate: string;
  script: string;
  renderErrors: string;
  videoUrl: string | null;
  coverUrl: string | null;
  userVerdict: string | null;
  createdAt: Date;
  clipAsset: { license: string } | null;
}

interface VideoFactoryPanelProps {
  drafts: VideoDraftCardData[];
  history: { id: string; status: string; userVerdict: string | null; createdAt: Date }[];
  brandSlug: string;
  brandName: string;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hookLines(script: string): string[] {
  const parsed = parseJson(script);
  const hook = isRecord(parsed) ? parsed.hook : null;
  const lines = isRecord(hook) ? hook.lines : null;
  return Array.isArray(lines) ? lines.filter((l): l is string => typeof l === "string" && l.trim() !== "") : [];
}

function renderErrors(raw: string): string[] {
  const parsed = parseJson(raw);
  return Array.isArray(parsed) ? parsed.map((e) => (typeof e === "string" ? e : JSON.stringify(e))) : [];
}

function clipSource(clip: VideoDraftCardData["clipAsset"]): string {
  if (!clip) return "기본 이미지";
  try {
    return new URL(clip.license).hostname.replace(/^www\./, "");
  } catch {
    return clip.license;
  }
}

function StreakHeader({ streak }: { streak: number }) {
  const reached = streak >= GOAL;
  return (
    <section aria-label="판정 진행" className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-base">
          <span className="text-2xl font-bold tabular-nums">연속 {streak}편</span>
          <span className="text-slate-500 dark:text-slate-400"> / 목표 {GOAL}편</span>
        </p>
        {reached && <span className={`${BADGE} ${BADGE_DONE}`}>목표 달성</span>}
      </div>
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {Array.from({ length: GOAL }, (_, i) => (
          <span key={i} className={`h-2 rounded-full ${i < streak ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />
        ))}
      </div>
      <p className="text-base text-slate-500 dark:text-slate-400">최신 완성 영상부터 &quot;올릴 만함&quot;이 이어진 편수예요. &quot;아님&quot;이나 미판정이 나오면 다시 0부터 세요.</p>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-16 text-center text-base text-slate-600 dark:border-slate-700 dark:text-slate-400">
      <p className="font-medium text-slate-900 dark:text-slate-100">아직 만들어진 영상이 없어요</p>
      <p>매일 아침 KST 06:00에 자동으로 한 편 만들어요. 내일 아침에 다시 확인해 주세요.</p>
    </div>
  );
}

function Media({ draft }: { draft: VideoDraftCardData }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // The play button unmounts on click; hand keyboard focus to the player that replaces it.
  useEffect(() => {
    if (playing) videoRef.current?.focus();
  }, [playing]);

  if (draft.status === "COMPLETED" && draft.videoUrl) {
    if (playing || !draft.coverUrl) {
      return (
        <video
          ref={videoRef}
          src={draft.videoUrl}
          poster={draft.coverUrl ?? undefined}
          controls
          playsInline
          preload="none"
          autoPlay={playing}
          className={`${MEDIA} object-cover ${FOCUS}`}
        />
      );
    }
    return (
      <button type="button" onClick={() => setPlaying(true)} className={`group relative block overflow-hidden rounded-lg ${FOCUS}`} aria-label="영상 재생">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.coverUrl} alt="" loading="lazy" className={`${MEDIA} object-cover`} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow">
            <Play className="ml-0.5 h-6 w-6" aria-hidden="true" />
          </span>
        </span>
      </button>
    );
  }

  if (draft.status === "RENDERING" || draft.status === "QUEUED") {
    return (
      <div className={`${MEDIA} flex flex-col items-center justify-center gap-2 text-base text-slate-500 dark:text-slate-400`}>
        <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span>{draft.status === "QUEUED" ? "렌더 대기 중" : "영상 만드는 중"}</span>
      </div>
    );
  }

  return (
    <div className={`${MEDIA} flex items-center justify-center text-base text-slate-500 dark:text-slate-400`}>
      {draft.status === "FAILED" ? "영상 없음" : "영상 주소 없음"}
    </div>
  );
}

const VERDICT_BUTTONS: { value: Verdict; label: string; active: string }[] = [
  { value: "good", label: "올릴 만함", active: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" },
  { value: "bad", label: "아님", active: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700" },
];
const VERDICT_IDLE = "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

interface VideoCardProps {
  draft: VideoDraftCardData;
  verdict: string | null;
  pending: boolean;
  error: string | null;
  onVerdict: (value: Verdict) => void;
}

function VideoCard({ draft, verdict, pending, error, onVerdict }: VideoCardProps) {
  const status = STATUS[draft.status] ?? { label: draft.status, className: BADGE_NEUTRAL };
  const lines = hookLines(draft.script);
  const errors = draft.status === "FAILED" ? renderErrors(draft.renderErrors) : [];

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
      <Media draft={draft} />
      <div className="flex flex-col gap-2 px-1 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${BADGE} ${status.className}`}>{status.label}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">{draft.kstDate}</span>
        </div>
        {lines.length > 0 && (
          <p className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {lines.map((line, i) => (
              <span key={i} className="block">{line}</span>
            ))}
          </p>
        )}
        <p className="text-base text-slate-500 dark:text-slate-400">배경: {clipSource(draft.clipAsset)}</p>

        {draft.status === "FAILED" && (
          <div className="rounded-lg bg-red-50 p-3 text-base text-red-800 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-medium">실패 이유</p>
            {errors.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-base break-words">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            ) : (
              <p className="mt-1 text-base">기록된 이유가 없어요</p>
            )}
          </div>
        )}

        {draft.status === "COMPLETED" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="판정">
              {VERDICT_BUTTONS.map((b) => {
                const pressed = verdict === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    aria-pressed={pressed}
                    disabled={pending}
                    onClick={() => onVerdict(b.value)}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-base font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${pressed ? b.active : VERDICT_IDLE} ${FOCUS}`}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
            <p className="min-h-6 text-base" aria-live="polite">
              {error ? (
                <span role="alert" className="text-red-600 dark:text-red-400">{error}</span>
              ) : pending ? (
                <span className="text-slate-500 dark:text-slate-400">저장 중…</span>
              ) : verdict === null ? (
                <span className="text-slate-500 dark:text-slate-400">아직 판정 전</span>
              ) : null}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

export function VideoFactoryPanel({ drafts, history, brandSlug, brandName }: VideoFactoryPanelProps) {
  const [verdicts, setVerdicts] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const verdictOf = (d: { id: string; userVerdict: string | null }) => (d.id in verdicts ? verdicts[d.id] : d.userVerdict);
  const streak = consecutiveGood(history.map((h) => ({ ...h, userVerdict: verdictOf(h) })));

  async function submitVerdict(draft: VideoDraftCardData, value: Verdict) {
    const previous = verdictOf(draft);
    if (previous === value || pending[draft.id]) return;
    setVerdicts((v) => ({ ...v, [draft.id]: value }));
    setPending((p) => ({ ...p, [draft.id]: true }));
    setErrors((e) => ({ ...e, [draft.id]: null }));
    try {
      const res = await fetch(`/api/video-drafts/${draft.id}/verdict`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict: value }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : `저장 실패 (${res.status})`);
      }
    } catch (err) {
      setVerdicts((v) => ({ ...v, [draft.id]: previous }));
      const reason = err instanceof Error ? err.message : "네트워크 오류";
      setErrors((e) => ({ ...e, [draft.id]: `판정을 저장하지 못했어요: ${reason}` }));
    } finally {
      setPending((p) => ({ ...p, [draft.id]: false }));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-lg font-bold">{brandName} · 영상 공장</h1>
          <Link href={`/brands/${brandSlug}`} className={`rounded-md text-base text-slate-600 hover:underline dark:text-slate-300 ${FOCUS}`}>
            ← 대시보드로
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <StreakHeader streak={streak} />
        {drafts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {drafts.map((d) => (
              <VideoCard
                key={d.id}
                draft={d}
                verdict={verdictOf(d)}
                pending={Boolean(pending[d.id])}
                error={errors[d.id] ?? null}
                onVerdict={(value) => void submitVerdict(d, value)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
