"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Send } from "lucide-react";
import type { NewsMedia } from "@/lib/newsdesk/approval";
import { MediaSlots } from "./MediaSlots";
import { VariantEditor, type VariantAction } from "./VariantEditor";
import {
  BUTTON_IDLE, BUTTON_PRIMARY, FOCUS, formatKst, hostOf, PANEL, PLATFORM_DOT, PLATFORM_LABEL, TONE_TEXT, variantState,
  type DeskItem,
} from "./shared";
import type { NewsPlatform } from "@/lib/newsdesk/verify";

interface ItemPanelProps {
  item: DeskItem;
  brandName: string;
  brandSlug: string;
  busy: boolean;
  notice: { tone: "ok" | "error"; text: string } | null;
  act: (action: string, body?: Record<string, unknown>) => Promise<boolean>;
  setMedia: (media: NewsMedia[]) => Promise<boolean>;
}

/** The one question this column answers: what is ready to go out on each channel, and is it true to the article? */
function finding(item: DeskItem): string {
  const unverified = item.facts.filter((f) => !f.verified).length;
  const blocked = item.variants.filter((v) => !v.locked && v.check.blockers.length > 0).map((v) => PLATFORM_LABEL[v.platform]);
  const parts: string[] = [];
  if (item.facts.length > 0) {
    parts.push(unverified > 0 ? `팩트 ${item.facts.length}개 중 ${unverified}개는 원문에서 못 찾았어` : `팩트 ${item.facts.length}개 모두 원문에서 확인됨`);
  } else if (item.rawMode) {
    parts.push("원문 그대로 모드라 팩트를 뽑지 않았어");
  }
  if (blocked.length > 0) parts.push(`${blocked.join("·")}은 고쳐야 승인돼`);
  const approved = item.variants.filter((v) => v.approved || v.locked).length;
  parts.push(`승인 ${approved}/${item.variants.length}`);
  return parts.join(" · ");
}

