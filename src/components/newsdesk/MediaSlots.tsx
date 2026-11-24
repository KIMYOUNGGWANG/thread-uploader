"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { NewsMedia } from "@/lib/newsdesk/approval";
import { FOCUS } from "./shared";

const MAX = 5;
const MAX_BYTES = 5 * 1024 * 1024; // Telegram fetches photos by URL up to 5 MB
const TYPES = ["image/png", "image/jpeg"];

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface MediaSlotsProps {
  brandId: string;
  media: NewsMedia[];
  onChange: (media: NewsMedia[]) => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

/** Up to five images in send order: Ctrl+V repeatedly, drop several, or pick files. Uploads straight to Blob. */
export function MediaSlots({ brandId, media, onChange, disabled = false, disabledReason }: MediaSlotsProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const locked = disabled || busy > 0;

  async function add(files: File[]) {
    if (disabled) return;
    const room = MAX - media.length;
    const picked = files.filter((f) => TYPES.includes(f.type));
    const problems: string[] = [];
    if (picked.length < files.length) problems.push("PNG·JPEG만 올릴 수 있어");
    const fitting = picked.filter((f) => f.size <= MAX_BYTES);
    if (fitting.length < picked.length) problems.push("한 장에 5MB까지야");
    if (fitting.length > room) problems.push(`최대 ${MAX}장이라 ${fitting.length - room}장은 뺐어`);
    const batch = fitting.slice(0, Math.max(0, room));
    setError(problems.length ? problems.join(" · ") : null);
    if (batch.length === 0) return;

    setBusy(batch.length);
    const added: NewsMedia[] = [];
    try {
      for (const file of batch) {
        const ext = file.type === "image/png" ? "png" : "jpg";
        const blob = await upload(`newsdesk/${brandId}/image.${ext}`, file, {
          access: "public",
          handleUploadUrl: "/api/newsdesk/upload",
          clientPayload: JSON.stringify({ brandId }),
        });
        added.push({ url: blob.url, sha256: await sha256(file), name: file.name || `붙여넣은 이미지.${ext}`, bytes: file.size });
      }
    } catch (e) {
      const kept = added.length > 0 ? ` (앞의 ${added.length}장은 넣었어)` : "";
      setError(`${e instanceof Error ? `업로드 실패: ${e.message}` : "업로드 실패"}${kept}`);
    }
    try {
      // Images that made it before a failure are kept, so the operator only re-adds the ones that failed.
      if (added.length > 0) await onChange([...media, ...added]);
    } finally {
      setBusy(0);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files);
    if (files.length > 0) {
      event.preventDefault();
      void add(files);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void add(Array.from(event.dataTransfer.files));
  }

  const remove = (index: number) => void onChange(media.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2">
      <div
        tabIndex={0}
        role="group"
        aria-label={`이미지 ${media.length}/${MAX}장. 여기를 누르고 Ctrl+V로 붙여넣거나 파일을 끌어다 놓기`}
        onPaste={onPaste}
        onDragOver={(e) => { e.preventDefault(); if (!locked) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`grid grid-cols-5 gap-2 rounded-lg p-2 ${dragging ? "bg-slate-100 ring-2 ring-slate-400" : "bg-slate-50"} ${FOCUS}`}
      >
        {Array.from({ length: MAX }, (_, i) => {
          const item = media[i];
          if (item) {
            return (
              <figure key={item.url} className="relative aspect-square overflow-hidden rounded-md bg-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs, already sized by the uploader */}
                <img src={item.url} alt={`${i + 1}번 이미지: ${item.name}`} className="h-full w-full object-cover" />
                <figcaption className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 text-xs font-semibold leading-5 text-white">{i + 1}</figcaption>
                {!disabled && (
                  <button type="button" onClick={() => remove(i)} aria-label={`${i + 1}번 이미지 빼기`}
                    className={`absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-800 hover:bg-slate-100 ${FOCUS}`}>
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </figure>
            );
          }
          const isNext = i === media.length;
          return (
            <button key={`slot-${i}`} type="button" disabled={locked || !isNext} onClick={() => input.current?.click()}
              aria-label={isNext ? `${i + 1}번 자리에 이미지 추가` : `${i + 1}번 자리 (비어 있음)`}
              className={`grid aspect-square place-items-center rounded-md border border-dashed text-slate-600 ${isNext && !locked ? "border-slate-400 bg-white hover:bg-slate-100" : "border-slate-300"} disabled:cursor-default ${FOCUS}`}>
              {isNext && busy > 0 ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : (
                <span className="flex flex-col items-center gap-0.5 text-xs">
                  {isNext && <ImagePlus className="h-5 w-5" aria-hidden />}
                  {i + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <input ref={input} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => { void add(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <p className="text-sm text-slate-600">
        {disabled && disabledReason ? disabledReason : busy > 0 ? `${busy}장 올리는 중…` : "칸을 누르고 Ctrl+V · 끌어다 놓기 · 파일 선택. 1번부터 순서대로 보내."}
      </p>
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
