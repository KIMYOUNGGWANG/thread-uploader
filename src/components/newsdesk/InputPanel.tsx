"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { NewsMedia } from "@/lib/newsdesk/approval";
import { MediaSlots } from "./MediaSlots";
import { BUTTON_IDLE, BUTTON_PRIMARY, callJson, FIELD, formatKst, LABEL, PANEL, type DeskItem } from "./shared";

interface ScrapeResult {
  article: { url: string; title: string; text: string; imageUrl: string | null };
  earlier: { id: string; createdAt: string }[];
}

interface InputPanelProps {
  brandId: string;
  onCreated: (item: DeskItem) => void;
  onOpenEarlier: (id: string) => void;
}

/** Left column: the article in (URL or pasted text), the operator's note and images, then one call that drafts every channel. */
export function InputPanel({ brandId, onCreated, onOpenEarlier }: InputPanelProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [note, setNote] = useState("");
  const [media, setMedia] = useState<NewsMedia[]>([]);
  const [earlier, setEarlier] = useState<ScrapeResult["earlier"]>([]);
  const [fetching, setFetching] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown under the URL field, not at the foot of the form, so it is on screen where the button was pressed.
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function fetchArticle() {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const result = await callJson<ScrapeResult>("/api/newsdesk/scrape", { method: "POST", body: { brandId, url } });
      setUrl(result.article.url);
      setTitle(result.article.title);
      setText(result.article.text);
      setEarlier(result.earlier);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "기사를 가져오지 못했어");
    } finally {
      setFetching(false);
    }
  }

  async function compose() {
    setComposing(true);
    setError(null);
    try {
      const { item } = await callJson<{ item: DeskItem }>("/api/newsdesk", {
        method: "POST",
        body: { brandId, sourceUrl: url, sourceTitle: title, sourceText: text, rawMode, operatorNote: note, media },
      });
      onCreated(item);
      setUrl(""); setTitle(""); setText(""); setNote(""); setMedia([]); setEarlier([]); setRawMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "원고를 만들지 못했어");
    } finally {
      setComposing(false);
    }
  }

  const busy = fetching || composing;

  return (
    <section aria-labelledby="desk-input" className={`${PANEL} flex flex-col gap-5 p-5`}>
      <h2 id="desk-input" className="text-base font-semibold text-slate-900">새 기사</h2>

      <div className="flex flex-col gap-2">
        <label htmlFor="desk-url" className={LABEL}>기사 URL</label>
        <div className="flex gap-2">
          <input id="desk-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void fetchArticle(); } }}
            placeholder="https://zdnet.co.kr/view/?no=…" className={`${FIELD} min-w-0 flex-1`} />
          <button type="button" onClick={() => void fetchArticle()} disabled={busy || !url.trim()} className={`${BUTTON_IDLE} shrink-0`}>
            {fetching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}가져오기
          </button>
        </div>
        {fetchError && <p className="text-sm text-rose-700" role="alert">{fetchError}</p>}
        {earlier.length > 0 && (
          <p className="text-sm text-amber-800">
            이 기사로 이미 만든 원고가 있어:{" "}
            {earlier.map((e, i) => (
              <button key={e.id} type="button" onClick={() => onOpenEarlier(e.id)} className="font-semibold underline underline-offset-2">
                {formatKst(e.createdAt)}{i < earlier.length - 1 ? ", " : ""}
              </button>
            ))}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="desk-title" className={LABEL}>제목</label>
        <input id="desk-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={FIELD} placeholder="가져오면 채워져 (직접 써도 돼)" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="desk-text" className={LABEL}>기사 원문</label>
          <span className="text-sm tabular-nums text-slate-600">{text.length.toLocaleString("ko-KR")} / 20,000자</span>
        </div>
        <textarea id="desk-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} rows={8}
          placeholder="URL로 가져오거나, 못 읽는 사이트면 본문을 여기에 붙여넣어" className={`${FIELD} resize-y leading-relaxed`} />
        <label className="flex min-h-11 items-center gap-3 text-base text-slate-800">
          <input type="checkbox" checked={rawMode} onChange={(e) => setRawMode(e.target.checked)} className="h-5 w-5 accent-slate-900" />
          AI 가공 없이 원문 그대로 모든 채널에
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="desk-note" className={LABEL}>내 의견·강조할 점</label>
        <input id="desk-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} disabled={rawMode} className={FIELD}
          placeholder={rawMode ? "원문 그대로 모드에선 안 써" : "예: 실무 자동화에 꼭 봐야 할 기술"} />
      </div>

      <div className="flex flex-col gap-2">
        <span className={LABEL}>이미지 <span className="font-normal text-slate-600">(최대 5장, 순서대로 전송)</span></span>
        <MediaSlots brandId={brandId} media={media} onChange={setMedia} disabled={composing} />
      </div>

      {error && <p className="text-base text-rose-700" role="alert">{error}</p>}
      <button type="button" onClick={() => void compose()} disabled={busy || !text.trim()} className={BUTTON_PRIMARY}>
        {composing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {composing ? (rawMode ? "만드는 중…" : "팩트 뽑고 원고 쓰는 중… (최대 1분)") : "원고 만들기"}
      </button>
    </section>
  );
}
