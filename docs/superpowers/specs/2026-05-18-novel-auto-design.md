# Novel Auto Design

## Goal

Add `/novel-auto` to automatically run the creative production workflow after the user has manually completed intake and planning. The feature should continue from an existing active branch plan, produce drafts, review them, repair failed drafts, re-review repaired drafts, and export once all plot units are approved.

Quality improvement is a core requirement. `novel-auto` must include automatic review and revision steps; it must not be a simple produce-all command.

## Preconditions

`novel-auto` starts only after the user has manually completed:

- `/novel-intake`
- `/novel-plan`

The active branch must already exist. `novel-auto` operates only on the current active branch repository. It does not create branches, switch branches, intake requirements, or create the initial plan.

Before doing creative work, `novel-auto` validates that the active branch repository has all artifacts required by the existing production primitives:

- requirements from intake
- production controls
- story bible
- production plan
- at least one plot unit

Missing active branch state, missing intake artifacts, missing planning artifacts, or an empty plot-unit list returns a blocked report instead of starting generation.

## Workflow

For each plot unit, `novel-auto` runs a bounded quality loop:

1. Resolve the next actionable unit from the active branch.
2. Produce units in `ready_to_produce`.
3. Review units in `drafted` or `reviewing`.
4. If review passes, the existing `reviewPlotUnit` behavior records the review, approves the unit, and promotes the next planned unit when sequencing allows it.
5. If review fails with repair instructions, the existing `reviewPlotUnit` behavior records the failed review, creates a repair task, and moves the unit to `repair_requested`.
6. Repair units in `repair_requested` or `repairing` through their current repair task.
7. Re-review the repaired draft after it returns to `drafted`.
8. Repeat repair and re-review for that unit until it passes or reaches the configured repair limit.
9. Stop with a blocker report if the unit still cannot pass.
10. Verify every plot unit is `approved`.
11. Export the manuscript only after the all-approved verification succeeds.

The default repair limit is `3` repairs per plot unit. The initial review does not count as a repair attempt. Each successful call to `repairPlotUnit` counts as one repair attempt. With the default, a unit may receive at most three repairs and three corresponding re-reviews after the initial failed review. If the third repaired draft fails review again, `novel-auto` stops with `status: "blocked"` and does not create a fourth repair attempt.

## Resume and Existing-State Behavior

`novel-auto` is resumable from persisted active-branch state. It should choose the earliest unit by `orderIndex` that requires action, while respecting existing sequencing rules and repair priority.

State handling:

- `approved`: skip; never rewrite or re-review automatically.
- `ready_to_produce`: produce, then review.
- `drafted`: review the existing draft without producing a new one.
- `reviewing`: call `reviewPlotUnit` with the reviewer decision; the existing implementation accepts this state even though review work is not persisted as a long-running durable state by the orchestrator.
- `repair_requested`: repair the current repair task before producing later units.
- `repairing`: resume by calling `repairPlotUnit` with the current in-progress repair task; if no valid current repair task exists, block.
- `rejected` with a current repair task or repair task created from the latest failed review: treat as repair work only if the implementation can deterministically resolve the open repair task, otherwise block.
- `rejected` without repair instructions or without a resolvable open repair task: block.
- `producing`: block. The existing `producePlotUnit` rolls failed generation back to `ready_to_produce`; a persisted `producing` unit indicates an interrupted run that cannot be safely resumed without knowing whether prose was written.
- `planned`: not directly actionable; existing promotion logic should make the next unit `ready_to_produce` after prior units are approved. If no actionable unit exists and any unit remains `planned`, block with sequencing context.

Repair work has priority over later production. Any existing `repair_requested`, `repairing`, or resolvable repair-backed `rejected` unit must be handled before a later `ready_to_produce` unit.

## State Machine Rules

`novel-auto` must respect the existing state machine:

- It must not approve a draft without a review pass.
- It must not approve a repaired unit directly after repair.
- Repair returns the unit to `drafted`; a fresh review is required.
- Approved units are locked and skipped.
- `rejected` units without repair instructions or resolvable repair tasks are blockers.
- `repair_requested` units are repaired before producing later units.
- Sequential production rules remain enforced by existing sequencing logic.

The conceptual approval path remains:

```text
ready_to_produce -> producing -> drafted -> reviewing -> approved
```

The implementation does not need to persist `reviewing` as an externally observable long-running state before approval or rejection. The existing `reviewPlotUnit` function is the authority: it accepts `drafted` or `reviewing`, records the review, and persists the final `approved`, `rejected`, or `repair_requested` result.

The repair path remains:

```text
drafted/reviewing -> rejected -> repair_requested -> repairing -> drafted -> reviewing -> approved
```

## Architecture

Add a core orchestrator module:

```text
src/novel-production/auto.ts
```

The orchestrator composes existing primitives:

- `producePlotUnit`
- `reviewPlotUnit`
- `repairPlotUnit`
- `exportManuscript`
- `buildProductionStatus`
- `createActiveBranchNovelProductionRepository`

It should not duplicate generation, review, repair, export, status, or sequencing logic.

Suggested API:

```ts
type NovelAutoOptions = {
  maxRepairAttemptsPerUnit?: number;
  stopAfterUnitId?: string;
  now?: () => string;
};

type NovelAutoAgents = {
  generate(prompt: string): Promise<string>;
  review(input: NovelAutoReviewRequest): Promise<NovelAutoReviewDecision>;
  repair(input: NovelAutoRepairRequest): Promise<string>;
};

async function runNovelAuto(
  repository: NovelProductionRepository,
  agents: NovelAutoAgents,
  options?: NovelAutoOptions,
): Promise<NovelAutoRunReport>;

async function runActiveBranchNovelAuto(
  root: string,
  agents: NovelAutoAgents,
  options?: NovelAutoOptions,
): Promise<NovelAutoRunReport>;
```

