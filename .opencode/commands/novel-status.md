---
description: Report novel production status through novel-producer.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to summarize the current production state.

Workspace: `.novel-production/`.

Required behavior:
- Count total, approved, drafted, rejected, and repair-requested units.
- Name the next action.
- Report blockers.
- Write or refresh the production report when requested.
