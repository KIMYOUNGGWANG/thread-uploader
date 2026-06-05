---
name: error-handling
description: 풀스택 에러 핸들링 표준 패턴. Backend API 에러 응답, React Error Boundary, Toast/전체화면 에러 구분, 재시도 정책. 에러 처리 코드 작성 및 리뷰 시 사용.
---

# 🛡️ Error Handling

Standardized error handling patterns for fullstack applications.

## Backend (API Routes / Edge Functions)
```typescript
// Standard error response
function errorResponse(code: number, message: string, details?: string) {
  return new Response(JSON.stringify({
    error: { code, message, details }
  }), { status: code, headers: { 'Content-Type': 'application/json' } });
}

// Usage
try {
  const result = await riskyOperation();
  return Response.json(result);
} catch (err) {
  console.error('[API] /endpoint:', err);
  return errorResponse(500, 'Internal server error');
}
```

## Frontend (React)
1. **Error Boundary**: Wrap major sections, not every component.
2. **Fallback UI**: Show user-friendly message, not raw error.
3. **Toast for recoverable errors**: Network timeout, validation fail.
4. **Full-page for fatal errors**: Auth expired, server down.

## Rules
1. **Never swallow errors silently** (`catch {}` is forbidden).
2. **Always log with context**: `[Module] action: error message`.
3. **User-facing messages in Korean**, dev logs in English.
4. **Retry policy**: Network errors get 3 retries with exponential backoff.
5. **Graceful degradation**: Show cached/stale data if API fails.

## Anti-Patterns
- ❌ `catch (e) { /* ignore */ }`
- ❌ Showing raw stack traces to users
- ❌ Generic "Something went wrong" without recovery action
- ✅ "네트워크 오류가 발생했습니다. 다시 시도해주세요." + Retry button

## Error Matrix

| 상황 | 사용자 메시지 | 로그 레벨 | 재시도 |
|------|---------------|-----------|--------|
| 입력 검증 실패 | 입력값을 확인해주세요 | info | 없음 |
| 권한 부족 | 권한이 없습니다 | warn | 없음 |
| 네트워크 일시 실패 | 네트워크 오류가 발생했습니다 | warn | 3회 |
| 외부 API 장애 | 잠시 후 다시 시도해주세요 | error | 3회 |
| 내부 서버 예외 | 잠시 후 다시 시도해주세요 | error | 없음 |

## Retry Helper

```typescript
export async function withRetry<T>(
  action: () => Promise<T>,
  maxRetries = 3,
) {
  let lastError: unknown;

  for (let retryIndex = 0; retryIndex < maxRetries; retryIndex += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, 300 * 2 ** retryIndex),
      );
    }
  }

  throw lastError;
}
```

## Review Checklist

- [ ] 에러마다 사용자 메시지와 개발자 로그가 분리되어 있는가?
- [ ] 에러가 발생한 요청 경로와 주요 식별자가 로그에 남는가?
- [ ] 재시도가 가능한 오류와 불가능한 오류를 구분했는가?
- [ ] toast, inline error, full-page error가 상황에 맞게 선택됐는가?
