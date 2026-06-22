# CosmicPath Viral Upgrade Plan

## TL;DR
> **Summary**: CosmicPath should stop chasing reply-heavy "comment and I will answer" virality and move toward low-operator-burden participation: self-classification comments, saveable decision mini-tools, wedge-specific series, and a formula/quality/metrics loop that learns which formats create replies, saves, profile visits, and report starts.
> **Deliverables**:
> - New CosmicPath viral formula taxonomy
> - Updated generation prompts and campaign defaults
> - Quality gates for self-classification, save/share, and non-repetitive hooks
> - Manual viral swipe-file workflow
> - 7-day evidence sprint dashboard/summary criteria
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 3 -> Task 5 -> Task 7 -> Final Verification

## Context

### Original Request
The user asked whether there are more viral directions for CosmicPath and explicitly invoked `omo:ulw-plan`.

### Interview Summary
- CosmicPath is a 3-layer analysis report service, not a prediction app.
- User does not want a comment strategy that requires them to answer every reply.
- Existing generated posts can feel repetitive.
- Threads posts must stay under 500 characters.
- Current preferred brand frame: "question reception", "3-layer analysis", "action narrowing", "calm not exploitative".

### Research Summary
- `.agent/memory/brand-voice.md`: CosmicPath must avoid future certainty, partner-mind claims, and fear-based fortune language.
- `.agent/memory/task_board.md`: current product mission is Portfolio Growth OS with a 7-day evidence sprint.
- `.agent/memory/brainstorm.md`: previous best direction was Campaign Conversion Loop; Reply Ops was only backup and auto-reply/DM is out of scope.
- `src/types/campaign.ts`: current campaign formulas still lean on `comment_diagnosis`, `friend_tag`, `self_confession`; `comment_diagnosis` can imply answer burden.
- `src/app/api/generate/route.ts`: generator supports campaign prompts, recent-post avoidance, angle variations, and structure variations.
- `src/lib/viral-analysis.ts`: viral scoring already rewards questions, lists, contrast words, CTAs, and 80-450 character length, but does not explicitly reward self-classification or save/share utility.
- Third-party 2026 Threads marketing sources consistently point to replies/conversation depth as important reach heuristics, but these are not official weighting disclosures and must be treated as hypotheses.

### Metis Review (gaps addressed)
Metis subagents were spawned but timed out without substantive output. Direct gap review identified the major contradiction: Threads appears conversation-driven, but user constraints reject high-touch reply ops. The plan resolves this by using self-classification and save/share mechanics rather than personal comment diagnosis.

## Work Objectives

### Core Objective
Upgrade CosmicPath's viral system so generated content creates more low-touch engagement and stronger report intent without increasing operator reply burden or violating the brand's non-predictive positioning.

### Deliverables
- A new campaign formula set centered on self-classification, save/share mini-tools, and wedge-specific decision prompts.
- Generation prompt rules that make comments optional, low-touch, and not reply-dependent.
- Quality gates that fail overclaiming, repetitive, reply-burden CTAs, and generic self-help.
- Viral memory improvements so manual examples and owned winners teach the generator specific structures.
- A 7-day evidence sprint playbook for deciding whether the new viral direction works.

### Definition of Done
- `npm run test -- --run src/app/api/generate/route.test.ts src/lib/quality-gate.test.ts src/lib/viral-analysis.test.ts` exits 0 after implementation.
- `npm run typecheck` exits 0.
- HTTP scenario against `/api/generate` creates posts with self-classification or save/share mechanics, no reply promise, no over-500-character body, and non-duplicate first lines.
- Dashboard/campaign summary shows the generated batch tied to a campaign and exposes metrics needed for the 7-day evidence sprint.
- Manual review confirms generated posts preserve CosmicPath tone: calm, non-predictive, no partner-mind guarantee, no "I will answer you" burden.

