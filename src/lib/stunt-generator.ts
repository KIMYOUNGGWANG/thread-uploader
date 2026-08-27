export interface StuntConcept {
  readonly title: string;
  readonly hook: string;
  readonly commonEnemy: string;
  readonly stuntExecution: string;
  readonly examplePostText: string;
  readonly conversionPath: string;
  readonly royWarning: string;
}

export function generateAudaciousStunts(
  productName: string,
  targetCustomer: string,
  industryPain: string
): readonly StuntConcept[] {
  const cleanProduct = productName.trim() || "Our Product";
  const cleanCustomer = targetCustomer.trim() || "Target Audience";
  const cleanPain = industryPain.trim() || "Inefficient industry practices";

  return [
    {
      title: `${cleanPain} 타파 선언 스턴트`,
      hook: `왜 ${cleanCustomer}들은 여전히 ${cleanPain}에 돈과 시간을 버리고 있을까?`,
      commonEnemy: `기존 업계의 낡고 불합리한 ${cleanPain} 관행`,
      stuntExecution: `업계 리더들의 낡은 방식을 투명하게 비교 공개하고, ${cleanProduct}의 1/10 시간 단축 결과를 실시간 검증하는 공개 라이브 실험 진행.`,
      examplePostText: `대부분의 ${cleanCustomer}들이 ${cleanPain} 때문에 속고 있습니다.\n\n우리는 더 이상 가짜 전문가들의 상술을 참지 않기로 했습니다. ${cleanProduct}로 어떻게 10분 만에 끝내는지 직접 보여드립니다.`,
      conversionPath: `프로필 링크에서 30초 만에 무료 진단 체크리스트 확인`,
      royWarning: `어설프게 비판만 하고 실질적 대안을 안 보이면 그냥 어그로로 몰림. 확실한 데이터 필수.`,
    },
    {
      title: `비밀 흑역사 공개 & 반전 폭로`,
      hook: `솔직히 고백합니다. ${cleanProduct} 만들기 전엔 저도 ${cleanPain}으로 유저들 피를 말렸습니다.`,
      commonEnemy: `업계 내부인들만 알던 치사한 영업 마진 구조`,
      stuntExecution: `창업자가 직접 나와 이전 비즈니스에서 불합리했던 비하인드 경험을 폭로하고, 이를 완전히 뒤엎는 혁신 구조 공개.`,
      examplePostText: `업계 사람들은 저를 싫어하겠지만 공개하겠습니다.\n\n${cleanCustomer}를 쥐어짜는 ${cleanPain}의 진짜 원인은 바로 이것입니다. 그래서 저는 완전히 다른 방식으로 ${cleanProduct}를 만들었습니다.`,
      conversionPath: `댓글 또는 프로필에서 1:1 비밀 가이드북 다운로드`,
      royWarning: `자기 폭로는 진정성이 생명. 감성 팔이가 아니라 데이터와 해결책으로 마감해야 함.`,
    },
    {
      title: `10배 환불 / 도전장 스턴트`,
      hook: `${cleanProduct} 쓰고도 ${cleanPain} 해결 안 되면 제가 개인 사비로 보상해 드립니다.`,
      commonEnemy: `결과 책임 안 지는 무책임한 솔루션들`,
      stuntExecution: `7일 이내에 성과 미달 시 100% 보상 공약 또는 7-Day 퍼포먼스 챌린지 선언.`,
      examplePostText: `${cleanCustomer} 여러분, 더 이상 무의미한 지출에 속지 마세요.\n\n7일 동안 ${cleanProduct}를 테스트해보고도 ${cleanPain}이 안 잡히면 직접 책임지겠습니다.`,
      conversionPath: `지금 무료 7일 스프린트 참여하기`,
      royWarning: `실제 제품 퀄리티와 고객 지원 속도가 뒷받침되어야 환불 대란을 막음.`,
    },
  ];
}
