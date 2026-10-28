import type { CommandPlan } from "@/lib/command-plan";
import { readJsonObjectResponse } from "@/lib/generate-client";

export type CommandPlanPreview = {
  readonly plan: CommandPlan;
  readonly brandSlug: string | null;
};

export type CommandApproveResult = {
  readonly count: number;
  readonly auditSummary: { total: number; passed: number; needsReview: number };
};

/** `{ text }` → plan only. The server writes nothing until `approveCommandPlan` is called. */
export async function requestCommandPlan(text: string): Promise<CommandPlanPreview> {
  const response = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await readJsonObjectResponse<{ plan?: unknown; brandSlug?: unknown }>(response, "계획 세우기 실패");
  if (!response.ok || !data.plan) throw new Error(data.error ?? "계획 세우기 실패");
  return { plan: data.plan as CommandPlan, brandSlug: typeof data.brandSlug === "string" ? data.brandSlug : null };
}

/** `{ plan, approved: true }` → hypothesis saved + drafts queued in NEEDS_REVIEW. */
export async function approveCommandPlan(plan: CommandPlan): Promise<CommandApproveResult> {
  const response = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, approved: true }),
  });
  const data = await readJsonObjectResponse<{ count?: number; auditSummary?: CommandApproveResult["auditSummary"] }>(response, "초안 생성 실패");
  if (!response.ok) throw new Error(data.error ?? "초안 생성 실패");
  return { count: data.count ?? 0, auditSummary: data.auditSummary ?? { total: 0, passed: 0, needsReview: 0 } };
}
