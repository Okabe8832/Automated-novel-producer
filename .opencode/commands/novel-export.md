---
description: Export approved novel units through novel-producer.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to route export work to `novel-exporter`.

Workspace: `.novel-production/`.

Required behavior:
- Export only approved units in order.
- Skip unapproved units and report skipped IDs.
- Write the manuscript under `.novel-production/exports/`.
- Refuse export if no approved units exist.