### Must Have
- Comments are used as low-touch self-classification only.
- Every formula must work even if the operator never replies.
- Every post should have one clear native engagement target: reply choice, save, share/tag, profile visit, or first-comment link.
- Link cadence remains conservative; link-heavy posting is not the default.
- Generated body stays within the shared Threads limit.

### Must NOT Have
- No auto-replies, auto-DMs, auto-follows, or artificial engagement.
- No "comment and I will read/diagnose/answer you" promise.
- No "상대 마음 알려줌", "100% 맞춘다", "미래 보장", or "무조건 연락해라" style claims.
- No broad generic "좋은 일이 올 거예요" filler.
- No campaign that requires the user to manually answer every commenter.

## Recommended Viral Direction

### Primary Direction: Self-Classification Decision Loops
Use comments as a low-effort classification action, not as a support inbox.

Examples:
- `A/B/C/D 중 어디에 가까워?`
- `연락 / 대기 / 축소 / 보류 중 하나만 고르면 됨`
- `버팀형 / 이동형 / 준비형`
- `확장 / 보수 / 정리 / 보류`

Why: It creates replies without requiring operator responses and reinforces CosmicPath's core product action: narrowing choices.

### Secondary Direction: Saveable Decision Mini-Tools
Create posts designed to be saved or shared because they act like tiny decision aids.

Examples:
- "연락 전 4칸 체크"
- "이직 밀기 전 3가지 조건"
- "하반기 움직임/대기/축소/보류 구분표"
- "질문이 흐려질 때 보는 3단분석 순서"

Why: It reduces reliance on reply depth and fits the calm "접수실" brand.

### Backup Direction: Manual Swipe File Before More Automation
Seed 30-50 high-performing adjacent posts manually, then run the existing viral memory system.

Why: The app already has viral memory infrastructure, but empty or weak memory means generation falls back to generic patterns.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed after implementation.
- Test decision: TDD with Vitest for generation prompt helpers, quality gates, campaign normalization, and viral analysis.
- QA policy: Each implementation task includes agent-run HTTP/CLI scenarios.
- Evidence path: `.omo/evidence/task-{N}-cosmicpath-viral-upgrade.{ext}`

## Execution Strategy

### Parallel Execution Waves
Wave 1: Task 1, Task 2, Task 3
Wave 2: Task 4, Task 5, Task 6
Wave 3: Task 7, Task 8
Final: F1-F4 verification

### Dependency Matrix
| Task | Depends On | Blocks |
| --- | --- | --- |
| 1 | none | 4, 5, 7 |
| 2 | none | 4, 6 |
| 3 | none | 5, 6 |
| 4 | 1, 2 | 7 |
| 5 | 1, 3 | 7 |
| 6 | 2, 3 | 7 |
| 7 | 4, 5, 6 | 8 |
| 8 | 7 | Final |

## TODOs

- [x] 1. Replace reply-burden campaign formulas with low-touch viral formulas

  **What to do**: In `src/types/campaign.ts`, update CosmicPath campaign formula language so `comment_diagnosis` becomes self-classification, not diagnosis-by-operator. Add or rename formulas around `self_classification`, `saveable_checklist`, and `friend_share` if the type system requires it. Preserve compatibility for existing stored campaign IDs by normalizing legacy `comment_diagnosis` into the new self-classification behavior.
  **Must NOT do**: Do not remove legacy campaigns in a way that breaks existing database configs. Do not promise operator replies.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 7 | Blocked By: none

  **References**:
  - Pattern: `src/types/campaign.ts` - current `CAREER_TIMING_WEDGE_399` and `PRODUCT_GROWTH_BASELINE` campaign formula defaults.
  - Pattern: `.agent/memory/brand-voice.md` - non-predictive, action-narrowing language.
  - Constraint: `.agent/memory/task_board.md` - no automatic comments/DMs.

  **Acceptance Criteria**:
  - [x] Legacy `comment_diagnosis` configs normalize safely.
  - [x] Default CosmicPath formulas no longer instruct "분류해준다" or "상황을 쓰면 답해준다".
  - [x] At least one default formula creates A/B/C or 4-way self-classification.
  - [x] At least one default formula creates save/share utility without requiring comments.

  **QA Scenarios**:
  ```text
  Scenario: Legacy campaign normalization keeps old configs usable
    Tool: bash
    Steps: npm run test -- --run src/types/brand.test.ts src/app/api/brands/route.test.ts
    Expected: Tests pass and legacy campaign IDs still normalize.
    Evidence: .omo/evidence/task-1-campaign-formulas.txt

  Scenario: No reply-promise language in defaults
    Tool: bash
    Steps: node -e "const fs=require('fs'); const s=fs.readFileSync('src/types/campaign.ts','utf8'); if(/분류해준|알려주|답글|진단해준/.test(s)) process.exit(1)"
    Expected: Exit code 0 after legacy-safe wording is removed or isolated in tests.
    Evidence: .omo/evidence/task-1-no-reply-promise.txt
  ```

  **Commit**: YES | Message: `feat(viral): add low-touch campaign formulas` | Files: `src/types/campaign.ts`, related tests

