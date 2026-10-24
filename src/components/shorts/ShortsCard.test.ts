import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShortsCard } from "@/components/shorts/ShortsCard";
import type { ShortsFeedItem } from "@/lib/youtube/shorts-feed";

const base: ShortsFeedItem = {
  id: "1",
  videoId: "v",
  title: "t",
  channelTitle: "c",
  permalink: "p",
  thumbnailUrl: "",
  publishedAt: new Date(),
  views: 1000,
  likes: null,
  comments: null,
  velocity: 10,
  velocityWindowHours: 1,
  country: "KR",
  outlierRatio: null,
  channelMedianViews: null,
  baselineSampleSize: 0,
};
const html = (item: ShortsFeedItem) => renderToStaticMarkup(React.createElement(ShortsCard, { item }));

describe("ShortsCard outlier badge", () => {
  it("shows an orange badge at 2x or more with the baseline tooltip", () => {
    const out = html({ ...base, outlierRatio: 3.2, channelMedianViews: 10000, baselineSampleSize: 12 });
    expect(out).toMatch(/<span[^>]*text-orange-700[^>]*>평소의 3\.2배<\/span>/);
    expect(out).toContain('title="채널 최근 쇼츠 12개 중앙값 1만회 기준"');
  });

  it("uses a neutral badge under 2x", () => {
    const out = html({ ...base, outlierRatio: 1.5, channelMedianViews: 10000, baselineSampleSize: 12 });
    expect(out).toMatch(/<span[^>]*bg-slate-100[^>]*>평소의 1\.5배<\/span>/);
    expect(out).not.toMatch(/<span[^>]*orange[^>]*>평소의/);
  });

  it("says no baseline instead of showing 0x", () => {
    const out = html(base);
    expect(out).toContain("평소 기준 없음");
    expect(out).not.toContain("0.0배");
  });
});
