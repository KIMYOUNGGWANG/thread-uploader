---
name: execution
description: "Core PM skill pack for product execution. Covers writing PRDs, slicing user stories, feature prioritization frameworks (RICE, Kano), and managing feedback."
user-invocable: true
risk: safe
---

# Product Execution Skill Pack

This skill pack provides frameworks for prioritizing work, defining requirements, and managing the delivery lifecycle.

## 1. Prioritization Frameworks
Structured methods to ruthlessly prioritize the backlog.
- **RICE**: Reach, Impact, Confidence, Effort. Best for comparing independent features.
- **Impact vs. Effort Matrix**: Quick visual prioritization (Quick Wins, Major Projects, Fill-ins, Thankless Tasks).
- **Kano Model**: Categorizing features by Basic Needs, Performance, and Delighters.
*Prompt Pattern:* "Prioritize this list of 5 features using the RICE framework: [Feature List]"

## 2. Product Requirements Document (PRD)
Write concise, engineering-ready requirements.
- Focus on the 'Why' and the 'What', not the 'How'.
- Include Context, Target Audience, Problem, Solution, Success Metrics, Out of Scope, and UX flows.
*Prompt Pattern:* "Draft a PRD for [Feature/Epic Name] focusing on solving [Specific Problem]."

## 3. User Story Slicing
Break down large Epics into deliverable, independent User Stories using INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable).
- Format: "As a [User Persona], I want to [Action], so that [Value/Goal]."
- Include Acceptance Criteria (Given/When/Then).
*Prompt Pattern:* "Break down the epic '[Epic Name]' into 3-5 INVEST user stories with acceptance criteria."

## 4. Triage Feature Requests
Analyze and categorize incoming customer feedback and feature requests.
- Group by theme.
- Assess strategic fit against current OKRs/Goals.
*Prompt Pattern:* "Analyze these feature requests and categorize them by theme and strategic alignment: [Input]"

## 🛠️ Implementation Checklist
- [ ] Are prioritization decisions based on objective criteria (e.g., RICE) rather than gut feel?
- [ ] Does the PRD clearly state the 'Goal' and 'Success Metrics' before listing features?
- [ ] Are user stories small enough to be completed in a single sprint (INVEST)?
- [ ] Do user stories have clear, testable acceptance criteria?
