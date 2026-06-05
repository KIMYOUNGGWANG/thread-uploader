---
name: deep-research
description: 다중 소스 심층 리서치. 웹 검색, 결과 합성, 출처 명시 보고서 제공. 특정 주제에 대한 철저한 리서치, 경쟁사 분석, 기술 평가, 시장 분석 시 사용.
---

# Deep Research

Produce thorough, cited research reports from multiple web sources.

## When to Activate

- User asks to research any topic in depth
- Competitive analysis, technology evaluation, or market sizing
- Due diligence on companies, investors, or technologies
- Any question requiring synthesis from multiple sources
- User says "research", "deep dive", "investigate", or "what's the current state of"

## Workflow

### Step 1: Understand the Goal

Clarify 1-2 quick questions:
- "What's your goal — learning, making a decision, or writing something?"
- "Any specific angle or depth you want?"

If the user says "just research it" — skip ahead with reasonable defaults.

### Step 2: Plan the Research

Break the topic into 3-5 research sub-questions. Example:
- Topic: "AI-powered social apps market"
  - What are the main players and their traction?
  - What monetization models are working?
  - What user acquisition channels are most effective?
  - What are the technical challenges?
  - What's the market size and growth trajectory?

### Step 3: Execute Multi-Source Search

For EACH sub-question, search using available tools (WebSearch, WebFetch):

**Search strategy:**
- Use 2-3 different keyword variations per sub-question
- Mix general and news-focused queries
- Aim for 10-20 unique sources total
- Prioritize: official docs, reputable news, research > blogs > forums

### Step 4: Deep-Read Key Sources

For the most promising URLs, fetch full content via WebFetch.

Read 3-5 key sources in full for depth. Do not rely only on search snippets.

### Step 5: Synthesize and Write Report

Structure the report:

```markdown
# [Topic]: Research Report
*Generated: [date] | Sources: [N] | Confidence: [High/Medium/Low]*

## Executive Summary
[3-5 sentence overview of key findings]

## 1. [First Major Theme]
[Findings with inline citations]
- Key point ([Source Name](url))
- Supporting data ([Source Name](url))

## 2. [Second Major Theme]
...

## Key Takeaways
- [Actionable insight 1]
- [Actionable insight 2]
- [Actionable insight 3]

## Sources
1. [Title](url) — [one-line summary]
2. ...

## Methodology
Searched [N] queries. Analyzed [M] sources.
Sub-questions investigated: [list]
```

### Step 6: Deliver

- **Short topics**: Post the full report in chat
- **Long reports**: Post executive summary + key takeaways, save full report to `docs/research/[topic].md`

## Quality Rules

1. **Every claim needs a source.** No unsourced assertions.
2. **Cross-reference.** If only one source says it, flag it as unverified.
3. **Recency matters.** Prefer sources from the last 12 months.
4. **Acknowledge gaps.** If you couldn't find good info on a sub-question, say so.
5. **No hallucination.** If you don't know, say "insufficient data found."
6. **Separate fact from inference.** Label estimates, projections, and opinions clearly.

## Research Modes

### Competitive Analysis
Collect:
- product reality, not marketing copy
- funding and investor history
- traction metrics if public
- distribution and pricing clues
- strengths, weaknesses, and positioning gaps

### Technology Evaluation
Collect:
- how it works, trade-offs
- adoption signals and community health
- integration complexity
- lock-in, security, compliance risk

### Market Sizing
Use:
- top-down estimates from reports or public datasets
- bottom-up sanity checks
- explicit assumptions for every leap in logic

## Example Research Requests

```
"Research the current state of AI social apps"
"Deep dive into Next.js vs Remix for 2025"
"Research the best strategies for bootstrapping a SaaS business"
"Investigate the competitive landscape for AI dream journaling apps"
"What's the market size for mental wellness apps?"
```
