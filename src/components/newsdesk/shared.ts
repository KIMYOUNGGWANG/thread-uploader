import type { NewsItemView, VariantView } from "@/lib/newsdesk/service";
import type { NewsPlatform } from "@/lib/newsdesk/verify";

export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";
export const PANEL = "rounded-xl border border-slate-200 bg-white";
export const BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BUTTON_PRIMARY = `${BUTTON} border-slate-900 bg-slate-900 text-white hover:bg-slate-700`;
export const BUTTON_IDLE = `${BUTTON} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;
export const LABEL = "text-sm font-semibold text-slate-800";
export const FIELD = `w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-500 ${FOCUS}`;

export const PLATFORM_LABEL: Record<NewsPlatform, string> = { telegram: "텔레그램", threads: "Threads", kakao: "카카오톡" };
// Identity marks only (tab dots, preview frames): each channel looks like itself, not like data.
export const PLATFORM_DOT: Record<NewsPlatform, string> = { telegram: "bg-[#229ED9]", threads: "bg-slate-900", kakao: "bg-[#FEE500] ring-1 ring-inset ring-amber-400" };

export const UPLOAD_LABEL: Record<string, string> = {
  QUEUED: "대기 중", UPLOADING: "올리는 중", PROCESSING: "올리는 중", PUBLISHED: "올라감", FAILED: "실패", CANCELED: "취소됨",
};

export const IN_FLIGHT = new Set(["QUEUED", "UPLOADING", "PROCESSING"]);

export type DeskItem = NewsItemView;
export type DeskVariant = VariantView;

/** One state per channel, in the operator's words; drives the tab line and the publish summary. */
export function variantState(variant: VariantView): { label: string; tone: "done" | "ready" | "draft" | "busy" | "failed" } {
  if (variant.platform === "kakao" && variant.manualDoneAt) return { label: "보냈음", tone: "done" };
  const status = variant.upload?.status;
  if (status === "PUBLISHED") return { label: "올라감", tone: "done" };
  if (status && IN_FLIGHT.has(status)) return { label: UPLOAD_LABEL[status], tone: "busy" };
  if (status === "FAILED") return { label: "실패", tone: "failed" };
  if (variant.approved) return { label: "승인됨", tone: "ready" };
  return { label: "승인 전", tone: "draft" };
}

export const TONE_TEXT: Record<ReturnType<typeof variantState>["tone"], string> = {
  done: "text-emerald-700", ready: "text-emerald-700", draft: "text-slate-600", busy: "text-sky-700", failed: "text-rose-700",
};

export function textLimit(platform: NewsPlatform, imageCount: number): number | null {
  if (platform === "telegram") return imageCount > 0 ? 1024 : 4096;
  if (platform === "threads") return 500;
  return null;
}

export function formatKst(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** POST/PATCH JSON and surface the server's Korean error message (or a plain fallback for non-JSON errors). */
export async function callJson<T>(url: string, init: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init.method,
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : `요청 실패 (HTTP ${response.status})`;
    throw new Error(message);
  }
  return data as T;
}
