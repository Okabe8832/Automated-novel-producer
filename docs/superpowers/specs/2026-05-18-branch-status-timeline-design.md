# Branch Status Timeline Design

## Goal

Enhance `/novel-branch-status` with a compact branch timeline diagram that shows each registered branch and its plot-unit statuses at a glance.

Example output:

```text
branch01: ch01(approved) ── ch02(drafted) ── ch03(repair_requested)
branch02*: ch01(approved) ── ch02(ready_to_produce)
branch03: ch01(planned) ── ch02(planned) ── ch03(planned)
```

## Approved Design

Use option 1: add the timeline while preserving the existing detailed directory counts, artifact checks, active branch marker, and warnings.

## Data Source

The timeline reads only each branch workspace's `plot-units.json`. It must not read draft contents, review contents, repair task contents, generation run contents, reports, or manuscripts.

## Display Rules

- Add a `## Branch Timeline` section near the top of rendered markdown, after top-level active branch/warnings and before detailed branch sections.
- Render one line per registered branch.
- Use `branchId*` for the active branch and `branchId` for inactive branches.
- Sort plot units by `orderIndex`.
- Label units as `ch01`, `ch02`, `ch03`, etc. based on sorted display position, not raw unit id.
- Show the raw plot-unit status inside parentheses.
- Join units with ` ── `.
- If a branch has no plot units, render `branchId: no plot units`.
- If the branch workspace is missing, keep existing warning behavior and render `branchId: no plot units`.
- If `plot-units.json` is missing, malformed, or unreadable for a branch, do not throw for the whole status report. Add a branch warning and render `branchId: plot units unavailable`.

## API Shape

Extend `NovelBranchStatusBranch` with:

```ts
plotUnits: NovelBranchPlotUnitStatus[];
plotUnitsAvailable: boolean;
```

Add:

```ts
export type NovelBranchPlotUnitStatus = {
  label: string;
  status: PlotUnitStatus;
};
```

The label is precomputed during status building so rendering stays simple and stable.

## Command Asset

Update `.opencode/commands/novel-branch-status.md` to mention the compact timeline and clarify that it reads `plot-units.json` metadata only, not draft or review contents.

## Tests

Cover:

- Branch timeline renders one compact line per branch.
- Active branch line uses `*`.
- Units are sorted by `orderIndex`.
- Labels use `ch01`, `ch02`, etc.
- Raw statuses are preserved in parentheses.
- Existing detailed directory and artifact output remains present.
- Empty plot units render `no plot units`.
- Missing branch workspace renders `no plot units` and keeps warning.
- Missing or malformed `plot-units.json` renders `plot units unavailable` and adds a branch warning.
- Command asset documents the timeline and no-content-read behavior.
- Status building/rendering does not read draft, review, repair task, generation run, report, or manuscript contents. Add sentinel content to those files and assert the rendered status does not contain the sentinel text; alternatively make those content files unreadable while metadata-only status still renders.

## Non-Goals

- No graph rendering library.
- No Mermaid output.
- No reading draft/review/repair contents.
- No status abbreviations in the first implementation.
- No removal of existing file counts or artifact checks.
