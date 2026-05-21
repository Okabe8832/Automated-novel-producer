# OpenCode Story Agent Plugin Design

> Superseded by `docs/superpowers/specs/2026-05-16-opencode-novel-production-line-design.md`. The product framing is no longer a generic story workbench; it is an OpenCode-native novel production line.

## Go / No-Go

**Conclusion: Conditional Go.**

The product direction is clear: stop building the local web app and rewrite the project as an OpenCode-native story creation workflow. The condition is that OpenCode's current extension model does not expose a first-class plugin hook for registering agents or slash commands directly. First-stage delivery must therefore use project-local OpenCode files (`.opencode/agents`, `.opencode/commands`, `.opencode/plugins`) and design the plugin layer around supported tools/hooks plus file synchronization.

## Product Direction

Build a local OpenCode story creation assistant for Chinese novel writing. The first stage should work inside a project directory without a web server, browser UI, account system, or SQLite service. The assistant is workflow-first: commands drive the core business loop, and conversation is used only to clarify missing high-impact inputs or help refine creative content.

The business loop remains the same as the prior local workbench:

1. Initialize a story project.
2. Maintain story materials: elements, characters, scenes, and timeline entries.
3. Maintain a linear plot node chain.
4. Generate Chinese draft prose for a plot node.
5. Review, approve, reject, and revise generated drafts.
6. Export approved content into a manuscript file.

## Confirmed User Decisions

- Do not continue the local web frontend path.
- The first useful surface is an OpenCode built-in/custom agent.
- The final packaging target is plugin-style usage.
- The main interaction should be command/workflow-driven; conversation is auxiliary.
- Story data should live in project-local files, not a global database.
- First-stage output should be simple, business-complete, and runnable locally.

## OpenCode Extension Constraints

Official OpenCode docs currently separate the extension surfaces:

- Agents are defined through markdown files such as `.opencode/agents/*.md` or user-level agent files.
- Commands are defined through markdown files such as `.opencode/commands/*.md` or user-level command files.
- Plugins are loaded from `.opencode/plugins/*.ts|js` or configured packages and primarily provide tools, hooks, config adjustments, shell environment, and event handling.

Because plugin docs do not describe a direct “register agent” or “register command” API, the design must not depend on that. The stable first-stage shape is:

```text
.opencode/
  agents/
    story-architect.md
  commands/
    story-init.md
    story-material.md
    story-node.md
    story-generate.md
    story-review.md
    story-export.md
  plugins/
    story-workbench.ts
```

Second-stage plugin packaging can ship these assets and install or synchronize them into the project-local `.opencode` directory, but the MVP should not require that packaging mechanism to be solved before the agent is usable.

## Recommended Architecture

Use a file-backed OpenCode workflow with three layers.

### 1. Project Story Workspace

The story state lives in `.story-agent/`. Files are human-readable, git-friendly, and easy for the agent to inspect or repair.

```text
.story-agent/
  story.json
  elements.json
  characters.json
  scenes.json
  timeline.json
  plot-nodes.json
  drafts/
    <node-id>.md
  generation-runs/
    <run-id>.json
  exports/
    manuscript.md
```

This replaces SQLite as the first-stage persistence boundary. Existing domain ideas remain useful, but the storage implementation should be rewritten around JSON and Markdown files.

### 2. OpenCode Agent and Commands

`story-architect.md` is the main agent persona. It owns the creative workflow rules: ask only high-impact questions, keep Chinese output, preserve project files, and follow the plot node status flow.

Command files provide repeatable entry points:

- `/story-init` initializes `.story-agent/`.
- `/story-material` adds or updates elements, characters, scenes, and timeline entries.
- `/story-node` adds or updates plot nodes.
- `/story-generate` generates a draft for one node.
- `/story-review` approves or rejects a draft and records revision requests.
- `/story-export` exports approved node drafts into `exports/manuscript.md`.

The commands should delegate to the story agent or instruct the current session to use the story agent. They should not duplicate long business rules in every command; shared rules belong in the agent prompt and plugin/tool validation.

### 3. Local Plugin Helper

`.opencode/plugins/story-workbench.ts` should be a thin helper layer, not the core product. Its MVP responsibility is to provide validated file operations or workspace inspection helpers if direct file editing becomes too error-prone.

The plugin must stay aligned with officially supported OpenCode plugin capabilities. It may expose custom tools for operations such as reading the story workspace summary, validating JSON state, or writing a generation run. It must not rely on undocumented agent-registration behavior.

## MVP Trim

### MVP Must Have

