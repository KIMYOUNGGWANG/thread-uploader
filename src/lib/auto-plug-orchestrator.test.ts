import { describe, expect, it } from "vitest";
import {
  shouldTriggerAutoPlug,
  buildAutoPlugComment,
  planTwoStageThread,
} from "./auto-plug-orchestrator";

describe("auto-plug-orchestrator", () => {
  it("triggers auto-plug when reply velocity threshold is achieved", () => {
    const publishedAt = new Date("2026-09-09T10:00:00Z");
    const now = new Date("2026-09-09T10:20:00Z"); // 20 mins later

    // 4 replies, 40 views -> triggers immediately
    const res = shouldTriggerAutoPlug({
      views: 40,
      likes: 3,
      replies: 4,
      publishedAt,
      now,
    });

    expect(res.shouldPlug).toBe(true);
    expect(res.reason).toContain("댓글 수 기준 충족");
  });

  it("delays auto-plug if post is still in cold stage without minimum velocity", () => {
    const publishedAt = new Date("2026-09-09T10:00:00Z");
    const now = new Date("2026-09-09T10:15:00Z"); // 15 mins later

    const res = shouldTriggerAutoPlug({
      views: 12,
      likes: 1,
      replies: 0,
      publishedAt,
      now,
    });

    expect(res.shouldPlug).toBe(false);
    expect(res.reason).toContain("아직 임계치 미달");
  });

  it("triggers auto-plug after safe elapsed time with baseline reach", () => {
    const publishedAt = new Date("2026-09-09T10:00:00Z");
    const now = new Date("2026-09-09T10:50:00Z"); // 50 mins later

    const res = shouldTriggerAutoPlug({
      views: 65,
      likes: 4,
      replies: 1,
      publishedAt,
      now,
    });

    expect(res.shouldPlug).toBe(true);
    expect(res.reason).toContain("안전 대기 시간");
  });

  it("builds polite, value-driven auto-plug copy without spam words", () => {
    const comment = buildAutoPlugComment({ offerType: "framework" });
    expect(comment).toContain("프로필 링크(↓)");
    expect(comment).toContain("프레임워크");

    const custom = buildAutoPlugComment({ customMessage: "자세한 건 바이오 확인!" });
    expect(custom).toBe("자세한 건 바이오 확인!");
  });

  it("plans a clean two-stage thread stripping body links and preparing auto-plug", () => {
    const plan = planTwoStageThread({
      rootContent: "이것이 본문입니다 https://bad-link.com 읽어보세요.",
      conversationIgniter: "어느 쪽이 더 맞다고 보시나요?",
      conversionLink: "https://my-landing.com/r/abc",
      offerType: "guide",
    });

    expect(plan.stage1.content).not.toContain("https://bad-link.com");
    expect(plan.stage1.firstComment).toBe("어느 쪽이 더 맞다고 보시나요?");
    expect(plan.stage2.eligibleForAutoPlug).toBe(true);
    expect(plan.stage2.autoPlugComment).toContain("프로필 바이오(↓)");
  });
});
