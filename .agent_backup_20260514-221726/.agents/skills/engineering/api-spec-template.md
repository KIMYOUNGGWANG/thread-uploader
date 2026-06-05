---
name: api-spec-template
description: REST API 명세서 생성 템플릿. 엔드포인트, TypeScript 인터페이스, 인증, 에러코드, DB 스키마 정의. /plan 워크플로우에서 docs/api-spec.md 생성 시 사용. Contract-First 개발의 핵심 산출물.
---

# 📜 API Spec Template (The Contract)

`docs/api-spec.md` 생성 시 이 템플릿을 사용. 모든 섹션을 빠짐없이 채울 것.

---

## API 설계 원칙

1. **명사 기반 URL**: `/dreams` (O) — `/getDreams` (X)
2. **복수형 리소스**: `/dreams/:id` — 단수 금지
3. **HTTP 메서드 의미 준수**: GET(조회), POST(생성), PATCH(부분수정), PUT(전체교체), DELETE(삭제)
4. **일관된 응답 구조**: 성공/에러 모두 동일한 envelope 패턴
5. **버저닝**: URL 기반 `/api/v1/` 또는 헤더 기반
6. **인증 일관성**: 모든 보호 엔드포인트는 동일한 인증 방식 사용

---

## Project Info

- **Project**: [Project Name]
- **Version**: v1.0
- **Generated**: [Date]
- **Base URL**: `/api`
- **Auth Method**: Bearer Token (Supabase JWT)

---

## Authentication

```
Header: Authorization: Bearer <supabase-jwt-token>
```

- 공개 엔드포인트: Auth 불필요
- 보호 엔드포인트: 모든 요청에 Bearer 토큰 필수
- RLS: DB 레벨에서 추가 보호 (이중 방어)

---

## Endpoints

### [Feature Name]

| Method | Path | Description | Auth | Cache |
|:-------|:-----|:------------|:-----|:------|
| `GET` | `/api/resource` | 목록 조회 (페이지네이션) | ✅ | 60s |
| `GET` | `/api/resource/:id` | 단건 조회 | ✅ | 30s |
| `POST` | `/api/resource` | 새 리소스 생성 | ✅ | - |
| `PATCH` | `/api/resource/:id` | 부분 수정 | ✅ | - |
| `DELETE` | `/api/resource/:id` | 삭제 | ✅ | - |

#### Request Schema

```typescript
// POST /api/resource
interface CreateResourceRequest {
  name: string;          // Required. 1-100자
  description?: string;  // Optional. 최대 500자
  category: string;      // Required. 유효한 카테고리 ID
}

// PATCH /api/resource/:id
interface UpdateResourceRequest {
  name?: string;
  description?: string;
  category?: string;
}
```

#### Response Schema

```typescript
// 단건 성공 (200/201)
interface ResourceResponse {
  id: string;            // UUID v4
  name: string;
  description: string | null;
  category: string;
  userId: string;        // 소유자 ID
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

// 목록 (200)
interface ResourceListResponse {
  data: ResourceResponse[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}
```

---

## Error Codes

| Code | Meaning | When |
|:-----|:--------|:-----|
| `400` | Bad Request | 유효하지 않은 입력값 |
| `401` | Unauthorized | 토큰 없음/만료 |
| `403` | Forbidden | 권한 없음 (타인 리소스) |
| `404` | Not Found | 리소스 없음 |
| `409` | Conflict | 중복 데이터 |
| `422` | Unprocessable | 비즈니스 로직 위반 |
| `429` | Too Many Requests | Rate limit 초과 |
| `500` | Server Error | 서버 내부 오류 |

```typescript
// 모든 에러 공통 응답
interface ErrorResponse {
  error: {
    code: number;
    message: string;      // 사용자 노출용 (한국어)
    details?: string;     // 개발자용 디버깅 정보
  }
}
```

---

## Database Tables

| Table | Key Columns | RLS | Index |
|:------|:------------|:----|:------|
| `resources` | `id uuid PK`, `user_id uuid FK`, `name text`, `category text`, `created_at timestamptz` | ✅ | `user_id`, `created_at` |

### RLS 정책 패턴

```sql
-- 본인 데이터만 조회
CREATE POLICY "own_select" ON resources
  FOR SELECT USING (auth.uid() = user_id);

-- 본인 데이터만 수정/삭제
CREATE POLICY "own_modify" ON resources
  FOR ALL USING (auth.uid() = user_id);
```

---

## Query Parameters

| Param | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `page` | number | 1 | 페이지 번호 |
| `pageSize` | number | 20 | 페이지당 항목 수 (max: 100) |
| `sort` | string | `created_at` | 정렬 기준 필드 |
| `order` | `asc\|desc` | `desc` | 정렬 방향 |

---

## Notes

- 모든 타임스탬프: ISO 8601 형식 (`2026-03-18T10:00:00.000Z`)
- 모든 ID: UUID v4
- 빈 목록: `{ data: [], pagination: { total: 0, ... } }` (404 아님)
- Soft delete 고려: `deleted_at` 컬럼 추가 옵션

> [!IMPORTANT]
> 이 스펙은 **바인딩 계약**. Frontend/Backend 모두 이 스키마를 정확히 준수.
> 스펙 변경 시 반드시 버전 업 후 양쪽 동시 업데이트.
