# 숏폼레이더 (가칭) -- 데이터 모델

> 이 문서는 앱에서 다루는 핵심 데이터의 구조를 정의합니다.
> 개발자가 아니어도 이해할 수 있는 "개념적 ERD"입니다.

---

## 전체 구조

```
[Organization] --1:N--> [User]
      |--1:1--> [Subscription]
      |--1:N--> [Client] --1:N--> [Generation] --N:1--> [Video]
      |--1:N--> [Board] --1:N--> [BoardItem] --N:1--> [Video]      (Phase 2)
      |--1:N--> [Topic] (커스텀, org_id 있음)                        (Phase 2)

[Topic] --N:M--> [Channel] --1:N--> [Video] --1:N--> [VideoSnapshot]
                                       |--1:1--> [Transcript]
```

두 덩어리로 나뉩니다.
- **공용 데이터** (Topic·Channel·Video·VideoSnapshot·Transcript): 모든 조직이 같이 보는 수집 결과. 크론이 채움.
- **조직 데이터** (Organization·User·Subscription·Client·Generation·Board): 조직별로 격리. RLS로 보호.

---

## 엔티티 상세

### Organization
에이전시 한 곳. 가입하면 자동으로 하나 생김.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | org_abc | O |
| name | 조직 이름 | 메이크패밀리 | O |
| created_at | 생성일 | 2026-10-22 | O |

### User
로그인하는 사람. Supabase Auth의 사용자와 1:1.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | Supabase auth user id | uuid | O |
| org_id | 소속 조직 | org_abc | O |
| email | 이메일 | a@b.com | O |
| role | owner / member | owner | O |

### Subscription
조직의 요금제 상태.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| org_id | 조직 | org_abc | O |
| plan | free / pro / team | pro | O |
| status | active / past_due / canceled | active | O |
| client_limit | 등록 가능 클라이언트 수 | 10 | O |
| gen_quota | 월 생성 한도 | 100 | O |
| gen_used | 이번 달 사용량 | 37 | O |
| period_end | 결제 주기 종료일 | 2026-11-22 | O |
| toss_billing_key | 토스 빌링키 (암호화) | … | X |

### Client
에이전시가 관리하는 인플루언서 계정 하나.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | cli_1 | O |
| org_id | 소속 조직 | org_abc | O |
| name | 표시 이름 | 호랑이아빠 | O |
| handle | 계정 핸들 | @dragon.tiger_papa | X |
| platform | youtube / instagram | instagram | O |
| topic_ids | 관심 주제 | [육아, 리빙] | O |
| tone | 말투·분위기 | 유쾌한 아빠, 반말, 짧은 문장 | O |
| banned_words | 금지어 | [협찬, 광고] | X |
| notes | 자유 메모 | 아이 얼굴 노출 금지 | X |

### Topic
피드의 탭 하나. `org_id`가 비어 있으면 기본 주제, 있으면 그 조직의 커스텀 주제(Phase 2).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | tp_parenting | O |
| name | 이름 | 육아 | O |
| keywords | 검색 키워드 | [육아, 아기, parenting] | O |
| org_id | 커스텀이면 조직 | null | X |
| sort_order | 탭 순서 | 1 | O |

### Channel
수집 대상 유튜브 채널(시드). 주제와 N:M.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | YouTube channel id | UCxxxx | O |
| title | 채널명 | 호랑이아빠 | O |
| country | KR / US / JP … | KR | O |
| uploads_playlist_id | 업로드 재생목록 id (수집용) | UUxxxx | O |
| topic_ids | 속한 주제 | [tp_parenting] | O |
| last_checked_at | 마지막 수집 시각 | … | O |

### Video
수집된 쇼츠 하나.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | YouTube video id | abc123XYZ | O |
| channel_id | 채널 | UCxxxx | O |
| title | 제목 | 여기도 긁어봐 | O |
| thumbnail_url | 섬네일 | https://i.ytimg.com/… | O |
| published_at | 게시 시각 | 2026-10-22T03:00Z | O |
| duration_sec | 길이(초) | 42 | O |
| topic_ids | 주제 (채널에서 상속) | [tp_parenting] | O |
| country | 국내/해외 (채널에서 상속) | KR | O |
| latest_views | 최신 조회수 (캐시) | 4240000 | O |
| velocity | 시간당 조회수 증가 (캐시) | 282000 | O |
| fetched_at | 마지막 갱신 | … | O |

