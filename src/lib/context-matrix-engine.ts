/**
 * 3D Context Matrix Engine
 * Generates non-repetitive, hyper-specific real-world scenario permutations
 * across 3 orthogonal dimensions: Persona × Friction Scenario × Internal Tension.
 */

export interface MatrixDimensionSet {
  personas: string[];
  frictions: string[];
  tensions: string[];
}

export interface DynamicContextResult {
  persona: string;
  friction: string;
  tension: string;
  dynamicTopic: string;
  targetAudience: string;
  situation: string;
}

export interface ContextWeightsConfig {
  personaWeights?: Record<string, number>;
  frictionWeights?: Record<string, number>;
  epsilon?: number;
}

export interface ResolveDynamicContextOptions {
  domainId?: string;
  index: number;
  baseTopic?: string;
  userTarget?: string;
  userSituation?: string;
  contextWeights?: ContextWeightsConfig;
}

export const DOMAIN_MATRICES: Record<string, MatrixDimensionSet> = {
  saju_viral: {
    personas: [
      "3년차 UI/UX 디자이너",
      "7년차 백엔드/풀스택 개발자",
      "초기 스타트업 PO/프로덕트 기획자",
      "인하우스 퍼포먼스 마케터",
      "IT 솔루션 B2B 영업대표",
      "광고 에이전시 AE/콘텐츠 기획자",
      "1인 창업가/인디메이커",
      "대기업 5년차 과장/중간관리자",
    ],
    frictions: [
      "보고서 결재만 5단계인 보수적인 위계 조직",
      "실무 역량 전무한 낙하산 팀장의 훈수와 마이크로매니징",
      "성과 가로채기와 사내 정치 싸움에 휘말린 상태",
      "3년차 번아웃과 포괄임금제 야근의 늪",
      "대기업 네임밸류 vs 스타트업 성장 정체 사이의 갈림길",
      "연봉 1,500 인상 이직 오퍼 뒤에 숨겨진 업무 폭탄 함정",
      "홧김에 사표 던지기 직전 카드값과 통장 잔고 딜레마",
      "창업 런웨이 3개월 남은 외통수와 번아웃",
    ],
    tensions: [
      "식상 과다(실행·창작욕 80%) vs 관성(조직 위계 순응)의 기질 미스매치",
      "편인 과다(생각 과잉·실행 마비) vs 식신(현실 행동력)의 충돌",
      "10년 대운 교운기(접목운) 환경 강제 리셋과 무기력증",
      "비견·겁재 과다(자존심·독립심) vs 조직 복종의 한계",
      "재성 결핍(돈 안 되는 완벽주의) vs 현실 자본주의의 압박",
      "단일 사주 맹신 vs 점성술 토성 직업궁 강타의 교차 충돌",
      "에너지 소진기 한가운데에서의 충동적 이직 베팅 리스크",
      "손실 회피 심리와 과거 실패 경험에 대한 자책감",
    ],
  },
  career_decision: {
    personas: [
      "3년차 주니어 기획자",
      "시니어 아키텍트/테크 리드",
      "시리즈 A 스타트업 팀 리드",
      "그로스 마케터",
      "전략 컨설턴트",
      "에이전시 PM",
      "부트스트랩 SaaS 빌더",
      "전통 대기업 8년차 차장",
    ],
    frictions: [
      "연봉 20% 인상 뒤에 숨은 주 80시간 노동 함정",
      "결산 직후 입사해 사내정치 스케이프고트가 된 상황",
      "경영진의 무리한 피벗과 팀원 줄퇴사 위기",
      "성과 평가 직전 프로젝트 강제 엎어짐",
      "잡초 뽑기성 잡무로 커리어 사다리가 끊긴 느낌",
      "임원진 갈등 사이에 낀 샌드위치 중간관리자",
      "퇴사 전 통장 잔고 6개월치와 전세금 만기 압박",
      "동기들의 이직 성공 소식에 흔들리는 상대적 박탈감",
    ],
    tensions: [
      "버팀형 vs 이동형 vs 준비형 3단계 의사결정 기로",
      "심리적 번아웃 상태에서의 충동적 도피 이직 리스크",
      "기존 도메인 전문성 매몰비용 vs 신규 AI 전환 갈등",
      "조직 내 평판 방어 vs 개인 성장 속도의 불일치",
      "고액 연봉 골든핸드커프스 vs 자아실현의 딜레마",
      "안전지향적 성향과 시장 격변기의 불안감 충돌",
      "내부 정치 피로도와 이직 면접 준비 체력 고갈",
      "단기 금전 보상과 3년 후 시장 가치의 미스매치",
    ],
  },
  product_growth: {
    personas: [
      "1인 B2B SaaS 파운더",
      "스타트업 그로스 엔지니어",
      "노코드 프리랜서 에이전시 대표",
      "디지털 프로덕트 크리에이터",
      "B2B 솔루션 세일즈 리드",
      "인하우스 오퍼레이션 매니저",
      "인디해커/마이크로 빌더",
      "고객 성공(CS) 팀 리드",
    ],
    frictions: [
      "수작업 엑셀 복붙으로 매주 5시간씩 날아가는 비효율",
      "파편화된 SaaS 도구 10개 구독료로 월 100만 원씩 새는 누수",
      "견적서·인보이스 수동 발행 지연으로 계약 취소되는 위기",
      "신규 유저 온보딩 2단계에서 70%가 이탈하는 병목",
      "수동 슬랙 알림과 스프레드시트 동기화 오류로 인한 클레임",
      "혼자서 CS, 개발, 마케팅 다 하느라 제품 개선 올스톱",
      "무료 가입자는 늘어나는데 유료 결제 전환율 0.5% 정체",
      "정기 결제 실패(Dunning) 방치로 매달 날아가는 MRR",
    ],
    tensions: [
      "기술 부채 해결 vs 즉각적인 신기능 출시 압박",
      "셀프서브 셀프온보딩 vs 엔터프라이즈 하이터치 세일즈 딜레마",
      "오가닉 바이럴 CAC 0원 추구 vs 유료 광고 스케일업 유혹",
      "제품 완성도 집착 vs 빠른 시장 검증(MVP) 배포의 마찰",
      "단기 무료 프로모션 vs 장기 가격 정책 방어의 갈등",
      "단순한 1기능 도구 vs 올인원 플랫폼 확장 유혹",
      "개발 자동화 구축 시간 vs 현재 수작업 처리의 기회비용",
      "피처 요청 수용 vs 제품 코어 가치 단순성 유지의 충돌",
    ],
  },
  ecommerce_d2c: {
    personas: [
      "Corporate tech professional seeking alignment",
      "High-achieving perfectionist creator",
      "Creative freelance digital nomad",
      "Chronic people-pleasing team lead",
      "Avoidant serial dater in metropolitan city",
      "Anxious overachiever facing 29yo quarter-life crisis",
      "Independent studio art director",
      "Golden-handcuffs executive with creative burnout",
    ],
    frictions: [
      "The recurring avoidant attachment loop in modern dating",
      "Saturn return at 29: corporate career feeling like slow death",
      "Empty external milestone syndrome despite promotion",
      "Exhausted emotional caretaker burnout in relationships",
      "Hidden financial leaks in income capital defense",
      "Imposter syndrome paralyzing high-visibility creative launches",
      "Unhealed childhood conditioning sabotaging adult boundaries",
      "Cognitive dissonance between public ambition and private exhaustion",
    ],
    tensions: [
      "Sun external ego clash with Moon inner emotional sabotage",
      "4th House IC emotional conditioning vs 10th House career drive",
      "Western astrology ambiguity vs Eastern Four Pillars clock precision",
      "Fear of being misunderstood vs craving for soul-level validation",
      "Surface-level dating compatibility vs deep synastry friction",
      "Golden handcuffs safety vs independent creative venture fear",
      "Over-giving empathy vs sudden emotional stonewalling",
      "Perfectionist delay vs releasing authentic creative self",
    ],
  },
};

