---
name: "source-command-hub-upgrade"
description: "Self-upgrade workflow with regression validation and recorded release notes (Orchestrator v7)"
---

# source-command-hub-upgrade

Use this skill when the user asks to run the migrated source command `hub-upgrade`.

## Command Template

# 🚀 Hub Upgrade

허브 자체를 업그레이드할 때 쓰는 운영 워크플로우. 목표는 변경과 검증을 함께 남기는 것이다.

## 0. Required Inputs
- [ ] Read `VERSION`
- [ ] Read `CHANGELOG.md`
- [ ] Read relevant upgrade docs under `docs/upgrades/`
- [ ] Read the active rebuild plan when applicable.

## 1. Upgrade Rubric
- [ ] What changed: workflow quality, scripts, docs, reference clients, release discipline
- [ ] What could regress: onboarding, bridge, reports, QA path, linked-client compatibility
- [ ] What version and one-line summary describe this upgrade?

## 2. PASS / FAIL Gate

### PASS
- [ ] Version and summary are explicit.
- [ ] Upgrade report exists under `docs/upgrades/`.
- [ ] Required validation commands were actually run.

### FAIL
- [ ] 버전만 올리고 검증 근거가 없다.
- [ ] changelog 또는 upgrade report가 빠져 있다.

## 3. Red Flags
- hub upgrade가 linked-client 경로를 깨뜨릴 수 있는데 smoke path를 안 본다.
- docs, scripts, workflow surfaces가 서로 다르게 바뀐다.

## 4. Artifact
- [ ] Run:
  - `bash .agent/scripts/hub-upgrade.sh "<version>" "<summary>"`
- [ ] Primary artifacts:
  - `VERSION`
  - `CHANGELOG.md`
  - `docs/upgrades/*`

## 5. Handoff
- [ ] validation clean -> normal operation
- [ ] regressions found -> `/fix` or follow-up hub upgrade pass