export function ItemPanel({ item, brandName, brandSlug, busy, notice, act, setMedia }: ItemPanelProps) {
  const [active, setActive] = useState<NewsPlatform>(item.variants[0]?.platform ?? "telegram");
  const [dirty, setDirty] = useState<Partial<Record<NewsPlatform, boolean>>>({});
  const onDirtyChange = useCallback((platform: NewsPlatform, value: boolean) => {
    setDirty((current) => (current[platform] === value ? current : { ...current, [platform]: value }));
  }, []);

  const variant = item.variants.find((v) => v.platform === active) ?? item.variants[0];
  const anyDirty = Object.values(dirty).some(Boolean);
  const anyLocked = item.variants.some((v) => v.locked);
  const approvable = item.variants.filter((v) => !v.locked && !v.approved && v.check.blockers.length === 0);
  const publishable = item.variants.filter((v) => v.platform !== "kakao" && v.approved && !v.locked);
  // The button names exactly what will go out: approved channels that are also connected.
  const ready = publishable.filter((v) => item.channels[v.platform as "telegram" | "threads"]?.connected);
  const unready = publishable.filter((v) => !ready.includes(v));
  const images = item.media.map((m) => m.url);
  const source = hostOf(item.sourceUrl);
  const [running, setRunning] = useState<"approve_all" | "publish" | null>(null);

  async function run(action: "approve_all" | "publish", body: Record<string, unknown>) {
    setRunning(action);
    try {
      await act(action, body);
    } finally {
      setRunning(null);
    }
  }

  const variantAct: VariantAction = (action, body) => act(action, { platform: variant.platform, ...body });

  return (
    <section aria-labelledby="desk-item" className={`${PANEL} flex flex-col`}>
      {/* Title row: the article, the finding, and the screen's main job (publish) */}
      <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 id="desk-item" className="text-xl font-bold leading-snug text-slate-900 break-keep [overflow-wrap:anywhere]">
            {item.sourceTitle ?? item.sourceText.slice(0, 60)}
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
            {source && item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 underline-offset-2 hover:underline ${FOCUS}`}>
                {source}<ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
            <span>{formatKst(item.createdAt)} 생성</span>
          </p>
          <p className="text-base text-slate-800">{finding(item)}</p>
          {unready.length > 0 && (
            <p className="text-sm text-amber-900">발행에서 빠지는 채널: {unready.map((v) => PLATFORM_LABEL[v.platform]).join("·")} (연결 안 됨)</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" disabled={busy || anyDirty || approvable.length === 0}
            onClick={() => void run("approve_all", { revisions: Object.fromEntries(approvable.map((v) => [v.platform, v.revision])) })}
            className={BUTTON_IDLE}
            title={anyDirty ? "저장 안 한 수정이 있어" : approvable.length === 0 ? "승인할 원고가 없어" : undefined}>
            {running === "approve_all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            전체 승인{approvable.length > 0 ? ` (${approvable.length})` : ""}
          </button>
          <button type="button" disabled={busy || anyDirty || ready.length === 0}
            onClick={() => void run("publish", { platforms: ready.map((v) => v.platform) })} className={BUTTON_PRIMARY}
            title={anyDirty ? "저장 안 한 수정이 있어" : publishable.length === 0 ? "승인된 텔레그램·Threads 원고가 없어" : ready.length === 0 ? "승인한 채널이 아직 연결 안 됐어" : undefined}>
            {running === "publish" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {ready.length > 0 ? `${ready.map((v) => PLATFORM_LABEL[v.platform]).join("·")} 발행` : "발행"}
          </button>
        </div>
      </div>
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"}
          className={`mx-5 mb-4 rounded-lg px-3 py-2 text-base ${notice.tone === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`}>
          {notice.text}
        </p>
      )}

      <div className="grid gap-5 border-t border-slate-100 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Facts with their evidence: the reason to trust (or fix) every draft below */}
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-base font-semibold text-slate-900">핵심 사실과 근거</h3>
          {item.facts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600">
              {item.rawMode ? "원문 그대로 모드라 팩트를 뽑지 않았어." : "뽑힌 팩트가 없어. 원문이 너무 짧았을 수 있어."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {item.facts.map((fact, index) => (
                <li key={`${index}-${fact.text}`} className="flex gap-2.5">
                  {fact.verified
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-label="원문에서 확인됨" />
                    : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-label="원문에서 못 찾음" />}
                  <div className="min-w-0">
                    <p className="text-base text-slate-900">{fact.text}</p>
                    <p className={`text-sm ${fact.verified ? "text-slate-600" : "text-amber-900"}`}>
                      {fact.verified ? `근거: “${fact.evidence}”` : `근거 인용이 원문과 달라: “${fact.evidence || "없음"}”`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-base font-semibold text-slate-900">이미지 <span className="font-normal text-slate-600">{item.media.length}/5장</span></h3>
          <MediaSlots brandId={item.brandId} media={item.media} onChange={async (media) => { await setMedia(media); }}
            disabled={busy || anyLocked}
            disabledReason={anyLocked ? "발행을 시작한 채널이 있어서 이미지를 바꿀 수 없어." : undefined} />
          {!anyLocked && <p className="text-sm text-slate-600">이미지를 바꾸면 모든 채널 승인이 풀려.</p>}
        </div>
      </div>

      {/* Channel tabs: each tab says where that channel stands */}
      <div className="border-t border-slate-100 px-5 pt-3">
        {/* Inset shadow, not border-b + -mb-px: a negative margin overflows an overflow-x-auto row and draws a scrollbar. */}
        <div role="tablist" aria-label="채널별 원고" className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-slate-200)]">
          {item.variants.map((v) => {
            const state = variantState(v);
            const selected = v.platform === variant.platform;
            return (
              <button key={v.platform} role="tab" type="button" aria-selected={selected} aria-controls="desk-variant" onClick={() => setActive(v.platform)}
                className={`flex min-h-14 shrink-0 flex-col items-start justify-center border-b-2 px-3 py-2 text-left sm:px-4 ${selected ? "border-slate-900" : "border-transparent hover:border-slate-300"} ${FOCUS}`}>
                <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <span className={`h-2.5 w-2.5 rounded-full ${PLATFORM_DOT[v.platform]}`} aria-hidden />
                  {PLATFORM_LABEL[v.platform]}{dirty[v.platform] ? " *" : ""}
                </span>
                <span className={`text-sm ${TONE_TEXT[state.tone]}`}>{state.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div id="desk-variant" role="tabpanel" className="p-5">
        {variant && (
          <VariantEditor key={variant.platform} variant={variant} images={images} brandName={brandName} brandSlug={brandSlug}
            channel={variant.platform === "kakao" ? null : item.channels[variant.platform]} busy={busy} act={variantAct}
            onDirtyChange={(value) => onDirtyChange(variant.platform, value)} />
        )}
      </div>
    </section>
  );
}
