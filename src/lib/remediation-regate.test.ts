import { describe, expect, it } from "vitest";
import { reconcileRemediation } from "@/lib/remediation-regate";
import type { RemediationResult } from "@/lib/remediation-engine";
import type { QualityResult } from "@/lib/quality-gate";

const raw = "혹시 도화보다 센 홍염보다 센 게 뭔지 알아? 바로 화개야.\n\n스님도 파계시킴. 너는 어느 쪽이야?";
const rewritten = "완전히 다른 글이 되어버린 리라이트 결과.";

function remediation(overrides: Partial<RemediationResult>): RemediationResult {
  return {
    content: rewritten,
    firstComment: "리라이트된 첫 댓글",
    scoreResult: { totalScore: 92, actionableFixes: [] } as unknown as RemediationResult["scoreResult"],
    pass: true,
    method: "TARGETED_REWRITE",
    rewriteCount: 1,
    actionableFixes: [],
    ...overrides,
  };
}

const passing: QualityResult = { pass: true, score: 3, profile: "saju_viral", reasons: [] };
const failing: QualityResult = { pass: false, score: 1, profile: "saju_viral", reasons: ["사주 용어 없음"] };

describe("reconcileRemediation", () => {
  it("keeps the remediated draft when it still passes the quality gate", () => {
    const outcome = reconcileRemediation({
      rawContent: raw,
      rawFirstComment: "원래 첫 댓글",
      remediation: remediation({}),
      regate: () => passing,
      threshold: 80,
    });

    expect(outcome.content).toBe(rewritten);
    expect(outcome.firstComment).toBe("리라이트된 첫 댓글");
    expect(outcome.reverted).toBe(false);
    expect(outcome.extraReasons).toEqual([]);
  });

  it("reverts to the gate-passing original when the rewrite breaks the quality gate", () => {
    const outcome = reconcileRemediation({
      rawContent: raw,
      rawFirstComment: "원래 첫 댓글",
      remediation: remediation({}),
      regate: (content) => (content === rewritten ? failing : passing),
      threshold: 80,
    });

    expect(outcome.content).toBe(raw);
    expect(outcome.firstComment).toBe("원래 첫 댓글");
    expect(outcome.reverted).toBe(true);
    expect(outcome.extraReasons[0]).toContain("remediation_reverted");
    expect(outcome.extraReasons[0]).toContain("사주 용어 없음");
    // Score is recomputed from the original, not inherited from the discarded rewrite
    expect(outcome.remediation.content).toBe(raw);
    expect(outcome.remediation.scoreResult.totalScore).not.toBe(92);
    expect(outcome.remediation.pass).toBe(outcome.remediation.scoreResult.totalScore >= 80);
  });

  it("skips the re-gate when remediation left the content untouched", () => {
    let calls = 0;
    const outcome = reconcileRemediation({
      rawContent: raw,
      rawFirstComment: null,
      remediation: remediation({ content: raw, firstComment: null, method: "INITIAL_PASS", rewriteCount: 0 }),
      regate: () => { calls += 1; return failing; },
      threshold: 80,
    });

    expect(calls).toBe(0);
    expect(outcome.reverted).toBe(false);
  });
});
