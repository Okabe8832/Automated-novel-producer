---
description: Produce one novel unit through the novel-producer main agent.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to produce the next eligible unit or the unit specified by the user.

Workspace: `.novel-production/`.

Required behavior:
- Validate requirements, story bible, plan, and plot units.
- Use sequential mode by default.
- Build a prompt snapshot.
- Include the active branch-local `prompt settings` clone in the prompt snapshot.
- Route drafting to `novel-drafter` and continuity checks to `novel-continuity` when needed.
- Write the draft, generation run, and updated unit state.
- Do not modify the project root `prompt settings` template during branch-scoped production work.
- Report blockers instead of guessing.
