"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { WeeklyScorecard, Bottleneck } from "@/lib/weekly-scorecard";

type ScorecardResponse = WeeklyScorecard & { brandId: string; queue: { review: number; pending: number } };

const BOTTLENECK_LABEL: Record<Bottleneck, string> = {
  sample: "표본 부족",
  reach: "도달 병목",
  conversion: "전환 병목",
  ops: "운영 적체",
  none: "정상",
};

const BOTTLENECK_CLASS: Record<Bottleneck, string> = {
  sample: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  reach: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  conversion: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  ops: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  none: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function formatNullable(value: number | null, suffix = ""): string {
  return value === null ? "–" : `${value.toLocaleString()}${suffix}`;
}

export function WeeklyScorecardPanel({ brandId }: { brandId: string }) {
  const [data, setData] = useState<ScorecardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/growth/scorecard?brandId=${brandId}&weeks=4`);
      const body = (await response.json()) as ScorecardResponse | { error?: string };
      if (!response.ok) throw new Error((body as { error?: string }).error ?? "스코어카드 불러오기 실패");
      setData(body as ScorecardResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "스코어카드 불러오기 실패");
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPublished = data?.weeks.reduce((total, week) => total + week.published, 0) ?? 0;

  return (
    <section aria-label="주간 스코어카드" className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">주간 스코어카드 (최근 4주)</h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !data && <p className="text-sm text-slate-500 dark:text-slate-400">불러오는 중…</p>}

      {data && totalPublished === 0 && !error && (
        <p className="text-sm text-slate-500 dark:text-slate-400">최근 4주에 발행된 글이 없어요. 발행이 시작되면 주차별 성과가 여기에 쌓여요.</p>
      )}

      {data && totalPublished > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
            <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BOTTLENECK_CLASS[data.bottleneck]}`}>
              {BOTTLENECK_LABEL[data.bottleneck]}
            </span>
            <p className="text-sm text-slate-700 dark:text-slate-200">{data.nextAction}</p>
            <span className="sm:ml-auto text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              리뷰 대기 {data.queue.review} · 발행 대기 {data.queue.pending}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th scope="col" className="py-1 pr-3 font-medium">주차</th>
                  <th scope="col" className="py-1 pr-3 font-medium text-right">발행</th>
                  <th scope="col" className="py-1 pr-3 font-medium text-right">측정</th>
                  <th scope="col" className="py-1 pr-3 font-medium text-right">중앙값 뷰</th>
                  <th scope="col" className="py-1 pr-3 font-medium text-right">1만뷰 돌파</th>
                  <th scope="col" className="py-1 pr-3 font-medium text-right">클릭/1천뷰</th>
                  <th scope="col" className="py-1 pr-3 font-medium text-right">전환</th>
                  <th scope="col" className="py-1 pr-3 font-medium text-right">유료</th>
                  <th scope="col" className="py-1 font-medium text-right">링크 vs 무링크</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((week) => (
                  <tr key={week.startsAt} className="border-t border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{week.label}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{week.published}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{week.measured}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatNullable(week.medianViews)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{week.breakoutCount} ({week.breakoutRate}%)</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatNullable(week.clicksPer1kViews)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{week.funnel.conversions}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{week.funnel.paid}</td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                      {formatNullable(week.linked.medianViews)} ({week.linked.posts}) / {formatNullable(week.unlinked.medianViews)} ({week.unlinked.posts})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.formulas.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">공식별 (측정 2개 이상, 중앙값 뷰 순)</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th scope="col" className="py-1 pr-3 font-medium">Formula</th>
                    <th scope="col" className="py-1 pr-3 font-medium text-right">글</th>
                    <th scope="col" className="py-1 pr-3 font-medium text-right">중앙값 뷰</th>
                    <th scope="col" className="py-1 pr-3 font-medium text-right">1만뷰 돌파율</th>
                    <th scope="col" className="py-1 pr-3 font-medium text-right">클릭</th>
                    <th scope="col" className="py-1 pr-3 font-medium text-right">전환</th>
                    <th scope="col" className="py-1 font-medium text-right">유료</th>
                  </tr>
                </thead>
                <tbody>
                  {data.formulas.map((row) => (
                    <tr key={row.formulaId} className="border-t border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      <td className="py-1.5 pr-3 font-mono text-xs">{row.formulaId}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.posts}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{formatNullable(row.medianViews)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.breakoutRate}%</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.clicks}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.conversions}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
