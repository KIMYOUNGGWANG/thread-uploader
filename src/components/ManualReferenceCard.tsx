"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, Quote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManualReferenceResult } from "@/lib/manual-reference";

type Kind = "story" | "info";
type Field = "content" | "kind" | "linkUrl" | "sourceUrl";
type FieldErrors = Partial<Record<Field, string>>;

// Mirrors src/lib/manual-reference.ts (server re-validates everything).
const MIN_CONTENT_CHARS = 20;
const MAX_CONTENT_CHARS = 5000;
const X_STATUS_URL = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/(?:i\/web|[A-Za-z0-9_]{1,15})\/status\/\d+(?:[/?#].*)?$/i;

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "story", label: "사연형", hint: "감정 흐름" },
  { value: "info", label: "정보형", hint: "도구·자료 추천" },
];

const INPUT_CLASS =
  "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-base md:text-sm focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500";

function validate(content: string, kind: Kind, linkUrl: string, sourceUrl: string): FieldErrors {
  const errors: FieldErrors = {};
  if (content.replace(/\s/g, "").length < MIN_CONTENT_CHARS) errors.content = `원글 본문은 공백을 빼고 ${MIN_CONTENT_CHARS}자 이상이어야 해`;
  else if (content.length > MAX_CONTENT_CHARS) errors.content = `원글 본문은 ${MAX_CONTENT_CHARS.toLocaleString("en-US")}자 이하여야 해`;
  if (kind === "info" && linkUrl.trim() && !/^https?:\/\/\S+$/i.test(linkUrl.trim())) errors.linkUrl = "링크는 http:// 또는 https://로 시작해야 해";
  if (sourceUrl.trim() && !X_STATUS_URL.test(sourceUrl.trim())) errors.sourceUrl = "X 원글 주소는 x.com 또는 twitter.com의 /status/숫자 주소여야 해";
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickFieldErrors(value: unknown): FieldErrors {
  if (!isRecord(value)) return {};
  const out: FieldErrors = {};
  for (const field of ["content", "kind", "linkUrl", "sourceUrl"] as const) {
    const message = value[field];
    if (typeof message === "string") out[field] = message;
  }
  return out;
}

function isResult(value: unknown): value is ManualReferenceResult {
  if (!isRecord(value)) return false;
  if (value.status === "created") return typeof value.postId === "string";
  if (value.status === "dropped") return Array.isArray(value.reasons);
  return value.status === "duplicate";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

interface ManualReferenceCardProps {
  brandId: string;
  brandName: string;
  onCreated: () => Promise<void>;
}

export function ManualReferenceCard({ brandId, brandName, onCreated }: ManualReferenceCardProps) {
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<Kind>("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [droppedReasons, setDroppedReasons] = useState<string[] | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFeedback = () => {
    setFormError(null);
    setDroppedReasons(null);
    setIsDuplicate(false);
  };

  const editField = (field: Field, apply: () => void) => {
    apply();
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    clearFeedback();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    clearFeedback();

    const clientErrors = validate(content, kind, linkUrl, sourceUrl);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/viral/references/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          content,
          kind,
          ...(kind === "info" && linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
          ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
        }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const fieldErrors = isRecord(data) ? pickFieldErrors(data.errors) : {};
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
        } else {
          setFormError(isRecord(data) && typeof data.error === "string" ? data.error : "초안을 만들지 못했어. 잠시 뒤 다시 해줘");
        }
        return;
      }
      if (!isResult(data)) {
        setFormError("서버 응답 형식이 올바르지 않아");
        return;
      }

      if (data.status === "created") {
        setContent("");
        setLinkUrl("");
        setSourceUrl("");
        setErrors({});
        await onCreated();
      } else if (data.status === "dropped") {
        setDroppedReasons(data.reasons);
      } else {
        setIsDuplicate(true);
      }
    } catch {
      toast.error("네트워크 오류로 초안을 만들지 못했어. 입력은 그대로 뒀으니 다시 눌러줘");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="manual-reference-title"
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6"
    >
      <div className="mb-1 flex items-center gap-2">
        <Quote className="h-5 w-5 shrink-0 text-indigo-500" aria-hidden="true" />
        <h2 id="manual-reference-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
          X 인기글로 초안 만들기
        </h2>
      </div>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-200">{brandName}</span> 말투로 새로 써서 피드 탭 승인 대기열 맨 앞에 넣어. 보통 10~30초 걸려.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="mref-content" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            원글 본문
          </label>
          <textarea
            id="mref-content"
            value={content}
            onChange={(e) => editField("content", () => setContent(e.target.value))}
            disabled={isSubmitting}
            rows={5}
            placeholder="X 글을 그대로 복사해서 붙여넣어. 스레드(이어지는 글)면 전부 붙여넣어도 돼."
            aria-invalid={errors.content ? true : undefined}
            aria-describedby={errors.content ? "mref-content-error" : "mref-content-hint"}
            className={`block min-h-28 w-full resize-y rounded-md border bg-slate-50 px-3 py-2 text-base text-slate-800 shadow-xs outline-none transition-[color,box-shadow] placeholder:text-slate-400 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 md:text-sm ${
              errors.content
                ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/30 dark:border-red-500"
                : "border-slate-200 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/40 dark:border-slate-700"
            }`}
          />
          {errors.content ? (
            <FieldError id="mref-content-error" message={errors.content} />
          ) : (
            <p id="mref-content-hint" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              공백 빼고 {MIN_CONTENT_CHARS}자 이상 · {MAX_CONTENT_CHARS.toLocaleString("en-US")}자 이하
            </p>
          )}
        </div>

        <div>
          <span id="mref-kind-label" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            글 유형
          </span>
          <div role="radiogroup" aria-labelledby="mref-kind-label" className="flex flex-wrap gap-2">
            {KINDS.map((option) => {
              const checked = kind === option.value;
              return (
                <label
                  key={option.value}
                  className={`relative flex min-w-[8.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-indigo-500/40 ${
                    isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                  } ${
                    checked
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="mref-kind"
                    value={option.value}
                    checked={checked}
                    disabled={isSubmitting}
                    onChange={() => editField("kind", () => setKind(option.value))}
                    className="sr-only"
                  />
                  <span className="font-semibold">{option.label}</span>
                  <span className={`text-xs ${checked ? "text-indigo-100" : "text-slate-400"}`}>· {option.hint}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {kind === "info"
              ? "정보형: 목록 순서를 살리고, 링크를 쓰면 첫 댓글에 붙여."
              : "사연형: 상황과 감정선만 가져오고 디테일은 전부 바꿔."}
          </p>
          <FieldError id="mref-kind-error" message={errors.kind} />
        </div>

        {kind === "info" && (
          <div>
            <label htmlFor="mref-link" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              첫 댓글 링크 <span className="font-normal text-slate-400">(선택)</span>
            </label>
            <Input
              id="mref-link"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={linkUrl}
              onChange={(e) => editField("linkUrl", () => setLinkUrl(e.target.value))}
              disabled={isSubmitting}
              placeholder="https://uiverse.io"
              aria-invalid={errors.linkUrl ? true : undefined}
              aria-describedby={errors.linkUrl ? "mref-link-error" : undefined}
              className={INPUT_CLASS}
            />
            <FieldError id="mref-link-error" message={errors.linkUrl} />
          </div>
        )}

        <div>
          <label htmlFor="mref-source" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            X 원글 주소 <span className="font-normal text-slate-400">(선택 · 같은 글 중복 방지용)</span>
          </label>
          <Input
            id="mref-source"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={sourceUrl}
            onChange={(e) => editField("sourceUrl", () => setSourceUrl(e.target.value))}
            disabled={isSubmitting}
            placeholder="https://x.com/someone/status/1234567890"
            aria-invalid={errors.sourceUrl ? true : undefined}
            aria-describedby={errors.sourceUrl ? "mref-source-error" : undefined}
            className={INPUT_CLASS}
          />
          <FieldError id="mref-source-error" message={errors.sourceUrl} />
        </div>

        {droppedReasons && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              품질 검사에서 탈락했어. 입력은 그대로 뒀으니 다시 눌러봐.
            </p>
            {droppedReasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5">
                {droppedReasons.map((reason, index) => (
                  <li key={`${index}-${reason}`} className="break-words">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isDuplicate && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            이 X 글로 만든 초안이 이미 있어
          </div>
        )}

        {formError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {formError}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:ring-indigo-500/40"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              초안 만드는 중…
            </>
          ) : (
            "초안 만들기"
          )}
        </Button>
      </form>
    </section>
  );
}
