import Link from "next/link";
import type { ShortsRegion, ShortsWindow } from "@/lib/youtube/shorts-feed";

const WINDOWS: Array<{ value: ShortsWindow; label: string }> = [
  { value: "24", label: "24시간" },
  { value: "48", label: "48시간" },
];
const REGIONS: Array<{ value: ShortsRegion; label: string }> = [
  { value: "kr", label: "국내" },
  { value: "global", label: "해외" },
  { value: "all", label: "전체" },
];

const CHIP =
  "rounded-full border px-3 py-1.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const ACTIVE = "border-violet-600 bg-violet-600 text-white";
const INACTIVE =
  "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

interface ShortsFiltersProps {
  window: ShortsWindow;
  region: ShortsRegion;
}

export function ShortsFilters({ window, region }: ShortsFiltersProps) {
  return (
    <nav aria-label="쇼츠 필터" className="flex flex-wrap gap-2">
      {WINDOWS.flatMap((w) =>
        REGIONS.map((r) => {
          const active = w.value === window && r.value === region;
          return (
            <Link
              key={`${w.value}-${r.value}`}
              href={`?window=${w.value}&region=${r.value}`}
              aria-current={active ? "page" : undefined}
              className={`${CHIP} ${active ? ACTIVE : INACTIVE}`}
            >
              {w.label} · {r.label}
            </Link>
          );
        })
      )}
    </nav>
  );
}
