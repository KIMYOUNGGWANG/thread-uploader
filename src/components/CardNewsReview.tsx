"use client";

import { useState } from "react";
import { AlertTriangle, Images } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMPLIANCE_PREFIX, slidesVersion, type CardSlide } from "@/lib/wellness/slides";

interface PreviewProps {
  postId: string;
  slides: CardSlide[];
  rawSlides: string;
  instagramCaption: string | null;
  issues: string[];
}

export function CardNewsPreview({ postId, slides, rawSlides, instagramCaption, issues }: PreviewProps) {
  const [captionOpen, setCaptionOpen] = useState(false);
  const version = slidesVersion(rawSlides);

  return (
    <div className="mt-3 space-y-3">
      {issues.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 dark:border-red-900 dark:bg-red-950/40">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            승인 전에 고쳐야 할 표현 {issues.length}개
          </p>
          <ul className="space-y-0.5 text-xs text-red-600 dark:text-red-400">
            {issues.map((issue) => (
              <li key={issue}>{issue.replace(`${COMPLIANCE_PREFIX} · `, "")}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Images className="h-3 w-3" aria-hidden />
          인스타 카드 {slides.length}장
        </p>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {slides.map((slide, i) => (
            <a
              key={i}
              href={`/api/cards/${postId}?slide=${i}&v=${version}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 snap-start rounded-md ring-violet-500 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
              aria-label={`카드 ${i + 1} 크게 보기: ${slide.headline}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/cards/${postId}?slide=${i}&v=${version}`}
                alt=""
                loading="lazy"
                className="h-28 w-28 rounded-md border border-slate-200 bg-[#F6F1EA] object-cover dark:border-slate-700"
              />
            </a>
          ))}
        </div>
      </div>

      {instagramCaption && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">인스타 캡션</p>
          <p className={`whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300 ${captionOpen ? "" : "line-clamp-3"}`}>{instagramCaption}</p>
          <button
            type="button"
            onClick={() => setCaptionOpen((open) => !open)}
            className="mt-1 text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            {captionOpen ? "접기" : "전체 보기"}
          </button>
        </div>
      )}
    </div>
  );
}

interface EditorProps {
  slides: CardSlide[];
  caption: string;
  onSlidesChange: (slides: CardSlide[]) => void;
  onCaptionChange: (caption: string) => void;
}

const fieldClass =
  "w-full rounded-lg border p-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800";

export function CardNewsEditor({ slides, caption, onSlidesChange, onCaptionChange }: EditorProps) {
  const update = (index: number, patch: Partial<CardSlide>) =>
    onSlidesChange(slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="instagram-caption" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          인스타 캡션
        </label>
        <textarea
          id="instagram-caption"
          value={caption}
          onChange={(event) => onCaptionChange(event.target.value)}
          maxLength={2200}
          className={`${fieldClass} h-32 resize-y`}
        />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-[10px] font-bold uppercase tracking-wider text-slate-400">카드 문구 ({slides.length}장)</legend>
        {slides.map((slide, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
            <Input
              value={slide.headline}
              onChange={(event) => update(i, { headline: event.target.value })}
              aria-label={`카드 ${i + 1} 제목`}
              placeholder={`카드 ${i + 1} 제목`}
              aria-invalid={!slide.headline.trim()}
            />
            {(slide.body !== undefined || !slide.items) && (
              <textarea
                value={slide.body ?? ""}
                onChange={(event) => update(i, { body: event.target.value || undefined })}
                aria-label={`카드 ${i + 1} 본문`}
                placeholder="본문 (선택)"
                className={`${fieldClass} h-16 resize-y`}
              />
            )}
            {slide.items && (
              <textarea
                value={slide.items.join("\n")}
                onChange={(event) => update(i, { items: event.target.value.split("\n") })}
                aria-label={`카드 ${i + 1} 목록 (한 줄에 하나)`}
                placeholder="목록 (한 줄에 하나)"
                className={`${fieldClass} h-20 resize-y`}
              />
            )}
          </div>
        ))}
      </fieldset>
    </div>
  );
}
