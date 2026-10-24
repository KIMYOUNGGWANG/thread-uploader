import { formatDistanceToNowStrict } from "date-fns";
import { ko } from "date-fns/locale";
import { OUTLIER_HIGHLIGHT_RATIO, type ShortsFeedItem } from "@/lib/youtube/shorts-feed";

const compact = new Intl.NumberFormat("ko", { notation: "compact" });

const BADGE = "rounded-full px-2 py-0.5 text-sm font-semibold";
const BADGE_HOT = "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300";
const BADGE_NEUTRAL = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

function OutlierBadge({ item }: { item: ShortsFeedItem }) {
  if (item.outlierRatio === null) return <span className={`${BADGE} ${BADGE_NEUTRAL}`}>평소 기준 없음</span>;
  const shown = Math.round(item.outlierRatio * 10) / 10; // compare what is displayed, so 1.96 -> "2.0배" is not grey
  const hot = shown >= OUTLIER_HIGHLIGHT_RATIO;
  const title =
    item.channelMedianViews === null
      ? undefined
      : `채널 최근 쇼츠 ${item.baselineSampleSize}개 중앙값 ${compact.format(item.channelMedianViews)}회 기준`;
  return (
    <span className={`${BADGE} ${hot ? BADGE_HOT : BADGE_NEUTRAL}`} title={title}>
      평소의 {shown.toFixed(1)}배
    </span>
  );
}

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
        <OutlierBadge item={item} />
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
