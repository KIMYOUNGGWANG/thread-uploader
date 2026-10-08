import { summarizeFormulaConversions, type FormulaConversionInput } from "@/lib/formula-conversion-summary";

export function FormulaConversionTable({ posts }: { posts: FormulaConversionInput[] }) {
  const rows = summarizeFormulaConversions(posts);
  if (rows.length === 0) return null;

  return (
    <section aria-label="Formula별 클릭·전환" className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Formula별 클릭 · 전환</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th scope="col" className="py-1 pr-4 font-medium">Formula</th>
              <th scope="col" className="py-1 pr-4 font-medium text-right">발행</th>
              <th scope="col" className="py-1 pr-4 font-medium text-right">클릭</th>
              <th scope="col" className="py-1 pr-4 font-medium text-right">전환</th>
              <th scope="col" className="py-1 font-medium text-right">결제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.formulaId} className="border-t border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                <td className="py-1.5 pr-4 font-mono text-xs">{row.formulaId}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">{row.published}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">{row.clicks}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">{row.conversions}</td>
                <td className="py-1.5 text-right tabular-nums">{row.paid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
