import type { RemediationResult } from "@/lib/remediation-engine";
import type { QualityResult } from "@/lib/quality-gate";
import { scoreThreadsPostAlgorithmic } from "@/lib/threads-algorithm-scorer";

export interface ReconcileRemediationInput {
  rawContent: string;
  rawFirstComment: string | null;
  remediation: RemediationResult;
  // May be async: English drafts also run the LLM naturalness judge on the rewrite.
  regate: (content: string, firstComment: string) => QualityResult | Promise<QualityResult>;
  threshold: number;
}

export interface ReconcileRemediationOutcome {
  content: string;
  firstComment: string | null;
  remediation: RemediationResult;
  reverted: boolean;
  extraReasons: string[];
}

// A rewrite that scores higher on the algorithm heuristics can still break the content gate
// (drop saju terms, lose the 3 choices). The original already passed, so fall back to it.
export async function reconcileRemediation(input: ReconcileRemediationInput): Promise<ReconcileRemediationOutcome> {
  const { rawContent, rawFirstComment, remediation, regate, threshold } = input;
  const unchanged = remediation.content === rawContent && (remediation.firstComment ?? null) === rawFirstComment;
  if (unchanged) {
    return { content: rawContent, firstComment: rawFirstComment, remediation, reverted: false, extraReasons: [] };
  }

  const gate = await regate(remediation.content, remediation.firstComment ?? "");
  if (gate.pass) {
    return { content: remediation.content, firstComment: remediation.firstComment, remediation, reverted: false, extraReasons: [] };
  }

  const scoreResult = scoreThreadsPostAlgorithmic(rawContent, rawFirstComment);
  return {
    content: rawContent,
    firstComment: rawFirstComment,
    remediation: {
      ...remediation,
      content: rawContent,
      firstComment: rawFirstComment,
      scoreResult,
      pass: scoreResult.totalScore >= threshold,
      actionableFixes: scoreResult.actionableFixes,
    },
    reverted: true,
    extraReasons: [`remediation_reverted: ${gate.reasons.join(", ")}`],
  };
}
