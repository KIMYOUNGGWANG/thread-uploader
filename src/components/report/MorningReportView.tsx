"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MorningReport, ReportChannel } from "@/lib/distribution/morning-report";

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";
const CARD = "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";
const BUTTON = `min-h-11 rounded-lg border px-3 py-2 text-base font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;
const BUTTON_IDLE = "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
const BUTTON_DANGER = "border-rose-600 bg-rose-600 text-white hover:bg-rose-700";

const CHANNEL_LABEL: Record<ReportChannel, string> = {
  threads: "Threads", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", x: "X",
};
const KIND_LABEL: Record<string, string> = { video: "영상", carousel: "카드뉴스", text: "글" };

function formatKst(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function remaining(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "곧 올라가요";
  const minutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}시간 ${minutes % 60}분 남음` : `${minutes}분 남음`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

async function post(url: string, action: string): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `요청 실패 (${res.status})`);
  }
}

function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, url: string, action: string) => {
    setPending(key);
    setError(null);
    try {
      await post(url, action);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "실패했어요");
    } finally {
      setPending(null);
    }
  };
  return { pending, error, run };
}

export function MorningReportView({ report }: { report: MorningReport }) {
  const now = useNow();
  const { pending, error, run } = useAction();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-lg font-bold">아침 보고</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{formatKst(report.since)} 이후 · {formatKst(report.generatedAt)} 기준</p>
          </div>
          <Link href="/brands" className={`rounded-md text-base text-slate-600 hover:underline dark:text-slate-300 ${FOCUS}`}>제품 대시보드 →</Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-800 dark:bg-red-950/30 dark:text-red-200">{error}</p>}

        <section aria-labelledby="todo-heading" className="flex flex-col gap-3">
          <h2 id="todo-heading" className="text-base font-bold">내 할 일 {report.todos.length > 0 && <span className="text-slate-500">({report.todos.length})</span>}</h2>
          {report.todos.length === 0 ? (
            <p className={`${CARD} text-base text-slate-500 dark:text-slate-400`}>오늘은 할 일이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.todos.map((todo) => (
                <li key={todo.key} className={`${CARD} flex flex-wrap items-center justify-between gap-3`}>
                  <span className="text-base break-words">{todo.text}</span>
                  <span className="flex gap-2">
                    {todo.kind === "tiktok_public" && todo.uploadId && (
                      <button type="button" disabled={pending !== null} className={`${BUTTON} ${BUTTON_IDLE}`}
                        onClick={() => run(todo.key, `/api/channel-uploads/${todo.uploadId}`, "ack_public")}>
                        공개로 바꿨어요
                      </button>
                    )}
                    {todo.kind === "failed_upload" && todo.uploadId && (
                      <button type="button" disabled={pending !== null} className={`${BUTTON} ${BUTTON_IDLE}`}
                        onClick={() => run(todo.key, `/api/channel-uploads/${todo.uploadId}`, "retry")}>
                        다시 시도
                      </button>
                    )}
                    {todo.href && <Link href={todo.href} className={`${BUTTON} ${BUTTON_IDLE} inline-flex items-center`}>열기</Link>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
          <h2 id="pending-heading" className="text-base font-bold">오늘 올라갈 것</h2>
          {report.pendingVideos.length === 0 && report.pendingUploads.length === 0 ? (
            <p className={`${CARD} text-base text-slate-500 dark:text-slate-400`}>취소 창이 열린 영상·카드뉴스가 없어요.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {report.pendingVideos.map((video) => (
                <article key={video.draftId} className={`${CARD} flex gap-3`}>
                  {video.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.coverUrl} alt="" className="aspect-[9/16] w-20 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{video.brandName} · 영상 → 연결된 영상 채널</p>
                    <p className="text-base font-semibold break-words">{video.title || "제목 없음"}</p>
                    <p className="text-base">{video.canceled ? "취소됨" : `${formatKst(video.autoPublishAt)} 자동 업로드 · ${remaining(video.autoPublishAt, now)}`}</p>
                    <div className="flex flex-wrap gap-2">
                      {video.canceled ? (
                        <button type="button" disabled={pending !== null} className={`${BUTTON} ${BUTTON_IDLE}`}
                          onClick={() => run(video.draftId, `/api/video-drafts/${video.draftId}/schedule`, "resume")}>취소 되돌리기</button>
                      ) : (
                        <>
                          <button type="button" disabled={pending !== null} className={`${BUTTON} ${BUTTON_DANGER}`}
                            onClick={() => run(video.draftId, `/api/video-drafts/${video.draftId}/schedule`, "cancel")}>취소</button>
                          <button type="button" disabled={pending !== null} className={`${BUTTON} ${BUTTON_IDLE}`}
                            onClick={() => run(video.draftId, `/api/video-drafts/${video.draftId}/schedule`, "publish_now")}>지금 올리기</button>
                        </>
                      )}
                      <Link href={`/brands/${video.brandSlug}/videos`} className={`${BUTTON} ${BUTTON_IDLE} inline-flex items-center`}>미리 보기</Link>
                    </div>
                  </div>
                </article>
              ))}
              {report.pendingUploads.map((upload) => (
                <article key={upload.id} className={`${CARD} flex flex-col gap-2`}>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{upload.brandName} · {KIND_LABEL[upload.kind] ?? upload.kind} → {CHANNEL_LABEL[upload.channel]}</p>
                  <p className="text-base font-semibold break-words">{upload.title || "제목 없음"}</p>
                  <p className="text-base">{formatKst(upload.scheduledAt)} 자동 업로드 · {remaining(upload.scheduledAt, now)}</p>
                  <div>
                    <button type="button" disabled={pending !== null} className={`${BUTTON} ${BUTTON_DANGER}`}
                      onClick={() => run(upload.id, `/api/channel-uploads/${upload.id}`, "cancel")}>취소</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {report.threadsBacklog.some((b) => b.pending + b.review > 0) && (
            <p className="text-base text-slate-600 dark:text-slate-400">
              Threads 대기 글: {report.threadsBacklog.filter((b) => b.pending + b.review > 0).map((b) => `${b.brandName} 발행 대기 ${b.pending} · 검토 ${b.review}`).join(" / ")}
            </p>
          )}
        </section>

        <section aria-labelledby="done-heading" className="flex flex-col gap-3">
          <h2 id="done-heading" className="text-base font-bold">어제부터 올라간 것</h2>
          {report.summary.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {report.summary.map((s) => (
                <div key={s.channel} className={CARD}>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{CHANNEL_LABEL[s.channel]}</p>
                  <p className="text-xl font-bold tabular-nums">{s.published}건</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {s.failed > 0 ? <span className="text-red-600 dark:text-red-400">실패 {s.failed}</span> : "실패 없음"}
                    {s.views !== null ? ` · 조회 ${s.views.toLocaleString("ko-KR")}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          {report.recent.length === 0 ? (
            <p className={`${CARD} text-base text-slate-500 dark:text-slate-400`}>어제부터 올라간 것이 없어요.</p>
          ) : (
            <ul className={`${CARD} flex flex-col divide-y divide-slate-200 p-0 dark:divide-slate-800`}>
              {report.recent.map((item) => (
                <li key={`${item.channel}-${item.id}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                  <span className="min-w-0 text-base break-words">
                    <span className="font-semibold">{CHANNEL_LABEL[item.channel]}</span>
                    <span className="text-slate-500 dark:text-slate-400"> · {item.brandName} · {KIND_LABEL[item.kind] ?? item.kind}{item.privacy === "private" ? " · 비공개" : ""}</span>
                    <span className="block">{item.title || "제목 없음"}</span>
                    {item.status === "FAILED" && item.errorLog && <span className="block text-sm text-red-600 dark:text-red-400">{item.errorLog}</span>}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    {item.status === "FAILED" ? <span className="font-semibold text-red-600 dark:text-red-400">실패</span> : formatKst(item.at)}
                    {item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer" className={`underline ${FOCUS}`}>보기</a>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
