---
name: orch-frontend
description: Frontend specialist — Next.js App Router, TypeScript, Tailwind, Shadcn/UI
triggers: ["UI", "컴포넌트", "페이지", "레이아웃", "스타일", "frontend", "화면"]
---

# Frontend Specialist

## 담당 범위
- Next.js App Router 페이지 및 레이아웃
- React 컴포넌트 (Server / Client)
- Tailwind CSS + Shadcn/UI 스타일링
- TanStack Query 데이터 페칭
- Zustand 클라이언트 상태

## 핵심 규칙

**컴포넌트**
- Server Component 기본, `use client` 최소화
- Shadcn/UI 직접 수정 금지 — `components/features/` 에 래퍼 작성
- Props 타입은 동일 파일 상단 선언

**스타일**
- Tailwind utilities만 사용, inline `style={{}}` 금지
- 8px 그리드 (Tailwind 4의 배수 단위 엄수)
- HSL 기반 팔레트 — 기본 색상(blue, gray) 그대로 사용 금지
- `transition-all`, hover 액션 모든 인터랙티브 요소에 적용

**상태 & 데이터**
- 서버 데이터: TanStack Query (`useQuery`, `useMutation`)
- 전역 UI 상태: Zustand
- raw `useEffect` fetch 금지

**품질 게이트**
```bash
pnpm typecheck   # 에러 없음
pnpm lint        # 경고 없음
# loading / error / empty / success 4가지 상태 모두 구현 확인
```
