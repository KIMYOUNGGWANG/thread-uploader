# 📜 API Spec (Threads Auto Uploader)

## Project Info
- **Project**: Threads Auto Uploader
- **Version**: v1.0
- **Generated**: 2026-03-02
- **Base URL**: `/api`

---

## Authentication
- **Method**: None (Currently Internal/Cron use only)
- *Recommendation*: Add API Key auth for secure `/api/posts` access in future updates.

---

## Endpoints

### Posts Management

| Method | Path | Description | Access |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/posts` | 예약된 포스트 목록 조회 | Public |
| `POST` | `/api/posts` | 단일 포스트 수동 생성 | Public |
| `PATCH` | `/api/posts/:id` | 포스트 내용/스케줄 수정 | Public |
| `DELETE` | `/api/posts/:id` | 포스트 삭제 | Public |
| `POST` | `/api/posts/upload` | Markdown 파일에서 포스트 일괄 파싱 및 등록 | Public |
| `POST` | `/api/posts/reset` | DB 포스트 전체 초기화 | Public |
| `POST` | `/api/posts/:id/publish` | **[신규]** 포스트 즉시 발행 | Public |

#### Request Schemas

```typescript
// POST /api/posts
interface CreatePostRequest {
  content: string;         // 본문 텍스트
  imageUrls?: string[];    // 이미지 URL 배열 (JSON stringified in DB)
  scheduledAt: string;     // ISO 8601 Date string
}

// PATCH /api/posts/:id
interface UpdatePostRequest {
  content?: string;
  imageUrls?: string[];
  scheduledAt?: string;
  status?: "PENDING" | "PUBLISHED" | "FAILED";
}
```

#### Response Schemas

```typescript
// Post 엔티티
interface PostResponse {
  id: string;
  content: string;
  imageUrls: string;       // JSON string
  scheduledAt: string;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  threadsId: string | null;
  createdAt: string;
  errorLog: string | null;
}
```

### Automation & Cron

| Method | Path | Description | Type |
|:-------|:-----|:------------|:-----|
| `POST` | `/api/cron/publish` | 펜딩 포스트 중 시간이 지난 건 발행 트리거 | GitHub/Vercel Cron |
| `POST` | `/api/cron/refresh-token` | Threads API 토큰 만료 전(7일) 자동 갱신 | GitHub/Vercel Cron |

---

## Error Codes

| Code | Meaning | When |
|:-----|:--------|:-----|
| `400` | Bad Request | 입력값 검증 실패 (잘못된 날짜, 내용 없음 등) |
| `404` | Not Found | 리소스 없음 (잘못된 포스트 ID) |
| `500` | Server Error | DB 오류 또는 Threads API 연동 오류 |

---

## Database Tables (Prisma 스키마)

| Table | Structure | Note |
|:------|:------------|:----|
| `Post` | `id`, `content`, `imageUrls`, `scheduledAt`, `status`, `threadsId`, `createdAt`, `errorLog` | 포스트 메인 테이블 |
| `Settings` | `id` ("default"), `accessToken`, `userId`, `tokenExpiry`, `updatedAt` | Threads API 연동 설정 테이블 |

---

## Notes
- `imageUrls`는 배열이지만 DB(`Post.imageUrls`)에는 `JSON.stringify`된 문자열 포맷으로 저장/반환됩니다. `TEXT`, `IMAGE`, `CAROUSEL` 포맷을 자동 감지하여 발행합니다.
- 토큰 갱신 로직은 자동화되어 있으나, 첫 토큰은 환경변수(`THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`)에서 주입됩니다.

> [!IMPORTANT]
> 이 API 스펙은 `/launch` 워크플로우를 통과한 **공식 계약서**입니다. 추후 기능 추가(특히 즉시 발행 버튼 T-04 등) 시 이 문서를 먼저 업데이트하고 코드를 수정해야 합니다. 
