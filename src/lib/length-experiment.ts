import { prisma } from "@/lib/prisma";
import { MAX_REFILL_PER_RUN } from "@/lib/queue-refill";
import { THREADS_CONTENT_MAX_LENGTH } from "@/lib/threads-limits";
import type { BrandConfig } from "@/types/brand";
import type { LengthArm, LengthExperimentConfig } from "@/types/length-experiment";

// One definition of "experiment post" for publish, generation, refill and
// scripts/analyze-post-response.mjs (which mirrors it): spec docs/superpowers/specs/2026-10-16-length-experiment-design.md.

export interface ExperimentPostShape {
  content: string;
  postCategory: string;
  formulaId: string | null;
  createdAt: Date;
}

export function classifyLength(content: string, config: LengthExperimentConfig): LengthArm | "MID" {
  if (content.length <= config.shortMax) return "S";
  if (content.length >= config.longMin) return "L";
  return "MID";
}

/** GROWTH posts outside the promo video rotation; card carousels count, since every generated KR post has them. */
export function isExperimentPost(post: Pick<ExperimentPostShape, "postCategory" | "formulaId">): boolean {
  return post.postCategory === "GROWTH" && !(post.formulaId ?? "").startsWith("video:");
}

/** Drafts made before startAt were written without the arm's length target, so they sit the experiment out. */
export function isExperimentDraft(post: ExperimentPostShape, config: LengthExperimentConfig): boolean {
  return isExperimentPost(post) && post.createdAt.getTime() >= Date.parse(config.startAt);
}

export function sequencePosition(published: ExperimentPostShape[], config: LengthExperimentConfig): number {
  return published.filter((post) => isExperimentDraft(post, config) && classifyLength(post.content, config) !== "MID").length;
}

export function currentArm(config: LengthExperimentConfig, position: number, now: Date): LengthArm | null {
  if (now.getTime() < Date.parse(config.startAt) || position >= config.sequence.length) return null;
  return config.sequence[position] === "L" ? "L" : "S";
}

/** First post (input in publish order) that is either outside the experiment or an experiment draft of this slot's arm. */
export function pickPublishCandidate<T extends ExperimentPostShape>(candidates: T[], config: LengthExperimentConfig, arm: LengthArm): T | null {
  return candidates.find((post) => !isExperimentPost(post) || (isExperimentDraft(post, config) && classifyLength(post.content, config) === arm)) ?? null;
}

export function countPendingByArm(pending: ExperimentPostShape[], config: LengthExperimentConfig): Record<LengthArm, number> {
  const counts: Record<LengthArm, number> = { S: 0, L: 0 };
  for (const post of pending) {
    const arm = classifyLength(post.content, config);
    if (arm !== "MID" && isExperimentDraft(post, config)) counts[arm]++;
  }
  return counts;
}

export function planLengthArms(pending: Record<LengthArm, number>, nextArm: LengthArm, count: number): LengthArm[] {
  const planned = { ...pending };
  return Array.from({ length: count }, () => {
    const arm: LengthArm = planned.S === planned.L ? nextArm : planned.S < planned.L ? "S" : "L";
    planned[arm]++;
    return arm;
  });
}

/** Fisher-Yates: formula, intent mode and link cadence are picked by batch index, so arms must not follow it. */
export function shuffleArms(arms: LengthArm[], random: () => number = Math.random): LengthArm[] {
  const shuffled = [...arms];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function planExperimentRefillCount(pending: Record<LengthArm, number>, target: number, maxPerRun: number = MAX_REFILL_PER_RUN): number {
  const perArm = Math.ceil(target / 2);
  return Math.min(maxPerRun, Math.max(0, perArm - pending.S) + Math.max(0, perArm - pending.L));
}

export interface LengthExperimentState {
  config: LengthExperimentConfig;
  position: number;
  arm: LengthArm;
  pending: Record<LengthArm, number>;
}

const EXPERIMENT_POST_SELECT = { content: true, postCategory: true, formulaId: true, createdAt: true } as const;

/** Null (and no DB reads) unless the brand has a live experiment: started and not yet through its sequence. */
export async function loadLengthExperimentState(
  brandId: string,
  brandConfig: Pick<BrandConfig, "lengthExperiment">,
  now: Date
): Promise<LengthExperimentState | null> {
  const config = brandConfig.lengthExperiment;
  if (!config || now.getTime() < Date.parse(config.startAt)) return null;

  const [published, pending] = await Promise.all([
    prisma.post.findMany({
      where: { brandId, status: "PUBLISHED", publishedAt: { gte: new Date(config.startAt) } },
      select: EXPERIMENT_POST_SELECT,
    }),
    prisma.post.findMany({ where: { brandId, status: "PENDING", qualityPass: true }, select: EXPERIMENT_POST_SELECT }),
  ]);
  const position = sequencePosition(published, config);
  const arm = currentArm(config, position, now);
  return arm ? { config, position, arm, pending: countPendingByArm(pending, config) } : null;
}

const TARGET_RANGE: Record<LengthArm, string> = { S: "140~240자", L: "400~450자" };

/** Generation-side band check. L is also capped at one post: past 500 chars it publishes as a split thread. */
export function lengthGateReason(content: string, target: LengthArm, config: LengthExperimentConfig): string | null {
  const overSinglePost = target === "L" && content.length > THREADS_CONTENT_MAX_LENGTH;
  if (classifyLength(content, config) === target && !overSinglePost) return null;
  return `길이 실험 ${target} 범위 밖: ${content.length}자 (목표 ${TARGET_RANGE[target]})`;
}

export function lengthPromptLines(target: LengthArm): { rule: string; request: string } {
  const rule = target === "S"
    ? "- 본문 목표 길이는 140~240자로 극도로 압축한다. [길이 실험] 이 길이 지시가 공식 지시문 속 글자 수보다 우선한다."
    : "- [길이 실험] 본문은 반드시 400~450자로 쓴다. 이 길이 지시가 공식 지시문 속 글자 수보다 우선한다. 1~2문장마다 줄을 바꾼다.";
  return { rule, request: `위 실험 조건을 조합해서 ${TARGET_RANGE[target]} Threads 포스트 1개를 작성해줘.` };
}
