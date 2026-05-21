---
description: Create a new branch in the novel production workspace.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to create a new branch in the local novel production workspace.

The active branch is tracked in `.novel-production/active-branch.json`.
The branch registry is maintained in `.novel-production/branches.json`.

Required behavior:
- Use the direct `novel_branch_create` plugin tool.
- Create a new branch entry in `.novel-production/branches.json`.
- Initialize the branch workspace at `.novel-production/branches/<branchId>`.
- Set .novel-production/active-branch.json to the new branch.

Business logic is implemented in direct plugin and core APIs, not in `novel-producer` orchestration.
