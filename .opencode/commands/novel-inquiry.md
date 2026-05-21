---
description: Ask simple novel workflow questions without changing production state.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use `novel-producer` only to answer a simple user question about the novel workflow or current process.

Workspace: `.novel-production/`.

Required behavior:
- Treat this command as read-only question mode.
- Answer the user's question directly and briefly.
- Do not modify `.novel-production` files or production state.
- Do not create or update requirements, plans, plot units, drafts, reviews, reports, exports, branch registry, or active branch pointers.
- Do not continue production, resume pending production work, or infer that the user is asking for execution.
- Do not run /novel-auto, /novel-intake, /novel-plan, /novel-produce, /novel-review, /novel-repair, or /novel-export.
- Do not call direct plugin tools unless the user explicitly asks to read status or inspect existing state.

Use this command when the user is only asking a question and does not want the current production workflow disturbed.
