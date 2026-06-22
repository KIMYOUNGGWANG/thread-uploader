import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DemoAssetGeneratorPanel from "@/components/DemoAssetGeneratorPanel";

// Mock fetch globally
vi.stubGlobal("fetch", vi.fn());

describe("DemoAssetGeneratorPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it("renders the URL input and form labels", () => {
    const markup = renderToStaticMarkup(React.createElement(DemoAssetGeneratorPanel, {
      brandId: "brand_123",
    }));

    expect(markup).toContain("URL 기반 제품 데모 에셋 생성기");
    expect(markup).toContain("제품 URL (Product Landing Page)");
    expect(markup).toContain("렌더링 비주얼 스타일 선택");
    expect(markup).toContain("Minimalist Premium Dark");
    expect(markup).toContain("Interactive Split-Screen");
    expect(markup).toContain("Bento Grid Showcase");
    expect(markup).toContain("Kinetic Typography");
    expect(markup).toContain("동영상 생성 수 (1-5개)");
    expect(markup).toContain("이미지 생성 수 (1-12개)");
  });
});
