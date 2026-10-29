# SNS 운영 비서 -- 데이터 모델

> 이 문서는 앱에서 다루는 핵심 데이터의 구조를 정의합니다.
> 개발자가 아니어도 이해할 수 있는 "개념적 ERD"입니다.
> **원칙: 기존 표를 최대한 재사용한다.** 새 표는 `ClipAsset` 하나다. 실제 스키마 변경과 마이그레이션은 Phase 1a 설계에서 따로 승인받는다 (전역 규칙).

---

## 전체 구조

```
Brand (기존) ─┬─1:N─> ChannelAccount (기존)   instagram / youtube / tiktok 계정 한 줄씩
              ├─1:N─> ClipAsset (새로)         훅 클립 묶음
              └─1:N─> VideoDraft (새로, 2026-10-29 결정)
                          │
                          ├─N:1─> ClipAsset    이 영상에 쓴 훅 클립
                          └─1:N─> Publication (기존) ─N:1─> ChannelAccount
                                   채널마다 1줄 (릴스 1, 쇼츠 1, 틱톡 1)
```

---

## 엔티티 상세

### Brand (기존, 변경 없음)
브랜드 하나. cosmicpath, cosmicpath-global, catchdex 등. `brandConfig`에 영상 설정(포맷 목록, 스타일 이름, 업로드 슬롯, 취소 창 길이)을 JSON으로 추가한다 **[내 판단]**. 칸을 늘리지 않으려는 것이다. `parseBrandConfig`(`src/types/brand.ts`)가 값을 정규화하므로 타입·기본값·테스트를 함께 바꿔야 한다.

