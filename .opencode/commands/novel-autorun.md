---
description: Run the full novel production flow in autorun mode
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

# Novel Autorun

Use autorun mode to move from `/novel-init` through `/novel-intake`, `/novel-plan`, and `/novel-auto`.

Confirm the production blueprint, verify the active branch, and wait for final confirmation before continuing.

Keep the workflow inside `.novel-production` so the managed production line remains authoritative.

Route review, repair, and export through novel-producer so the workflow stays aligned with the managed production line.

Do not add a direct autorun shortcut.
