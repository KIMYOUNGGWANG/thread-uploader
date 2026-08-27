import { describe, expect, it } from "vitest";
import { getPublishSafetyBlockReasons } from "./publish-safety-gate";

describe("getPublishSafetyBlockReasons", () => {
  it("blocks stale reply-burden content even when stored quality was previously true", () => {
    const reasons = getPublishSafetyBlockReasons({
      content: "이직할지 버틸지 모르겠다면 A/B/C 중 골라봐. 댓글에 지금 상황 짧게 써줘. 같이 보자.",
      firstComment: null,
    });

    expect(reasons).toContain("reply-burden CTA 포함");
  });

  it("blocks soft 같이 봐요 phrasing in the first comment", () => {
    const reasons = getPublishSafetyBlockReasons({
      content: "이직 제안을 받았다면 A. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해.",
      firstComment: "프로필에서 타이밍과 결정 패턴을 같이 봐요.",
    });

    expect(reasons).toContain("reply-burden CTA 포함");
  });

  it("blocks generated meta text before publishing", () => {
    const reasons = getPublishSafetyBlockReasons({
      content: "이직 타이밍 체크\nA. 버팀형 B. 이동형 C. 준비형\n\n자수 체크: 500자 이하 통과",
      firstComment: "프로필에서 확인하세요.",
    });

    expect(reasons).toContain("generated meta text 포함");
  });

  it("allows multi-part threads over 500 chars up to 2400 chars", () => {
    const longPost = "이직 고민과 퇴사 타이밍에 대한 상세한 인사이트입니다.\n\n".repeat(20); // ~700 chars
    expect(longPost.length).toBeGreaterThan(500);
    expect(longPost.length).toBeLessThanOrEqual(2400);

    const reasons = getPublishSafetyBlockReasons({
      content: longPost,
      firstComment: "프로필에서 확인하세요.",
    });

    expect(reasons).not.toContain(expect.stringMatching(/업로드 제한 초과/));
    expect(reasons).toHaveLength(0);
  });

  it("blocks extremely long posts exceeding 2400 chars", () => {
    const tooLongPost = "아주 긴 글입니다. ".repeat(250); // ~2500 chars
    expect(tooLongPost.length).toBeGreaterThan(2400);

    const reasons = getPublishSafetyBlockReasons({
      content: tooLongPost,
      firstComment: null,
    });

    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0]).toMatch(/5단 스레드 최대 허용.*초과/);
  });
});
