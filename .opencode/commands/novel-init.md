---
description: Initialize the novel production workspace through novel-producer.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` to initialize the local novel production workspace.

Workspace: `.novel-production/`.

Required behavior:
- Create the workspace directories and starter JSON files.
- Preserve existing workspace files when re-run.
- Report the created paths and next command.
