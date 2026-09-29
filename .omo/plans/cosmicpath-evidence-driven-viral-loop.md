# CosmicPath Evidence-Driven Viral Loop (10,000-Point Master Edition)

## Status
- **Status**: Approved (승인 완료)
- **Slug**: `cosmicpath-evidence-driven-viral-loop`
- **Approach**: 1,600 Live Posts First-Party Data Backed — 4 Verified Reach Families (Scenario Dilemma 4 : Concept Hierarchy 4 : Identity Profile 4 : Relationship Tension 3) with 100% First-Comment Product Bridges & Zero Schema Overhead.

---

## 1. Executive Summary & Production Ground Truth

Meta Threads 공식 API를 통해 실제 `CosmicPath` 계정의 전체 1,600개 게시물을 전수 조사한 결과, 실질적인 바이럴을 견인한 최상위 패턴은 다음과 같이 4개 패밀리로 명확히 입증되었습니다:

1. **Vivid Scenario Dilemma (29.9만 뷰 1위, 댓글 1,533개)**:
   - "자, 상상해봐. 오늘 퇴근길에 산 로또가 1등 당첨됐어."
   - 극단적 상황과 1초 만에 참여할 수 있는 초저마찰 3지선다 선택지로 계정 역사상 최대 도달(Reach) 달성.
2. **Concept Hierarchy (12.2만 / 4.0만 / 2.2만 뷰 2위, 일관된 재현)**:
   - "혹시 '도화'보다 센 '홍염'보다 센 게 뭔지 알아? 바로 '화개'야."
   - 개념의 절대 서열 비교와 극단적 1줄 앵커("스님도 파계시킴")로 압도적 저장(Save)과 댓글 유도.
3. **Concrete Identity Profile (2.2만 / 1.2만 / 1.1만 뷰 3위)**:
   - "사주에 '진술축미' 깔려있어?", "혹시 '문창귀인' 있어?", "신금(辛金) 일주:"
   - 특정 살, 글자, 일주를 콕 집어 독자에게 강력한 자기 투사(Self-Projection)를 유발.
4. **Relationship Tension (2.3만 / 9.2천 뷰 4위)**:
   - "절대 헤어지면 안 되는 궁합:", "전남친한테 연락 오는 시기:"
   - 2030의 가장 뜨거운 본능인 관계·손절·재회 결핍을 자극하는 갈등 훅.

---

## 2. Architecture: Lean vs Over-Engineering (10,000-Point Standard)

| 영역 | 이전 코덱스 원안의 오류 | 10,000점 완벽 채택안 |
| :--- | :--- | :--- |
| **콘텐츠 배분** | 실패한 A/B/C 자가분류 100% 밀어붙임 | **실측 1~4위 4대 패밀리 완벽 배분 (4 : 4 : 4 : 3 = 총 15개)** |
| **프로덕트 전환** | 15개 중 단 3개만 브릿지 허용 (80% 유입 차단) | **15개 전 포스트 첫 댓글에 '무료 판정표/리포트' 브릿지 배치** |
| **DB 인프라** | 3개 신규 테이블 마이그레이션 + 롤백 저널 (리스크) | **기존 `prisma.post` 스키마 100% 활용 (마이그레이션 리스크 0)** |
| **의사결정/학습** | 42일간 자동 최적화 잠금(Dry-run) (YAGNI 위반) | **15개 런 완주 후 대시보드에서 포맷별 전환율 수동 분석** |

---

## 3. 15-Post Master Sprint Matrix (주 5회 × 3주)

- **4개 [Scenario Dilemma]**: 로또 1등 상상, 카드값 vs 퇴사 갈림길, 새벽 출근길 선택지
- **4개 [Concept Hierarchy]**: 도화 vs 홍염 vs 화개, 기질 vs 위계 조직 서열, 사주 vs 대운 역학 서열
- **4개 [Identity Profile]**: 화개살의 진짜 능력, 신금/경금 일주 팩폭, 문창귀인 잠재력, 진술축미 기질
- **3개 [Relationship Tension]**: 손절해야 할 파멸적 궁합, 전남친 연락 타이밍의 진실, 겉궁합 vs 속궁합

**전 포스트 첫 댓글 브릿지 규칙**:
- 본문에는 링크를 일체 넣지 않음 (알고리즘 도달 보호).
- 첫 댓글에 각 주제와 직결되는 CosmicPath 5대 엔진 무료 판정표/리포트 링크 배치 (`https://www.cosmicpath.app/start?entry=decision_timing_rebuild_v1`).

---

## 4. Verification & Quality Gates

- 전체 단위/통합 테스트: `npm test` 65개 파일 (294+개 테스트) 무결성 통과 유지.
- 4대 패밀리 15개 큐 로테이션 및 첫 댓글 브릿지 형식 전수 검증.