`runActiveBranchNovelAuto` is the branch-aware convenience API. It must use the current active branch only.

`maxRepairAttemptsPerUnit` must be a positive integer when provided. Missing value defaults to `3`. Values below `1`, non-integers, `NaN`, `Infinity`, or non-number values are invalid and return or throw a validation error before production starts.

## Review and Repair Agents

The core orchestrator should depend on injected agent interfaces. This keeps it testable and avoids hard-coding a specific LLM or OpenCode agent runtime.

`review` should return a structured decision:

```ts
type NovelAutoReviewDecision = {
  result: "pass" | "fail";
  checklist: ReviewRecord["checklist"];
  issues: string[];
  decisionNotes: string;
  repair?: {
    scope: RepairTaskRecord["scope"];
    intensity: RepairTaskRecord["intensity"];
    instructions: string;
  };
};
```

If review fails without `repair`, automation stops with a blocker. It must not silently approve or guess repair instructions.

`repair` receives the existing draft, repair task, and prompt via `repairPlotUnit`; it returns repaired prose only.

## Run Report

`novel-auto` should return and optionally render a report:

```ts
type NovelAutoRunReport = {
  status: "completed" | "blocked";
  activeBranchId?: string;
  processedUnitIds: string[];
  approvedUnitIds: string[];
  repairedUnitIds: string[];
  blockedUnitId?: string;
  blocker?: string;
  repairAttemptsByUnitId: Record<string, number>;
  exportResult?: ExportResult;
};
```

The report should make it clear which units were produced, reviewed, repaired, approved, blocked, and exported.

## Command and Plugin Surface

Add command asset:

```text
.opencode/commands/novel-auto.md
```

The command is the required user-facing surface for this feature. It should route through `novel-producer` or the existing novel-production agent flow so real drafting, review, and repair agents can participate. It must document that the command runs after manual intake/plan and includes automatic review/repair quality loops.

Do not add a direct `novel_auto` plugin tool in the initial implementation. The current plugin surface cannot safely supply real generation, review, and repair adapters by itself. The core API remains testable through injected agents, and a future plugin tool may be added only after real adapters exist.

## Export Rules

Before calling `exportManuscript`, `novel-auto` must load all plot units and verify every unit is `approved`. If any unit is not approved, it must return `status: "blocked"` and must not call export.

After export, `novel-auto` must verify the result has `skippedUnitIds.length === 0`. If export ever reports skipped units, the run report must be `status: "blocked"` and include those skipped unit ids in the blocker message.

## Stop Conditions

`novel-auto` stops and returns `status: "blocked"` when:

- No active branch exists.
- Requirements, production controls, story bible, production plan, or plot units are missing.
- No plot units exist.
- A produce call fails and leaves the unit retryable.
- A persisted unit is `producing`.
- A review fails without repair instructions.
- A repair call fails.
- A unit would need more than `maxRepairAttemptsPerUnit` repairs.
- A unit is in an unsupported state for the required next action.
- Any existing `rejected`, `repair_requested`, or `repairing` blocker cannot be repaired deterministically.
- Any unit remains unapproved when export would otherwise begin.
- Export succeeds but reports skipped units.

`novel-auto` returns `status: "completed"` only when every plot unit is approved and export succeeds with no skipped units.

## Quality Policy

- Default `maxRepairAttemptsPerUnit` is `3` repairs per plot unit.
- The initial failed review does not count against the repair limit.
- A repair attempt is counted after `repairPlotUnit` successfully returns a repaired draft.
- Every failed review should include concrete issues and repair instructions if repair is expected.
- Every repair must be followed by another review.
- Approved units are not rewritten.
- The automation should prefer stopping with a clear report over making speculative repairs or approvals.

## Non-Goals

- No automatic intake.
- No automatic initial planning.
- No cross-branch processing.
- No infinite repair loop.
- No direct approval after produce or repair.
- No rewriting approved units.
- No browser UI.
- No branch creation or switching.
- No direct plugin tool in the initial implementation.

## Testing Strategy

Tests should cover:

- Running from an active branch repository.
- Producing, reviewing, approving, and exporting all units.
- Review failure creates repair task, repair returns to drafted, re-review can approve.
- Repair attempts are capped at `3` repairs by default.
- The initial failed review does not count as a repair attempt.
- The third failed re-review blocks and does not create a fourth repair attempt.
- Failure after max attempts returns a blocked report.
- Review failure without repair instructions blocks.
- Approved units are skipped and not rewritten.
- Existing `drafted` units are reviewed without being regenerated.
- Existing `repair_requested` units are repaired before later production continues.
- Existing `repairing` units resume only with a valid current repair task.
- Existing `rejected` units without repair instructions or resolvable open repair tasks block.
- Persisted `producing` units block.
- Planned-only remaining units without an actionable promoted unit block with sequencing context.
- Export is called only after all units are approved.
- Export result with skipped units returns a blocked report.
- Invalid `maxRepairAttemptsPerUnit` values are rejected.
- Missing `maxRepairAttemptsPerUnit` defaults to `3`.
- No active branch blocks.
- Missing requirements blocks.
- Missing production controls blocks.
- Missing story bible blocks.
- Missing production plan blocks.
- Missing or empty plot units block.
- Current active branch only: data from non-active branches is not read, written, produced, reviewed, repaired, or exported.
- Command asset documents manual intake/plan preconditions and automatic review/repair quality loop.
- Deployment includes the new command asset.

## Implementation Boundary

The implementation plan should build the testable core orchestrator and command asset. It should not add a direct plugin tool until real runtime adapters can be supplied. Tests should use injected deterministic agents for generation, review, and repair.
