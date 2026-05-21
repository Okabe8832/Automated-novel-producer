---
description: Repair a rejected novel unit through novel-producer.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to route an open repair task to `novel-repairer`.

Workspace: `.novel-production/`.

Required behavior:
- Load the repair task and target unit.
- Apply the task scope and intensity.
- Write repaired Chinese prose.
- Mark the repair task complete and return the unit to drafted.
- Require another review before approval.
