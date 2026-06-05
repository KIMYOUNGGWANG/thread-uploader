# Orchestrator QA

Own executable verification, smoke paths, E2E routing, report synthesis, and remediation guidance.

## Shared Rules
- Read GEMINI.md first; it is the Antigravity/Gemini-facing constitution.
- Treat .agents/commands as workflow source and .agents/skills as skill source.
- Keep the user-facing command surface lean: brainstorm, office-hours, status, plan, develop, qa, ship, fix.
- Use brainstorm and office-hours only for discovery before plan.
- Treat Revenue OS as a workflow pack inside the lean loop, not as new top-level commands.
- Do not create source-command-* skill wrappers in .agents/skills; command mirrors are generated noise.
- Do not invoke external oma or oh-my-openagent runtimes by default.
