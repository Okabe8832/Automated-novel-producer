# Novel Branch Design

## Goal

Add a branch layer to the OpenCode novel production line so one project can manage multiple independent novel projects. A branch is similar to a git branch in user experience: users create a branch, switch the active branch, and then run normal Novel commands against that active context.

This is not a git branch. It does not switch code, worktrees, commits, or repository state. It switches the active novel-production workspace inside `.novel-production/`.

## User Model

- One branch represents one novel project.
- A branch is not a version of another branch.
- There is no special `main` branch semantics.
- Cross-branch operations are not supported.
- All production commands operate only on the current active branch.

Examples:

```text
branch01 = 小说 A
branch02 = 小说 B
branch03 = 小说 C
```

After switching to `branch02`, `/novel-intake`, `/novel-plan`, `/novel-produce`, `/novel-review`, `/novel-repair`, `/novel-export`, `/novel-status`, and `/novel-read` all read and write only branch02 state.

## Product Flow

The branch layer only selects the novel project. Existing production semantics remain stage-based.

- Branch commands create and switch the active novel project.
- `/novel-intake` captures the initial project requirements for the active branch.
- `/novel-plan` turns those requirements into initial story settings, story bible, production plan, and plot units for the active branch.
- `/novel-produce` plans/writes chapter text for the active branch.
- `/novel-review` reviews generated text for the active branch.
- `/novel-repair` repairs failed units for the active branch.
- `/novel-export` exports approved units for the active branch.
- `/novel-read` is a read-only user preview command for the active branch.

`/novel-read` should be optimized for user reading, not orchestration. It should not ask `novel-producer` to reason over the project. It should use a direct plugin tool to read the selected draft text.

## Data Layout

The root workspace keeps branch registry and active-branch state. Each branch contains a complete novel-production workspace.

```text
.novel-production/
  branches.json
  active-branch.json
  branches/
    branch01/
      requirements.json
      production-controls.json
      story-bible.json
      prototypes.json
      element-pools.json
      plan.json
      plot-units.json
      materials/
      material-decompositions/
      drafts/
        ch01.md
        ch02.md
      reviews/
      repair-tasks/
      generation-runs/
      exports/
        manuscript.md
      reports/
        production-report.md
    branch02/
      requirements.json
      production-controls.json
      story-bible.json
      prototypes.json
      element-pools.json
      plan.json
      plot-units.json
      drafts/
        ch03.md
```

`branches.json` is the branch registry:

```json
{
  "schemaVersion": 1,
  "branches": [
    {
      "id": "branch01",
      "title": "小说 A",
      "createdAt": "2026-05-16T00:00:00.000Z",
      "updatedAt": "2026-05-16T00:00:00.000Z"
    }
  ]
}
```

`active-branch.json` is the HEAD-like pointer:

```json
{
  "schemaVersion": 1,
  "branchId": "branch01",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

## Branch IDs

Branch IDs should be path-safe and predictable:

```text
^[A-Za-z0-9_-]+$
```

The UI may encourage names such as `branch01`, `branch02`, but the storage layer should not require numeric suffixes. Invalid branch IDs are rejected. Commands must not guess or normalize unsafe IDs into paths.

## Command Design

### Branch Commands

The durable command should be parameterized:

```text
/novel-branch branch02
```

It switches the active branch to `branch02`. If `branch02` does not exist, the command should report that clearly and suggest creating it.

Branch creation should be explicit:

```text
/novel-branch-create branch02
```

It creates a new branch workspace, registers it in `branches.json`, initializes starter files under `.novel-production/branches/branch02/`, and switches active branch to the new branch unless the command explicitly says not to.

Shortcut commands such as `/novel-branch02` may be added later, but they are optional. The base design should not require generating one command file per branch, because branches are user-created runtime data.

### Production Commands

Existing Novel production commands should resolve workspace paths through the active branch. For example, after switching to `branch02`:

```text
/novel-intake
```

writes to:

```text
.novel-production/branches/branch02/requirements.json
```

and:

```text
/novel-produce ch03
```

writes to:

```text
.novel-production/branches/branch02/drafts/ch03.md
```

No production command should read another branch as fallback context.

### Read Command

`/novel-read` should remain user-facing, but the fast path must be direct.

Input:

```text
/novel-read ch03 --offset 0 --limit 4000
```

Behavior:

1. Resolve active branch from `.novel-production/active-branch.json`.
2. Read `.novel-production/branches/<activeBranch>/drafts/ch03.md`.
3. Return `content.slice(offset, offset + limit)`.
4. Do not mutate any production state.
5. Do not search other branches if the draft is missing.

## Plugin Tool Design

Add a direct plugin tool named `novel_read`.

Input shape:

```ts
type NovelReadInput = {
  root?: string;
  unitId: string;
  offset?: number;
  limit?: number;
};
```

Output shape:

```ts
type NovelReadOutput = {
  branchId: string;
  unitId: string;
  path: string;
  offset: number;
  limit: number;
  text: string;
};
```

Rules:

- Load the active branch pointer.
- Validate the active `branchId` and requested `unitId` with the safe ID rule.
- Validate `offset` as a non-negative integer.
- Validate `limit` as a positive integer.
- Default `offset` to `0`.
- Default `limit` to `4000`.
- Return a clear error when no active branch exists.
- Return a clear error when the branch does not exist.
- Return a clear error when the draft is missing in the active branch.

This tool is intentionally narrow. It does not load requirements, story bible, plot units, reviews, or production reports.

`novel_read` must not accept a user-selected branch override. Reading another branch requires switching active branch first. This preserves the rule that one command invocation operates on only the active novel project.

## Workspace Path Layer

Current code uses `workspacePaths(root)` and assumes `.novel-production/` is the production workspace. Branch support should introduce a selector layer instead of duplicating path logic everywhere.

Recommended model:

```ts
type BranchRef = {
  branchId: string;
};