function pickWeighted(items: string[], weights: Record<string, number>, seed: number): string {
  const pool: string[] = [];
  for (const item of items) {
    const w = Math.max(1, weights[item] ?? 3);
    for (let i = 0; i < w; i++) pool.push(item);
  }
  if (pool.length === 0) return items[seed % items.length];
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

/**
 * Returns dynamic context for a given index and domain.
 * Uses coprime step sizes to guarantee zero permutation repetition over 64+ consecutive indices.
 */
export function resolveDynamicContext(options: ResolveDynamicContextOptions): DynamicContextResult {
  const domainKey = options.domainId && DOMAIN_MATRICES[options.domainId]
    ? options.domainId
    : options.domainId?.includes("product")
    ? "product_growth"
    : options.domainId?.includes("career")
    ? "career_decision"
    : options.domainId?.includes("etsy") || options.domainId?.includes("commerce")
    ? "ecommerce_d2c"
    : "saju_viral";

  const matrix = DOMAIN_MATRICES[domainKey] ?? DOMAIN_MATRICES.saju_viral;
  const pLen = matrix.personas.length;
  const fLen = matrix.frictions.length;
  const tLen = matrix.tensions.length;

  const totalCombinations = pLen * fLen * tLen;

  // Affine state-space permutation generator: (A * index + B) % totalCombinations
  // 269 is prime and coprime to powers of 2 (such as 512) and arbitrary state spaces
  let coprimeStep = 269;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  while (gcd(coprimeStep, totalCombinations) !== 1) {
    coprimeStep += 2;
  }

  const permutationCode = ((coprimeStep * options.index + 73) % totalCombinations + totalCombinations) % totalCombinations;
  const pIdx = permutationCode % pLen;
  const fIdx = Math.floor(permutationCode / pLen) % fLen;
  const tIdx = Math.floor(permutationCode / (pLen * fLen)) % tLen;

  let persona: string;
  let friction: string;
  const tension = matrix.tensions[tIdx];

  const weights = options.contextWeights;
  const hasCustomWeights = Boolean(
    (weights?.personaWeights && Object.keys(weights.personaWeights).length > 0) ||
    (weights?.frictionWeights && Object.keys(weights.frictionWeights).length > 0)
  );

  const epsilon = weights?.epsilon ?? 0.2;
  const explorePeriod = Math.max(2, Math.round(1 / epsilon));
  const isExploration = !hasCustomWeights || (options.index % explorePeriod === 0);

  if (!isExploration && hasCustomWeights) {
    persona = pickWeighted(matrix.personas, weights?.personaWeights ?? {}, options.index * 7 + 1);
    friction = pickWeighted(matrix.frictions, weights?.frictionWeights ?? {}, options.index * 11 + 3);
  } else {
    persona = matrix.personas[pIdx];
    friction = matrix.frictions[fIdx];
  }

  const baseTopic = options.baseTopic?.trim();
  const dynamicTopic = baseTopic
    ? `${baseTopic} (${persona}의 ${friction} 사례)`
    : `${persona}가 겪는 ${friction}과 ${tension}`;

  // If user provided a specific non-default target/situation, respect it while enriching
  const isDefaultTarget = !options.userTarget || ["일반 독자", "2030 직장인"].includes(options.userTarget.trim());
  const targetAudience = isDefaultTarget
    ? `${friction}을 겪으며 ${tension}으로 흔들리는 ${persona}`
    : `${options.userTarget} (${persona} 관점)`;

  const isDefaultSituation = !options.userSituation || ["일상적인 상황", "퇴사와 이직 사이에서 흔들리는 상황"].includes(options.userSituation.trim());
  const situation = isDefaultSituation
    ? `${friction} 상황에서 ${tension}의 결정을 내려야 하는 순간`
    : `${options.userSituation} (${friction} 맥락)`;

  return {
    persona,
    friction,
    tension,
    dynamicTopic,
    targetAudience,
    situation,
  };
}
