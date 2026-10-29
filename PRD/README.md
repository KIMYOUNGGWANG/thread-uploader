# SNS 운영 비서 -- 디자인 문서

> Show Me The PRD로 생성됨 (2026-10-29)
> 이전 PRD(숏폼레이더, 2026-10-22, 에이전시용 SaaS)는 [archive/2026-10-22-shortform-radar/](./archive/2026-10-22-shortform-radar/)로 옮겼다.

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 뭘 만드는지, 안 만드는 것, 사용자 결정, 레퍼런스 | 프로젝트 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 데이터 구조 (기존 표 재사용 + ClipAsset) | DB 설계할 때 |
| [03_PHASES.md](./03_PHASES.md) | 1a 영상 공장 → 1b 3채널 업로드 → 2 보고판 → 3 카드뉴스 → 4 X | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택, 금지 목록, 채널 제약 | AI에게 코드 시킬 때마다 |

## 다음 단계

1. [03_PHASES.md](./03_PHASES.md)의 "Phase 1a 시작 프롬프트"로 superpowers:brainstorming → writing-plans
2. 1a 첫 작업은 영상 레퍼런스 통합 문서와 브랜드 스타일 샘플 2~3개
3. 스키마 변경(ClipAsset, VideoDraft 칸, Publication.videoDraftId)은 1a 설계에서 supabase-postgres-best-practices 검토 후 승인

## 미결 사항

- [ ] 취소 창 길이 (제안: 3시간)
- [ ] cosmicpath 브랜드 스타일 (샘플 보고 선택)
- [ ] 내레이션 무료 TTS 엔진
- [ ] 틱톡 앱 심사 신청 시점
- [ ] 유튜브 채널 (새로 만들지, 기존 것을 쓸지)
- [ ] 영상·클립 파일 저장소와 보관 기간
- [ ] `TikTokVideoDraft` → `VideoDraft` 이름 변경 여부
- [ ] CI 렌더용 한글 폰트
- [ ] 비평 단계(LLM 비전) 사용 여부와 월 비용 상한
