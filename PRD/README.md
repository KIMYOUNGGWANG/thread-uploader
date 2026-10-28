# 숏폼레이더 (가칭) -- 디자인 문서

> Show Me The PRD로 생성됨 (2026-10-22)
> 출발점: https://www.threads.com/@makefamily_/post/DexxF6NE6lF

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 뭘 만드는지, 누가 쓰는지, 안 만드는 것 | 프로젝트 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 데이터 구조 (급상승 = 스냅샷 차분) | DB 설계할 때 |
| [03_PHASES.md](./03_PHASES.md) | 1a 피드 → 1b 생성·결제 → 2 → 3 | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택, 금지 목록, 쿼터 계산 | AI에게 코드 시킬 때마다 |
| [05_TECH_SPEC.md](./05_TECH_SPEC.md) | API 계약, 생성 스키마, 크론 명세, 에러·RLS·테스트 | 2단계 spec 쓸 때, 구현 중 |

## 다음 단계

1. 아래 미결 사항 중 **이름·주제 목록·자막 방식** 3개를 먼저 정한다
2. `PRD/03_PHASES.md`의 Phase 1a → superpowers:brainstorming → writing-plans
3. 스키마가 나오면 supabase-postgres-best-practices로 검토 후 승인

## 미결 사항

- [ ] 서비스 이름 (가칭 "숏폼레이더")
- [ ] 기본 주제 8~10개 + 주제별 시드 채널 50개 큐레이션 (1회 수작업)
- [ ] 쇼츠 판정 길이 (60초 vs 180초)
- [ ] 자막 추출 방식 (비공식 timedtext vs 외부 전사 API) — 자막 없는 영상 처리 포함
- [ ] 요금 (Free / Pro ₩49,000 / Team ₩149,000 가안)
- [ ] 해외 영상 → 한국어 스크립트 생성 여부 (기본: 한국어)
- [ ] 해외 판정 기준 (channel.country 비어 있을 때)
- [ ] 스냅샷 보관 기간 (7일 vs 30일)
- [ ] Edge Function 시간 제한 내 수집 가능 여부
- [ ] 토스 정기결제 심사 준비 (사업자·서비스 URL)
- [ ] 비공식 자막 엔드포인트의 Edge Function 호출 가능 여부
- [ ] Claude structured output 지원 범위
- [ ] 빌링키 암호화 방식 (Vault vs pgsodium)
