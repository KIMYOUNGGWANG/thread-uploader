import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ko } from "date-fns/locale";
import { ShortsCard } from "@/components/shorts/ShortsCard";
import { ShortsFilters } from "@/components/shorts/ShortsFilters";
import type { ShortsFeedItem, ShortsRegion, ShortsSort, ShortsWindow } from "@/lib/youtube/shorts-feed";

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

interface ShortsFeedProps {
  items: ShortsFeedItem[];
  lastCapturedAt: Date | null;
  filters: { window: ShortsWindow; region: ShortsRegion; sort: ShortsSort };
  brandSlug: string;
  brandName: string;
  hasApiKey: boolean;
  adapterEnabled: boolean;
}

function EmptyState({ brandSlug, hasApiKey, adapterEnabled }: Pick<ShortsFeedProps, "brandSlug" | "hasApiKey" | "adapterEnabled">) {
  const linkClass = adapterEnabled
    ? `text-violet-600 hover:underline dark:text-violet-400 ${FOCUS}`
    : `inline-block rounded-md bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 ${FOCUS}`;
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-16 text-center text-base text-slate-600 dark:border-slate-700 dark:text-slate-400">
      <p>아직 수집된 쇼츠가 없어요. 설정 → 바이럴 소스에서 유튜브 어댑터를 켜고 키워드를 넣어주세요.</p>
      {!hasApiKey && <p>YOUTUBE_API_KEY가 설정되지 않았어요</p>}
      <Link href={`/brands/${brandSlug}/settings`} className={linkClass}>
        설정으로 가기
      </Link>
    </div>
  );
}

export function ShortsFeed({ items, lastCapturedAt, filters, brandSlug, brandName, hasApiKey, adapterEnabled }: ShortsFeedProps) {
  const updated = lastCapturedAt
    ? `마지막 갱신 ${formatDistanceToNowStrict(lastCapturedAt, { locale: ko, unit: "minute" })} 전`
    : "아직 갱신 전";
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-lg font-bold">{brandName} · 쇼츠 레이더</h1>
          <Link href={`/brands/${brandSlug}`} className={`rounded-md text-base text-slate-600 hover:underline dark:text-slate-300 ${FOCUS}`}>
            ← 대시보드로
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <ShortsFilters window={filters.window} region={filters.region} sort={filters.sort} />
        <p className="text-base text-slate-500 dark:text-slate-400">{updated}</p>
        {items.length === 0 ? (
          <EmptyState brandSlug={brandSlug} hasApiKey={hasApiKey} adapterEnabled={adapterEnabled} />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ShortsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
