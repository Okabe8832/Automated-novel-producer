---
description: Switch the active branch in the novel production workspace.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to switch the active branch in the local novel production workspace.

The active branch is tracked in `.novel-production/active-branch.json`.
The branch registry is maintained in `.novel-production/branches.json`.

Required behavior:
- Use the direct `novel_branch_switch` plugin tool.
- Resolve the target branch from the branch registry.
- Update the active branch in `.novel-production/active-branch.json`.
- Each branch has its own branch workspace under `.novel-production/branches/<branchId>`.

Business logic is implemented in direct plugin and core APIs, not in `novel-producer` orchestration.
