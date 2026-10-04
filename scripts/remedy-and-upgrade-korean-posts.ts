import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UPGRADED_POSTS: Record<string, { content: string; firstComment: string }> = {
  cmukt6kq30005zjc7s4vtciqy: {
    content: `결산 직후 입사한 시니어 아키텍트들 보면 다 같은 패턴이야.
회사 실적 안 나면 넌 스케이프고트가 되고, 운세 앱은 "올해 대박"이라고만 해.

진짜 문제는 타이밍이 겹쳤다는 거야. 대운 교운기인데 조직 에너지가 하강 중이면? 통장이 많아도 빠져나가.

지금 너 상황 체크해봐.

▶ A. 버팀형: "3년 더 존버하면 직급 올라와" (근데 멘탈이 버틸까?)
▶ B. 이동형: "좋은 회사 제안 들어왔어" (근데 또 반복돼)
▶ C. 준비형: "통장 모아서 대기 중" (기간만 낭비)

👉 당신은 지금 A/B/C 중 어디에 가까워? 댓글로 남겨주면 지금 타이밍에서 제일 주의해야 할 치명타 1가지 답글로 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmukt7cmk000dzjc7r5et6u9w: {
    content: `손절선을 모르고 있는 직장인들 봤냐.
회사 결산 직후 조직개편 되면, 시니어들이 제일 먼저 스케이프고트가 돼. 동료가 그런 상황에 빠져있다면 타이밍이 겹쳤을 가능성이 높아.

체크해봐.

▶ A. 버팀형: 방금 회사 실적 안 나고 조직개편 직후 (손절은 3개월 뒤)
▶ B. 이동형: 한 달에 한 번도 안 쓰는 스킬로 월급 받음 (탈출 고려)
▶ C. 준비형: 이미 관계 깨졌는데 업무로 엮임 (4주간 준비 후 결정)

👉 당신은 지금 A/B/C 중 어디에 가까워? 댓글로 남겨주면 지금 타이밍에서 가장 먼저 끊어내야 할 리스크 1가지 답글로 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmukt7cna000fzjc7noee6wlj: {
    content: `퇴사 고민에 업무 슬랙은 읽씹하고 새벽에 전 애인 생각나? 그건 오행 밸런스가 깨졌다는 신호야.

스타트업 팀리드들 패턴 보면 다 같아. 잡무가 늘면서 자기 전문성을 못 쓰면 뇌가 예전 사람을 꺼내서 현실 도피해.

체크해봐.

▶ A. 이동형: 지난 3개월간 핵심 스킬 5번 미만 씀 (탈출 신호)
▶ B. 준비형: 스킬은 안 쓰지만 팀 성장에 보람 (롤 재협상 신호)
▶ C. 버팀형: 매일 화병 약 찾고 있음 (에너지 보존 신호)

👉 지금 너는 A/B/C 중 어디에 가까워? 댓글로 남겨주면 지금 당장 꺼야 할 불 1가지 팩폭해줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmum5v2h700091j4k07zjkyyz: {
    content: `'네임밸류'보다 센 게 뭔지 알아?

바로 '반복 가능한 시스템'이야. 그리고 그것보다 센 건 '타이밍이 내 손에 있는지'야.
대기업은 네임밸류를 주지만 타이밍은 경영진이 쥐고 있어. 스타트업은 시스템을 만들지만 정체 구간에 빠지면 1년 버티다 번아웃 온다.

사주로 보면 '동업·이직 제안' 타이밍이 대운 전환기인지가 핵심이야.

▶ A. 네임밸류 믿고 존버형
▶ B. 시스템 믿고 이직형
▶ C. 타이밍 볼 때까지 관망형

👉 지금 넌 몇 번에 가까워? 댓글로 남겨주면 네 상황에서 절대 하면 안 되는 악수(惡手) 1가지 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmum5v3k1000b1j4kr18fvhft: {
    content: `신금 일주면서 진술축미 깔려있어? 축하해, 넌 돈 냄새 맡는 감각은 천재인데 손절할 타이밍을 못 본다는 뜻이야.

화개살이 덮고 있거든 더 심해. 떨어질 때 놓는 게 아니라 딱 붙어있다가 떨어지는 순간 모든 걸 다 끌어당겨.

▶ A. 타이밍 못 잡고 존버하는 형
▶ B. 과감하게 손절 후 전환하는 형
▶ C. 손실 방어선 치고 기회 대기형

👉 당신은 지금 A/B/C 중 어디에 가까워? 댓글로 남겨주면 신금 일주가 피해야 할 돈 낭비 패턴 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmum5v5ia000d1j4ku2aeljf6: {
    content: `천을귀인 만난 사람들 보면 하나 같아. 그 사람 손잡고 난 뒤부터 일이 풀린대.

근데 지금 너 손 잡은 사람이 그런 귀인이야, 아니면 하나씩 빨아먹는 뱀파이어야? 사주로 봐야 안다.
도화살 풀셋은 연애로 고생하고, 천을귀인은 다음 판 귀인까지 딸려와.

▶ A. 끝까지 함께할 귀인 상대
▶ B. 지금 즉시 손절해야 할 상극 상대
▶ C. 아직 정체 파악 안 된 물음표 상대

👉 너 지금 누구랑 있어? 댓글로 남겨주면 상대와의 에너지 흐름 1줄 요약해줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=relationship_timing`,
  },
  cmum5v65w000h1j4kbbi0nkn1: {
    content: `'대운 전환'보다 센 게 뭔지 알아? 바로 '납음년(納音年)'이야.

낙하산 팀장이 "올해 대박 난다더라"고 할 때, 그건 10년 단위 대운 얘기야. 납음년은 12년마다 돌아오는 '에너지 완전 초기화 신호'야.
대운이 좋아도 납음년이 안 좋으면 감정적인 이직 결정으로 후회하기 쉬워.

▶ A. 대운만 믿고 즉시 이직형
▶ B. 납음년 보고 일단 존버형
▶ C. 전체 사이클 재점검 대기형

👉 넌 지금 A/B/C 중 어디야? 댓글로 남겨주면 올해 가장 조심해야 할 이직 함정 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmum5v78y000j1j4kya4d0tb3: {
    content: `화개살 터진 사람들 보면 왜 주변이 자꾸 흔들릴까?

스님도 파계시킬 정도의 은은한 매력인데, 정작 본인은 자기 영향력을 몰라.
자기 매력을 무기로 쓸 줄 모르면 3개월 뒤 현타 오고 6개월 뒤 번아웃 온다. 지금 들어온 운의 윈도우를 제대로 잡아야 판이 바뀌어.

▶ A. 매력 폭발기 (실행 중심)
▶ B. 번아웃 잠복기 (충전 중심)
▶ C. 타이밍 대기 (관망 중심)

👉 지금 넌 A/B/C 중 어디에 해당해? 댓글로 남겨주면 지금 단계에서 에너지를 쓰는 법 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=charm_timing`,
  },
  cmum5v87u000l1j4kppdoyjaf: {
    content: `손절할 사람 vs 평생 갈 사람, 사주로 보면 왜 정반대일까?

같은 도화살이라도 한 사람은 날 성장시키고, 다른 사람은 속 쓰리게 해. 매력 차이가 아니라 '기질 궁합의 충돌'이야.
회사에서 성과 가로채기 당하고 있다면 상대와의 '오행 상극' 신호야.

▶ A. 끌리는데 속 쓰린 관계 (상극)
▶ B. 담담한데 일 풀리는 관계 (귀인)
▶ C. 서로 에너지 뺏는 소모 관계 (충)

👉 지금 네 곁엔 A/B/C 중 누가 더 많아? 댓글로 남겨주면 상극 관계 끊어내는 타이밍 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=relationship_timing`,
  },
  cmum5v9xk000r1j4kdleng80f: {
    content: `신금 일주에 진술축미 깔려있으면 왜 치명적 매력과 자기파괴를 오갈까?

돈을 끌어당기는 자성이 강한데 꺼지면 한순간에 날려. 남 눈치 안 보는 기질이라 사업엔 무기지만, 슬럼프 오면 심리 낙차로 다 접어버려.

▶ A. 지금 돌진할 타이밍 (창업/확장)
▶ B. 한 턴 쉬어갈 타이밍 (수성/방어)
▶ C. 판을 새로 짤 타이밍 (피벗)

👉 지금 넌 A/B/C 중 어느 쪽에 가까워? 댓글로 남겨주면 자기파괴 막는 멘탈 가이드 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmum5vata000t1j4kvxjg6cz0: {
    content: `절대 헤어지면 안 되는 궁합이 있어?

만나면 일이 술술 풀리고 더 나은 버전이 되는 사람. 반대로 만나면 자꾸 작아지고 자존감 까이는 사람.
이게 단순 느낌이 아니라 오행 밸런스 상생 vs 상극 문제야.

▶ A. 나를 살리는 귀인 궁합
▶ B. 에너지를 갉아먹는 상극 궁합
▶ C. 서로 무관심한 평행선 궁합

👉 넌 지금 누구랑 있어? 댓글로 남겨주면 오행 궁합에서 제일 먼저 봐야 할 핵심 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=relationship_timing`,
  },
  cmum5vbst000v1j4kt97tlhf8: {
    content: `연봉 1,500 인상 계약서에 왜 선뜻 사인하기 망설여질까? 3개월 뒤 현실이 이렇게 갈린다.

▶ A. 야근 폭탄에 번아웃 와서 병원비로 나감
▶ B. 존버하다 화병 나서 6개월 만에 퇴사
▶ C. 오행 체크하고 입사 타이밍 조율해 대박 기회 잡음

👉 너는 A/B/C 중 어떤 현실로 갈 것 같아? 댓글로 남겨주면 이직 전 반드시 체크해야 할 타이밍 팁 줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
  cmum5vdau000z1j4k9s3a91qd: {
    content: `사주에 진술축미 깔린 사람이 스타트업 가면 왜 5년 뒤 후회할까?

'돈 창고'는 타고났는데 창고 여는 열쇠를 잃어버려서야. 대기업 월급이 열쇠라고 착각하지만, 신금/경금은 '정지 상태에서의 축적'으로만 돈을 키워.
스타트업으로 가면 성장은 해도 통장 잔고 보고 오열한다.

▶ A. 대기업에서 자산 축적형
▶ B. 스타트업에서 지분 승부형
▶ C. 개인 사업으로 독립형

👉 넌 지금 A/B/C 중 어디 타이밍이야? 댓글로 남겨주면 돈 창고 여는 진짜 열쇠 짚어줄게.

(내 정확한 사주 대운 & 오행 분석은 첫 댓글 링크에서 3초 만에 확인 가능)`,
    firstComment: `📍 [무료] 내 사주 대운 교운기 & 오행 결핍 3초 진단하기:
https://www.cosmicpath.app?utm_source=threads&utm_medium=first_comment&utm_campaign=career_timing`,
  },
};

async function main() {
  console.log("Upgrading 13 Korean pending posts with viral hook, firstComment, and visual card URLs...");

  for (const [id, data] of Object.entries(UPGRADED_POSTS)) {
    const cardUrl = `https://thread-uploader.vercel.app/api/cards/${id}`;
    await prisma.post.update({
      where: { id },
      data: {
        content: data.content,
        firstComment: data.firstComment,
        imageUrls: JSON.stringify([cardUrl]),
        qualityScore: 95,
        qualityPass: true,
        errorLog: null,
      },
    });
    console.log(`✅ Upgraded post: ${id}`);
  }

  console.log("All 13 posts upgraded successfully!");
}

main()
  .catch((e) => {
    console.error("Error upgrading posts:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
