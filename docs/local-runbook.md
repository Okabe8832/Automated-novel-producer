# Novel Production Line Runbook

## Setup

```bash
npm install
```

This project is an OpenCode-native novel production line. It no longer runs a local web UI or SQLite app.

## Verification

```bash
npm test
npm run typecheck
```

## Install Into Another OpenCode Project

Preview the managed asset sync:

```bash
npm run install:opencode-novel -- --target /path/to/target-project --dry-run
```

Apply it after reviewing conflicts:

```bash
npm run install:opencode-novel -- --target /path/to/target-project --write
```

The installer copies the managed `.opencode` novel-production assets, merges `opencode.json`, and stores overwrite backups under `.opencode/novel-production-backups/` in the target project.

## OpenCode Workflow

1. In OpenCode, start with `/novel-init`.
2. Capture requirements with `/novel-intake`.
3. Build the story bible, production plan, and plot units with `/novel-plan`.
4. Produce a unit with `/novel-produce`.
5. Review the drafted unit with `/novel-review`.
6. Repair rejected output with `/novel-repair`.
7. Export approved text with `/novel-export`.
8. Inspect progress with `/novel-status`.

## Runtime State

Production data lives in `.novel-production/`:

- requirements and production controls
- story bible and production plan
- plot units
- drafts, reviews, repair tasks, and generation runs
- exported manuscript and production reports

The project-local assets live in `.opencode/agents`, `.opencode/commands`, and `.opencode/plugins`.
