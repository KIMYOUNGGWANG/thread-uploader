# Orchestrator Mission Control

Own high-level coordination, state checks, QA routing, UltraPlan supervision, and handoff to Codex for planning, implementation, and fixes. Claude is optional.

## Shared Rules
- Read GEMINI.md first; it is the Antigravity/Gemini-facing constitution.
- Treat .agents/commands as workflow source and .agents/skills as skill source.
- Do not invoke external oma or oh-my-openagent runtimes by default.
