/**
 * Two-Stage Decoupled Auto-Plug Orchestrator
 *
 * Prevents 2026 Meta Threads algorithmic demotion by decoupling viral organic distribution
 * from commercial monetization:
 * Stage 1 (T=0): Publishes clean root thread with a zero-friction Conversation Igniter (no links).
 * Stage 2 (T=Velocity): Automatically evaluates post metrics and drops an Auto-Plug CTA
 * into the thread only when organic momentum/escape velocity is proven.
 */

export interface AutoPlugMetrics {
  views: number;
  likes: number;
  replies: number;
  publishedAt: Date;
  now?: Date;
}

export interface AutoPlugThresholds {
  minViews?: number; // default 80
  minLikes?: number; // default 5
  minReplies?: number; // default 3
  minElapsedMinutes?: number; // default 45
  maxElapsedHours?: number; // default 48 (don't plug stale posts)
}

export interface AutoPlugTriggerResult {
  shouldPlug: boolean;
  reason: string;
}

export interface AutoPlugTemplateInput {
  linkUrl?: string;
  brandName?: string;
  offerType?: "framework" | "guide" | "tool" | "consulting" | "newsletter";
  customMessage?: string;
}

export interface TwoStagePlan {
  stage1: {
    content: string;
    firstComment: string | null;
  };
  stage2: {
    eligibleForAutoPlug: boolean;
    autoPlugComment: string | null;
  };
}

const DEFAULT_THRESHOLDS: Required<AutoPlugThresholds> = {
  minViews: 80,
  minLikes: 5,
  minReplies: 3,
  minElapsedMinutes: 45,
  maxElapsedHours: 48,
};

/**
 * Checks whether an active post has met the velocity threshold to trigger an Auto-Plug.
 */
export function shouldTriggerAutoPlug(
  metrics: AutoPlugMetrics,
  options: AutoPlugThresholds = {}
): AutoPlugTriggerResult {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options };
  const now = metrics.now ?? new Date();
  const elapsedMinutes = Math.max(0, (now.getTime() - metrics.publishedAt.getTime()) / (60 * 1000));
  const elapsedHours = elapsedMinutes / 60;

  if (elapsedHours > thresholds.maxElapsedHours) {
    return {
      shouldPlug: false,
      reason: `발행 후 ${Math.round(elapsedHours)}시간 경과로 인한 자동 플러그 만료 (신선도 소진)`,
    };
  }

  // Velocity Condition 1: High conversational momentum
  if (metrics.replies >= thresholds.minReplies && metrics.views >= 30) {
    return {
      shouldPlug: true,
      reason: `댓글 수 기준 충족 (${metrics.replies}개 댓글, ${metrics.views}회 노출) - 유기적 대화 활성화됨`,
    };
  }

  // Velocity Condition 2: High view or like momentum
  if (metrics.views >= thresholds.minViews && metrics.likes >= thresholds.minLikes) {
    return {
      shouldPlug: true,
      reason: `조회/좋아요 기준 충족 (${metrics.views}뷰, ${metrics.likes}좋아요) - 1차 탈출 성공`,
    };
  }

  // Velocity Condition 3: Safe time elapsed with moderate baseline engagement
  if (elapsedMinutes >= thresholds.minElapsedMinutes && (metrics.likes >= 3 || metrics.views >= 50)) {
    return {
      shouldPlug: true,
      reason: `안전 대기 시간(${Math.round(elapsedMinutes)}분) 경과 및 유기적 반응 확보됨`,
    };
  }

  return {
    shouldPlug: false,
    reason: `아직 임계치 미달 (현재: ${metrics.views}뷰, ${metrics.likes}좋아요, ${metrics.replies}댓글, 경과 ${Math.round(elapsedMinutes)}분)`,
  };
}

/**
 * Builds a natural, non-spammy Auto-Plug comment directing readers to the bio or resource.
 */
export function buildAutoPlugComment(input: AutoPlugTemplateInput): string {
  if (input.customMessage) {
    return input.customMessage.trim();
  }

  const offer = input.offerType ?? "guide";
  switch (offer) {
    case "framework":
      return "본문에서 다룬 구체적인 체크리스트와 프레임워크는 프로필 링크(↓)에 무료로 정리해 두었습니다. 필요하신 분은 참고해 보세요!";
    case "tool":
      return "이 작업을 자동화하고 시간 아껴주는 도구 링크는 프로필 바이오(↓)에 남겨두었습니다.";
    case "consulting":
      return "내 상황에 맞춘 구체적인 진단이나 상담이 필요하시다면 프로필 링크(↓)로 남겨주시면 확인 후 답변드립니다.";
    case "newsletter":
      return "이런 인사이트와 실전 사례를 매주 정리해서 보내드리고 있습니다. 프로필 링크(↓)에서 확인해 보세요.";
    case "guide":
    default:
      return "더 깊은 내용과 실전 예시가 담긴 가이드는 프로필 바이오(↓)에 걸어두었습니다.";
  }
}

/**
 * Plans a two-stage decoupled posting pipeline.
 */
export function planTwoStageThread(input: {
  rootContent: string;
  conversationIgniter?: string;
  conversionLink?: string;
  offerType?: AutoPlugTemplateInput["offerType"];
}): TwoStagePlan {
  // Strip any accidental links from root content
  const cleanRootContent = input.rootContent.replace(/https?:\/\/[^\s]+/gi, "").trim();

  // Stage 1 first comment is purely a conversation igniter
  const stage1FirstComment = input.conversationIgniter?.trim() || null;

  // Stage 2 comment prepared for auto-plugging
  const autoPlugComment = input.conversionLink || input.offerType
    ? buildAutoPlugComment({
        linkUrl: input.conversionLink,
        offerType: input.offerType ?? "guide",
      })
    : null;

  return {
    stage1: {
      content: cleanRootContent,
      firstComment: stage1FirstComment,
    },
    stage2: {
      eligibleForAutoPlug: Boolean(autoPlugComment),
      autoPlugComment,
    },
  };
}
