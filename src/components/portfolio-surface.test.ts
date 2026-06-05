import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("portfolio product surface", () => {
  it("uses product portfolio language in shell pages", () => {
    const layout = readProjectFile("src/app/layout.tsx");
    const login = readProjectFile("src/app/login/page.tsx");
    const brands = readProjectFile("src/app/brands/page.tsx");

    expect(layout).toContain('title: "Portfolio Growth OS"');
    expect(login).toContain("내 제품 성장 워크스페이스");
    expect(brands).toContain("성장 실험을 운영할 제품을 선택하세요");
    expect(brands).toContain("첫 제품 만들기");
    expect(brands).toContain('placeholder="예: InvoiceFlow"');
    expect(brands).toContain('placeholder="invoiceflow"');
    expect(brands).toContain("자동 세팅 미리보기");
    expect(brands).toContain("세팅 준비도");
    expect(brands).toContain('placeholder="견적서 작성 시간을 줄이는 프리랜서 도구"');
  });

  it("keeps product settings placeholders generic", () => {
    const productSettings = readProjectFile("src/components/ProductSettingsTab.tsx");

    expect(productSettings).toContain('placeholder="InvoiceFlow"');
    expect(productSettings).toContain('placeholder="/invoice"');
    expect(productSettings).toContain("세팅 준비도");
    expect(productSettings).toContain("7일 캠페인 시작");
    expect(productSettings).not.toContain('placeholder="CosmicPath"');
    expect(productSettings).not.toContain("퇴사/이직 타이밍");
    expect(productSettings).not.toContain("/career/uncertainty");
  });

  it("keeps generic create and settings placeholders free of CosmicPath career examples", () => {
    const brands = readProjectFile("src/app/brands/page.tsx");
    const settingsForm = readProjectFile("src/components/BrandSettingsForm.tsx");
    const placeholderLines = `${brands}\n${settingsForm}`
      .split("\n")
      .filter((line) => line.includes("placeholder="));
    const placeholders = placeholderLines.join("\n");

    expect(placeholders).toContain('placeholder="예: InvoiceFlow"');
    expect(placeholders).toContain('placeholder="invoiceflow"');
    expect(placeholders).toContain('placeholder="예: invoiceflow.app"');
    expect(placeholders).toContain('placeholder="예: 견적서 자동화"');
    expect(placeholders).toContain('placeholder="예: 견적서를 급하게 보내야 할 때"');
    expect(placeholders).toContain('placeholder="예: 프리랜서 세금 시즌"');
    expect(placeholders).toContain('placeholder="예: invoiceflow_official"');
    expect(placeholders).not.toContain("CosmicPath");
    expect(placeholders).not.toContain("cosmicpath");
    expect(placeholders).not.toContain("/career/uncertainty");
    expect(placeholders).not.toContain("퇴사");
    expect(placeholders).not.toContain("이직");
    expect(placeholders).not.toContain("사주");
    expect(placeholders).not.toContain("화개살");
    expect(placeholders).not.toContain("수성 역행");
  });

  it("saves product profile and active experiment fields", () => {
    const settingsForm = readProjectFile("src/components/BrandSettingsForm.tsx");

    expect(settingsForm).toContain("productProfile,");
    expect(settingsForm).toContain("activeExperiment,");
    expect(settingsForm).toContain("이 제품의 현재 성장 실험에 사용할 캠페인과 품질 프로필입니다.");
  });

  it("renders dashboard overview source for product metrics", () => {
    const dashboard = readProjectFile("src/components/Dashboard.tsx");

    expect(dashboard).toContain("function PortfolioOverview");
    expect(dashboard).toContain("summary.activeExperiment.name");
    expect(dashboard).toContain("summary.primaryMetric");
    expect(dashboard).toContain("summary.conversionMetric");
  });
});
