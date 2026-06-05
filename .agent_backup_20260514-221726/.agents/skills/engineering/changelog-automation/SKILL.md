---
name: changelog-automation
description: "Automate changelog generation from commits, PRs, and releases following Keep a Changelog format. Use when setting up release workflows, generating release notes, or standardizing commit conventions."
risk: unknown
source: community
date_added: "2026-02-27"
---

# Changelog Automation

Patterns and tools for automating changelog generation, release notes, and version management following industry standards.

## Use this skill when

- Setting up automated changelog generation
- Implementing conventional commits
- Creating release note workflows
- Standardizing commit message formats
- Managing semantic versioning

## Do not use this skill when

- The project has no release process or versioning
- You only need a one-time manual release note
- Commit history is unavailable or unreliable

## Instructions

- Select a changelog format and versioning strategy.
- Enforce commit conventions or labeling rules.
- Configure tooling to generate and publish notes.
- Review output for accuracy, completeness, and wording.

## Safety

- Avoid exposing secrets or internal-only details in release notes.

## Quick Start

```bash
# Install commitlint + husky for commit enforcement
pnpm add -D @commitlint/cli @commitlint/config-conventional husky

# Configure commitlint
echo "export default { extends: ['@commitlint/config-conventional'] };" > commitlint.config.ts

# Activate husky
pnpm exec husky init
echo "pnpm exec commitlint --edit \$1" > .husky/commit-msg

# Install release-please (Google) as an alternative to semantic-release
pnpm add -D release-please
```

## Conventional Commits

| Type       | When to use                        | SemVer bump |
|------------|------------------------------------|-------------|
| `feat`     | New user-facing feature            | minor       |
| `fix`      | Bug fix                            | patch       |
| `chore`    | Maintenance, deps, tooling         | none        |
| `docs`     | Documentation only                 | none        |
| `refactor` | Code restructure, no behavior change | none      |
| `perf`     | Performance improvement            | patch       |
| `test`     | Adding/fixing tests                | none        |
| `ci`       | CI config changes                  | none        |
| `BREAKING CHANGE` | Footer or `!` suffix      | major       |

Examples:
```
feat(auth): add Google OAuth login
fix(api): handle 429 rate-limit responses
feat!: drop Node 16 support
```

## GitHub Actions — release-please

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          release-type: node   # or: python, rust, go, etc.

      # Only runs after release PR is merged
      - uses: actions/checkout@v4
        if: ${{ steps.release.outputs.release_created }}

      - name: Publish to npm
        if: ${{ steps.release.outputs.release_created }}
        run: |
          pnpm install
          pnpm build
          pnpm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Keep a Changelog Template

```markdown
# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security

## [1.0.0] - 2026-03-01

### Added
- Initial release
```

## Git Hook: commitlint

```bash
# .husky/commit-msg
pnpm exec commitlint --edit $1
```

`commitlint.config.ts`:
```ts
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [1, 'never'],        // warn if scope missing
    'body-max-line-length': [2, 'always', 100],
  },
};
```
