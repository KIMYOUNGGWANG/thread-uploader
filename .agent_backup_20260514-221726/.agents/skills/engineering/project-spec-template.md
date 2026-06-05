---
name: project-spec-template
description: 프로젝트 시작 시 기술 스택 및 아키텍처 명세 템플릿. Next.js/Supabase 기본 스택과 Neon/Clerk 대안 스택 정의, FSD Lite 패턴, 핵심 기능 및 DB 스키마 초안. 새 프로젝트 설정, 스택 결정, 아키텍처 문서화 시 사용.
risk: safe
---

# 🏗️ Project Spec Template

> **The Blueprint.**
> Copy this to `conductor/project-spec.md` at the start of every project.

## 1. Tech Stack (The Golden Standard)

| Layer | Plan A (Default) 🚀 | Plan B (Emergency/Stability) 🛡️ |
|:------|:-------------------|:-------------------------------|
| **Framework** | Next.js 14+ (App Router) | — |
| **Language** | TypeScript | — |
| **Styling** | TailwindCSS + Shadcn/UI | — |
| **Database** | **Supabase (PostgreSQL)** | **Neon (Serverless Postgres)** |
| **Auth** | **Supabase Auth** | **Clerk** |
| **ORM** | — (Supabase JS Client) | Drizzle ORM |
| **State** | Zustand | — |
| **Query** | TanStack Query | — |

## 2. Architecture Rules

- **Pattern**: Feature-Sliced Design (FSD) Lite
- **API**: Route Handlers (`app/api/...`)
- **Validation**: Zod (for API inputs)
- **Error Handling**: Standardize via `utils/error.ts`

## 3. Core Features
*(List the top 3-5 features here)*
- [ ] Feature 1: ...
- [ ] Feature 2: ...

## 4. Database Schema (Draft)
*(Briefly describe core tables)*
- `users`: id, email, created_at
- ...

---
> [!TIP]
> **Why Plan B?**
> If Supabase experiences outage or scaling issues, switch DB to **Neon** and Auth to **Clerk**.
> The rest of the stack (Next.js, Tailwind, Zustand) remains unchanged.
