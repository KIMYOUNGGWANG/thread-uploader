# 📜 API Spec (Threads Auto Uploader)

## Project Info
- **Project**: Threads Auto Uploader
- **Version**: v1.1
- **Updated**: 2026-04-08
- **Base URL**: `/api`

---

## Authentication
- **Method**: None
- **Current scope**: Internal dashboard + cron usage
- **Release risk**: All write endpoints are currently unauthenticated. Add API key or session auth before exposing beyond trusted use.

---

## Endpoints

### Posts Queue

| Method | Path | Description | Access |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/posts` | 전체 포스트 목록 조회 | Public |
| `POST` | `/api/posts` | 포스트 배열 생성 및 큐 삽입 | Public |
| `PATCH` | `/api/posts/:id` | 포스트 내용/상태/예약시간 수정 | Public |
| `DELETE` | `/api/posts/:id` | 단일 포스트 삭제 | Public |
| `DELETE` | `/api/posts/reset` | `PENDING` 포스트 전체 삭제 | Public |
| `POST` | `/api/posts/:id/publish` | 단일 포스트 즉시 발행 | Public |

#### Request Schemas

```typescript
interface ParsedPost {
  content: string;
  images: string[];
  scheduledAt: string | null;
  firstComment?: string;
}

// POST /api/posts
interface CreatePostsRequest {
  posts: ParsedPost[];
  insertAtFront?: boolean;
}

// PATCH /api/posts/:id
interface UpdatePostRequest {
  content?: string;
  imageUrls?: string; // DB raw value
  scheduledAt?: string;
  status?: "PENDING" | "PUBLISHED" | "FAILED";
  threadsId?: string | null;
  errorLog?: string | null;
  firstComment?: string | null;
}
```

#### Response Schemas

```typescript
interface PostResponse {
  id: string;
  content: string;
  imageUrls: string[]; // API response is parsed array
  scheduledAt: string;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  threadsId: string | null;
  createdAt: string;
  errorLog: string | null;
  firstComment: string | null;
}

interface CreatePostsResponse {
  success: true;
  count: number;
  posts: Array<{
    id: string;
    scheduledAt: string;
    status: "PENDING";
  }>;
}
```

### Immediate Upload

| Method | Path | Description | Access |
|:-------|:-----|:------------|:-----|
| `POST` | `/api/posts/upload` | DB 저장 없이 Threads에 즉시 발행 | Public |

```typescript
interface ImmediateUploadRequest {
  content: string;
  imageUrls?: string[];
  firstComment?: string;
}

interface ImmediateUploadResponse {
  success: true;
  threadsId: string;
  replyId: string | null;
  replyError: string | null;
  message: string;
}
```

### AI Generation

| Method | Path | Description | Access |
|:-------|:-----|:------------|:-----|
| `POST` | `/api/generate` | AI로 포스트와 첫댓글을 생성해 `PENDING` 큐에 저장 | Public |

```typescript
interface GenerateRequest {
  count?: number; // 1..300, default 30
  insertAtFront?: boolean;
}

interface GenerateResponse {
  success: true;
  count: number;
}
```

### Automation & Cron

| Method | Path | Description | Type |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/cron/publish` | 가장 오래된 `PENDING` 포스트 1개를 FIFO 순서로 발행 | GitHub/Vercel Cron |
| `GET` | `/api/cron/refresh-token` | Threads API 토큰 상태 확인 및 필요 시 갱신 | GitHub/Vercel Cron |

#### Cron Security
- `CRON_SECRET`가 설정된 경우 `Authorization: Bearer <secret>` 헤더 또는 `?secret=` 쿼리가 필요함

---

## Error Codes

| Code | Meaning | When |
|:-----|:--------|:-----|
| `400` | Bad Request | 입력값 검증 실패 |
| `401` | Unauthorized | Cron secret 불일치 |
| `404` | Not Found | 잘못된 포스트 ID |
| `500` | Server Error | DB 오류 또는 Threads API 오류 |

---

## Database Tables (Prisma)

| Table | Structure | Note |
|:------|:----------|:-----|
| `Post` | `id`, `content`, `imageUrls`, `scheduledAt`, `status`, `threadsId`, `createdAt`, `errorLog`, `firstComment` | 발행 큐 + 발행 결과 |
| `Settings` | `id`, `accessToken`, `userId`, `tokenExpiry`, `updatedAt` | Threads API 토큰 저장 |

---

## Notes
- DB의 `Post.imageUrls`는 문자열 컬럼이며 `JSON.stringify`된 배열을 저장함.
- `GET /api/posts`에서는 `imageUrls`를 다시 배열로 파싱해서 반환함.
- 첫댓글은 `Post.firstComment`에 저장되며, 즉시 발행/cron 발행 모두 본문 발행 뒤 재시도 로직을 거쳐 답글로 업로드됨.
- `scheduledAt`은 절대 시간 스케줄러라기보다 FIFO 순서 보장을 위한 정렬 키로도 사용됨.
- `/api/posts/upload`는 이름과 달리 “파일 업로드 파싱” 엔드포인트가 아니라 “즉시 Threads 발행” 엔드포인트임.

> [!IMPORTANT]
> 코드와 계약이 어긋나면 ship 게이트에서 먼저 문서를 갱신하거나 구현을 되돌려야 한다.