- [x] 2. Add a CosmicPath viral mode guide to brand memory

  **What to do**: Update `.agent/memory/brand-voice.md` with a new section that defines three viral modes: `self_classification`, `saveable_tool`, and `quiet_contrarian`. Include examples, banned CTAs, and preferred conversion language.
  **Must NOT do**: Do not reintroduce "AI 운명 예측" language.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 6 | Blocked By: none

  **References**:
  - Pattern: `.agent/memory/brand-voice.md` - existing brand DNA, good hooks, forbidden expressions.
  - Pattern: `src/app/api/generate/route.ts` - generation prompt consumes product/campaign context, not this markdown directly; this memory guides operator setup.

  **Acceptance Criteria**:
  - [x] The memory explicitly says comments must be self-classification, not personalized reply requests.
  - [x] The memory includes 10 example hooks across relationship, career, money, and monthly-flow wedges.
  - [x] The memory includes a "save/share" format library.

  **QA Scenarios**:
  ```text
  Scenario: Brand memory contains viral mode definitions
    Tool: bash
    Steps: rg "self_classification|saveable_tool|quiet_contrarian|자기분류|저장" .agent/memory/brand-voice.md
    Expected: All mode terms or Korean equivalents are present.
    Evidence: .omo/evidence/task-2-brand-memory.txt

  Scenario: Forbidden reply-burden CTA is absent
    Tool: bash
    Steps: rg "댓글.*답|댓글.*봐줄|사연.*남겨" .agent/memory/brand-voice.md; test $? -eq 1
    Expected: No forbidden reply-promise CTA appears.
    Evidence: .omo/evidence/task-2-no-reply-burden.txt
  ```

  **Commit**: YES | Message: `docs(brand): define CosmicPath viral modes` | Files: `.agent/memory/brand-voice.md`

- [x] 3. Expand generation variation from surface structure to intent-level viral modes

  **What to do**: In `src/app/api/generate/route.ts`, replace or augment `ANGLE_VARIATIONS` and `STRUCTURE_VARIATIONS` with explicit viral intent modes: self-classification, saveable checklist, myth-busting, case file, decision rubric, friend-share. Pass the selected mode into the prompt with clear "what success looks like" instructions.
  **Must NOT do**: Do not only add more adjectives to the prompt; this must change output incentives.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 6 | Blocked By: none

  **References**:
  - Pattern: `src/app/api/generate/route.ts` - current `ANGLE_VARIATIONS`, `STRUCTURE_VARIATIONS`, `buildExperiment`, and `buildGenerationPrompt`.
  - Pattern: `src/lib/viral-analysis.ts` - current structure/CTA detection.

  **Acceptance Criteria**:
  - [x] Generated prompt includes one explicit viral mode per post.
  - [x] Prompt bans reply-dependent CTA across all modes.
  - [x] Prompt includes separate success metric per mode: replies, saves, shares, profile visits, or link clicks.

  **QA Scenarios**:
  ```text
  Scenario: Prompt exposes viral mode and success metric
    Tool: bash
    Steps: npm run test -- --run src/app/api/generate/route.test.ts -t "includes viral mode"
    Expected: Test passes and assertion confirms mode + metric are in prompt.
    Evidence: .omo/evidence/task-3-generate-prompt.txt

  Scenario: Prompt avoids operator-reply promises
    Tool: bash
    Steps: npm run test -- --run src/app/api/generate/route.test.ts -t "bans reply-dependent CTA"
    Expected: Test passes and generated prompt contains the ban.
    Evidence: .omo/evidence/task-3-reply-ban.txt
  ```

  **Commit**: YES | Message: `feat(generate): add viral intent modes` | Files: `src/app/api/generate/route.ts`, `src/app/api/generate/route.test.ts`

