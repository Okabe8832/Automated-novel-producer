---
description: Capture novel requirements through novel-producer.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to capture or update the user's novel production requirements.

Workspace: `.novel-production/`.

Required behavior:
- Ask only for missing core production requirements.
- Persist requirements in Chinese-first form.
- Preserve must-include, must-avoid, style, point of view, audience, and length targets.
- Update the active branch-local `prompt settings` clone after requirements are saved.
- Do not modify the project root `prompt settings` template during branch-scoped intake work.
- Report blockers instead of guessing.
