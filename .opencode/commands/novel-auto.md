---
description: Run the approved novel production plan through automatic drafting, review, repair, and export
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Run the active branch novel production workflow after the user has manually completed `/novel-intake` and `/novel-plan`.

Workspace: `.novel-production/`.

Use the current active branch only. Do not create or switch branches.

Quality loop:
- Produce the next ready plot unit.
- Review every drafted unit.
- If review fails with repair instructions, repair the unit and re-review it.
- Use at most 3 repairs per plot unit by default.
- Never approve directly after produce or repair; approval requires a passing review.
- Export only after every plot unit is approved.

If a unit cannot pass review, lacks repair instructions, exceeds the repair limit, or is in an unsafe interrupted state, stop and report the blocker.

Route this command through `novel-producer` so drafting, review, and repair agents can participate. Do not rely on a direct plugin shortcut for this workflow.
