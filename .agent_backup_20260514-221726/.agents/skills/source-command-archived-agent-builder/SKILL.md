---
name: "source-command-archived-agent-builder"
description: "Build an AI Agent System (Legacy workflow)"
---

# source-command-archived-agent-builder

Use this skill when the user asks to run the migrated source command `archived-agent-builder`.

## Command Template

# 🤖 Agent Builder (AI Architect v6.0)

> [!WARNING]
> Legacy workflow. Prefer `/plan`, `/develop`, `/qa`, `/review`, `/ship` unless you explicitly need this specialized agent-design flow.

Workflow to design, implement, and evaluate a production-ready AI agent.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: AI Agent design is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.

## 1. [AGENT] AI Architect: Target KPIs & Use Case
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "agent architect evaluation product manager" --concat --strict`
- [ ] **Goal**: Choose a narrow use case and measurable quality goals.
- [ ] **Action**: Set latency, quality, and failure-rate thresholds before implementation. Document in `agent_spec.md`.

## 2. [AGENT] RAG Engineer: Memory & Retrieval
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "rag vector database llm embeddings" --concat --strict`
- [ ] **Goal**: Design tools, memory, and retrieval strategy for the agent.
- [ ] **Action**: Keep retrieval quality measurable and version prompt/tool contracts. Implement RAG pipeline.

## 3. [AGENT] Flow Orchestrator: LangGraph / MCP
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "langgraph mcp orchestration automation" --concat --strict`
- [ ] **Goal**: Implement the orchestration loop and production safeguards.
- [ ] **Action**: Start with constrained tool permissions and explicit fallback behavior. Build agent graph.

## 4. [AGENT] AI Evaluator: Iterate & Improve
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "agent evaluate langfuse kaizen improve" --concat --strict`
- [ ] **Goal**: Run benchmark scenarios and improve weak areas systematically.
- [ ] **Action**: Use test datasets and failure buckets to guide each iteration cycle. Tweak prompts and temperature.

## 5. [AGENT] Critic Gate — Agent Review ♻️
- [ ] **Evaluate**: Does the agent hit the reliability targets defined in Step 1?
- [ ] **PASS** → Output ready agent.
- [ ] **FAIL** → Route back to Step 3/4. Max 2 retries.

## 6. [AGENT] Workflow Transition
- [ ] **Present**: Use `notify_user` to present the agent performance metrics and endpoints.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "AGENT-BUILDER" "[Summary of AI Agent session]"`
