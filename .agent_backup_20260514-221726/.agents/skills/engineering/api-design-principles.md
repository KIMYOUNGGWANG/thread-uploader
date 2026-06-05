---
name: api-design-principles
description: Master REST and GraphQL API design principles to build intuitive, scalable, and maintainable APIs that delight developers. Use when designing new APIs, reviewing API specifications, or establishing API design standards.
---

# API Design Principles

Master REST and GraphQL API design principles to build intuitive, scalable, and maintainable APIs that delight developers and stand the test of time.

## Use this skill when

- Designing new REST or GraphQL APIs
- Refactoring existing APIs for better usability
- Establishing API design standards for your team
- Reviewing API specifications before implementation
- Migrating between API paradigms (REST to GraphQL, etc.)
- Creating developer-friendly API documentation
- Optimizing APIs for specific use cases (mobile, third-party integrations)

## Do not use this skill when

- You only need implementation guidance for a specific framework
- You are doing infrastructure-only work without API contracts
- You cannot change or version public interfaces

## Instructions

1. Define consumers, use cases, and constraints.
2. Choose API style and model resources or types.
3. Specify errors, versioning, pagination, and auth strategy.
4. Validate with examples and review for consistency.

## 1. RESTful Standards (from Ours)

- Use appropriate HTTP methods: `GET` (read), `POST` (create), `PATCH`/`PUT` (update), `DELETE` (delete).
- Use plural nouns for resources: `/api/users`, not `/api/getUser`.
- Version APIs: `/api/v1/users`.

## 2. Request/Response Format (from Ours)

- Always return JSON.
- Standard success: `{ "data": { ... }, "meta": { "page": 1 } }`.
- Standard error: `{ "error": { "message": "Reason", "code": 400 } }`.
- Include `request_id` in all responses for tracing.

## 3. Security (from Ours)

- Use Bearer Token (JWT) for authentication.
- Implement rate limiting (e.g., 100 req/min for free tier).
- Never expose internal IDs if UUIDs are available.
- Validate all input on the server side (never trust client).
- Use HTTPS only. Reject plaintext.

## 4. Pagination & Filtering

- Use cursor-based pagination for large datasets.
- Support `?limit=`, `?cursor=`, `?sort=`, `?filter[field]=` query params.

## 5. Versioning Strategy

- URL path versioning preferred: `/api/v1/`, `/api/v2/`.
- Never break existing consumers without deprecation notice.

## Resources

- `resources/implementation-playbook.md` for detailed patterns, checklists, and templates.

## Error Contract Example

```json
{
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "이미 예약된 시간입니다.",
    "requestId": "req_123",
    "details": {
      "slotId": "slot_456"
    }
  }
}
```

## Pagination Example

```http
GET /api/v1/bookings?limit=20&cursor=booking_120&sort=-createdAt
```

```json
{
  "data": [{ "id": "booking_121" }],
  "meta": {
    "nextCursor": "booking_121",
    "limit": 20
  }
}
```

## Review Checklist

- [ ] consumer가 누구인지와 auth 모델이 명확한가?
- [ ] success / error wire shape가 모든 endpoint에서 일관적인가?
- [ ] pagination, filtering, sorting 정책이 문서화됐는가?
- [ ] breaking change 없이 진화 가능한 versioning 전략인가?
