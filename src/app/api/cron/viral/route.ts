import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverViralExamples, learnViralPatterns } from "@/lib/viral-service";
import { verifyCronSecret } from "@/lib/cron-auth";
import { analyzeTopViralExamples } from "@/lib/viral-llm-analysis";
import { sendSystemAlert } from "@/lib/alert-service";
import { refillReferenceReplay, type ReferenceRefillResult } from "@/lib/reference-replay-refill";
import { parseBrandConfig } from "@/types/brand";

export const maxDuration = 300; // discovery + Claude analysis + ref_replay 생성 1개 per brand

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4시간 주기 중 분석은 09:41·21:41 두 번만(viral.yml). ref_replay는 분석 결과를 안 쓰므로 매 실행 시도한다.
  const analyze = request.nextUrl.searchParams.get("analyze") !== "false";
  // Full rows: refillReferenceReplay takes a whole Brand.
  const brands = await prisma.brand.findMany();
  const results = [];
  const externalSourcesFailed: string[] = [];

  for (const brand of brands) {
    // No keywords = nothing to search; skip so brands without a radar setup don't burn quota or raise false alarms.
    if (parseBrandConfig(brand.brandConfig).viralDiscovery.keywords.length === 0) {
      results.push({ slug: brand.slug, skipped: "no_keywords" });
      continue;
    }
    try {
      const discovery = await discoverViralExamples(brand.id, { includeOwnPosts: true, limit: 10 });
      // Claude analysis is an enrichment: a failure must not block pattern learning.
      const llmAnalysis = analyze
        ? await analyzeTopViralExamples(brand.id).catch((error: unknown) => ({
            analyzed: 0,
            error: error instanceof Error ? error.message : "Claude analysis failed",
          }))
        : { analyzed: 0, skipped: "analyze=false" };
      const learning = await learnViralPatterns(brand.id);
      // One outside-structure draft per day (gates live inside); a failure must not turn the brand red.
      const referenceReplay: ReferenceRefillResult = await refillReferenceReplay(brand, new Date()).catch((error: unknown) => ({
        generated: 0 as const,
        skipped: "dropped" as const,
        reason: error instanceof Error ? error.message : "Reference replay failed",
      }));
      if (discovery.externalAllFailed) {
        externalSourcesFailed.push(brand.slug);
        await sendSystemAlert({
          level: "error",
          title: "Viral discovery failed",
          message: discovery.errors.map((error) => error.message).join(", "),
          brandName: brand.name,
        });
      }
      // Only-own-posts means the app lacks threads_keyword_search (Meta app review). Warn on the two analysis runs a day, not all six.
      if (discovery.keywordOnlyOwnPosts && analyze) {
        await sendSystemAlert({
          level: "warning",
          title: "Keyword search returned only own posts",
          message: "threads_keyword_search 권한이 없어 본인 글만 검색됩니다. Meta 앱 심사 전까지 ref_replay 원본이 생기지 않습니다.",
          brandName: brand.name,
        });
      }
      results.push({
        slug: brand.slug,
        success: true,
        saved: discovery.saved,
        learnedPatterns: learning.learnedPatterns,
        llmAnalysis,
        referenceReplay,
        keywordOnlyOwnPosts: discovery.keywordOnlyOwnPosts,
        errors: discovery.errors,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      // A throw collects nothing either, so it alerts and turns the run red like an all-sources failure.
      externalSourcesFailed.push(brand.slug);
      await sendSystemAlert({ level: "error", title: "Viral discovery failed", message, brandName: brand.name });
      results.push({ slug: brand.slug, success: false, error: message });
    }
  }

  // Own-post learning still ran above, but a run where every keyword/profile source failed has
  // collected no outside references, so surface it as a failure instead of a silent green run.
  if (externalSourcesFailed.length > 0) {
    return NextResponse.json({ success: false, externalSourcesFailed, brands: results }, { status: 500 });
  }
  return NextResponse.json({ success: true, brands: results });
}
