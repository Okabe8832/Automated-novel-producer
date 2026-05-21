---
description: Show simple file status for all novel branches.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use the direct `novel_branch_status` plugin tool to show a compact branch timeline, simple file counts, and key artifact existence for every registered active branch workspace. `agent: novel-producer` is only the OpenCode host entrypoint; business logic is implemented in direct plugin and core TypeScript APIs.

Workspace: `.novel-production/`.

Required behavior:
- Use the direct plugin tool `novel_branch_status`.
- Show all registered branches and mark the active branch.
- Print a compact timeline from `plot-units.json` metadata only, using `ch01(status) ── ch02(status)` style lines.
- Print file counts for known branch directories.
- Print whether key artifacts such as `requirements.json`, `plot-units.json`, `exports/manuscript.md`, and `reports/production-report.md` exist.
- Do not read draft or review contents, repair task contents, generation run contents, report contents, manuscript contents, or any prose body content.
- Do not ask novel-producer to reason over branch files.
- Do not modify branch registry, active pointer, drafts, reviews, reports, or production state.
