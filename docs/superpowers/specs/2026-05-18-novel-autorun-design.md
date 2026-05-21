# Novel Autorun Design

## Goal

Add `/novel-autorun` as the top-level novel production mode after `/novel-init`. It should guide the project from initial requirements through production-ready planning, final blueprint confirmation, automatic draft production, automatic review and repair, and final manuscript export.

`/novel-autorun` is not just a shortcut for `/novel-intake`, `/novel-plan`, and `/novel-auto`. It is the system-level director for producing a finished novel more accurately, automatically, logically, and systematically.

## Relationship to Existing Commands

`/novel-auto` remains the downstream automation loop. It assumes intake and planning already exist, then produces, reviews, repairs, re-reviews, approves, and exports the active branch.

`/novel-autorun` sits above it:

```text
/novel-init
  -> /novel-autorun
       -> confirm or create intake
       -> confirm or create production plan
       -> confirm story bible and plot nodes
       -> final production approval
       -> existing /novel-auto production loop
       -> exported manuscript
```

The new command should reuse existing intake, planning, generation, review, repair, export, branch, status, and repository primitives. It should not duplicate the production state machine already defined by `/novel-auto`.

## User Experience

The command starts an "autorun mode" for the active branch. The default confirmation style is loose: the system should avoid unnecessary interruptions and should ask the user only when missing information, contradictions, weak story logic, or final production approval require human input.

The intended experience:

1. If intake is missing, collect enough requirements to create it.
2. If intake exists, summarize it and ask only for missing or conflicting essentials.
3. If planning is missing, create a complete story bible, production plan, and plot-unit list from the intake.
4. If planning exists, inspect it for production readiness instead of blindly accepting file presence.
5. Present a concise full-book production blueprint.
6. Wait for one final user confirmation before writing novel prose.
7. After final confirmation, run automatic production, review, repair, re-review, approval, and export until completed or blocked.

## Production Blueprint

Before prose production starts, `/novel-autorun` must present a blueprint that is clear enough for the user to approve the entire run.

The blueprint should include:

- intake summary: genre, length target, audience, tone, constraints, and special instructions
- story bible summary: premise, world, central conflict, themes, style, and continuity rules
- major character list: role, motivation, arc, and appearance or identifying traits when relevant
- plot-node list: each unit's purpose, conflict movement, character movement, dependency on previous units, and intended output role
- production policy: automatic drafting, review, repair limit, re-review requirement, and export behavior

This is the main upgrade over `/novel-auto`: the system checks whether the story is logically producible before it starts drafting.

## Intake Readiness

`/novel-autorun` should treat intake as ready only when the requirements are sufficient to drive planning. It should not require exhaustive detail, but it should require enough structure to avoid arbitrary generation.

Minimum intake readiness should include:

- story type or genre
- approximate length or unit count target
- core premise or protagonist situation
- desired tone and style constraints
- major exclusions or must-have requirements if the user provides any

If required information is missing, autorun asks focused questions. In loose mode, it should batch only closely related missing fields and avoid asking for details the planner can reasonably infer.

## Planning Readiness

`/novel-autorun` should treat planning as ready only when the story bible and plot units can guide production without placeholder logic.

Planning readiness should include:

- non-placeholder story bible
- non-placeholder production plan
- at least one plot unit
- clear sequential ordering
- each plot unit has a distinct narrative function
- major characters needed by the story are instantiated in planning
- plot-unit character bindings reference known characters only
- no obvious conflict between intake constraints, story bible, and plot units

This should build on the existing `/novel-plan` rule that major characters must be instantiated during planning rather than left as vague placeholders.

## Confirmation Gates

The command should avoid adding a large new persistent state machine for human confirmation. Existing durable artifacts already model most of the workflow: requirements, story bible, production plan, plot units, drafts, reviews, repair tasks, approvals, exports, and reports.

The recommended confirmation gates are command-level orchestration checkpoints:

1. Intake confirmation: requirements are sufficient for planning.
2. Plan confirmation: story bible and plot units are sufficient for production.
3. Final production confirmation: user approves the full production blueprint.

Only the final production confirmation is mandatory in normal loose mode. Earlier gates should interrupt only when information is missing, contradictory, or structurally unsafe.

## Automatic Production Loop

After final production confirmation, `/novel-autorun` should call into the existing `/novel-auto` behavior rather than reimplementing it.

The downstream loop remains:

```text
ready_to_produce -> producing -> drafted -> review -> approved
                                      -> repair_requested -> repairing -> drafted -> review
```

Rules inherited from `/novel-auto`:

- approved units are never rewritten automatically
- failed review requires repair instructions
- repaired units must be reviewed again before approval
- repair attempts are bounded
- export occurs only after every plot unit is approved
- any unsafe or ambiguous state produces a blocked report instead of speculative continuation

## Branch Behavior

`/novel-autorun` operates only on the current active branch. It should not silently create, switch, or process multiple branches.

If there is no active branch, the command should block with a clear instruction to run `/novel-init` or create/switch a branch first. If branch state is inconsistent, it should block rather than guessing the target workspace.

## Reports and Blockers

Autorun should produce a clear final report whether it completes or blocks.

Completed report should include:

- active branch id
- units produced
- units repaired
- units approved
- export path or export metadata

Blocked report should include:

- active branch id if available
- current phase: intake, planning, final confirmation, production, review, repair, or export
- blocking reason
- next recommended action

The report should prefer actionable language over internal implementation details.

## Architecture

Add a user-facing command asset:

```text
.opencode/commands/novel-autorun.md
```

The command should route through `novel-producer` or the existing novel production agent flow so it can coordinate intake, planning, drafting, review, repair, and export with the right specialist agents.

Optional core support may be added if implementation needs a testable orchestration layer:

```text
src/novel-production/autorun.ts
tests/novel-production/autorun.test.ts
```

If added, this layer should focus on readiness checks and phase reporting. It should compose existing modules rather than duplicating their behavior:

- `intake.ts` for requirements capture
- `planning.ts` for story bible, production plan, plot units, and character bindings
- `auto.ts` for downstream production/review/repair/export automation
- `branches.ts` and `repository.ts` for active-branch routing
- `status.ts` and branch status helpers for summaries and reports

## Testing Strategy

Implementation should add tests for the command and any new core readiness layer.

Expected coverage:

- command asset exists and documents the full autorun workflow
- deployment includes the new command asset
- missing active branch blocks clearly
- missing intake enters intake phase instead of production
- incomplete intake blocks or requests focused clarification
- missing plan enters planning phase instead of production
- placeholder or structurally weak plan blocks before drafting
- final production gate happens before first draft generation
- confirmed blueprint proceeds into existing auto loop
- active-branch isolation is preserved
- downstream auto blockers are surfaced without being swallowed

Existing `/novel-auto` tests should remain the authority for produce/review/repair/export behavior.

## Non-Goals

- No cross-branch autorun.
- No silent production before final confirmation.
- No infinite repair or review loop.
- No approval without review.
- No direct approval after repair.
- No rewriting approved units.
- No large new persistent confirmation state machine unless implementation proves command-level checkpoints are insufficient.
- No duplicate implementation of generation, review, repair, export, or sequencing logic.

## Open Implementation Decision

The implementation plan should decide whether `/novel-autorun` can initially be command-guided only, or whether a small `autorun.ts` readiness/reporting module is needed for testability.

The preferred starting point is a small testable readiness/reporting module plus a command asset. This keeps the design systematic without disturbing the stable `/novel-auto` production loop.
