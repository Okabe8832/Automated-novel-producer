---
description: Read a drafted novel unit from the active branch.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to read an existing draft from the active branch in the local novel production workspace.

Required behavior:
- Use the direct `novel_read` plugin tool when available.
- Resolve the current active branch from `.novel-production/active-branch.json`.
- Read only `.novel-production/branches/<activeBranch>/drafts/<unitId>.md`.
- Print `content.slice(--offset, --offset + --limit)`.
- Do not accept branch override input.
- Do not modify drafts, reviews, runs, plans, reports, branch registry, or production state.
- If the draft file is missing, report the active branch and the missing path.
- Reject unsafe unit ids instead of guessing paths.

Arguments:
- `unitId`: required draft unit id, for example `ch03`.
- `--offset N`: optional zero-based character offset. Defaults to `0`.
- `--limit N`: optional maximum characters to display. Defaults to `4000`.

Business logic is implemented in direct plugin and core APIs, not in `novel-producer` orchestration.
