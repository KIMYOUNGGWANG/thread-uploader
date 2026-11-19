# 뉴스 데스크 -- 데이터 모델

> 2026-11-19. 스키마는 사용자 승인을 받았다 (Phase 1 계획 승인). 반대 검토 2회 결과는 `docs/superpowers/plans/2026-11-19-news-desk-phase1.md` 끝에 있다.

## 전체 구조
```
Brand 1─N NewsItem 1─N NewsVariant (플랫폼당 1개)
NewsItem ··· ChannelUpload (sourceKey = "news:<newsItemId>", FK 없음, 플랫폼 계정당 1행)
```

## 엔티티 상세

### NewsItem (신규)
기사 하나. 원문, 메모, 팩트, 이미지를 담는다.
- `sourceUrl`(정리된 URL), `sourceTitle`, `sourceText`(최대 20,000자), `rawMode`, `operatorNote`
- `facts`: JSON `[{ text, evidence, verified }]`
- `media`: JSON `[{ url, sha256, name, bytes }]`, 최대 5개, Vercel Blob URL만, 순서 = 전송 순서

### NewsVariant (신규)
플랫폼별 원고. `@@unique([newsItemId, platform])`.
- `platform`: `telegram | threads | kakao` (Phase 2: `linkedin | facebook`)
- `text`, `revision`(글·이미지가 바뀔 때마다 +1), `approvedRevision`(revision과 같을 때만 승인됨), `approvedAt`
- `lockedAt`: 발행을 시작한 시각(카카오는 "보냈어"). 잠긴 동안 수정·재승인 불가
- `manualDoneAt`: 카카오 "보냈어" 시각

### ChannelUpload (기존, 변경 없음)
- 텔레그램·Threads 발행은 새 kind `"post"`(글 + 이미지 0~5장) 행으로 들어간다.
- 기존 유니크 키 `(channelAccountId, sourceKey)`가 플랫폼당 1번만 생기게 막는다.

## 규칙 (전부 `src/lib/newsdesk/approval.ts` 한 곳)
- 승인은 화면에서 본 revision일 때만 된다 (`updateMany where {id, revision, lockedAt: null}`).
- 글을 바꾸는 함수는 하나뿐이고 revision을 같이 올린다.
- 이미지 변경은 잠긴 원고가 없을 때만 되고, 모든 원고의 revision을 올린다.
- 발행은 한 트랜잭션에서 원고 선점(`lockedAt`) + 업로드 행 생성. 행 생성이 실패하면 선점도 롤백된다.
- FAILED/CANCELED 행 재사용은 그 상태일 때만 조건부로 한다.
- 모닝 리포트의 [재시도]는 `news:` 행을 거부한다. 다시 보내기는 데스크에서만 한다.

## 왜 이 구조인가
- Post 테이블을 안 쓴다: Post는 X 크로스포스트, 인스타 카드뉴스, autopilot 슬롯·쿼터, 길이 실험, winner-replay, auto-plug가 모두 읽는다. 뉴스가 그 흐름에 섞이면 승인 안 한 채널로 나간다.
- 원고를 플랫폼별 행으로 둔다: 승인·revision·잠금이 플랫폼마다 따로 움직이기 때문이다.
- JSON 문자열 칸: 기존 스키마 관례(`imageUrls`, `platformData`)를 따른다.

## [NEEDS CLARIFICATION]
- 없음
