import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/products/auto-setup/route";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/products/auto-setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/products/auto-setup", () => {
  it("returns a ready setup preview for complete product context", async () => {
    const response = await POST(jsonRequest({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "https://invoiceflow.app",
    }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(isRecord(body)).toBe(true);
    if (!isRecord(body)) return;
    expect(isRecord(body.readiness)).toBe(true);
    expect(isRecord(body.config)).toBe(true);
    if (!isRecord(body.readiness) || !isRecord(body.config)) return;
    expect(body.readiness.status).toBe("ready");
    expect(body.readiness.canStartCampaign).toBe(true);
    expect(body.config.qualityProfile).toBe("product_growth");
  });

  it("returns readiness gaps when product context is not enough", async () => {
    const response = await POST(jsonRequest({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
    }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(isRecord(body)).toBe(true);
    if (!isRecord(body)) return;
    expect(isRecord(body.readiness)).toBe(true);
    if (!isRecord(body.readiness)) return;
    expect(body.readiness.status).toBe("needs_input");
    expect(body.readiness.canStartCampaign).toBe(false);
    expect(Array.isArray(body.readiness.gaps)).toBe(true);
  });

  it("keeps malformed landing URLs out of the ready state", async () => {
    const response = await POST(jsonRequest({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "not-a-url",
    }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(isRecord(body)).toBe(true);
    if (!isRecord(body)) return;
    expect(isRecord(body.readiness)).toBe(true);
    if (!isRecord(body.readiness)) return;
    expect(body.readiness.status).toBe("needs_input");
    expect(body.readiness.canStartCampaign).toBe(false);
  });

  it("rejects protocol-relative landing URLs", async () => {
    const response = await POST(jsonRequest({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "//invoiceflow.app",
    }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(isRecord(body)).toBe(true);
    if (!isRecord(body)) return;
    expect(isRecord(body.readiness)).toBe(true);
    if (!isRecord(body.readiness)) return;
    expect(body.readiness.status).toBe("needs_input");
    expect(body.readiness.canStartCampaign).toBe(false);
  });
});