### ChannelAccount (기존, 변경 없음)
브랜드의 SNS 계정 하나. 2026-10-26 멀티채널 구조(PR #65)로 이미 만들어져 있다.

토큰 위치 **[내 판단]**: 인스타 토큰은 지금처럼 `Brand.instagramAccessToken`을 계속 읽는다. 이전 마이그레이션은 이번 범위가 아니다. 새로 붙는 유튜브·틱톡 토큰만 `ChannelAccount`에 저장한다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| platform | 어느 SNS | `instagram`, `youtube`, `tiktok` | O |
| mode | 계정 운영 방식 | 기존 값 그대로 | O |
| accessToken / refreshToken / tokenExpiry | 업로드 권한 | (암호값) | X |
| settings | 채널별 설정 JSON | `{"tiktokPrivacy":"SELF_ONLY"}` | O |
| enabled | 켜기/끄기 | true | O |

### ClipAsset (새로)
브랜드 전용 훅 클립 하나. "우리 브랜드 전용 스톡 영상 폴더"라고 보면 된다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | clp_abc123 | O |
| brandId | 어느 브랜드 것인지 | cosmicpath | O |
| source | 어디서 왔나 | `stock` / `ai` / `own` | O |
| fileUrl | 클립 파일 위치 | (저장소 URL) | O |
| license | 출처·라이선스 메모 | `pexels:https://www.pexels.com/video/...` | O |
| mood | 분위기 태그 | `["밤하늘","손"]` | O |
| durationSec | 길이 | 3.2 | O |
| usedCount | 몇 번 썼나 | 4 | O |
| lastUsedAt | 마지막 사용 | 2026-11-02 | X |
| enabled | 끄기/켜기 | true | O |
| createdAt | 만든 날짜 | 2026-10-30 | O |

### VideoDraft (새로)
영상 한 편. **2026-10-29 사용자 결정으로 새 표다.** 처음에는 `TikTokVideoDraft`를 재사용하려 했다. 그런데 기존 `video-jobs` 경로가 그 표를 브랜드·상태만 보고 집어 가고, 완료 시 Threads `Post`를 만든다. 그래서 같은 표를 쓰면 옛 경로가 다시 켜졌을 때 새 영상이 Threads 글로 새어 나갈 수 있다. 칸 목록은 `docs/superpowers/specs/2026-10-29-video-factory-1a-design.md` 6장이 기준이다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| brandId | 어느 브랜드 | cosmicpath | O |
| formatId | 영상 포맷 | `kinetic_list` | O |
| status | 렌더 상태 | `QUEUED` → `RENDERING` → `COMPLETED` / `FAILED` | O |
| script | 원고 JSON (훅·항목·CTA) | — | O |
| captions | 채널별 캡션 JSON | `{"instagram":"…","youtube":"…","tiktok":"…"}` | O |
| voiceMode | 소리 방식 | `bgm_only` / `narration` | O |
| clipAssetId | 쓴 훅 클립 | clp_abc123 | X |
| renderErrors | 품질 검사 실패 이유 | `["글자 잘림: 1.2초"]` | O |
| videoUrl / coverUrl | 완성 영상과 표지 | (Blob URL) | X |
| userVerdict / verdictAt | 사용자 판정 | `good` | X |
| kstDate | 한국 날짜 (하루 편수 계산) | 2026-10-30 | O |
| autoPublishAt / cancelledAt | (1b) 자동 업로드 시각 / 취소 시각 | — | X |

### Publication (기존 + 변경 4개)
채널 하나에 올린 기록. 업로드 상태·외부 URL·조회수 칸이 이미 있다.

필요한 변경 (승인 대상 마이그레이션):
1. `videoDraftId` 칸과 VideoDraft 관계 추가
2. `postId`를 필수에서 선택(NULL 허용)으로. 기존 `@@unique([postId, channelAccountId])`·`@@index([postId])`(`prisma/schema.prisma`)는 유지
3. `@@unique([videoDraftId, channelAccountId])` 추가
4. "`postId`와 `videoDraftId` 중 정확히 하나" CHECK 제약 (Prisma 밖, SQL 마이그레이션)

코드 쪽: `ChannelPlatform` 타입이 지금 `"threads" | "instagram"`만 허용한다 (`src/lib/channels/publication-mirror.ts`). `youtube`·`tiktok` 추가가 필요하다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| **+ videoDraftId** | 어느 영상인지 | vd_123 | X |
| postId | 기존 Threads 글 연결. **필수 → 선택으로 변경 필요** | — | X |
| status | 업로드 상태 | `QUEUED` / `PUBLISHED` / `FAILED` | O |
| platformData | 채널별 부가 정보 | `{"tiktokPrivacy":"SELF_ONLY"}` | O |
| externalUrl / views / likes | 결과와 성과 | — | X |

규칙: `postId`와 `videoDraftId` 중 정확히 하나만 있어야 한다. 같은 영상은 같은 채널에 한 번만 올라간다 (`videoDraftId + channelAccountId` 유일).

### 관계
- 브랜드 1개에 클립 여러 개, 영상 여러 편, 채널 계정 여러 개가 있다.
- 영상 1편은 훅 클립 1개를 쓰고, 채널마다 Publication 1줄을 가진다.

---

## 왜 이 구조인가

- **재사용**: `Publication`·`ChannelAccount`가 "브랜드 → 채널 계정 → 게시 기록" 뼈대로 이미 합쳐져 있다 (2026-10-26 설계). 새로 만들면 같은 것을 두 번 갖게 된다. 단, 영상 원고는 옛 틱톡 경로와 섞이지 않게 새 표 `VideoDraft`에 둔다.
- **확장성**: 카드뉴스(Phase 3)는 `format = carousel`인 VideoDraft로 담거나 별도 표로 만든다. Phase 3 설계에서 정한다. X(Phase 4)는 `ChannelAccount` 한 줄과 Publication이면 된다.
- **비용**: `ClipAsset.source`만 `stock` → `ai`로 바꾸면 2단계 AI 클립 교체가 코드 수정 없이 끝난다.
- **단순성**: 브랜드 영상 설정을 새 표 대신 `brandConfig` JSON에 둔다. 값이 몇 개 안 되고 브랜드당 하나다.

---

## [NEEDS CLARIFICATION]

- 저장소 **[내 판단]**: 기존 렌더와 같은 Vercel Blob 공개 URL (`video/scripts/render-job.mjs`). 인스타는 URL을 넘기고, 유튜브는 파일 업로드, 틱톡은 파일 업로드 방식(`FILE_UPLOAD`)을 써서 URL 도메인 검증을 피한다. 1b 설계에서 공식 문서로 확인한다. 보관은 업로드 후 7일 뒤 삭제하고, 취소된 영상은 바로 삭제한다.
- [ ] `Publication.postId`를 선택으로 바꿀 때 기존 데이터·인덱스 영향 (supabase-postgres-best-practices로 검토)