function branchWorkspacePaths(root: string, branchId: string): NovelProductionPaths;
function activeBranchWorkspacePaths(root: string): Promise<NovelProductionPaths>;
```

`branchWorkspacePaths(root, branchId)` should reuse the existing `NovelProductionPaths` shape but set `workspace` to:

```text
.novel-production/branches/<branchId>
```

This keeps repository functions mostly unchanged once callers pass the selected branch workspace.

## Initialization and Migration

For new workspaces:

1. `/novel-init` creates `.novel-production/branches.json` and `.novel-production/active-branch.json` only when appropriate.
2. The first branch is created explicitly by `/novel-branch-create <branchId>` or by a guided init flow.
3. No branch is treated as `main` by default.

For existing workspaces that already have `.novel-production/drafts/` at the root:

- Do not silently move files.
- Provide a migration command or documented manual migration into a named branch.
- A safe first migration target can be user-selected, for example `branch01`.

Migration should copy or move the full current workspace contents into `.novel-production/branches/<branchId>/` only after explicit user approval.

## Error Handling

- No active branch: report that a branch must be created or selected first.
- Unknown branch: report the missing branch ID and list known branch IDs.
- Missing draft: report the active branch and missing path; do not search other branches.
- Unsafe branch or unit ID: reject before path construction.
- Existing branch on create: refuse unless a future explicit overwrite/import mode is designed.
- Cross-branch requests: reject unless the operation is a branch management command.

## Testing Strategy

Unit tests should cover:

- Branch registry creation and parsing.
- Active branch pointer creation, switching, and missing-pointer errors.
- Branch workspace path resolution.
- Branch-scoped repository reads/writes.
- `novel_read` direct tool behavior for active branch.
- Missing draft in active branch does not fall back to another branch.
- Unsafe branch and unit IDs are rejected.
- Existing unbranched workspace migration requires explicit approval.

Asset tests should cover:

- New branch command markdown assets exist.
- Plugin exposes `novel_read`.
- `/novel-read` documentation describes active branch behavior and direct read semantics.

Integration tests should cover:

1. Create branch01 and branch02.
2. Switch to branch02.
3. Write or seed `branch02/drafts/ch03.md`.
4. `novel_read({ unitId: "ch03" })` returns branch02 text.
5. branch01 `ch03.md`, if present, is not read while branch02 is active.

## Non-Goals

- No real git branch or worktree switching.
- No cross-branch production, review, repair, export, or read.
- No automatic branch merging.
- No branch diff view.
- No fallback search across branches.
- No one-command generation of infinite `/novel-branchNN` command files.
- No browser UI.

## Open Questions for Implementation Planning

- Should `/novel-init` create an initial branch interactively, or should branch creation always be explicit?
- How should `/novel-branch-create <id>` collect optional branch title metadata without slowing down the basic create path?
- What is the cleanest OpenCode-facing wrapper for `/novel-read` so it invokes `novel_read` directly and does not ask `novel-producer` to reason over the project?
- Should existing root `.novel-production/` state be copied or moved during migration?