- [x] 4. Add quality gate checks for low-touch engagement and overclaim safety

  **What to do**: Extend `src/lib/quality-gate.ts` and `src/lib/product-quality-gate.ts` so CosmicPath/career/product growth posts fail when they require operator replies, overclaim prediction, or lack a concrete low-touch engagement mechanic. Add helper patterns for self-classification, save/share, and profile/link CTA.
  **Must NOT do**: Do not make the quality gate so strict that all non-comment posts fail.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 1, 2

  **References**:
  - Pattern: `src/lib/quality-gate.ts` - career decision quality checks.
  - Pattern: `src/lib/product-quality-gate.ts` - product hook/relevance/CTA checks.
  - Constraint: `src/lib/threads-limits.ts` - shared 500-character limit already enforced.

  **Acceptance Criteria**:
  - [x] Posts with "댓글 남기면 봐줄게" fail.
  - [x] Posts with "상대 마음 알려준다" or "100% 맞춘다" fail.
  - [x] Posts with valid A/B/C self-classification pass when other criteria are met.
  - [x] Posts with save/share mini-tool pass when other criteria are met.

  **QA Scenarios**:
  ```text
  Scenario: Reply-burden CTA fails
    Tool: bash
    Steps: npm run test -- --run src/lib/quality-gate.test.ts -t "fails reply-burden CTA"
    Expected: Test is RED before implementation, GREEN after.
    Evidence: .omo/evidence/task-4-reply-burden-gate.txt

  Scenario: Self-classification CTA passes
    Tool: bash
    Steps: npm run test -- --run src/lib/quality-gate.test.ts -t "passes self-classification CTA"
    Expected: Test is RED before implementation, GREEN after.
    Evidence: .omo/evidence/task-4-self-classification-gate.txt
  ```

  **Commit**: YES | Message: `feat(quality): gate low-touch viral mechanics` | Files: `src/lib/quality-gate.ts`, `src/lib/product-quality-gate.ts`, related tests

- [x] 5. Teach viral analysis to recognize self-classification and save/share mechanics

  **What to do**: Extend `src/lib/viral-analysis.ts` and `src/types/viral.ts` if needed so learned patterns can distinguish `self_classification`, `saveable_tool`, `friend_share`, and `quiet_contrarian` structures. Make recommendations actionable enough to feed generation.
  **Must NOT do**: Do not break existing viral memory parsing; old memory must normalize.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 1, 3

  **References**:
  - Pattern: `src/lib/viral-analysis.ts` - `detectStructureType`, `detectCtaType`, `buildPatternRecommendation`.
  - Type: `src/types/viral.ts` - `ViralPatternDimension`, `ViralMemory`.
  - Pattern: `src/lib/viral-service.ts` - saved examples use analysis output.

  **Acceptance Criteria**:
  - [x] A/B/C and 4-way choice posts are classified distinctly.
  - [x] "저장", "보내줘", "친구에게" style posts are classified distinctly.
  - [x] Recommendations mention the mechanic, not just generic "use list".

  **QA Scenarios**:
  ```text
  Scenario: Self-classification is analyzed distinctly
    Tool: bash
    Steps: npm run test -- --run src/lib/viral-analysis.test.ts -t "detects self-classification"
    Expected: Test is RED before implementation, GREEN after.
    Evidence: .omo/evidence/task-5-self-classification-analysis.txt

  Scenario: Save/share tool is analyzed distinctly
    Tool: bash
    Steps: npm run test -- --run src/lib/viral-analysis.test.ts -t "detects saveable tool"
    Expected: Test is RED before implementation, GREEN after.
    Evidence: .omo/evidence/task-5-saveable-analysis.txt
  ```

  **Commit**: YES | Message: `feat(viral): classify participatory mechanics` | Files: `src/lib/viral-analysis.ts`, `src/types/viral.ts`, related tests

