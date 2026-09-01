import type { VoiceProfile } from "@/types/brand";
import { buildTrackedUrl, type TrackingParams } from "@/lib/tracking-url";

/**
 * Charlie Hills 바이럴 스킬 모듈 (charlie-viral-skills.ts)
 *
 * 1. 2-Line Contrast Hook (hook-generator):
 *    - 40자 이내의 단언형 오프닝 + 40자 이내의 반전 대립각(Contrast) 라인
 *
 * 2. 4-Line Admission First Comment (pinned-comment):
 *    - 1행: 사실처럼 보고하는 솔직한 고백 (One quiet admission)
 *    - 2행: 화자의 지위를 낮추는 유머러스한 인정 (Lower-status flip)
 *    - 3행: 최소한의 유효한 성과/체크리스트 안내 (Smallest possible win / sad flex)
 *    - 4행: 체념적 수용과 자연스러운 소프트 링크 (Resigned acceptance & link)
 */

export interface TwoLineContrastHook {
  opening: string;
  contrast: string;
  combined: string;
}

export function buildTwoLineContrastHook(
  topic: string,
  keyArgument: string
): TwoLineContrastHook {
  const cleanTopic = topic.trim();
  const cleanArg = keyArgument.trim();

  let opening = `${cleanTopic}에 목매는 사람이 너무 많다.`;
  let contrast = `근데 진짜 성과는 정반대에서 나온다.`;

  if (cleanTopic.includes("이직") || cleanTopic.includes("퇴사")) {
    opening = `이직 타이밍은 느낌으로 정하는 게 아니다.`;
    contrast = `결정은 감정이 아니라 반복된 신호가 한다.`;
  } else if (cleanTopic.includes("사주") || cleanTopic.includes("도화살")) {
    opening = `도화살 있다고 다 인기 많은 게 아니다.`;
    contrast = `오히려 감정 기복 때문에 스스로 지친다.`;
  } else if (cleanArg.length > 0) {
    opening = cleanArg.slice(0, 38);
    contrast = `하지만 남들은 이걸 정반대로 알고 있다.`;
  }

  // 40자 길이 제약 보장
  if (opening.length > 40) opening = opening.slice(0, 37) + "...";
  if (contrast.length > 40) contrast = contrast.slice(0, 37) + "...";

  return {
    opening,
    contrast,
    combined: `${opening}\n${contrast}`,
  };
}

export interface AdmissionCommentContext {
  topic?: string;
  linkUrl?: string;
  trackingParams?: TrackingParams;
  voiceProfile?: VoiceProfile;
}

export function buildAdmissionFirstComment(
  postContent: string,
  context: AdmissionCommentContext = {}
): string {
  const { topic = "이 내용", linkUrl, trackingParams, voiceProfile } = context;

  // 1. Admission (솔직한 고백)
  let admission = voiceProfile?.admissionStyle || "📌 솔직히 말하면 나도 매번 이 함정에 빠진다.";
  if (!admission.startsWith("📌")) {
    admission = `📌 ${admission}`;
  }

  // 2. Lower-status flip (화자의 지위를 낮춤)
  const flips = [
    "내가 대단해서 쓴 게 아니라, 몇 달 동안 삽질하고 깨달은 거다.",
    "똑똑해서 아는 게 아니라, 똑같이 당해봐서 몸으로 익혔다.",
    "누굴 가르칠 처지는 못 되고, 그냥 내가 흔들릴 때 보려고 정리했다.",
  ];
  const flip = flips[Math.floor(Math.random() * flips.length)] ?? flips[0];

  // 3. Smallest possible win / sad flex (작은 성과 및 가치 제공)
  const win = `${topic} 관련해서 바로 써먹을 수 있는 체크리스트만 따로 추려둠.`;

  // 4. Resigned acceptance + soft link (with tracked URL if params provided)
  let closing = "필요하면 기준표 삼아서 한 번 확인해봐.";
  if (linkUrl) {
    const finalUrl = trackingParams ? buildTrackedUrl(linkUrl, trackingParams) : linkUrl;
    closing = `정리해둔 전체 진단표 링크는 여기 걸어둘게: ${finalUrl}`;
  }

  return [admission, flip, win, closing].join("\n");
}
