"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import type { ChannelStatus } from "@/lib/newsdesk/service";
import { ChannelPreview } from "./ChannelPreview";
import { BUTTON_IDLE, BUTTON_PRIMARY, FIELD, formatKst, IN_FLIGHT, PLATFORM_LABEL, textLimit, UPLOAD_LABEL, type DeskVariant } from "./shared";

export type VariantAction = (action: string, body?: Record<string, unknown>) => Promise<boolean>;

interface VariantEditorProps {
  variant: DeskVariant;
  images: string[];
  brandName: string;
  brandSlug: string;
  channel: ChannelStatus | null;
  busy: boolean;
  act: VariantAction;
  onDirtyChange: (dirty: boolean) => void;
}

export function VariantEditor({ variant, images, brandName, brandSlug, channel, busy, act, onDirtyChange }: VariantEditorProps) {
  const [draft, setDraft] = useState(variant.text);
  const [copied, setCopied] = useState(false);
  // Which of this editor's buttons is waiting, so the spinner sits on the one that was pressed.
  const [running, setRunning] = useState<"save" | "approve" | null>(null);
  // A new revision from the server (save, approve elsewhere, media change) replaces the local copy.
  // Adjusted during render rather than in an effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [synced, setSynced] = useState({ text: variant.text, revision: variant.revision });
  if (synced.text !== variant.text || synced.revision !== variant.revision) {
    setSynced({ text: variant.text, revision: variant.revision });
    setDraft(variant.text);
  }
  const dirty = draft !== variant.text;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const limit = textLimit(variant.platform, images.length);
  const over = limit !== null && draft.length > limit;
  const status = variant.upload?.status ?? null;
  const editable = !variant.locked;
  const id = `variant-${variant.platform}`;

  async function approve() {
    setRunning("approve");
    try {
      if (dirty) {
        // The operator is looking at their own edit: save it, then approve the revision that save produced.
        if (!(await act("edit", { text: draft }))) return;
        await act("approve", { revision: variant.revision + 1 });
        return;
      }
      await act("approve", { revision: variant.revision });
    } finally {
      setRunning(null);
    }
  }

  async function save() {
    setRunning("save");
    try {
      await act("edit", { text: draft });
    } finally {
      setRunning(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(variant.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm font-semibold text-slate-800">{PLATFORM_LABEL[variant.platform]} 원고</label>
          <span className={`text-sm tabular-nums ${over ? "font-semibold text-rose-700" : "text-slate-600"}`}>
            {draft.length.toLocaleString("ko-KR")}{limit !== null ? ` / ${limit.toLocaleString("ko-KR")}자` : "자"}
          </span>
        </div>
        <textarea id={id} value={draft} onChange={(e) => setDraft(e.target.value)} readOnly={!editable} rows={12}
          className={`${FIELD} resize-y leading-relaxed ${editable ? "" : "bg-slate-50 text-slate-700"}`} />

        {variant.check.blockers.length > 0 && !dirty && (
          <ul className="flex flex-col gap-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" aria-label="승인을 막는 문제">
            {variant.check.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
        {variant.check.warnings.length > 0 && !dirty && (
          <ul className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" aria-label="확인할 점">
            {variant.check.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
        {over && limit !== null && (
          <p className="text-sm font-semibold text-rose-700">한도 {limit.toLocaleString("ko-KR")}자를 {(draft.length - limit).toLocaleString("ko-KR")}자 넘었어. 줄여야 승인할 수 있어.</p>
        )}
        {dirty && <p className="text-sm text-slate-700">저장 안 한 수정이 있어. 저장하면 이 채널 승인이 풀려.</p>}
        {channel && !channel.connected && variant.platform !== "kakao" && (
          <p className="text-sm text-amber-900">
            {channel.reason}.{" "}
            {variant.platform === "telegram" && <Link href={`/brands/${brandSlug}/settings`} className="font-semibold underline underline-offset-2">브랜드 설정 열기</Link>}
          </p>
        )}
        {variant.platform === "kakao" && !variant.approved && !variant.locked && (
          <p className="text-sm text-slate-600">카카오 단톡방은 자동으로 못 보내. 승인하면 &quot;원고 복사&quot; 버튼이 생기니까, 복사해서 단톡방에 붙여넣어줘.</p>
        )}
        {variant.platform === "telegram" && images.length === 0 && (
          <p className="text-sm text-slate-600">글만 보내면 원문 링크의 미리보기 이미지가 붙을 수 있어.</p>
        )}

        {/* Status and the controls for this channel's next step */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-700" aria-live="polite">
            <span className="tabular-nums">Rev {variant.revision}</span>
            {" · "}
            {variant.platform === "kakao" && variant.manualDoneAt
              ? `단톡방에 보냈음 (${formatKst(variant.manualDoneAt)})`
              : status
                ? `${UPLOAD_LABEL[status] ?? status}${variant.upload?.publishedAt ? ` (${formatKst(variant.upload.publishedAt)})` : ""}`
                : variant.approved && variant.approvedAt ? `승인됨 (${formatKst(variant.approvedAt)})` : "승인 전"}
          </p>
          {status === "FAILED" && variant.upload?.errorLog && (
            <p className="break-words rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{variant.upload.errorLog}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {editable && dirty && (
              <button type="button" disabled={busy} onClick={() => void save()} className={BUTTON_IDLE}>
                {running === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}저장
              </button>
            )}
            {editable && (!variant.approved || dirty) && (
              <button type="button" disabled={busy || over || (!dirty && variant.check.blockers.length > 0) || !draft.trim()} onClick={() => void approve()} className={BUTTON_PRIMARY}>
                {running === "approve" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                {dirty ? "저장하고 승인" : "승인"}
              </button>
            )}
            {/* Kakao's next step after approval is the copy, so it leads; undoing the approval comes last. */}
            {variant.platform === "kakao" && variant.approved && !variant.locked && !dirty && (
              <>
                <button type="button" onClick={() => void copy()} className={BUTTON_PRIMARY}>
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied ? "복사했어" : "원고 복사"}
                </button>
                <button type="button" disabled={busy} onClick={() => void act("kakao_sent")} className={BUTTON_IDLE}>단톡방에 보냈어</button>
              </>
            )}
            {editable && variant.approved && !dirty && (
              <button type="button" disabled={busy} onClick={() => void act("revoke")} className={BUTTON_IDLE}>승인 취소</button>
            )}
            {status === "QUEUED" && (
              <button type="button" disabled={busy} onClick={() => void act("cancel")} className={BUTTON_IDLE}>대기 취소</button>
            )}
            {variant.upload?.externalUrl && (
              <a href={variant.upload.externalUrl} target="_blank" rel="noreferrer" className={BUTTON_IDLE}>
                <ExternalLink className="h-4 w-4" aria-hidden />올라간 글 보기
              </a>
            )}
            {variant.canUnlock && (
              <button type="button" disabled={busy} onClick={() => void act("unlock")} className={BUTTON_IDLE}>
                {variant.platform === "kakao" ? "보냄 표시 되돌리기" : "잠금 풀고 다시 고치기"}
              </button>
            )}
          </div>
          {variant.canUnlock && variant.platform !== "kakao" && (
            <p className="text-sm text-slate-700">실패 사유를 먼저 확인해줘. &quot;전송 여부 확인 필요&quot;면 채널에 실제로 올라갔을 수 있어.</p>
          )}
          {status && IN_FLIGHT.has(status) && <p className="text-sm text-slate-600">진행 상황을 자동으로 확인하는 중이야.</p>}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-semibold text-slate-800">미리보기</span>
        <ChannelPreview platform={variant.platform} text={draft} images={images} handle={channel?.handle ?? null} brandName={brandName} />
      </div>
    </div>
  );
}
