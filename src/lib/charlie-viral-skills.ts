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
  linkPlacement?: "bio" | "firstComment";
  deficiencyBridge?: string;
}

export function buildAdmissionFirstComment(
  postContent: string,
  context: AdmissionCommentContext = {}
): string {
  const { topic = "이 내용", linkUrl, trackingParams, voiceProfile, linkPlacement = "bio", deficiencyBridge } = context;

  const isEnglish = voiceProfile?.language === "en" ||
    Boolean(linkUrl && linkUrl.includes("etsy.com")) ||
    (!/[가-힣]/.test(postContent) && /[a-zA-Z]{4,}/.test(postContent));

  if (isEnglish) {
    const isRelationship = /synastry|relationship|dating|couple|partner|venus|love|marriage|avoidant/i.test(postContent + " " + topic);
    const targetUrl = linkUrl || "";
    const finalUrl = targetUrl && trackingParams ? buildTrackedUrl(targetUrl, trackingParams) : targetUrl;

    const enAdmissions = [
      voiceProfile?.admissionStyle || "📌 Honestly, I used to fall for this exact pattern every single time.",
      "📌 To be completely honest, I ignored these exact signs for three years.",
      "📌 Not trying to act superior here. I learned this the expensive way.",
      "📌 Real talk: I wrote this after making this exact mistake twice.",
    ];
    const admission = enAdmissions[Math.floor(Math.random() * enAdmissions.length)] ?? enAdmissions[0];

    const enFlips = [
      "Not claiming to have it all figured out—I just learned this the hard way after burning out twice.",
      "Not trying to preach here. I just cataloged this after watching the same dynamic implode for the third time.",
      "I only know this because I spent years falling into the exact same trap myself.",
      "Just sharing the raw notes I wish someone handed me before I signed up for this.",
      "No guru nonsense—just patterns that kept repeating until I actually mapped them out.",
    ];
    const enFlip = enFlips[Math.floor(Math.random() * enFlips.length)] ?? enFlips[0];
    const enWin = deficiencyBridge || (isRelationship
      ? "Pulled the complete decision framework together so you don't have to guess."
      : "Mapped out the full decision blueprint so you can see your own blind spots.");

    const allowDirectLink = linkPlacement === "firstComment" && Boolean(finalUrl);
    const enClosing = allowDirectLink
      ? `If you want the raw breakdown without the generic sugar-coating: ${finalUrl}`
      : "The full decision framework is linked at the top of my profile.";

    return [admission, enFlip, enWin, enClosing].join("\n");
  }

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

  // 3. Smallest possible win / deficiency bridge (작은 성과 및 결핍 브릿지)
  const win = deficiencyBridge
    ? deficiencyBridge
    : (topic.includes("화개") || topic.includes("도화") || topic.includes("홍염") || topic.includes("신살") || topic.includes("살"))
      ? "이게 '치명적 매력'으로 터지는지 '인간관계 파탄'으로 터지는지는 지지 1개로 갈림. 판정 기준만 따로 정리해둠."
      : `${topic} 관련해서 바로 써먹을 수 있는 체크리스트만 따로 추려둠.`;

  // 4. Resigned acceptance + soft bio guide (or direct link if explicitly configured as firstComment)
  let closing = "전체 판단 기준표와 리포트는 프로필 상단 링크에 남겨둠.";
  if (linkPlacement === "firstComment" && linkUrl) {
    const finalUrl = trackingParams ? buildTrackedUrl(linkUrl, trackingParams) : linkUrl;
    closing = `정리해둔 전체 진단표 링크는 여기 걸어둘게: ${finalUrl}`;
  }

  return [admission, flip, win, closing].join("\n");
}

export interface ConversationIgniterContext {
  topic?: string;
  formulaId?: string;
  voiceProfile?: VoiceProfile;
  hookType?: string;
}

/**
 * 2026 Threads Algorithm Ranking Signal: Reply Depth & Conversation Velocity
 * Builds a second spark/igniter comment for the creator to drop 15~30 mins after posting,
 * specifically engineered to stimulate substantive back-and-forth discussion without cheesy bait.
 */
export function buildConversationIgniterComment(
  postContent: string,
  context: ConversationIgniterContext = {}
): string {
  const { topic = "", formulaId = "" } = context;

  // 1. 3-Choice / Dilemma formulas
  if (formulaId.includes("lotto") || formulaId.includes("choice") || formulaId.includes("dilemma") || /1\.|2\.|3\./.test(postContent)) {
    const choices = [
      "솔직히 나는 2번 보고 바로 공감했는데 친구는 무조건 1번이라더라. 너넨 진지하게 몇 번이냐?",
      "3번 고른 사람 있으면 진짜 이유가 궁금함 ㅋㅋㅋ 다들 현실적으로 어느 쪽 선택함?",
      "이거 직장 동료들한테 물어보니까 반응 반반으로 갈리더라. 너네 기준엔 몇 번이 정답임?",
    ];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // 2. Hierarchy / Ego / Identity formulas
  if (formulaId.includes("hierarchy") || formulaId.includes("ego") || topic.includes("살") || topic.includes("사주")) {
    const egos = [
      "주변에 이거 제대로 터진 사람 보면 눈빛부터 다르던데, 너네 주변에도 이런 기운 가진 사람 있음?",
      "처음엔 안 믿었는데 실제 사례 뜯어보니까 소름 돋게 맞더라. 본인 사주에서 확인해본 사람?",
      "이거 장점으로 쓰면 대박인데 방치하면 멘탈부터 깨짐. 너넨 이거 어떻게 체감함?",
    ];
    return egos[Math.floor(Math.random() * egos.length)];
  }

  // 3. Fact Bomb / Incumbent Attack
  if (formulaId.includes("fact") || formulaId.includes("attack") || formulaId.includes("warning") || topic.includes("시간") || topic.includes("오차")) {
    const facts = [
      "아직도 30분 오차 계산 안 하고 사주 보러 가는 사람 많더라. 다들 본인 진짜 태어난 시 알고 있었음?",
      "주변에 물어보면 10명 중 7명은 자기가 태어난 시(時)도 헷갈려함. 확인해본 사람?",
      "기존에 알고 있던 사주랑 다르게 나와서 당황한 사람 손 들어봐.",
    ];
    return facts[Math.floor(Math.random() * facts.length)];
  }

  // 4. Default Conversation Spark
  const defaults = [
    `이거 관련해서 나도 겪어보기 전까진 몰랐는데 다들 어떻게 생각함?`,
    `이 상황 닥치면 다들 현실적으로 어떻게 대처함? 솔직한 경험담 궁금함.`,
    `너네 기준에선 이게 맞다고 봄? 다른 관점 있으면 댓글로 편하게 던져줘.`,
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}
