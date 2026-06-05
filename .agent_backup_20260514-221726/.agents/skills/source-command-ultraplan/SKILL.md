---
name: "source-command-ultraplan"
description: "Bounded automated plan-build-verify loop with Codex Primary and Antigravity gates (Orchestrator v7.4)"
---

# source-command-ultraplan

Use this skill when the user asks to run the migrated source command `ultraplan`.

## Command Template

# ⚡ UltraPlan

UltraPlan is a bounded automation loop for turning one mission into plan artifacts, Codex implementation, QA/review gates, and a final run report.

## 0. Required Inputs
- [ ] One mission string.
- [ ] Current project root.
- [ ] `AGENTS.md`, `.agent/memory/task_board.md`, and `docs/api-spec.md` when continuing existing work.

## 1. Safety Rules
- [ ] Default is dry-run. Real execution requires `--run`.
- [ ] Default requires a clean git working tree.
- [ ] Default is `--no-ship`; release-gate only runs with `--allow-ship`.
- [ ] Hard/manual gates halt and emit next-action plus remediation plan.

## 2. Command

```bash
bash .agent/scripts/ultraplan.sh --dry-run "mission" .
bash .agent/scripts/ultraplan.sh --run --max-retries 3 "mission" .
```

## 3. Checklist
- [ ] `audit-status`
- [ ] `runtime-mode`
- [ ] `intent-gate`
- [ ] `codex-plan`
- [ ] Codex implementation handoff
- [ ] `qa-gate`
- [ ] `ralph-loop` on halt
- [ ] `review-gate`
- [ ] `release-gate` only with `--allow-ship`

## 4. PASS / FAIL Gate

### PASS
- [ ] Dry-run prints the planned stages without changing tracked files.
- [ ] `--run` stops on dirty git when `--require-clean` is active.
- [ ] QA and review gates pass before ship handoff.

### FAIL
- [ ] A hard/manual gate remains.
- [ ] Codex planning or implementation fails.
- [ ] Release-gate is attempted without `--allow-ship`.

## 5. Red Flags
- running `--run` on a dirty tree without an explicit reason
- using UltraPlan to bypass missing product scope
- enabling `--allow-ship` for high-risk changes without human review

## 6. Artifact
- [ ] `.agent/runtime/runs/*-ultraplan.json`

## 7. Handoff
- [ ] halted -> inspect `next-action` and `remediation-plan`
- [ ] ready-for-ship -> run `/ship` or `release-gate` manually
- [ ] passed with `--allow-ship` -> capture release prep
