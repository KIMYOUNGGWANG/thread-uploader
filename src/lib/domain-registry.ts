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
      "식상(실행력) 80%인데 위계 조직 들어가서 매일 깨지는 이유",
      "10년 주기 대운 교체기(교운기)에 충동 퇴사하면 100% 물리는 원리",
      "단일 사주만 믿고 베팅했다가 망하는 이유와 5대 엔진 교차 분석",
      "돈 새어나가는 사주 오행 구멍과 재물선 방어",
      "만나면 속 갉아먹는 파멸적 궁합과 손절 타이밍",
      "착한 척하느라 속 다 곪은 사람들의 대인관계 손절선",
      "번아웃 와서 실행력 0일 때 오행 에너지 회복법",
      "결정 장애 올 때 사주 대운으로 보는 7일 행동 갈림길",
      "창업이나 사이드 프로젝트 시작하기 가장 위험한 시기",
    ],
    forbiddenCrossDomainTerms: ["MRR", "API", "B2B", "SaaS", "데모 신청", "전환율 10배", "진태양시", "32분", "1961년 표준시", "바넘 효과"],
    trackFormulas: {
      track_a: [
        {
          id: "career_mismatch",
          name: "식상 vs 관성 기질-조직 미스매치 팩폭",
          track: "track_a",
          weight: 5,
          instruction: "실행력/창작욕(식상)이 80%인 사람이 보수적 위계 조직(관성)에서 겪는 갈등을 '자책하지 마라, 성격 문제가 아니라 기질과 조직 설계의 미스매치다'라는 팩트로 진단하고 명쾌한 포지셔닝 판정을 준다.",
          hookArchetype: "기질 미스매치 훅",
          forbiddenKeywords: ["진태양시", "32분", "타로", "조상신", "운명론"],
        },
        {
          id: "imagination_dilemma",
          name: "상상/3지선다 딜레마 (30만 뷰 검증)",
          track: "track_a",
          weight: 4,
          instruction: "극단적인 현실적 딜레마 상황(로또, 야근, 카드값, 퇴사 고민 등)을 날것의 일상 구어로 던지고 3개 선택지를 주어 댓글로 치열하게 반응하게 만든다. 도입부는 매번 다른 일상 상황으로 시작하며 특정 어구('자, 상상해봐' 등)를 기계적으로 반복하지 않는다. 괄호 안에는 '심리적 자유' 같은 번역투 대신 '속은 시원한데 3달 뒤 카드값 오열' 같은 날것의 일상어만 쓴다.",
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
          id: "energy_reset_cycle",
          name: "10년 대운 교운기 번아웃 리스크 판정",
          track: "track_b",
          weight: 5,
          instruction: "10년 주기 대운이 바뀌기 직전 1~2년(교운기)에 기존 판이 흔들리고 무기력증이 오는 현상을 '슬럼프가 아니라 환경 리셋 구간'으로 진단하여 홧김 퇴사나 충동 창업으로 인한 손실 회피를 안내한다.",
          hookArchetype: "대운 교운기 훅",
          forbiddenKeywords: ["진태양시", "32분", "타로", "굿", "부적"],
        },
        {
          id: "multi_engine_audit",
          name: "단일 사주 맹점 vs 5대 엔진 교차 판정",
          track: "track_b",
          weight: 4,
          instruction: "동양 사주 하나만 보고 '올해 대박' 믿고 질렀다가 망하는 이유를 서양 점성술 트랜짓(토성 직업궁 강타 등)과의 교차 검증 필요성으로 폭로하며, 비행기 계기판 1개만 보고 야간 비행하는 위험성을 경고한다.",
          hookArchetype: "교차 검증 폭로 훅",
          forbiddenKeywords: ["진태양시", "32분", "무조건 성공"],
        },
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
      ],
      track_c: [
        {
          id: "beta_coupon_offer",
          name: "쿨한 팩폭 검증 & 베타 쿠폰",
          track: "track_c",
          weight: 4,
          instruction: "말장난 뺀 정밀 7일 결정 패킷을 소개하며 댓글 작성자에게 100% 무료 쿠폰을 선착순으로 나눠준다.",
          hookArchetype: "베타 나눔 훅",
          forbiddenKeywords: ["무료 사주 풀이 접수", "진태양시"],
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
    name: "CosmicPath Global (Dual-Cosmic Intelligence PRD v4.0)",
    description: "동양 명리학(BaZi) ✕ 서양 천문 점성술(Astrology) 듀얼 교차 검증 마스터 도시에 ($29.99~$44.99)",
    defaultTopics: [
      "Why your Moon sign keeps falling for emotionally unavailable partners (Avoidant Trap)",
      "The real reason you feel like two different people: Sun vs Moon vs Rising internal clash",
      "Saturn return at 29: why your corporate job feels like a slow existential death",
      "Why 90% of $15 Etsy astrology readings are copy-pasted ChatGPT prompts lacking dual precision",
      "The hidden financial leak in your 2nd house of income and capital defense",
      "How unhealed childhood emotional karma (4th House IC) secretly sabotages your adult dating life",
    ],
    forbiddenCrossDomainTerms: ["MRR", "API 엔드포인트", "SQL 쿼리", "스프린트 회고", "사주팔자", "대운", "살풀이", "신점", "복채", "부적"],
    trackFormulas: {
      track_a: [
        {
          id: "synastry_avoidant_trap",
          name: "Synastry & Avoidant Attachment Trap (Ch 6 & 7)",
          track: "track_a",
          weight: 4,
          instruction: "Expose why someone attracts emotionally unavailable or avoidant partners using harsh astrological reality (e.g. Venus in Gemini vs Moon in Cancer, 7th house descendant clash). 2-line contrast opening: start with a bold calling-out under 40 chars, followed by a reality-check contrast under 40 chars. Do not sugar-coat.",
          hookArchetype: "Relationship Calling-Out Hook",
          forbiddenKeywords: ["10-year luck pillar", "Saju", "Korean bazi", "대운", "사주", "도화살"],
        },
        {
          id: "big3_internal_sabotage",
          name: "Sun vs Moon Internal Sabotage (Ch 1 & 3)",
          track: "track_a",
          weight: 4,
          instruction: "Call out the daily cognitive dissonance between an ambitious external persona and an exhausted, self-sabotaging inner emotional core (e.g. Capricorn Sun vs Pisces Moon, 4th house IC trauma). 2-line contrast opening under 40 chars each. High relatable dopamine.",
          hookArchetype: "Internal Dissonance Hook",
          forbiddenKeywords: ["10-year luck pillar", "Saju", "Korean bazi", "대운", "사주", "도화살"],
        },
      ],
      track_b: [
        {
          id: "saturn_return_burnout",
          name: "Saturn Return & 29yo Career Collapse (Ch 4, 5, 8)",
          track: "track_b",
          weight: 4,
          instruction: "Address the 28-32 quarter-life existential crisis and corporate golden handcuffs. Deconstruct why external achievement feels empty when wealth architecture clashes with life timing. Clinical, sharp, forensic tone.",
          hookArchetype: "Career Reality Check Hook",
          forbiddenKeywords: ["10-year luck pillar", "Saju", "Korean bazi", "대운", "사주", "도화살"],
        },
        {
          id: "anti_ai_craft_expose",
          name: "Anti-AI Slop & Dual Mathematical Precision (Ch 1 & 10)",
          track: "track_b",
          weight: 3,
          instruction: "Deconstruct why $15 Etsy readings and free app notifications fail: they are generic ChatGPT outputs lacking cross-verified mathematical depth. Explain the missing half (Eastern time pillars meeting Western ephemeris natal charts) with zero mysticism.",
          hookArchetype: "Dual Intelligence Authority Hook",
          forbiddenKeywords: ["10-year luck pillar", "Saju", "Korean bazi", "대운", "사주", "도화살"],
        },
      ],
      track_c: [
        {
          id: "synastry_blueprint_offer",
          name: "25-Page Couple Synastry Blueprint Offer (Ch 6 & 7)",
          track: "track_c",
          weight: 4,
          instruction: "Present a concrete case study or checklist comparing a surface-level dating dilemma with the deep 25-page couple synastry dossier on Etsy ($44.99). Honest, resigned, zero-hype recommendation.",
          hookArchetype: "Couple Synastry Offer Hook",
          forbiddenKeywords: ["10-year luck pillar", "Saju", "Korean bazi", "대운", "사주", "도화살"],
        },
        {
          id: "d2c_etsy_offer",
          name: "15-20 Page Master Dossier Decision Offer (Ch 2, 4, 5, 8)",
          track: "track_c",
          weight: 3,
          instruction: "Present a high-stakes life decision dilemma (career pivot, wealth defense, relational timing) solved by the 15-20 page Master Life Intelligence Dossier on Etsy ($29.99). Direct soft CTA.",
          hookArchetype: "Master Dossier Offer Hook",
          forbiddenKeywords: ["10-year luck pillar", "Saju", "Korean bazi", "대운", "사주", "도화살"],
        },
      ],
    },
  },

  product_growth: {
    domainId: "product_growth",
    name: "제품 성장 / 인디 해커 도구 (Product-Led Growth)",
    description: "업무 병목 제거, 수작업 자동화 전후 비교, 셀프서브 가입 유도",
    defaultTopics: [
      "매주 반복되는 데이터 정리로 날아가는 5시간의 숨은 비용",
      "복잡한 도구 대신 1클릭으로 문제를 끝내는 최소 실행 워크플로우",
      "수작업으로 처리하다 놓치는 고객 요청과 이탈 방지법",
      "혼자 일하는 메이커가 겪는 반복 업무 자동화 체크리스트",
    ],
    forbiddenCrossDomainTerms: ["사주", "점성술", "도화살", "홍염살", "대운", "신살", "타로", "복채", "부적"],
    trackFormulas: {
      track_a: [
        {
          id: "workflow_bottleneck_dilemma",
          name: "반복 업무 병목 딜레마",
          track: "track_a",
          weight: 4,
          instruction: "하루 일과 중 가장 시간 아까운 반복 작업 3가지 중 선택하게 하여 격한 공감 유도.",
          hookArchetype: "업무 병목 공감 훅",
          forbiddenKeywords: ["사주", "운명"],
        },
      ],
      track_b: [
        {
          id: "before_after_roi",
          name: "도구 도입 전후 시간 ROI 비교",
          track: "track_b",
          weight: 5,
          instruction: "수작업 30분 걸리던 작업을 10초 만에 끝내는 구체적 화면/절차 전후 비교.",
          hookArchetype: "전후 비교 훅",
          forbiddenKeywords: ["기운", "운세"],
        },
      ],
      track_c: [
        {
          id: "self_serve_offer",
          name: "셀프서브 무료 체험 / 스타터 킷 오퍼",
          track: "track_c",
          weight: 4,
          instruction: "카드 등록 없이 즉시 써볼 수 있는 무료 스타터 킷 또는 테스트 링크 안내.",
          hookArchetype: "셀프서브 오퍼 훅",
          forbiddenKeywords: ["복채", "부적"],
        },
      ],
    },
  },
};

export function getDomainPreset(domainOrQualityProfile?: string): DomainPresetConfig {
  if (!domainOrQualityProfile) return DOMAIN_PRESETS.saju_viral;
  if (DOMAIN_PRESETS[domainOrQualityProfile]) return DOMAIN_PRESETS[domainOrQualityProfile];
  if (domainOrQualityProfile.includes("product")) {
    return DOMAIN_PRESETS.product_growth;
  }
  if (domainOrQualityProfile.includes("saas")) {
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
