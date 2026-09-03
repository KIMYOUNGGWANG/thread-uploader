/**
 * Domain Intelligence Registry
 * Plug-and-play domain presets for universal multi-brand growth OS.
 *
 * Supported domains:
 * - saju_viral: Saju mechanics, true solar time, 3-option lotto dilemmas
 * - career_decision: Career inflection points, salary masking burnout, scapegoat traps
 * - product_growth: Workflow time waste, before/after ROI, free trial/signup
 * - saas_b2b: Fragmented tooling costs, manual spreadsheet leaks, book a demo
 * - ecommerce_d2c: Low-quality comparison, craft transparency, direct purchase
 */

import type { ContentTrack } from "./quota-bandit-router";

export interface DomainFormulaConfig {
  id: string;
  name: string;
  track: ContentTrack;
  weight: number;
  instruction: string;
  hookArchetype: string;
  forbiddenKeywords: string[];
}

export interface DomainPresetConfig {
  domainId: string;
  name: string;
  description: string;
  defaultTopics: string[];
  trackFormulas: Record<ContentTrack, DomainFormulaConfig[]>;
  forbiddenCrossDomainTerms: string[];
}

export const DOMAIN_PRESETS: Record<string, DomainPresetConfig> = {
  saju_viral: {
    domainId: "saju_viral",
    name: "사주/운세/타이밍 (Saju Viral)",
    description: "친구 관찰 실화 썰, 대운 전환 신호, 에너지 밸런스 팩폭, 쿨한 쿠폰 나눔",
    defaultTopics: [
      "이직할 때 존버 vs 런 골든타임 판정",
      "돈 새어나가는 사주 오행 구멍과 재물선 방어",
      "만나면 속 갉아먹는 파멸적 궁합과 손절 타이밍",
      "착한 척하느라 속 다 곪은 사람들의 대인관계 손절선",
      "번아웃 와서 실행력 0일 때 오행 에너지 회복법",
      "결정 장애 올 때 사주 대운으로 보는 7일 행동 갈림길",
      "창업이나 사이드 프로젝트 시작하기 가장 위험한 시기",
      "새벽마다 전 애인 생각나는 사람들의 오행 밸런스",
    ],
    forbiddenCrossDomainTerms: ["MRR", "API", "B2B", "SaaS", "데모 신청", "전환율 10배"],
    trackFormulas: {
      track_a: [
        {
          id: "friend_observation_story",
          name: "친구 관찰 실화 썰형",
          track: "track_a",
          weight: 5,
          instruction: "주변 친구나 본인의 실제 관찰 썰('내 친구 중에 ~한 애 있거든?')로 시작하여 사주 대운/타이밍으로 풀어낸 뒤 댓글 유도로 닫는다.",
          hookArchetype: "관찰 썰형 훅",
          forbiddenKeywords: ["복채", "부적", "대박"],
        },
        {
          id: "energy_imbalance_mirror",
          name: "오행 에너지 밸런스 팩폭",
          track: "track_a",
          weight: 4,
          instruction: "겉으로는 멀쩡한데 속으로는 곪아있는 모순된 심리를 오행 불균형(목화토금수)으로 짚어주고 자아 대입을 유도한다.",
          hookArchetype: "자기인식 팩폭 훅",
          forbiddenKeywords: ["사기", "상담비"],
        },
      ],
      track_b: [
        {
          id: "timing_inflection_signs",
          name: "대운 전환기 3대 징조",
          track: "track_b",
          weight: 4,
          instruction: "억지로 버티면 망하는 시기와 판을 엎어야 새 판이 열리는 시기의 결정적 신호 3가지를 명확히 짚는다.",
          hookArchetype: "시기 판정 훅",
          forbiddenKeywords: ["위로", "괜찮아"],
        },
        {
          id: "relationship_cutoff_truth",
          name: "인간관계 손절 & 상극 궁합",
          track: "track_b",
          weight: 4,
          instruction: "나를 갉아먹는 상극 관계와 에너지 누수 타이밍을 직설적으로 분석한다.",
          hookArchetype: "관계 손절 훅",
          forbiddenKeywords: ["사기"],
        },
      ],
      track_c: [
        {
          id: "beta_coupon_offer",
          name: "쿨한 팩폭 검증 & 베타 쿠폰",
          track: "track_c",
          weight: 4,
          instruction: "말장난 뺀 정밀 7일 결정 패킷을 소개하며 댓글 작성자에게 100% 무료 쿠폰을 선착순으로 나눠준다.",
          hookArchetype: "베타 나눔 훅",
          forbiddenKeywords: ["무료 사주 풀이 접수"],
        },
      ],
    },
  },

  career_decision: {
    domainId: "career_decision",
    name: "커리어/이직/퇴사 의사결정 (Career Decision)",
    description: "연봉 마스킹 번아웃, 이직 후 6개월 퇴사율, 스케이프고트 신호",
    defaultTopics: [
      "연봉 20% 인상 제안의 신기루와 번아웃",
      "결산 직후 입사 = 사내정치 스케이프고트 함정",
      "퇴사 전 통장 잔고 6개월치보다 중요한 심리 기저",
      "이직 타이밍 3단계 자가진단 (버팀형 vs 이동형 vs 준비형)",
    ],
    forbiddenCrossDomainTerms: ["도화살", "사주팔자", "만세력", "살풀이", "신점"],
    trackFormulas: {
      track_a: [
        {
          id: "career_dilemma_poll",
          name: "커리어 갈림길 3지선다",
          track: "track_a",
          weight: 4,
          instruction: "버팀형 vs 이동형 vs 준비형 중 혼자 고르는 3단계 자가분류 프레임 제시.",
          hookArchetype: "자가진단 훅",
          forbiddenKeywords: ["사주", "운세"],
        },
      ],
      track_b: [
        {
          id: "career_data_warning",
          name: "이직 실패 데이터 경고",
          track: "track_b",
          weight: 5,
          instruction: "이직 후 6개월 내 조기 퇴사율 32%의 원인과 조직 개편기 함정 분석.",
          hookArchetype: "데이터 경고 훅",
          forbiddenKeywords: ["힐링", "힘내요"],
        },
      ],
      track_c: [
        {
          id: "career_dossier_offer",
          name: "커리어 의사결정 판정표",
          track: "track_c",
          weight: 3,
          instruction: "이직 계약서 서명 전 필수 검증 3대 리스크 판정표 안내 및 링크 연결.",
          hookArchetype: "솔루션 오퍼 훅",
          forbiddenKeywords: ["복채", "부적"],
        },
      ],
    },
  },

  saas_b2b: {
    domainId: "saas_b2b",
    name: "B2B SaaS / 생산성 도구 (B2B SaaS)",
    description: "파편화된 도구 비용, 엑셀 수작업 데이터 누수, ROI 10배 자동화",
    defaultTopics: [
      "팀원 10명이 매주 4시간씩 날리는 엑셀 수작업의 숨은 비용",
      "슬랙 알림 지옥에 빠져 본업을 놓치는 개발팀의 3가지 병목",
      "고객 이탈 신호를 사전에 감지하지 못해 발생하는 연간 5천만원 손실",
      "수작업 보고서 작성을 1클릭으로 끝내는 데이터 파이프라인",
    ],
    forbiddenCrossDomainTerms: ["사주", "점성술", "도화살", "홍염살", "대운", "신살", "타로"],
    trackFormulas: {
      track_a: [
        {
          id: "b2b_pain_poll",
          name: "업무 비효율 극단 딜레마",
          track: "track_a",
          weight: 4,
          instruction: "월요일 아침 출근하자마자 마주치는 최악의 업무 비효율 3가지 중 선택.",
          hookArchetype: "업무 고통 공감 훅",
          forbiddenKeywords: ["운명", "사주", "팔자"],
        },
      ],
      track_b: [
        {
          id: "b2b_roi_breakdown",
          name: "수작업 비용 누수 팩트폭격",
          track: "track_b",
          weight: 5,
          instruction: "도구 파편화로 발생하는 실제 인건비 손실액(연간 2,400만원) 수치 분석.",
          hookArchetype: "비용 폭로 훅",
          forbiddenKeywords: ["기운", "살"],
        },
      ],
      track_c: [
        {
          id: "b2b_demo_offer",
          name: "14일 무료 체험 & ROI 리포트",
          track: "track_c",
          weight: 3,
          instruction: "팀별 맞춤 비효율 진단 리포트 무료 신청 및 1클릭 데모 링크 연결.",
          hookArchetype: "B2B 데모 오퍼 훅",
          forbiddenKeywords: ["복채", "부적"],
        },
      ],
    },
  },

  ecommerce_d2c: {
    domainId: "ecommerce_d2c",
    name: "D2C / 글로벌 이커머스 (E-Commerce D2C)",
    description: "양산형 저질 제품 비교, 수제 공정 투명성, 20페이지 맞춤 디지털 파일",
    defaultTopics: [
      "1줄짜리 양산형 운세 앱 vs 20페이지 맞춤 출생차트의 데이터 격차",
      "공장에서 찍어낸 기성품이 감추고 있는 마진 구조의 진실",
      "내 인생 청사진을 단 1페이지 요약으로 끝낼 수 없는 이유",
    ],
    forbiddenCrossDomainTerms: ["MRR", "API 엔드포인트", "SQL 쿼리", "스프린트 회고"],
    trackFormulas: {
      track_a: [
        {
          id: "d2c_contrast_hook",
          name: "양산형 vs 맞춤형 대조",
          track: "track_a",
          weight: 4,
          instruction: "흔한 1문단짜리 서비스와 20페이지 심층 제작물의 극단적 퀄리티 대조.",
          hookArchetype: "퀄리티 대조 훅",
          forbiddenKeywords: ["B2B", "엔터프라이즈"],
        },
      ],
      track_b: [
        {
          id: "d2c_craft_transparency",
          name: "제작 공정 투명성 폭로",
          track: "track_b",
          weight: 5,
          instruction: "왜 대부분의 업체가 얕은 분석만 제공하는지 구조적 한계와 공정 공개.",
          hookArchetype: "투명성 공개 훅",
          forbiddenKeywords: ["위로"],
        },
      ],
      track_c: [
        {
          id: "d2c_etsy_offer",
          name: "Etsy 맞춤 상품 직결 오퍼",
          track: "track_c",
          weight: 3,
          instruction: "Etsy 상점의 20페이지 맞춤 디지털 리포트 즉시 주문 링크 연결.",
          hookArchetype: "제품 구매 오퍼 훅",
          forbiddenKeywords: ["상담 복채"],
        },
      ],
    },
  },
};

export function getDomainPreset(domainOrQualityProfile?: string): DomainPresetConfig {
  if (!domainOrQualityProfile) return DOMAIN_PRESETS.saju_viral;
  if (DOMAIN_PRESETS[domainOrQualityProfile]) return DOMAIN_PRESETS[domainOrQualityProfile];
  if (domainOrQualityProfile.includes("saas") || domainOrQualityProfile.includes("product")) {
    return DOMAIN_PRESETS.saas_b2b;
  }
  if (domainOrQualityProfile.includes("career")) {
    return DOMAIN_PRESETS.career_decision;
  }
  if (domainOrQualityProfile.includes("etsy") || domainOrQualityProfile.includes("commerce")) {
    return DOMAIN_PRESETS.ecommerce_d2c;
  }
  return DOMAIN_PRESETS.saju_viral;
}
