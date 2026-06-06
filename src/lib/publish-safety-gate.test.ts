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
});
