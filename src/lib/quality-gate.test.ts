import { describe, expect, it } from "vitest";
import { checkQuality } from "@/lib/quality-gate";

describe("checkQuality", () => {
  it("preserves saju viral pass and fail behavior", () => {
    const passing = checkQuality("혹시 도화살 있는 사람?\n댓글로 일주 남겨줘", "saju_viral");
    const failing = checkQuality("좋은 일이 올 거예요. 스스로를 믿으세요.", "saju_viral");

    expect(passing.pass).toBe(true);
    expect(failing.pass).toBe(false);
  });

  it("preserves career decision pass and fail behavior", () => {
    const passing = checkQuality("퇴사해야 할지 버틸지 모르겠다면\n댓글에 상황을 써줘. 버팀형/이동형/준비형으로 나눠볼게.", "career_decision");
    const failing = checkQuality("좋은 일이 올 거예요. 스스로를 믿으세요.", "career_decision");

    expect(passing.pass).toBe(true);
    expect(passing.careerDecisionType).toBe("stay");
    expect(failing.pass).toBe(false);
  });

  it("passes non-CosmicPath product content with product growth criteria", () => {
    const result = checkQuality(
      "견적서 보내는 데 아직도 30분씩 쓰고 있어?\nInvoiceFlow가 프리랜서 견적 템플릿을 정리해줘. 랜딩에서 확인해봐.",
      "product_growth",
      {
        productName: "InvoiceFlow",
        productKeywords: ["견적서", "프리랜서", "템플릿"],
        ctaTerms: ["확인", "랜딩"],
      }
    );

    expect(result.pass).toBe(true);
    expect(result.profile).toBe("product_growth");
  });

  it("rejects generic filler for product growth", () => {
    const result = checkQuality(
      "좋은 일이 올 거예요.\n스스로를 믿으면 언젠가 다 잘될 거예요.",
      "product_growth",
      {
        productName: "InvoiceFlow",
        productKeywords: ["견적서", "프리랜서"],
      }
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("generic");
  });
});
