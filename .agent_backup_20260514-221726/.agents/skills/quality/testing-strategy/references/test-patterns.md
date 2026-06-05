# Test Patterns — Code Templates

## Unit Test: AAA Pattern (Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { calculateTotal } from '@/features/cart/utils';

describe('calculateTotal', () => {
  it('should return 0 for empty items', () => {
    // Arrange
    const items: CartItem[] = [];
    
    // Act
    const result = calculateTotal(items);
    
    // Assert
    expect(result).toBe(0);
  });
});
```

## Zustand Store Test

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCartStore } from '@/features/cart/store';

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it('should add item to cart', () => {
    const { result } = renderHook(() => useCartStore());
    
    act(() => {
      result.current.addItem({ id: '1', name: 'Test', price: 1000, quantity: 1 });
    });
    
    expect(result.current.items).toHaveLength(1);
  });
});
```

## TanStack Query Test

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserProfile } from '@/features/user/hooks';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useUserProfile', () => {
  it('should fetch user profile', async () => {
    const { result } = renderHook(() => useUserProfile('user-123'), {
      wrapper: createWrapper(),
    });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Test User');
  });
});
```

## API Route Integration Test

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/users/route';
import { NextRequest } from 'next/server';

describe('POST /api/users', () => {
  it('should create user with valid data', async () => {
    const request = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', name: 'Test' }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(201);
  });
  
  it('should reject invalid email', async () => {
    const request = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', name: '' }),
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

## E2E Test (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Authentication Flow', () => {
  test('should sign up, login, and access dashboard', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('[data-testid="email-input"]', 'new@test.com');
    await page.fill('[data-testid="password-input"]', 'StrongPass123!');
    await page.click('[data-testid="signup-button"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
```

## Vitest Config Reference

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '*.config.*'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```
