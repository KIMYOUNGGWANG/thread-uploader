import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { buildMorningReport } from "@/lib/distribution/morning-report";
import { MorningReportView } from "@/components/report/MorningReportView";

export const dynamic = "force-dynamic";

/** First screen: what went up since yesterday, what goes up today (with cancel), and what needs me. */
export default async function Home() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const report = await buildMorningReport(userId);
  return <MorningReportView report={report} />;
}