- [x] 6. Add a manual swipe-file seed workflow for CosmicPath

  **What to do**: Use the existing manual viral example adapter to define an operator workflow for importing 30-50 adjacent examples. Add docs or UI copy that tells the operator what kinds of examples to paste: decision tools, relationship timing posts, career anxiety posts, quiet contrarian posts, and saveable frameworks.
  **Must NOT do**: Do not scrape private data or bypass official access. Do not auto-ingest low-quality accounts without approval.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 2, 3

  **References**:
  - Pattern: `src/types/viral.ts` - `ManualViralExample`.
  - Pattern: `src/lib/viral-service.ts` - manual adapter and viral memory learning.
  - Pattern: `src/components/BrandSettingsForm.tsx` - viral source settings surface.

  **Acceptance Criteria**:
  - [x] Operator can understand what examples to collect without extra instruction.
  - [x] Manual examples can be learned into viral memory.
  - [x] Weak/generic examples are excluded or marked low value by scoring guidance.

  **QA Scenarios**:
  ```text
  Scenario: Manual example import documents target examples
    Tool: bash
    Steps: rg "decision tool|self-classification|saveable|quiet contrarian|수동" README.md docs .agent/memory
    Expected: Operator-facing instructions exist.
    Evidence: .omo/evidence/task-6-swipe-file-docs.txt

  Scenario: Manual examples still parse
    Tool: bash
    Steps: npm run test -- --run src/lib/viral-service.test.ts src/lib/viral-analysis.test.ts
    Expected: Tests pass without breaking manual adapter behavior.
    Evidence: .omo/evidence/task-6-manual-viral-tests.txt
  ```

  **Commit**: YES | Message: `docs(viral): add CosmicPath swipe-file workflow` | Files: docs/memory/UI copy as chosen by executor

- [x] 7. Run a 7-day evidence sprint with a constrained content matrix

  **What to do**: Define a 28-post matrix: 7 self-classification, 7 saveable tools, 7 quiet contrarian, 7 friend-share/case-file. Use conservative link cadence. Track views, replies, reposts, clicks, profile visits if available, report starts, and paid conversions manually.
  **Must NOT do**: Do not judge by views alone. Do not change multiple unrelated variables during the sprint.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 8 | Blocked By: 4, 5, 6

  **References**:
  - Pattern: `.agent/memory/task_board.md` - 7-day evidence sprint.
  - Pattern: `src/app/api/campaigns/summary/route.ts` - campaign summary metrics.
  - Pattern: `src/components/Dashboard.tsx` - campaign summary and manual metrics UI.

  **Acceptance Criteria**:
  - [x] Batch contains exactly four mode groups with 7 posts each.
  - [x] Every post has one primary engagement target.
  - [x] Campaign summary can distinguish quality pass/fail and linked posts.
  - [x] Operator has a next-action rule after 7 days.

  **QA Scenarios**:
  ```text
  Scenario: Generate constrained 28-post sprint
    Tool: HTTP call
    Steps: curl -i -X POST http://localhost:3000/api/generate -H 'Content-Type: application/json' -d '{"brandId":"<qa-brand-id>","count":28,"campaignId":"career_timing_wedge_399","approvedCampaignStart":true}'
    Expected: HTTP 200 and body includes "count":28; sampled posts show all four viral modes.
    Evidence: .omo/evidence/task-7-generate-sprint.http

  Scenario: Campaign summary reports sprint status
    Tool: HTTP call
    Steps: curl -i 'http://localhost:3000/api/campaigns/summary?brandId=<qa-brand-id>&campaignId=career_timing_wedge_399'
    Expected: HTTP 200 and body includes campaignId, productProfile, quality summary, linked cadence, and next action.
    Evidence: .omo/evidence/task-7-summary.http
  ```

  **Commit**: YES | Message: `feat(campaign): support viral sprint matrix` | Files: generator/campaign/summary surfaces as needed

