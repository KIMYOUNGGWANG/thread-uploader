# 뉴스 데스크 -- 디자인 문서

> 2026-11-19 작성. 사용자가 준 레퍼런스 스크린샷(SNS_Auto "AI 코워크 v1.1")과 플랫폼 공식 문서 조사로 채웠다 (Show Me The PRD 인터뷰는 생략).
> Portfolio Growth OS에 붙는 확장 기능이다. 저장소 전체 PRD는 상위 `PRD/`에 있다.

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 뭘 만드는지, 누가 쓰는지 | 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 데이터 구조와 중복 발행 방지 규칙 | DB·발행 코드 만질 때 |
| [03_PHASES.md](./03_PHASES.md) | 단계별 계획 | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | AI 규칙 | AI에게 코드 시킬 때마다 |

Phase 1 상세 계획(반대 검토 2회 결과 포함): [`docs/superpowers/plans/2026-11-19-news-desk-phase1.md`](../../docs/superpowers/plans/2026-11-19-news-desk-phase1.md)

## 미결 사항
- 레퍼런스 앱은 어두운 테마, 이 앱은 밝은 테마다. Phase 1은 앱 톤을 따른다 (가정).
- 링크드인 댓글 권한(`w_member_social_feed`)을 셀프서비스로 받을 수 있는지 (Phase 2 전에 확인).
- Threads 컨테이너가 한 번만 발행되는지 (Phase 1 어댑터는 발행 전 상태 확인으로 대비).
