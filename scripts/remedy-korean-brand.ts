import { PrismaClient } from "@prisma/client";
import { checkQuality } from "../src/lib/quality-gate";

const prisma = new PrismaClient();

interface PostFix {
  id: string;
  qualityProfile: "career_decision" | "saju_viral";
  content: string;
  firstComment?: string | null;
}

const POST_FIXES: PostFix[] = [
  {
    id: "cmukt6kqt0007zjc7at5m3art",
    qualityProfile: "career_decision",
    content: `착한 척 일 다 받아주다가 상극팀과 일하는 사람들 봤냐?

매사에 "좋습니다" 하던 팀리드가 6개월 뒤 화병으로 병원 다닌다. 자기 스킬은 안 쓰고 계속 잡무만 받아들이니까. 사주 보면 식상과 관성이 극상극인데 자기는 양보만 하는 거야.

지금 당신이 여기에 속하는지 체크해봐.

▶ A. 버팀형: 매달 해야 할 일과 실제 하는 일이 다른데 말 못 함
▶ B. 이동형: 직급은 올랐는데 쓰는 스킬은 5년 전 그대로
▶ C. 준비형: 팀원 요청을 거절 못 하고 밤새 일함

A면 1년 이내 이직 준비. B면 탈출 신호. C면 지금 당장 손절 라인 그어야 함.

당신 상황은 A/B/C 중 어디에 가까워? 저장해두고 체크해봐.`,
  },
  {
    id: "cmukt6ya3000bzjc74k4fds5g",
    qualityProfile: "career_decision",
    content: `스타트업 팀리드가 외부 동업 제안 받을 때 가장 위험한 신호? 지금 하는 일에서 자기 스킬을 3개월에 한 번도 못 쓰고 있다는 거야.

그럼 그 제안이 "기회"처럼 보이겠지. 근데 그건 함정이야. 왜냐면 너는 이미 커리어 불감증 상태라서 판단력이 떨어져 있기 때문.

지금 체크해봐.

A. 버팀형 (존버): 회사에서 월급은 나오는데 스킬 못 씀. 6개월 뒤 화병.
B. 이동형 (탈출): 제안 오자마자 냅다 뜀. 새 회사도 같은 패턴 반복.
C. 준비형 (안전): 3개월 뒤 커리어 맵 그려서 데이터로 검증 후 이동.

당신은 지금 A/B/C 중 어디에 가까워? 저장해두고 셀프체크해봐.`,
  },
  {
    id: "cmukt8v7b000zzjc77wkkj95n",
    qualityProfile: "career_decision",
    content: `퇴사 고민과 야근 끝난 새벽에 전 애인 생각나는 건 운이 아니라 신호야.
그건 넌 아직 커리어 '정리 단계'에 있다는 뜻이고, 다른 사람들은 이미 다음 판을 준비 중이라는 뜻이야.

스타트업 팀 리드들 보면 패턴이 같아. 3개월을 잡무에만 박혀있다가 옛날 생각이 난대. 그럼 2가지 중 하나야.

A. 버팀형 (존버): 지금 팀이 니 성장을 못 막고 있어. 6개월 더 버틸 각.
B. 이동형 (탈출): 지금 배우는 게 0이 맞아. 당장 판 바꿈.
C. 준비형: 포트폴리오 정리하며 4주 뒤 움직임.

어디에 해당해? 저장해두고 당신 선택을 체크해봐.`,
  },
  {
    id: "cmukt97ll0013zjc7zxeo15np",
    qualityProfile: "career_decision",
    content: `회사에서 착한 척하느라 속 다 곪고 이직 타이밍 놓치는 사람들 보면 다 똑같아.
다른 사람 일은 챙기고 자기 일은 자꾸 미루는 거야.

스타트업 팀 리드들 보면 더 심해. 팀 잡무에 박혀서 커리어는 3년 정체되는데, 동업 제안 들어오면 흔들려. 사주로 보면 패턴이 명확해져.

너는 지금 어디?

A. 버팀형: 팀 잡무에서 겨우 벗어난 시점. 아직 손 놓으면 안 됨.
B. 이동형: 이미 팀 내 역할 끝낸 상태. 계약서 보고 움직임.
C. 준비형: 새 프로젝트 준비 중. 타이밍 조율 필요.

본인 상태 A/B/C 중 어디인지 체크하고 저장해봐.`,
  },
  {
    id: "cmukt9it20015zjc709bdw4vg",
    qualityProfile: "career_decision",
    content: `투자 실패와 커리어 번아웃 온 새벽에 전 애인 생각나는 건 운이 아니라 신호야.

그건 넌 아직 '정리 단계'에 있다는 뜻이고, 다른 사람들은 이미 다음 판을 준비 중이라는 뜻이야.

사주에서 진태양시 30분 오차도 안 잡으면 이직 시점이고 투자 타이밍이고 나올 수가 없지.

자, 너는 지금 어디 단계야?

A. 버팀형: 여전히 지나간 타이밍 후회 중 (정리 안 됨)
B. 이동형: 다음 기회 준비 끝내고 실행 신호 대기 (이직형)
C. 준비형: 손실 방어선 치고 관망 중 (준비형)

A/B/C 중 당신 상태를 저장해두고 체크해봐.`,
  },
  {
    id: "cmukt6kq30005zjc7s4vtciqy",
    qualityProfile: "career_decision",
    content: `결산 직후 입사한 시니어 아키텍트들 보면 다 같은 패턴이야.
회사 실적 안 나면 넌 스케이프고트가 되고, 운세 앱은 "올해 대박"이라고만 해.

진짜 문제는 타이밍이 겹쳤다는 거야. 대운 교운기인데 조직 에너지가 하강 중이면? 통장이 많아도 빠져나가.

지금 너 상황 체크해봐.

A. 버팀형: "3년 더 존버하면 직급 올라와" (근데 멘탈이 버틸까?)
B. 이동형: "좋은 회사 제안 들어왔어" (근데 또 반복돼)
C. 준비형: "통장 모아서 대기 중" (기간만 낭비)

지금 넌 A/B/C 중 어디에 가까워? 저장해두고 대운 사이클 체크해봐.`,
  },
  {
    id: "cmukt7cmk000dzjc7r5et6u9w",
    qualityProfile: "career_decision",
    content: `손절선을 모르고 있는 직장인들 봤냐.
회사 결산 직후 조직개편 되면, 시니어들이 제일 먼저 스케이프고트가 돼. 동료가 그런 상황에 빠져있다면 타이밍이 겹쳤을 가능성이 높아.

체크해봐.

A. 버팀형: 방금 회사 실적 안 나고 조직개편 직후. 손절은 3개월 뒤.
B. 이동형: 한 달에 한 번도 안 쓰는 스킬로 월급 받음. 탈출 고려.
C. 준비형: 이미 관계 깨졌는데 업무로 엮임. 4주간 준비 후 결정.

당신은 지금 A/B/C 중 어디에 가까워? 저장해두고 셀프체크해봐.`,
  },
  {
    id: "cmukt7cna000fzjc7noee6wlj",
    qualityProfile: "career_decision",
    content: `퇴사 고민에 업무 슬랙은 읽씹하고 새벽에 전 애인 생각나? 그건 오행 밸런스가 깨졌다는 신호야.

스타트업 팀리드들 패턴 보면 다 같아. 잡무가 늘면서 자기 전문성을 못 쓰면 뇌가 예전 사람을 꺼내서 현실 도피해.

체크해봐.

A. 이동형: 지난 3개월간 핵심 스킬 5번 미만 씀. 탈출 신호.
B. 준비형: 스킬은 안 쓰지만 팀 성장에 보람. 롤 재협상 신호.
C. 버팀형: 매일 화병 약 찾고 있음. 에너지 보존 신호.

지금 너는 A/B/C 중 어디에 가까워? 저장해두고 상태부터 체크해봐.`,
  },
  {
    id: "cmum5v2h700091j4k07zjkyyz",
    qualityProfile: "saju_viral",
    content: `'네임밸류'보다 센 게 뭔지 알아?

바로 '반복 가능한 시스템'이야. 그리고 그것보다 센 건 '타이밍이 내 손에 있는지'야.

대기업은 네임밸류를 주지만 타이밍은 경영진이 쥐고 있어. 스타트업은 시스템을 만들지만 정체 구간에 빠지면 1년 버티다 번아웃 온다.

사주로 보면 '동업·이직 제안' 타이밍이 대운 전환기인지가 핵심이야.

1. 네임밸류 믿고 존버
2. 시스템 믿고 이직
3. 타이밍 볼 때까지 대기

지금 넌 몇 번에 가까워? 저장해두고 셀프체크해봐.`,
  },
  {
    id: "cmum5v3k1000b1j4kr18fvhft",
    qualityProfile: "saju_viral",
    content: `신금 일주면서 진술축미 깔려있어? 축하해, 넌 돈 냄새 맡는 감각은 천재인데 손절할 타이밍을 못 본다는 뜻이야.

화개살이 덮고 있거든 더 심해. 떨어질 때 놓는 게 아니라 딱 붙어있다가 떨어지는 순간 모든 걸 다 끌어당겨.

1. 타이밍 못 잡고 존버
2. 과감하게 손절 후 전환

당신은 지금 몇 번에 가까워? 저장해두고 체크해봐.`,
  },
  {
    id: "cmum5v5ia000d1j4ku2aeljf6",
    qualityProfile: "saju_viral",
    content: `천을귀인 만난 사람들 보면 하나 같아. 그 사람 손잡고 난 뒤부터 일이 풀린대.

근데 지금 너 손 잡은 사람이 그런 귀인이야, 아니면 하나씩 빨아먹는 뱀파이어야? 사주로 봐야 안다.

도화살 풀셋은 연애로 고생하고, 천을귀인은 다음 판 귀인까지 딸려와.

1. 존버해야 할 귀인 상대
2. 지금 손절해야 할 상극 상대

너 지금 누구랑 있어? 저장해두고 생일 체크해봐.`,
  },
  {
    id: "cmum5v65w000h1j4kbbi0nkn1",
    qualityProfile: "saju_viral",
    content: `'대운 전환'보다 센 게 뭔지 알아? 바로 '납음년(納音年)'이야.

낙하산 팀장이 "올해 대박 난다더라"고 할 때, 그건 10년 단위 대운 얘기야. 납음년은 12년마다 돌아오는 '에너지 완전 초기화 신호'야.

대운이 좋아도 납음년이 안 좋으면 감정적인 이직 결정으로 후회하기 쉬워.

1. 대운만 믿고 이직
2. 납음년 보고 존버
3. 타이밍 재점검

넌 몇 번이야? 저장해두고 생일 체크해봐.`,
  },
  {
    id: "cmum5v78y000j1j4kya4d0tb3",
    qualityProfile: "saju_viral",
    content: `화개살 터진 사람들 보면 왜 주변이 자꾸 흔들릴까?

스님도 파계시킬 정도의 은은한 매력인데, 정작 본인은 자기 영향력을 몰라.

자기 매력을 무기로 쓸 줄 모르면 3개월 뒤 현타 오고 6개월 뒤 번아웃 온다. 지금 들어온 운의 윈도우를 제대로 잡아야 판이 바뀌어.

1. 매력 폭발기 (실행)
2. 번아웃 잠복기 (충전)
3. 타이밍 대기 (관망)

지금 넌 몇 번 상태야? 저장해두고 확인해봐.`,
  },
  {
    id: "cmum5v87u000l1j4kppdoyjaf",
    qualityProfile: "saju_viral",
    content: `손절할 사람 vs 평생 갈 사람, 사주로 보면 왜 정반대일까?

같은 도화살이라도 한 사람은 날 성장시키고, 다른 사람은 속 쓰리게 해. 매력 차이가 아니라 '기질 궁합의 충돌'이야.

회사에서 성과 가로채기 당하고 있다면 상대와의 '오행 상극' 신호야.

1. 끌리는데 속 쓰린 관계 (상극)
2. 담담한데 일 풀리는 관계 (귀인)

지금 네 곁엔 몇 번이 많아? 저장해두고 체크해봐.`,
  },
  {
    id: "cmum5v9xk000r1j4kdleng80f",
    qualityProfile: "saju_viral",
    content: `신금 일주에 진술축미 깔려있으면 왜 치명적 매력과 자기파괴를 오갈까?

돈을 끌어당기는 자성이 강한데 꺼지면 한순간에 날려. 남 눈치 안 보는 기질이라 사업엔 무기지만, 슬럼프 오면 심리 낙차로 다 접어버려.

1. 지금 돌진할 타이밍 (창업)
2. 한 턴 쉬어갈 타이밍 (수성)

지금 넌 어느 쪽에 가까워? 저장해두고 자성 흐름을 체크해봐.`,
  },
  {
    id: "cmum5vata000t1j4kvxjg6cz0",
    qualityProfile: "saju_viral",
    content: `절대 헤어지면 안 되는 궁합이 있어?

만나면 일이 술술 풀리고 더 나은 버전이 되는 사람. 반대로 만나면 자꾸 작아지고 자존감 까이는 사람.

이게 단순 느낌이 아니라 오행 밸런스 상생 vs 상극 문제야.

1. 나를 살리는 귀인 궁합
2. 에너지를 갉아먹는 상극 궁합

넌 지금 누구랑 있어? 저장해두고 궁합 체크해봐.`,
  },
  {
    id: "cmum5vbst000v1j4kt97tlhf8",
    qualityProfile: "saju_viral",
    content: `연봉 1,500 인상 계약서에 왜 선뜻 사인하기 망설여질까? 3개월 뒤 현실이 이렇게 갈린다.

1. 야근 폭탄에 번아웃 와서 퇴직금으로 카드값 메꿈
2. 존버하다 화병 나서 병원비로 월급 다 나감
3. 오행 체크하고 입사 타이밍 조율해 대박 기회 잡음

너는 몇 번 현실로 갈 거 같아? 저장해두고 타이밍 확인해봐.`,
  },
  {
    id: "cmum5vdau000z1j4k9s3a91qd",
    qualityProfile: "saju_viral",
    content: `사주에 진술축미 깔린 사람이 스타트업 가면 왜 5년 뒤 후회할까?

'돈 창고'는 타고났는데 창고 여는 열쇠를 잃어버려서야. 대기업 월급이 열쇠라고 착각하지만, 신금/경금은 '정지 상태에서의 축적'으로만 돈을 키워.

스타트업으로 가면 성장은 해도 통장 잔고 보고 오열한다.

1. 대기업에서 축적
2. 스타트업에서 승부

넌 지금 몇 번 타이밍이야? 저장해두고 체크해봐.`,
  },
];