### VideoSnapshot
한 영상의 시간별 수치. 급상승 계산의 원재료.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| video_id | 영상 | abc123XYZ | O |
| captured_at | 측정 시각 | 2026-10-22T04:00Z | O |
| views | 조회수 | 4240000 | O |
| likes | 좋아요 | 23000 | O |
| comments | 댓글 수 | 1100 | O |

### Transcript
영상 자막. 생성 전에 한 번 뽑아 캐시.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| video_id | 영상 | abc123XYZ | O |
| lang | 언어 | ko | O |
| text | 전체 자막 | "여기도 긁어봐…" | O |
| source | yt_caption / whisper | yt_caption | O |

### Generation
벤치마킹 생성 결과 한 건.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | gen_1 | O |
| org_id | 조직 | org_abc | O |
| client_id | 대상 클라이언트 | cli_1 | O |
| video_id | 원본 영상 | abc123XYZ | O |
| analysis | 원본 분석 (JSON: hook_type, structure, cta, why_viral) | {…} | O |
| script | 우리 버전 스크립트 (마크다운) | "## 훅 …" | O |
| shots | 촬영컷 (JSON 배열: no, scene, line, caption, sec) | [{…}] | O |
| model | 사용 모델 | claude-sonnet-5-5 | O |
| created_at | 생성 시각 | … | O |

### Board / BoardItem (Phase 2)
저장함. Board(org_id, name) → BoardItem(board_id, video_id, memo).

### 관계
- Organization 1곳에 User 여러 명, Subscription 1개, Client 여러 개
- Client 1개에 Generation 여러 건. Generation은 Video 1개를 가리킴
- Topic과 Channel은 N:M (한 채널이 육아·리빙 둘 다 가능)
- Channel 1개에 Video 여러 개, Video 1개에 VideoSnapshot 여러 개(시간별), Transcript 1개

---

## 왜 이 구조인가

- **급상승 = 스냅샷 차분**: 유튜브 API는 "급상승" 정렬을 주지 않음. 매시간 조회수를 찍어 두고 `(현재 조회수 − N시간 전 조회수) / N`으로 직접 계산해야 함. 그래서 VideoSnapshot이 핵심.
- **주제 = 시드 채널 묶음**: 유튜브 `search.list`는 호출당 100유닛이라 하루 100번밖에 못 씀. 채널의 업로드 목록(`playlistItems.list`, 1유닛)과 통계(`videos.list`, 50개당 1유닛)는 싸서, 주제별 시드 채널을 돌리는 방식이 쿼터 안에 들어감. 키워드 검색은 신규 채널 발굴용으로만 하루 몇 번.
- **Video에 velocity 캐시**: 피드 정렬 때마다 스냅샷을 집계하면 느려서, 크론이 계산해 Video에 써 둠.
- **Client에 톤·금지어**: 생성 프롬프트의 재료. "직원 1명이 100명 관리"가 되려면 계정 특성을 사람이 기억하지 않고 여기 적어 둬야 함.
- 확장성: Phase 2 인스타 수집은 Video에 `platform` 컬럼만 추가하면 같은 구조. 커스텀 주제는 Topic.org_id로 이미 자리 있음.
- 단순성: 영상 파일·댓글 본문·채널 통계 이력은 저장하지 않음. YouTube API 약관상 캐시 데이터는 30일 내 갱신·삭제해야 하므로 VideoSnapshot은 30일 지나면 삭제.

---

## [NEEDS CLARIFICATION]

- [ ] 쇼츠 판정: `duration_sec <= 60`만 수집할지, 180초까지 넓힐지 (API는 "쇼츠 여부"를 안 줌)
- [ ] 해외 판정: 채널 `country`가 비어 있는 경우 `defaultLanguage`로 추정할지
- [ ] 스냅샷 보관 기간 30일 → 피드는 48h까지만 쓰므로 7일로 줄여도 되는지
