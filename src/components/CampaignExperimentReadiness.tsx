export interface ExperimentReadinessData {
  status: "empty" | "incomplete" | "ready";
  totalPosts: number;
  immaturePosts: number;
  maturePosts: number;
  measuredMaturePosts: number;
  missingMetricsPosts: number;
  zeroViewMaturePosts: number;
}

export interface MatureComparisonData {
  totalPosts: number;
  maturePosts: number;
  measuredPosts: number;
  missingMetricsPosts: number;
  medianViews: number | null;
  replyRate: number;
  repostRate: number;
}

export interface ViralModeComparisonData extends MatureComparisonData {
  viralIntentModeId: string;
}

interface Props {
  readiness?: ExperimentReadinessData;
  linkExposureComparison?: {
    linked: MatureComparisonData;
    control: MatureComparisonData;
  } | null;
  viralModeComparisons?: ViralModeComparisonData[];
}

const MODE_LABELS: Record<string, string> = {
  imagination_dilemma: "3지선다 딜레마",
  concept_hierarchy: "개념 서열",
  identity_profile: "기질 프로파일",
  relationship_tension: "관계 텐션",
};

export function CampaignExperimentReadiness({
  readiness,
  linkExposureComparison,
  viralModeComparisons = [],
}: Props) {
  if (!readiness) return null;
  if (readiness.status === "empty") return <EmptyExperimentState />;

  return (
    <section className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
      <ReadinessHeader readiness={readiness} />
      {linkExposureComparison && <LinkComparison comparison={linkExposureComparison} />}
      {viralModeComparisons.length > 0 && <ModeComparison rows={viralModeComparisons} />}
    </section>
  );
}

function EmptyExperimentState() {
  return (
    <section className="rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">실험 데이터 없음</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">첫 배치를 발행하면 72시간 기준 비교가 시작됩니다.</p>
    </section>
  );
}

function ReadinessHeader({ readiness }: { readiness: ExperimentReadinessData }) {
  const isReady = readiness.status === "ready";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-white">72시간 실험 판독</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          성숙 표본 {readiness.measuredMaturePosts}/{readiness.totalPosts} · 대기 {readiness.immaturePosts} · 지표 누락 {readiness.missingMetricsPosts}
        </p>
      </div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${isReady ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
        {isReady ? "비교 준비 완료" : "표본 수집 중"}
      </span>
      {readiness.zeroViewMaturePosts > 0 && (
        <span className="text-xs text-slate-500 dark:text-slate-400">0뷰 {readiness.zeroViewMaturePosts}개</span>
      )}
    </div>
  );
}

function LinkComparison({ comparison }: { comparison: NonNullable<Props["linkExposureComparison"]> }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <ComparisonCard label="링크 노출" value={comparison.linked} />
      <ComparisonCard label="무링크 대조군" value={comparison.control} />
    </div>
  );
}

function ComparisonCard({ label, value }: { label: string; value: MatureComparisonData }) {
  return (
    <div className="rounded-lg border border-white/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{formatMedian(value.medianViews)}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">중앙 조회수 · 표본 {value.measuredPosts}/{value.maturePosts}</p>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">댓글률 {value.replyRate}% · 리포스트율 {value.repostRate}%</p>
    </div>
  );
}

function ModeComparison({ rows }: { rows: ViralModeComparisonData[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="text-slate-500 dark:text-slate-400"><tr><th className="pb-2 pr-4">콘텐츠 구조</th><th className="pb-2 pr-4">성숙 표본</th><th className="pb-2">중앙 조회수</th></tr></thead>
        <tbody className="divide-y divide-cyan-100 dark:divide-cyan-900/50">
          {rows.map((row) => (
            <tr key={row.viralIntentModeId}>
              <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-200">{MODE_LABELS[row.viralIntentModeId] ?? row.viralIntentModeId}</td>
              <td className="py-2 pr-4 tabular-nums text-slate-500 dark:text-slate-400">{row.measuredPosts}/{row.maturePosts}</td>
              <td className="py-2 tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatMedian(row.medianViews)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMedian(value: number | null): string {
  return value === null ? "표본 없음" : value.toLocaleString("ko-KR");
}
