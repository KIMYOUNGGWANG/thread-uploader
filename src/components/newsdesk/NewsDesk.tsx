"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NewsMedia } from "@/lib/newsdesk/approval";
import type { ChannelStatus } from "@/lib/newsdesk/service";
import { InputPanel } from "./InputPanel";
import { ItemPanel } from "./ItemPanel";
import { callJson, FOCUS, formatKst, IN_FLIGHT, PANEL, PLATFORM_LABEL, type DeskItem } from "./shared";
import type { NewsPlatform } from "@/lib/newsdesk/verify";

export interface RecentItem {
  id: string;
  title: string;
  createdAt: string;
  sent: string[];
}

interface NewsDeskProps {
  brand: { id: string; slug: string; name: string };
  recent: RecentItem[];
  initialItem: DeskItem | null;
  channels: Record<"telegram" | "threads", ChannelStatus>;
}

const TICK_MS = 5000;
const TICK_LIMIT = 24; // two minutes; the distribute cron carries on after that

interface PublishResponse {
  item: DeskItem;
  outcomes?: { platform: NewsPlatform; ok: boolean; error?: string }[];
  errors?: string[];
}

export function NewsDesk({ brand, recent: initialRecent, initialItem, channels }: NewsDeskProps) {
  const router = useRouter();
  const [item, setItem] = useState<DeskItem | null>(initialItem);
  const [recent, setRecent] = useState(initialRecent);
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const ticks = useRef(0);

  const show = useCallback((next: DeskItem) => {
    setItem(next);
    setRecent((list) => {
      const sent = next.variants.filter((v) => v.locked).map((v) => v.platform);
      const entry = { id: next.id, title: next.sourceTitle ?? next.sourceText.slice(0, 60), createdAt: next.createdAt, sent };
      return list.some((r) => r.id === next.id) ? list.map((r) => (r.id === next.id ? entry : r)) : [entry, ...list].slice(0, 20);
    });
  }, []);

  async function open(id: string) {
    setLoadingId(id);
    setNotice(null);
    try {
      const { item: next } = await callJson<{ item: DeskItem }>(`/api/newsdesk/${id}`, { method: "GET" });
      show(next);
      ticks.current = 0;
      router.replace(`/brands/${brand.slug}/newsdesk?item=${id}`, { scroll: false });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "불러오지 못했어" });
    } finally {
      setLoadingId(null);
    }
  }

  async function act(action: string, body: Record<string, unknown> = {}): Promise<boolean> {
    if (!item) return false;
    setBusy(true);
    setNotice(null);
    try {
      const result = await callJson<PublishResponse>(`/api/newsdesk/${item.id}`, { method: "POST", body: { action, ...body } });
      show(result.item);
      ticks.current = 0;
      const failed = [...(result.outcomes ?? []).filter((o) => !o.ok).map((o) => `${PLATFORM_LABEL[o.platform]}: ${o.error}`), ...(result.errors ?? [])];
      if (failed.length > 0) setNotice({ tone: "error", text: failed.join(" / ") });
      else if (action === "publish") setNotice({ tone: "ok", text: "발행을 시작했어. 채널별 상태가 아래 탭에 떠." });
      return true;
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "처리하지 못했어" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setMedia(media: NewsMedia[]): Promise<boolean> {
    if (!item) return false;
    setBusy(true);
    setNotice(null);
    try {
      const { item: next } = await callJson<{ item: DeskItem }>(`/api/newsdesk/${item.id}`, { method: "PATCH", body: { media } });
      show(next);
      return true;
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "이미지를 바꾸지 못했어" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  // While an upload is queued or running, advance just this item's uploads every few seconds.
  const inFlight = item?.variants.some((v) => v.upload && IN_FLIGHT.has(v.upload.status)) ?? false;
  useEffect(() => {
    if (!item || !inFlight || busy || ticks.current >= TICK_LIMIT) return;
    const timer = window.setTimeout(async () => {
      ticks.current += 1;
      try {
        const { item: next } = await callJson<{ item: DeskItem }>(`/api/newsdesk/${item.id}`, { method: "POST", body: { action: "tick" } });
        show(next);
      } catch {
        // a failed tick is retried on the next one; the cron is the backstop
      }
    }, TICK_MS);
    return () => window.clearTimeout(timer);
  }, [item, inFlight, busy, show]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-lg font-bold">{brand.name} · 뉴스 데스크</h1>
          <Link href={`/brands/${brand.slug}`} className={`rounded-md text-base text-slate-600 hover:underline ${FOCUS}`}>← 대시보드로</Link>
        </div>
      </header>

      {/* 1120 = 380 + 16 + 724 inside max-w-6xl (1152) minus 2 × 16 padding */}
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <InputPanel brandId={brand.id} onCreated={(next) => { show(next); ticks.current = 0; router.replace(`/brands/${brand.slug}/newsdesk?item=${next.id}`, { scroll: false }); }} onOpenEarlier={(id) => void open(id)} />

          <section aria-labelledby="desk-recent" className={`${PANEL} p-5`}>
            <h2 id="desk-recent" className="text-base font-semibold text-slate-900">최근 기사 <span className="font-normal text-slate-600">{recent.length}개</span></h2>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">아직 만든 기사가 없어. 위에서 첫 기사를 넣어줘.</p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {recent.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => void open(r.id)} aria-current={item?.id === r.id ? "true" : undefined}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left ${item?.id === r.id ? "bg-slate-100" : "hover:bg-slate-50"} ${FOCUS}`}>
                      <span className="line-clamp-1 text-base text-slate-900">{loadingId === r.id ? "불러오는 중…" : r.title}</span>
                      <span className="text-sm text-slate-600">
                        {formatKst(r.createdAt)} · {r.sent.length > 0 ? `${r.sent.map((p) => PLATFORM_LABEL[p as NewsPlatform] ?? p).join("·")} 보냄` : "아직 안 보냄"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {item ? (
          <ItemPanel key={item.id} item={item} brandName={brand.name} brandSlug={brand.slug} busy={busy} notice={notice} act={act} setMedia={setMedia} />
        ) : (
          <section aria-labelledby="desk-empty" className={`${PANEL} flex flex-col gap-4 p-5`}>
            <h2 id="desk-empty" className="text-xl font-bold text-slate-900">채널별 원고</h2>
            <p className="text-base text-slate-800">왼쪽에 기사를 넣고 &quot;원고 만들기&quot;를 누르면 여기에 팩트와 채널별 원고가 생겨.</p>
            <ul className="flex flex-col gap-2 text-base text-slate-800">
              <li><span className="font-semibold">텔레그램</span> — {channels.telegram.connected ? `${channels.telegram.handle ?? "채널"}에 바로 발행` : channels.telegram.reason}</li>
              <li><span className="font-semibold">Threads</span> — {channels.threads.connected ? "브랜드 계정에 바로 발행" : channels.threads.reason}</li>
              <li><span className="font-semibold">카카오톡</span> — 단톡방 자동 전송은 카카오가 막아둬서, 승인한 원고를 복사해 직접 붙여넣어</li>
            </ul>
            {notice && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-base text-rose-800">{notice.text}</p>}
          </section>
        )}
      </main>
    </div>
  );
}
