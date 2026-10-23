import { formatDistanceToNowStrict } from "date-fns";
import { ko } from "date-fns/locale";
import type { ShortsFeedItem } from "@/lib/youtube/shorts-feed";

const compact = new Intl.NumberFormat("ko", { notation: "compact" });

export function ShortsCard({ item }: { item: ShortsFeedItem }) {
  const hasStats = item.likes !== null || item.comments !== null;
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.thumbnailUrl}
        alt={item.title}
        loading="lazy"
        className="aspect-[9/16] w-full rounded-lg bg-slate-100 object-cover dark:bg-slate-800"
      />
      <h3 className="line-clamp-2 text-base font-medium text-slate-900 dark:text-slate-100">{item.title}</h3>
      <p className="truncate text-base text-slate-500 dark:text-slate-400">
        {item.channelTitle} · {formatDistanceToNowStrict(item.publishedAt, { locale: ko, unit: "hour", roundingMethod: "floor", addSuffix: false })} 전
      </p>
      <div className="flex flex-wrap items-center gap-2 text-base text-slate-900 dark:text-slate-100">
        <span>조회 {compact.format(item.views)}</span>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-sm font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
          +{compact.format(item.velocity)}/h ({item.velocityWindowHours}h 기준)
        </span>
      </div>
      {hasStats && (
        <p className="text-base text-slate-500 dark:text-slate-400">
          {item.likes !== null && <span>❤ {compact.format(item.likes)}</span>}
          {item.likes !== null && item.comments !== null && " · "}
          {item.comments !== null && <span>💬 {compact.format(item.comments)}</span>}
        </p>
      )}
      <a
        href={item.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md text-base font-medium text-violet-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-400"
      >
        유튜브에서 보기
      </a>
    </article>
  );
}