- [x] 8. Add final operator playbook and decision rules

  **What to do**: Add a short playbook that states what to do after the sprint: double down, revise offer, revise format, or pause. Include thresholds using available metrics: reply rate, save/share proxy if available, click rate, report starts, and paid conversion.
  **Must NOT do**: Do not create vanity-only success criteria.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final | Blocked By: 7

  **References**:
  - Pattern: `.agent/memory/brainstorm.md` - prior emphasis on conversion loop.
  - Pattern: `.agent/memory/task_board.md` - Revenue OS mode and manual metrics.
  - Pattern: `.agent/memory/brand-voice.md` - brand guardrails.

  **Acceptance Criteria**:
  - [x] Playbook has clear thresholds for keep/kill/revise.
  - [x] Playbook distinguishes viral attention from report conversion.
  - [x] Playbook keeps reply-heavy tactics optional, not required.

  **QA Scenarios**:
  ```text
  Scenario: Playbook has binary decision rules
    Tool: bash
    Steps: rg "double down|revise|pause|reply rate|click rate|report start|paid" README.md docs .agent/memory
    Expected: Decision rules exist in operator-facing docs.
    Evidence: .omo/evidence/task-8-playbook-rules.txt

  Scenario: Playbook does not require operator replies
    Tool: bash
    Steps: rg "must reply|답글.*필수|댓글.*전부" README.md docs .agent/memory; test $? -eq 1
    Expected: No rule requires answering every comment.
    Evidence: .omo/evidence/task-8-no-reply-requirement.txt
  ```

  **Commit**: YES | Message: `docs(campaign): add viral sprint decision rules` | Files: README/docs/memory as chosen by executor

## Final Verification Wave
> ALL must APPROVE before calling implementation complete.

- [x] F1. Plan Compliance Audit
  - Verify every task's references exist.
  - Verify every task has acceptance criteria and QA scenarios.
  - Evidence: `.omo/evidence/f1-plan-compliance.txt`

- [x] F2. Code Quality Review
  - Run `npm run typecheck`.
  - Run targeted tests listed above.
  - Evidence: `.omo/evidence/f2-code-quality.txt`

- [x] F3. Real Manual QA
  - Use HTTP calls against local app for generate + summary.
  - Use browser or in-app browser to inspect generated posts in dashboard if UI is affected.
  - Evidence: `.omo/evidence/f3-manual-qa.md`

- [x] F4. Scope Fidelity Check
  - Confirm no auto-reply/DM/follow automation was added.
  - Confirm no prediction/partner-mind guarantee language was introduced.
  - Evidence: `.omo/evidence/f4-scope-fidelity.txt`

## Commit Strategy
- One commit per task if implementation touches behavior.
- Use Conventional Commits.
- Do not commit plan-only changes unless the user asks.
- Suggested final implementation branch: `codex/cosmicpath-viral-upgrade`.

## Success Criteria
- Generated CosmicPath content is less repetitive and clearly distributed across viral modes.
- Comments, if used, are self-classification and do not require operator replies.
- Save/share-oriented content is generated and quality-checked as a first-class mode.
- The app can run a 7-day evidence sprint and tell the operator what to revise next.
- CosmicPath remains non-predictive, non-exploitative, and action-narrowing.