- Project-local `.story-agent/` workspace.
- One main OpenCode agent: `story-architect`.
- Command files for init, material management, node management, generation, review, and export.
- JSON schemas or TypeScript validators for story state files.
- Markdown draft output for each plot node.
- Prompt snapshot stored with every generation run.
- Chinese-only generation rule for novel prose.
- Linear plot node chain.
- Review flow: ready to generate, review pending, approved, rejected, revising.
- Export approved drafts into one manuscript Markdown file.
- Tests for file repository behavior, status transitions, prompt snapshot building, and export ordering.

### MVP Optional

- Migration script from the current SQLite database into `.story-agent/`.
- Local plugin tool for state validation.
- Demo seed command.
- JSON import/export command beyond the normal workspace files.

### Later

- True distributable plugin package with asset synchronization.
- Multiple story projects in one repository.
- Branching plot graphs.
- Automatic reviewer agent.
- Revision impact analysis across downstream nodes.
- Rich prompt template customization.

### Not Implemented

- Web UI.
- Next.js runtime.
- Browser e2e flow.
- Account management.
- Multi-user collaboration.
- Cloud deployment.
- Separate API settings UI.
- SQLite as the first-stage primary store.

## Data Contract Freeze V1

### `story.json`

```json
{
  "schemaVersion": 1,
  "id": "story-id",
  "title": "故事标题",
  "genre": "类型",
  "premise": "故事前提",
  "language": "zh-CN",
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

### `elements.json`

```json
[
  {
    "id": "element-id",
    "category": "type",
    "name": "要素名称",
    "description": "要素说明",
    "source": "user",
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

`category` values: `type | plot | character | scene | time | custom`.

### `characters.json`

```json
[
  {
    "id": "character-id",
    "name": "人物名",
    "nickname": "别名",
    "appearance": "外貌",
    "personality": "性格",
    "setting": "设定",
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

### `scenes.json`

```json
[
  {
    "id": "scene-id",
    "name": "场景名",
    "description": "场景说明",
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

### `timeline.json`

```json
[
  {
    "id": "time-entry-id",
    "label": "时间标签",
    "description": "时间说明",
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

### `plot-nodes.json`

```json
[
  {
    "id": "node-id",
    "orderIndex": 1,
    "title": "剧情节点标题",
    "summary": "剧情节点摘要",
    "status": "ready_to_generate",
    "draftPath": "drafts/node-id.md",
    "revisionRequest": "",
    "bindings": {
      "elementIds": [],
      "characterIds": [],
      "sceneIds": [],
      "timeEntryIds": []
    },
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

Plot node status values:

```text
draft -> ready_to_generate -> review_pending -> approved
review_pending -> rejected -> revising -> ready_to_generate
ready_to_generate -> failed -> ready_to_generate
```

The `failed` state is normally represented by a failed generation run while the node returns to `ready_to_generate`; it should not become a long-lived node state unless implementation needs it for a visible recovery step.

### `generation-runs/<run-id>.json`

```json
{
  "id": "run-id",
  "plotNodeId": "node-id",
  "status": "succeeded",
  "agent": "story-architect",
  "model": "opencode-session-model",
  "promptSnapshot": {
    "story": {},
    "plotNode": {},
    "previousNodes": [],
    "elements": [],
    "characters": [],
    "scenes": [],
    "timeEntries": [],
    "revisionRequest": "",
    "templateVersion": "opencode-story-agent-v1"
  },
  "outputPath": "drafts/node-id.md",
  "errorMessage": "",
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

Generation run status values: `pending | running | succeeded | failed`.

## Generation Flow

OpenCode itself supplies the model. The project should not recreate the old API settings UI. `/story-generate` should:

1. Load and validate `.story-agent/`.
2. Resolve the target plot node.
3. Build a prompt snapshot from story, previous approved or ordered nodes, bindings, and revision request.
4. Ask the `story-architect` agent to generate Chinese prose only.
5. Write the result to `drafts/<node-id>.md`.
6. Write a generation run JSON file.
7. Move the node to `review_pending` on success.
8. Record a failed generation run and leave the node retryable on failure.

## Review Flow

`/story-review` accepts one plot node and one outcome.

- Approve: mark `review_pending -> approved`.
- Reject: mark `review_pending -> rejected`, store the revision request, then allow `/story-generate` to move it back through `revising -> ready_to_generate` before regenerating.

The agent may ask for a revision request only when rejecting. It should not invent revision requests silently.

## Export Flow

`/story-export` reads approved plot nodes in `orderIndex` order, loads each `draftPath`, and writes `exports/manuscript.md`. Non-approved nodes are skipped by default and reported in the command output.

## Error Handling

- Missing `.story-agent/`: tell the user to run `/story-init` or offer to initialize if enough information is present.
- Invalid JSON: stop before writing new state, report the broken file, and preserve existing contents.
- Missing referenced binding IDs: report the specific missing IDs and skip generation until fixed.
- Duplicate `orderIndex`: reject the write and ask the user to resolve ordering, or auto-renumber only if the command explicitly asks for insertion.
- Generation failure: create a failed generation run, preserve previous draft if one exists, and keep the node retryable.
- Export with no approved nodes: create no manuscript and report the reason.

Writes should be atomic where practical: write to a temporary file, then rename into place. The implementation should avoid broad rewrites of unrelated files so diffs remain readable.

## Testing Strategy

Use TDD for the rewrite. The new test surface should focus on the file-backed workflow, not browser behavior.

Required tests:

- Workspace initialization creates the expected `.story-agent/` files.
- File repositories read and write valid JSON without losing unrelated fields.
- Status transitions reject invalid moves.
- Prompt snapshot includes story, target node, previous nodes, bindings, and revision requests.
- Draft generation with a fake generator writes draft Markdown and generation run metadata.
- Failed generation records an error and leaves the node retryable.
- Export concatenates only approved drafts in order.
- Command templates point at `story-architect` and do not duplicate stale business rules.

Browser e2e tests should be removed or replaced with command/workflow smoke tests after the web runtime is decommissioned.

## Migration and Decommissioning

The existing Next.js/SQLite app is not the target runtime anymore. Implementation should treat current code as reusable reference, not as architecture to preserve.

Reusable ideas:

- Domain status rules.
- Prompt snapshot structure.
- AI generation audit concept.
- Tests that express domain behavior.

Likely removed or replaced:

- `src/app/*` pages.
- React components.
- Next.js server actions.
- Playwright browser tests.
- SQLite repositories as the primary store.
- API settings page and stored API keys.

Do not delete working code casually during design. The implementation plan should decide whether to remove web files in one explicit task or keep them temporarily until the file-backed agent passes tests.

## File Ownership Map V1

### Agent and Command Surface

Owns:

- `.opencode/agents/story-architect.md`
- `.opencode/commands/story-init.md`
- `.opencode/commands/story-material.md`
- `.opencode/commands/story-node.md`
- `.opencode/commands/story-generate.md`
- `.opencode/commands/story-review.md`
- `.opencode/commands/story-export.md`

### Plugin Helper Surface

Owns:

- `.opencode/plugins/story-workbench.ts`
- Any plugin-specific package/config files needed by OpenCode.

### Story Agent Core Library

Suggested ownership:

- `src/story-agent/schema.ts`
- `src/story-agent/workspace.ts`
- `src/story-agent/repository.ts`
- `src/story-agent/prompt.ts`
- `src/story-agent/generation.ts`
- `src/story-agent/export.ts`

These files should be small and focused. If the implementation keeps existing `src/features/*` code temporarily, new file-backed modules should not silently mutate the old SQLite contracts.

### Tests

Owns:

- `tests/story-agent/*.test.ts`
- Existing domain tests that remain applicable after porting.

### Deprecated Web Surface

Candidate removal or archival in implementation:

- `src/app/*`
- `src/components/*`
- `e2e/*`
- `playwright.config.ts`
- Next.js and React dependencies in `package.json`

## Implementation Phases

### Phase 1: Built-In Project Agent

Create `.opencode/agents`, `.opencode/commands`, `.story-agent` schema, and file-backed tests. The user should be able to run the story workflow inside this project without publishing a plugin.

### Phase 2: Local Plugin Helper

Add `.opencode/plugins/story-workbench.ts` only for supported helper tools or validation. Keep the core workflow usable even if the plugin is disabled.

### Phase 3: Plugin Package

Package the agent, commands, and helper plugin for reuse. Because official plugin APIs do not directly register agents or commands, packaging should install or synchronize the markdown assets into the consumer project's `.opencode` directory.

## Acceptance Criteria

- No browser or local web server is required for the core story workflow.
- A fresh project can initialize `.story-agent/` through an OpenCode command.
- The story agent can create materials, plot nodes, and Chinese drafts.
- Draft generation records prompt snapshots and run metadata.
- Review and export workflows operate on project files.
- Tests pass without external AI calls.
- The design remains compatible with OpenCode's documented agent, command, and plugin surfaces.
