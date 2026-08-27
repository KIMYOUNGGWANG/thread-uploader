export interface TrendItem {
  readonly id: string;
  readonly platform: "reddit" | "hackernews" | "x_twitter" | "youtube";
  readonly title: string;
  readonly content: string;
  readonly author: string;
  readonly url: string;
  readonly engagementScore: number;
  readonly publishedAt: string;
}

export async function fetchLast30DaysTrends(
  keywords: readonly string[],
  limit = 5
): Promise<readonly TrendItem[]> {
  if (!keywords.length) {
    keywords = ["SaaS", "Growth Marketing", "AI Agents", "Startup"];
  }

  // Simulated structured trend fetcher representing last30daysfire multi-channel scraper
  const trends: TrendItem[] = [];
  const now = new Date();

  for (let i = 0; i < limit; i++) {
    const keyword = keywords[i % keywords.length];
    const platform = (["reddit", "hackernews", "x_twitter", "youtube"] as const)[i % 4];
    const daysAgo = Math.floor(Math.random() * 25) + 1;
    const pubDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    trends.push({
      id: `trend-${platform}-${i}-${Date.now()}`,
      platform,
      title: `${keyword} 30-day viral phenomenon: How founders are scaling in 2026`,
      content: `Hot discussion on ${keyword}: Why traditional CAC is dead and why organic viral content + card news is outperforming paid ads by 4x.`,
      author: `${platform}_creator_${i + 1}`,
      url: `https://${platform === "x_twitter" ? "x.com" : platform + ".com"}/trending/${i + 1}`,
      engagementScore: 85 + i * 2,
      publishedAt: pubDate,
    });
  }

  return trends;
}

export function formatTrendSummaryForPrompt(trends: readonly TrendItem[]): string {
  if (!trends.length) return "";
  return [
    "[최근 30일 외부 트렌드 인사이트 (last30daysfire)]",
    ...trends.map(
      (t) => `- [${t.platform.toUpperCase()}] ${t.title} (반응도: ${t.engagementScore}점) -> ${t.content}`
    ),
  ].join("\n");
}
