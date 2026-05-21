# Novel Branch Status Design

## Goal

Add `/novel-branch-status` to show the simple file situation across all novel branches. The command should help the user quickly answer: which branches exist, which one is active, and how many files each branch currently has in the key production directories.

The feature must minimize agent workload. Branch status is a filesystem summary, not a reasoning task. It should use a direct plugin tool and project-owned TypeScript APIs, avoiding `novel-producer` orchestration except as a thin OpenCode command entrypoint.

## User Model

- A branch represents one novel project.
- `/novel-branch-status` shows all branches by default.
- The active branch is marked in the output.
- The command does not inspect file contents, summarize prose, judge quality, or infer next writing actions.
- The command does not modify branch state.

## Output Scope

The first version is a lightweight all-branch overview.

For each branch, report:

- `branchId`
- `title` when present
- `active`
- `workspace`
- file counts for key directories:
  - `materials`
  - `material-decompositions`
  - `drafts`
  - `reviews`
  - `repair-tasks`
  - `generation-runs`
  - `exports`
  - `reports`
- key artifact existence:
  - `requirements.json`
  - `plan.json`
  - `plot-units.json`
  - `exports/manuscript.md`
  - `reports/production-report.md`

The output should be stable structured data from the plugin tool. A markdown renderer can present it compactly for humans.

Example structured output:

```ts
type NovelBranchStatusOutput = {
  activeBranchId?: string;
  warnings: string[];
  branches: Array<{
    branchId: string;
    title?: string;
    active: boolean;
    workspace: string;
    warnings: string[];
    directories: Array<{
      name: string;
      path: string;
      fileCount: number;
    }>;
    artifacts: Array<{
      name: string;
      path: string;
      exists: boolean;
    }>;
  }>;
};
```

## Architecture

Add a small status module rather than expanding branch mutation code:

```text
src/novel-production/branch-status.ts
```

Suggested APIs:

```ts
buildNovelBranchStatus(root: string): Promise<NovelBranchStatusReport>
renderNovelBranchStatusMarkdown(report: NovelBranchStatusReport): string
```

`buildNovelBranchStatus` should:

1. Read `.novel-production/branches.json`.
2. Read `.novel-production/active-branch.json` when present.
3. For every registered branch, compute branch workspace paths with `branchWorkspacePaths(root, branchId)`.
4. Count only direct regular files in the key directories. Do not recurse. Missing known directories count as `0` and are not fatal.
5. Check whether key artifacts exist.
6. Return structured data with top-level warnings and per-branch warnings.

This module can reuse existing branch path helpers. If branch registry reading is currently private inside `branches.ts`, expose a minimal read-only helper such as `listNovelBranches(root)` or keep registry parsing internal to `branch-status.ts` if that avoids coupling. Prefer a public `listNovelBranches(root)` because branch status is a legitimate read-only branch API.

## Plugin Tool

Add direct plugin tool:

```text
novel_branch_status
```

Input:

```ts
type NovelBranchStatusInput = {
  root?: string;
};
```

Behavior:

- Reject present non-string `root`.
- Default `root` to `process.cwd()`.
- Call `buildNovelBranchStatus(root)` directly.
- Return the structured status object.
- Do not call `novel-producer`.
- Do not inspect file contents.

## Command Asset

Add:

```text
.opencode/commands/novel-branch-status.md
```

The command asset should document that it uses `novel_branch_status` directly. `agent: novel-producer` may remain in frontmatter for OpenCode command routing consistency, but the text must state that business logic lives in the direct plugin/core TypeScript API and the command should not ask the agent to reason over branch files.

Required command behavior:

- Use direct `novel_branch_status` plugin tool.
- Show all registered branches.
- Mark the active branch.
- Print directory file counts and key artifact existence.
- Do not read draft/review contents.
- Do not modify branch registry, active pointer, or production files.

## Agent Workload Constraint

This is a hard requirement.

`/novel-branch-status` should be cheap to run:

- One direct plugin call.
- No LLM summarization of branch contents.
- No loading novel prose, reviews, manuscript text, or reports.
- No `novel-producer` task delegation for the core operation.
- No recursive deep scan beyond direct files in known branch directories.

The command should behave like a filesystem status command, not an analysis command.

## Error Handling

- Missing branch registry: return an empty branch list with no active branch, or a clear “no branches found” result.
- Missing active pointer: return branches with `active: false` and no `activeBranchId`.
- Stale active pointer: include `activeBranchId`, mark no branch active, and add a top-level warning.
- Missing branch workspace directory: include the branch with zero counts and artifact `exists: false`, plus a warning in that branch record.
- Missing key directories inside an existing workspace: count them as `0` and add no warning unless the entire workspace is missing.
- Malformed branch registry or active pointer JSON should throw a clear error.
- Permission errors should be surfaced clearly; they may be verified manually or with best-effort tests because portable permission simulation is unreliable across platforms.

## Non-Goals

- No branch deletion/list-management UI beyond status display.
- No branch diffing.
- No branch migration.
- No cross-branch reads of file contents.
- No prose/content summaries.
- No production next-action analysis; `/novel-status` remains responsible for plot-unit status.
- No one command per branch such as `/novel-branch02-status`.

## Testing Strategy

Add tests for:

- Core branch status reports all registered branches and marks the active branch.
- File counts are direct regular-file counts in known directories, do not recurse, and missing directories count as `0`.
- Key artifact existence is reported.
- Missing branch registry returns an empty branch list without failing.
- Missing active pointer does not fail the entire command.
- Stale active pointer reports a top-level warning.
- Missing branch workspace reports a per-branch warning and zero counts.
- Malformed branch registry or active pointer JSON throws a clear error.
- Permission errors are surfaced clearly; test when portable, otherwise document as best-effort/manual.
- Plugin `novel_branch_status` returns structured data and rejects invalid `root`.
- Command asset documents direct plugin use and low-agent-workload behavior.
- Deployment managed assets include `.opencode/commands/novel-branch-status.md`.

## Implementation Placement

Expected files:

- Create `src/novel-production/branch-status.ts`
- Modify `src/novel-production/branches.ts` if a public `listNovelBranches(root)` helper is needed
- Modify `.opencode/plugins/novel-production.ts`
- Create `.opencode/commands/novel-branch-status.md`
- Modify `src/novel-production/deployment.ts`
- Add `tests/novel-production/branch-status.test.ts`
- Modify `tests/novel-production/plugin-helper.test.ts`
- Modify `tests/novel-production/opencode-assets.test.ts`
- Modify `tests/novel-production/deployment.test.ts`
