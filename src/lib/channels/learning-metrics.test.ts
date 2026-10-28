import { describe, expect, it } from "vitest";
import { withThreadsMetrics } from "./learning-metrics";

const d = new Date("2026-01-02T00:00:00Z");
const older = new Date("2026-01-01T00:00:00Z");

type Pub = { views: number | null; likes: number | null; replies: number | null; reposts: number | null; metricsAt: Date | null };

const pub = (o: Partial<Pub> = {}): Pub => ({ views: null, likes: null, replies: null, reposts: null, metricsAt: null, ...o });
const p = (o: { views?: number | null; metricsAt?: Date | null; publications: Pub[] }) => ({
  id: "post-1",
  views: 10,
  likes: 1,
  replies: 2,
  reposts: 3,
  metricsAt: d,
  ...o,
});

describe("withThreadsMetrics", () => {
  it("uses the Threads publication metrics when present", () => {
    const out = withThreadsMetrics(p({ publications: [pub({ views: 99, likes: 9, replies: 8, reposts: 7, metricsAt: d })] }));
    expect([out.views, out.likes, out.replies, out.reposts]).toEqual([99, 9, 8, 7]);
  });
  it("falls back to post metrics when the mirror is missing", () => {
    expect(withThreadsMetrics(p({ views: 10, publications: [] })).views).toBe(10);
  });
  it("ignores a publication that has no metrics yet", () => {
    expect(withThreadsMetrics(p({ views: 10, publications: [pub({ views: null, metricsAt: null })] })).views).toBe(10);
  });
  it("keeps the post's metricsAt even when the publication has a different one", () => {
    expect(withThreadsMetrics(p({ metricsAt: d, publications: [pub({ views: 99, metricsAt: older })] })).metricsAt).toBe(d);
  });
  it("keeps other post fields untouched", () => {
    expect(withThreadsMetrics(p({ publications: [pub({ views: 99, metricsAt: d })] })).id).toBe("post-1");
  });
  it("drops the publications field", () => {
    expect("publications" in withThreadsMetrics(p({ publications: [] }))).toBe(false);
  });
  it("treats a missing publications field as empty", () => {
    const raw: unknown = { id: "post-1", views: 10, likes: null, replies: null, reposts: null };
    const out = withThreadsMetrics(raw as Parameters<typeof withThreadsMetrics>[0]);
    expect(out.views).toBe(10);
  });
});
