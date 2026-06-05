---
name: "source-command-archived-content"
description: "Marketing Strategy + Media Production (Legacy workflow)"
---

# source-command-archived-content

Use this skill when the user asks to run the migrated source command `archived-content`.

## Command Template

# 📣 Content (Brand Factory v6.0)

> [!WARNING]
> Legacy workflow. Prefer the core loop first and only use this when you intentionally need the old content-production flow.

마케팅 전략 수립부터 콘텐츠 제작(YouTube, TikTok, Blog)까지 **비즈니스 콘텐츠 올인원**.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: Content is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Smart Skill Discovery** ⚡: Run `bash .agent/scripts/smart-skill-loader.sh "marketing copywriting seo youtube tiktok content viral startup market" --concat --strict` → read `.agent/memory/current_loaded_skills.md`.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.

---

## Phase A: 마케팅 전략 (구 `/marketing`)

### 1. [AGENT] Strategist: Market Intel
- [ ] **Spy**: Identify top 3 competitors.
- [ ] **Angle**: Define "The Gap"—what competitors are missing.

### 2. [AGENT] Copywriter: Emotional Hook
- [ ] **Drafting**: Write copy using anti-AI copywriting rules.
- [ ] **AI Filter**: No "Unlock", "Elevate", etc. — human language only.

### 3. [AGENT] Critic Gate — Authenticity Audit ♻️
- [ ] **Evaluate**: Does the copy read like a human wrote it?
- [ ] **PASS** → Proceed to Phase B.
- [ ] **FAIL** → Re-dispatch copywriter. Max 2 retries.

### 4. [AGENT] Viral Growth: Loop Design
- [ ] **Loop**: Plan growth mechanisms and viral hooks.

---

## Phase B: 미디어 제작 (구 `/studio`)

### 5. [AGENT] Strategist: Content Planning
- [ ] **Research**: Identify trending topics.
- [ ] **Hook**: Design viral hooks using Phase A insights.

### 6. [AGENT] Writer: Script Generation
- [ ] **YouTube**: Generate long-form script.
- [ ] **TikTok**: Generate short-form script.
- [ ] **Blog**: Transform script to article.

### 7. [AGENT] Producer: Asset Prep
- [ ] **SEO**: Optimize metadata (Title, Description, Tags).
- [ ] **Thumbnail**: Propose thumbnail concepts (Text-to-Image prompts).

### 8. [AGENT] Critic Gate — Content Quality ♻️
- [ ] **Evaluate**: Is the content engaging? Is it human-sounding?
- [ ] **PASS** → Present to user.
- [ ] **FAIL** → Revise scripts. Max 2 retries.

### 9. [AGENT] Workflow Transition
- [ ] **Present**: Use `notify_user` with `BlockedOnUser: true` to present all generated content (IN KOREAN).

---
> [!IMPORTANT]
> **Language Protocol**: Agent internal = English. User reports = Korean.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "CONTENT" "[Summary of content session]"`