async function main() {
  const isApply = process.argv.includes("--apply");
  console.log(`\n========================================`);
  console.log(`🔧 CosmicPath 국문 브랜드 품질 치유 및 복구`);
  console.log(`모드: ${isApply ? "🚀 APPLY (실제 적용)" : "🔍 DRY RUN (시뮬레이션)"}`);
  console.log(`========================================\n`);

  console.log("1. 품질 게이트 전수 검증...");
  for (let i = 0; i < POST_FIXES.length; i++) {
    const fix = POST_FIXES[i];
    const res = checkQuality(fix.content, fix.qualityProfile);
    if (!res.pass) {
      console.error(`  ❌ [${i + 1}/${POST_FIXES.length}] ID: ${fix.id} 검증 실패:`, res.reasons);
      throw new Error(`포스트 ${fix.id} 품질 검증 실패!`);
    }
    console.log(`  ✅ [${(i + 1).toString().padStart(2)}/${POST_FIXES.length}] ID: ${fix.id} 통과 (score: ${res.score})`);
  }
  console.log("\n모든 18개 포스트 품질 검증 100% PASS 확인 완료.");

  if (!isApply) {
    console.log("\n[DRY RUN 완료] DB에 실제 반영하려면 --apply 플래그를 추가하십시오.");
    return;
  }

  // 1. FAILED 포스트 5건 ARCHIVED 정리
  const failedClean = await prisma.post.updateMany({
    where: { brandId: "cmqpj5tjf0002eize6v2ui2lg", status: "FAILED" },
    data: { status: "ARCHIVED", imageUrls: "[]" },
  });
  console.log(`\n2. FAILED 불량 포스트 정리 완료: ${failedClean.count}건 -> ARCHIVED`);

  // 2. 18개 포스트 DB 반영 및 스케줄 재배치
  // 오늘(10/4) 18:00 KST부터 5개 타임슬롯(09, 12, 18, 21, 23) 기반으로 순차 분산
  console.log("\n3. 18개 포스트 DB 업데이트 및 스케줄링 재배치 시작...");
  
  // 현재 시점 이후 타임슬롯 생성 (KST = UTC+9)
  const now = new Date();
  const scheduleSlots: Date[] = [];
  
  // 오늘 남은 슬롯: 18:00, 21:00, 23:00 KST (UTC 09:00, 12:00, 14:00)
  const kstToday = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kstToday.getUTCFullYear();
  const month = kstToday.getUTCMonth();
  const date = kstToday.getUTCDate();
  
  const dailyKstHours = [9, 12, 18, 21, 23];
  
  for (let dayOffset = 0; scheduleSlots.length < POST_FIXES.length; dayOffset++) {
    for (const kstHour of dailyKstHours) {
      // Create date in UTC corresponding to kstHour on dayOffset
      const slotUtc = new Date(Date.UTC(year, month, date + dayOffset, kstHour - 9, 0, 0));
      if (slotUtc.getTime() > now.getTime() + 15 * 60 * 1000) { // 최소 15분 이후 슬롯
        scheduleSlots.push(slotUtc);
        if (scheduleSlots.length >= POST_FIXES.length) break;
      }
    }
  }

  for (let i = 0; i < POST_FIXES.length; i++) {
    const fix = POST_FIXES[i];
    const scheduledAt = scheduleSlots[i];

    await prisma.post.update({
      where: { id: fix.id },
      data: {
        content: fix.content,
        qualityPass: true,
        qualityScore: 4,
        qualityReasons: "[]",
        status: "PENDING",
        scheduledAt,
        errorLog: null,
      },
    });

    const kstString = new Date(scheduledAt.getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 16) + " KST";

    console.log(`  ✅ [${(i + 1).toString().padStart(2)}/${POST_FIXES.length}] ID: ${fix.id} -> PENDING | 예정: ${kstString}`);
  }

  console.log(`\n🎉 CosmicPath 국문 브랜드 총 18건 치유 및 PENDING 큐 재스케줄링 완료!`);
}

main()
  .catch((err) => {
    console.error("실행 오류:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
