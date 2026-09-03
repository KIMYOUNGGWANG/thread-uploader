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
          id: "imagination_dilemma",
          name: "상상/3지선다 딜레마 (30만 뷰 검증)",
          track: "track_a",
          weight: 6,
          instruction: "'자, 상상해봐. 오늘 퇴근길에 ~'로 시작해 극단적 상황을 던지고 3개 선택지를 주어 댓글로 싸우게 만든다. 괄호 안에는 '심리적 자유' 같은 번역투 대신 '속은 시원한데 3달 뒤 카드값 오열' 같은 날것의 일상어만 쓴다.",
          hookArchetype: "상상 딜레마 훅",
          forbiddenKeywords: ["심리적 자유", "타이밍 손실 리스크", "리스크", "손익"],
        },
        {
          id: "concept_hierarchy",
          name: "개념 서열 비교 훅 (12만 뷰 검증)",
          track: "track_a",
          weight: 5,
          instruction: "대중이 흔히 아는 개념(A)보다 더 센 B, C를 비교하여('도화보다 센 홍염보다 센 게 뭔지 알아? 바로 화개야') 지적 호기심과 상식 파괴를 유발한다.",
          hookArchetype: "개념 서열 훅",
          forbiddenKeywords: ["사기", "상담비"],
        },
        {
          id: "cost_loss_punch",
          name: "손실 회피/바가지 팩폭 훅 (3.6만 뷰 검증)",
          track: "track_a",
          weight: 4,
          instruction: "'점집 가서 5만원 쓰고 타로 가서 3만원 쓸 바에 치킨이나 사 먹지 그랬어'처럼 기존 바가지 비용을 직관적으로 저격하고 현실 대안을 제시한다.",
          hookArchetype: "바가지 팩폭 훅",
          forbiddenKeywords: ["부적", "대박"],
        },
      ],
      track_b: [
        {
          id: "talent_reality_check",
          name: "현실 재능 판정 팩폭 (2.5만 뷰 검증)",
          track: "track_b",
          weight: 5,
          instruction: "'공부 머리 vs 일 머리 사주 보면 딱 나와. 공부 머리 없는데 공시 5년은 등골 브레이커야'처럼 낭비되는 노력을 날카롭게 짚고 타고난 재능 축을 분리한다.",
          hookArchetype: "재능 판정 훅",
          forbiddenKeywords: ["위로", "괜찮아"],
        },
        {
          id: "wealth_vault_unlock",
          name: "재물/돈 창고 언락 훅 (2.3만 뷰 검증)",
          track: "track_b",
          weight: 5,
          instruction: "'사주에 진술축미 깔려있어? 타고난 돈 창고야. 근데 창고 문 여는 열쇠가 언제 들어오는지 알아?'처럼 타고난 재물운과 타이밍을 흥미진진하게 짚는다.",
          hookArchetype: "돈 창고 훅",
          forbiddenKeywords: ["사기"],
        },
        {
          id: "destiny_partner_sign",
          name: "연애/귀인 궁합 훅 (2.3만 뷰 검증)",
          track: "track_b",
          weight: 4,
          instruction: "'절대 헤어지면 안 되는 궁합: 천을귀인 만난 궁합. 이 사람 만나고 일 잘 풀렸다면 절대 놓치지 마'처럼 귀인 만남과 연애 상극을 극단 대비한다.",
          hookArchetype: "귀인 궁합 훅",
          forbiddenKeywords: ["무조건 결혼"],
        },
        {
          id: "solar_distortion_truth",
          name: "시간 왜곡 팩트 폭로 (4.2만 뷰 검증)",
          track: "track_b",
          weight: 3,
          instruction: "'한국인 10명 중 7명은 자기가 태어난 시간을 잘못 알고 있다'는 팩트로 시작하되, 지루한 역사 강의가 아니라 즉시 자기 시주를 떠올려보게 만든다.",
          hookArchetype: "시간 왜곡 훅",
          forbiddenKeywords: ["1961년 표준시 강의"],
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
