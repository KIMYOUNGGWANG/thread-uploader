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
    description: "진태양시 팩트폭격, 신살 서열화, 초저마찰 3지선다 자가진단",
    defaultTopics: [
      "진태양시 32분 오차와 시주 왜곡",
      "도화살 vs 홍염살 vs 화개살 서열화",
      "대운 교체기 3단계 인간관계 정리 징조",
      "진술축미 잠긴 돈창고 개고 타이밍",
      "퇴근길 로또 1등 당첨 3지선다 딜레마",
    ],
    forbiddenCrossDomainTerms: ["MRR", "API", "B2B", "SaaS", "데모 신청", "전환율 10배"],
    trackFormulas: {
      track_a: [
        {
          id: "lotto_zero_friction",
          name: "극단적 상상 3지선다",
          track: "track_a",
          weight: 4,
          instruction: "퇴근길 로또 15억 당첨 등 극단적 상상 시나리오 + 1초 만에 고르는 1/2/3 선택지 제시.",
          hookArchetype: "상상형 딜레마 훅",
          forbiddenKeywords: ["복채", "부적", "대박"],
        },
        {
          id: "sal_hierarchy_ego",
          name: "신살 3단계 서열화",
          track: "track_a",
          weight: 4,
          instruction: "도화살 < 홍염살 < 화개살 등 에너지 서열화로 독자 자아 대입 유도.",
          hookArchetype: "서열 비교 훅",
          forbiddenKeywords: ["사기", "상담비"],
        },
      ],
      track_b: [
        {
          id: "fact_bomb_incumbent_attack",
          name: "천문 데이터 팩트 폭격",
          track: "track_b",
          weight: 5,
          instruction: "동경 135도 32분 오차, 서머타임 1시간 왜곡 팩트와 기득권 철학관 나태함 저격.",
          hookArchetype: "팩트 폭격 훅",
          forbiddenKeywords: ["위로", "괜찮아"],
        },
        {
          id: "controversy_stunt",
          name: "논쟁 스턴트 훅",
          track: "track_b",
          weight: 5,
          instruction: "기존 상식을 깨부수는 논쟁적 팩트 폭격 및 철학관 저격.",
          hookArchetype: "논쟁 도발 훅",
          forbiddenKeywords: ["사기"],
        },
      ],
      track_c: [
        {
          id: "consensus_matrix_offer",
          name: "5대 엔진 컨센서스 매트릭스",
          track: "track_c",
          weight: 3,
          instruction: "사주/점성술/자미두수 3개 이상 불일치 시 행동 보류 원칙 및 VIP 진단표 연결.",
          hookArchetype: "의사결정 오퍼 훅",
          forbiddenKeywords: ["무료 사주 풀이"],
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
