---
description: Build a novel production plan through novel-producer.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to route planning work to `novel-planner`.

Workspace: `.novel-production/`.

Required behavior:
- Validate requirements before planning.
- Create or update the story bible, production plan, and plot units.
- Use ordered production units.
- Make the first sequential unit ready to produce.
- Report the next eligible unit.
- Identify all structurally important major characters before finalizing the plan.
- Write those major characters to `story-bible.json.characters` with stable ids, names, roles, appearances, personalities, motivations, and arcs.
- Bind relevant plot units to those characters through `bindings.characterIds`.
- Do not leave placeholder characters such as "某反派", "某盟友", or unnamed mystery roles when the story framework depends on them.
- Update the active branch-local `prompt settings` clone after planning artifacts are saved.
- Do not modify the project root `prompt settings` template during branch-scoped planning work.
