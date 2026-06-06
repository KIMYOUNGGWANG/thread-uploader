import { describe, expect, it } from "vitest";
import { checkQuality } from "@/lib/quality-gate";

describe("checkQuality", () => {
  it("preserves saju viral pass and fail behavior", () => {
    const passing = checkQuality("혹시 도화살 있는 사람?\nA. 화개살 B. 도화살 C. 역마살 중 가까운 쪽 체크해봐", "saju_viral");
    const failing = checkQuality("좋은 일이 올 거예요. 스스로를 믿으세요.", "saju_viral");

    expect(passing.pass).toBe(true);
    expect(failing.pass).toBe(false);
  });

  it("preserves career decision pass and fail behavior", () => {
    const passing = checkQuality("퇴사해야 할지 버틸지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해. 저장해두고 다음 선택 전에 다시 봐.", "career_decision");
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

  it("fails reply-burden CTA for career decision content", () => {
    const result = checkQuality(
      "퇴사해야 할지 버틸지 모르겠다면\n댓글에 사연 남기면 내가 답글로 봐줄게. 버팀형/이동형/준비형으로 진단해줄게.",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("reply-burden");
  });

  it("fails situation-review CTA for career decision content", () => {
    const result = checkQuality(
      "이직할지 버틸지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 골라봐. 댓글에 A/B/C 아니면 지금 상황 짧게 써줘. 같이 보자.",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("reply-burden");
  });

  it("fails overclaiming fortune promises", () => {
    const result = checkQuality(
      "지금 연락하면 상대 마음 100% 알려준다\n댓글에 생일 남기면 미래를 보장해줄게.",
      "saju_viral"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("overclaim");
  });

  it("fails low-touch comment self-classification CTA for career decision content", () => {
    const result = checkQuality(
      "이직을 밀어붙일지 멈출지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 댓글에 남겨. 저장해두고 다음 선택 전에 다시 봐.",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("reply-burden");
  });

  it("passes self-check classification without comment burden", () => {
    const result = checkQuality(
      "이직을 밀어붙일지 멈출지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해. 저장해두고 다음 선택 전에 다시 봐.",
      "career_decision"
    );

    expect(result.pass).toBe(true);
    expect(result.reasons).not.toContain("reply-burden");
  });

  it("fails generated meta text in career decision content", () => {
    const result = checkQuality(
      "이직할지 버틸지 모르겠다면\nA. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해.\n\n자수 체크: 공백·줄바꿈 포함 약 430자",
      "career_decision"
    );

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toContain("generated meta text");
  });

  it("passes saveable product mini-tool content", () => {
    const result = checkQuality(
      "견적서 보내기 전에 3가지만 체크해.\n1. 고객명 2. 금액 3. 마감일. InvoiceFlow는 이 반복을 줄여줘. 저장하고 랜딩에서 확인해봐.",
      "product_growth",
      {
        productName: "InvoiceFlow",
        productKeywords: ["견적서", "반복", "고객명"],
        ctaTerms: ["저장", "확인", "랜딩"],
      }
    );

    expect(result.pass).toBe(true);
  });
});
