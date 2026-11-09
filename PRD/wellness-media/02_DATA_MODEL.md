# 웰니스 미디어 -- 데이터 모델

> 앱에서 다루는 핵심 데이터의 구조. 개발자가 아니어도 이해할 수 있는 "개념적 ERD"다.
> 원칙: Portfolio Growth OS에 이미 있는 테이블은 그대로 쓰고, 없는 것만 추가한다.
> 실제 스키마 변경은 구현 단계에서 승인을 받은 뒤 한다.

---

## 전체 구조

```
Brand(웰니스 미디어 프로필) ─1:N─> ContentSource(출처) ─1:N─> SourceArticle(수집 기사)
      │                                                         │ N
      │                                                         │ (PostArticle: 글 하나에 기사 여러 개)
      │                                                         │ N
      └─1:N─> Post(콘텐츠, 기존) ─1:N─> PostSlide(카드 장, 신규)
                   │
                   └─1:N─> Publication / ChannelUpload(채널별 게시, 기존) ── 성과 필드 포함
Brand.brandConfig.bannedTerms(금지 표현 사전) ── 검수 때 참조
```

| 인터뷰에서 합의한 엔티티 | 실제 구현 위치 | 신규/기존 |
|---|---|---|
| Source | `ContentSource` | 신규 |
| Article | `SourceArticle` | 신규 |
| PostArticle | `PostArticle` | 신규 (연결 테이블) |
| Post | `Post` | 기존 (필드 일부 추가) |
| Slide | `PostSlide` | 신규 |
| Publication | `Publication`(main), `ChannelUpload`(PR #128) | 기존 |
| Metric | `Publication`·`ChannelUpload`의 성과 필드 | 기존 (저장·공유 필드 추가 검토) |
| BannedTerm | `Brand.brandConfig` JSON의 `bannedTerms` | 기존 필드 활용 |

---

## 엔티티 상세

### ContentSource (신규)
글감을 가져올 출처.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | cs_01 | O |
| brandId | 어느 제품 프로필의 출처인지 | wellness-media | O |
| name | 출처 이름 | Well+Good | O |
| url | RSS 주소 | https://.../feed | O |
| type | rss / manual | rss | O |
| lang | 언어 | en | O |
| active | 수집 여부 | true | O |
| createdAt | 만든 날짜 | 2026-11-10 | O |

### SourceArticle (신규)
수집한 기사 한 건.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | sa_01 | O |
| sourceId | 출처 | cs_01 | O |
| url | 기사 주소 (중복 방지 기준, brand별 유일) | https://... | O |
| title | 제목 | Erewhon raises prices again | O |
| summary | AI 요약 3줄 | ... | X |
| publishedAt | 기사 날짜 | 2026-11-09 | X |
| score | 글감 점수 0~100 | 82 | X |
| formatHint | trend_list / celeb_business / mindset | celeb_business | X |
| status | new / selected / skipped | new | O |
| createdAt | 수집 시각 | 2026-11-10 05:00 | O |

### PostArticle (신규, 연결)
글 하나가 기사 여러 개를 참고할 수 있다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| postId | 콘텐츠 | p_01 | O |
| articleId | 기사 | sa_01 | O |

### Post (기존, 추가 필드만)
기존 필드 `content`(스레드 글), `topic`, `formulaId`, `hookType`, `ctaType`, `status`, `scheduledAt`, `qualityReasons`를 그대로 쓴다.

| 추가 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| instagramCaption | 인스타 캡션 (스레드 글과 다름) | 💜...💜 | X |
| complianceFlags | 걸린 금지 표현 목록 JSON | [{"term":"불면증 개선","suggestion":"잠드는 루틴"}] | X |

### PostSlide (신규)
카드 한 장.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | ps_01 | O |
| postId | 콘텐츠 | p_01 | O |
| order | 순서 1~10 | 1 | O |
| headline | 큰 글씨 | 립밤 케이스 하나로 1조 | O |
| body | 본문 | ... | X |
| template | 템플릿 이름 | magazine-cover | O |
| imageUrl | 렌더된 PNG 주소 | https://.../ps_01.png | X |

### Publication / ChannelUpload (기존)
채널별 게시 상태와 성과. 인스타 캐러셀은 PR #128의 `ChannelUpload(kind=carousel)` 흐름을 쓴다.
성과는 기존 `likes`, `replies`/`comments`, `views`를 쓰고, 인스타 **저장·공유** 필드가 없으면 추가를 검토한다.

### bannedTerms (기존 `Brand.brandConfig` JSON)
```json
{ "bannedTerms": [ { "term": "불면증 개선", "category": "disease", "suggestion": "잠드는 루틴" } ] }
```
category: disease(질병) / efficacy(효능 단정) / supplement(건기식)

---

## 관계
- 웰니스 미디어 프로필(Brand) 1개가 여러 출처를 가진다
- 출처 1개가 여러 기사를 가진다
- 글(Post) 1개가 여러 기사를 참고하고, 여러 카드 장을 가진다
- 글 1개가 채널마다 게시 기록을 1개씩 가진다

---

## 왜 이 구조인가

- **확장성**: 출처·기사 테이블에 `brandId`가 있어서 Phase 3에서 다른 고객사(B2B)를 붙여도 뼈대가 그대로다.
- **단순성**: 게시·성과는 이미 검증된 기존 테이블을 쓴다. 금지 표현은 브랜드마다 다른 작은 목록이라 별도 테이블 대신 `brandConfig` JSON에 둔다. 사전이 수백 개로 커지거나 여러 고객사가 공유해야 할 때 테이블로 뺀다.

---

## [NEEDS CLARIFICATION]

- [ ] 기존 `carousel-cards`가 카드 텍스트를 Post에서 파싱하는 방식인지 확인하고, `PostSlide`가 꼭 필요한지 결정
- [ ] 인스타 인사이트 API로 저장·공유 수를 받을 수 있는지와 권한 범위
- [ ] 스키마 변경은 구현 전에 승인 요청 (DB 규칙)
