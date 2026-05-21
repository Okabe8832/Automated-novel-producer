# Novel Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/novel-auto`, a command-backed active-branch automation loop that produces, reviews, repairs, re-reviews, approves, and exports novel plot units after manual intake and planning.

**Architecture:** Add a testable core orchestrator in `src/novel-production/auto.ts` that composes existing production primitives instead of duplicating generation, review, repair, sequencing, or export logic. The initial user-facing surface is command-only through `novel-producer`; no direct plugin tool is added until real runtime adapters exist.

**Tech Stack:** TypeScript, Vitest, Node fs/path helpers, existing novel-production repository APIs, OpenCode command assets.

---

## File Structure

- Create `src/novel-production/auto.ts`: core `runNovelAuto` and `runActiveBranchNovelAuto` orchestration, option validation, resumable state selection, bounded repair counting, export gating, and run report types.
- Create `tests/novel-production/auto.test.ts`: deterministic injected-agent tests for success, repair loops, blockers, resumability, active-branch isolation, and validation.
- Create `.opencode/commands/novel-auto.md`: command asset routed through `novel-producer`; documents manual intake/plan preconditions and automatic review/repair loop.
- Modify `tests/novel-production/opencode-assets.test.ts`: include `novel-auto` in command assets and assert quality-loop documentation.
- Modify `src/novel-production/deployment.ts`: include `.opencode/commands/novel-auto.md` in `managedAssetPaths`.
- Modify `tests/novel-production/deployment.test.ts`: update managed asset expectations if the test asserts exact count/list.

Do not modify `.opencode/plugins/novel-production.ts` for `novel_auto` in this implementation.

## Task 1: Core Auto Orchestrator Types and Validation

**Files:**
- Create: `src/novel-production/auto.ts`
- Test: `tests/novel-production/auto.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add tests that import `runNovelAuto` from `@/novel-production/auto` and verify:

```ts
await expect(runNovelAuto(repo, agents, { maxRepairAttemptsPerUnit: 0 })).rejects.toThrow(/positive integer/i);
await expect(runNovelAuto(repo, agents, { maxRepairAttemptsPerUnit: 1.5 })).rejects.toThrow(/positive integer/i);
await expect(runNovelAuto(repo, agents, { maxRepairAttemptsPerUnit: Number.POSITIVE_INFINITY })).rejects.toThrow(/positive integer/i);
```

Also test missing option defaults by making a unit fail review four times and asserting only three repairs occur before blocking in Task 3.

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts
```

Expected: FAIL because `@/novel-production/auto` does not exist.

- [ ] **Step 3: Add public types and option validation**

Create `src/novel-production/auto.ts` with:

```ts
import type { ExportResult } from "./export";
import type { NovelProductionRepository } from "./repository";
import type { IsoTimestamp, PlotUnitRecord, RepairTaskRecord, ReviewRecord } from "./schema";

export type NovelAutoOptions = {
  maxRepairAttemptsPerUnit?: number;
  now?: () => IsoTimestamp;
};

export type NovelAutoReviewRequest = {
  unit: PlotUnitRecord;
  draft: string;
  repairAttempt: number;
};

export type NovelAutoRepairRequest = {
  draft: string;
  repairTask: RepairTaskRecord;
  prompt: string;
};

export type NovelAutoReviewDecision = {
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

export type NovelAutoAgents = {
  generate(prompt: string): Promise<string>;
  review(input: NovelAutoReviewRequest): Promise<NovelAutoReviewDecision>;
  repair(input: NovelAutoRepairRequest): Promise<string>;
};

export type NovelAutoRunReport = {
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

const defaultMaxRepairAttemptsPerUnit = 3;

function resolveMaxRepairAttempts(value: number | undefined): number {
  if (value === undefined) {
    return defaultMaxRepairAttemptsPerUnit;
  }
  if (!Number.isInteger(value) || value < 1 || !Number.isFinite(value)) {
    throw new Error("maxRepairAttemptsPerUnit must be a positive integer");
  }
  return value;
}
```

Add a temporary minimal `runNovelAuto` that validates options and returns a blocked report for missing data. It will be completed in later tasks.

- [ ] **Step 4: Run validation tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts
```

Expected: validation tests PASS; feature-flow tests may still be absent or pending.

## Task 2: Preconditions and Active Branch Entry Point

**Files:**
- Modify: `src/novel-production/auto.ts`
- Test: `tests/novel-production/auto.test.ts`

- [ ] **Step 1: Write failing precondition tests**

Test that `runNovelAuto` returns `status: "blocked"` with a useful blocker when required artifacts are missing:

- requirements missing
- production controls missing
- story bible missing
- production plan missing
- empty plot units

Test that `runActiveBranchNovelAuto(root, agents)` blocks when no active branch exists.

Test active-branch isolation:

1. Create root workspace.
2. Create two branches with `createNovelBranch`.
3. Seed only the active branch with requirements, plan, units, and draft flow.
4. Run `runActiveBranchNovelAuto`.
5. Assert exported manuscript path contains `.novel-production/branches/<active>/exports/manuscript.md`.
6. Assert root or non-active branch manuscript is absent.

- [ ] **Step 2: Run failing precondition tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts
```

Expected: FAIL until precondition checks and active-branch entry point exist.

- [ ] **Step 3: Implement precondition validation**

In `runNovelAuto`, load each required artifact with small helper functions that convert missing-file errors into blocked reports:

```ts
async function loadRequired<T>(load: () => Promise<T>, blocker: string): Promise<{ ok: true; value: T } | { ok: false; blocker: string }> {
  try {
    return { ok: true, value: await load() };
  } catch {
    return { ok: false, blocker };
  }
}
```

Validate:

- `repository.loadRequirements()`
- `repository.loadProductionControls()`
- `repository.loadStoryBible()`
- `repository.loadPlan()`
- `repository.loadPlotUnits()` and length > 0

Add `runActiveBranchNovelAuto` using `createActiveBranchNovelProductionRepository(root)` and returning a blocked report if active branch resolution fails.

- [ ] **Step 4: Run precondition tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts
```

Expected: precondition and active-branch tests PASS.

## Task 3: Produce, Review, Approve, and Export Happy Path

**Files:**
- Modify: `src/novel-production/auto.ts`
- Test: `tests/novel-production/auto.test.ts`

- [ ] **Step 1: Write failing happy-path test**

Seed a normal active branch or repository with intake and plan for two units. Use deterministic agents:

```ts
const agents = {
  async generate() {
    return "自动生成的中文正文。";
  },
  async review() {
    return {
      result: "pass" as const,
      reviewMode: "agent_assisted",
      checklist: passingChecklist,
      issues: [],
      decisionNotes: "通过",
    };
  },
  async repair() {
    return "修复后的中文正文。";
  },
};
```

Assert:

- report status is `completed`
- both unit ids are in `processedUnitIds`
- both unit ids are in `approvedUnitIds`
- `exportResult?.skippedUnitIds` equals `[]`
- manuscript contains generated text in order

Adjust the agent type if `NovelAutoReviewDecision` does not include `reviewMode`; the orchestrator should pass `reviewMode: "agent_assisted"` into `reviewPlotUnit`.

- [ ] **Step 2: Run failing happy-path test**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts -t "produces reviews approves and exports"
```

Expected: FAIL because loop is not implemented.

- [ ] **Step 3: Implement main loop**

Implement loop helpers:

```ts
function sortUnits(units: PlotUnitRecord[]): PlotUnitRecord[] {
  return [...units].sort((left, right) => left.orderIndex - right.orderIndex);
}

function createBlockedReport(partial: Partial<NovelAutoRunReport>, blocker: string, blockedUnitId?: string): NovelAutoRunReport { ... }
```

Main behavior:

1. Load sorted units each iteration.
2. If every unit is approved, gate export.
3. Find highest-priority actionable unit:
   - repair states first by order: `repair_requested`, `repairing`, resolvable `rejected`
   - then review states: `drafted`, `reviewing`
   - then production state: `ready_to_produce`
4. For `ready_to_produce`, call `producePlotUnit(repository, unit.id, { generate: agents.generate }, { now })`.
5. If production returns a failed run or leaves unit `ready_to_produce`, block with the run error.
6. For `drafted`/`reviewing`, read draft, call `agents.review`, then pass decision to `reviewPlotUnit` with `reviewMode: "agent_assisted"`.
7. Track processed and approved ids without duplicates.
8. Do not implement `stopAfterUnitId` behavior in this iteration. Remove `stopAfterUnitId` from `NovelAutoOptions` before implementation unless a later spec revision defines exact semantics and tests. The approved report type only supports `"completed" | "blocked"`, so an undefined partial-success state must not be invented.

- [ ] **Step 4: Implement export gate**

Before export:

```ts
const unitsBeforeExport = await repository.loadPlotUnits();
const unapproved = unitsBeforeExport.filter((unit) => unit.status !== "approved");
if (unapproved.length > 0) return blocked(...);
const exportResult = await exportManuscript(repository);
if (exportResult.skippedUnitIds.length > 0) return blocked(...);
return completed report;
```

- [ ] **Step 5: Run happy-path test**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts -t "produces reviews approves and exports"
```

Expected: PASS.

## Task 4: Repair Loop and Attempt Cap

**Files:**
- Modify: `src/novel-production/auto.ts`
- Test: `tests/novel-production/auto.test.ts`

- [ ] **Step 1: Write failing repair-success test**

Use a review agent that fails first with repair instructions and passes after repair:

```ts
let reviewCalls = 0;
const agents = {
  async generate() { return "初稿。"; },
  async review() {
    reviewCalls += 1;
    if (reviewCalls === 1) {
      return {
        result: "fail" as const,
        checklist: failingChecklist,
        issues: ["质量不足"],
        decisionNotes: "需要增强",
        repair: { scope: "unit", intensity: "medium", instructions: "增强冲突和细节。" },
      };
    }
    return { result: "pass" as const, checklist: passingChecklist, issues: [], decisionNotes: "通过" };
  },
  async repair() { return "修复后的正文。"; },
};
```

Assert unit becomes approved, `repairedUnitIds` includes the unit, and `repairAttemptsByUnitId[unitId]` is `1`.

- [ ] **Step 2: Write failing no-repair blocker test**

Use a review agent that returns `fail` without a `repair` object. Assert:

- status is `blocked`
- `blockedUnitId` is the reviewed unit
- blocker mentions repair instructions
- repair agent is not called
- export is not called and manuscript is absent

- [ ] **Step 3: Write failing cap test**

Use review agent that always fails with repair instructions. With default options, assert:

- status is `blocked`
- `repairAttemptsByUnitId[unitId]` is `3`
- repair agent was called exactly `3` times
- review agent was called `4` times: initial review plus three re-reviews
- blocker mentions max repair attempts

- [ ] **Step 4: Run failing repair tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts -t "repair"
```

Expected: FAIL until repair handling exists.

- [ ] **Step 5: Implement repair handling**

For `repair_requested` and `repairing`:

1. Resolve repair task id from `unit.currentRepairTaskId`.
2. Load repair task.
3. Validate task status is `open` or `in_progress` and target matches unit.
4. Check current attempt count before repairing.
5. If count is already `>= maxRepairAttemptsPerUnit`, block before another repair.
6. Read current draft only if needed for reporting; `repairPlotUnit` will also read the draft and build the repair prompt.
7. Call `repairPlotUnit(repository, repairTask.id, { repair: agents.repair }, { now })`, with `NovelAutoAgents.repair` typed to accept the exact primitive input `{ draft, repairTask, prompt }`.
8. Increment `repairAttemptsByUnitId[unit.id]` only after `repairPlotUnit` succeeds.
9. Add unit id to `repairedUnitIds`.
10. Continue loop so the returned `drafted` unit is reviewed again.

For review failures with repair instructions, rely on `reviewPlotUnit` to create the repair task and move the unit to `repair_requested`.

For review failures without repair instructions, return a blocked report immediately after `reviewPlotUnit` records the rejected state. Do not attempt repair, do not approve, and do not export.

- [ ] **Step 6: Run repair tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts -t "repair"
```

Expected: PASS.

## Task 5: Resume and Unsupported State Blockers

**Files:**
- Modify: `src/novel-production/auto.ts`
- Test: `tests/novel-production/auto.test.ts`

- [ ] **Step 1: Write failing resume tests**

Add tests for:

- Existing `drafted` unit is reviewed without calling `generate`.
- Existing `repair_requested` unit is repaired before a later `ready_to_produce` unit.
- Existing `repairing` unit resumes only when `currentRepairTaskId` points to an `in_progress` repair task.
- Existing `rejected` without resolvable repair task blocks.
- Existing `producing` blocks.
- Planned-only remaining units with no actionable unit block.

Use repository setup patterns from `tests/novel-production/review-repair.test.ts` and direct `repo.savePlotUnits` where necessary.

- [ ] **Step 2: Run failing resume tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts -t "resume"
```

Expected: FAIL until state selection is complete.

- [ ] **Step 3: Complete actionable-unit selection**

Implement selection in this priority:

1. Any `producing` unit blocks immediately.
2. Earliest repair-priority unit among `repair_requested`, `repairing`, and resolvable `rejected`.
3. Earliest `drafted` or `reviewing` unit.
4. Earliest `ready_to_produce` unit.
5. If all approved, export.
6. Otherwise block with unsupported/sequencing context.

For `rejected`, only proceed if an open or in-progress repair task can be deterministically resolved from `currentRepairTaskId`. Do not scan and guess among multiple tasks unless repository APIs make an exact lookup possible.

- [ ] **Step 4: Run resume tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts -t "resume"
```

Expected: PASS.

## Task 6: Command Asset and Deployment Registration

**Files:**
- Create: `.opencode/commands/novel-auto.md`
- Modify: `tests/novel-production/opencode-assets.test.ts`
- Modify: `src/novel-production/deployment.ts`
- Modify: `tests/novel-production/deployment.test.ts` if exact managed assets are asserted

- [ ] **Step 1: Write failing asset tests**

In `tests/novel-production/opencode-assets.test.ts`, add `novel-auto` to `commandFiles`.

Add a specific test:

```ts
test("novel-auto command documents quality loop and manual preconditions", async () => {
  const content = await readFile(".opencode/commands/novel-auto.md", "utf8");
  expect(content).toContain("manual");
  expect(content).toContain("/novel-intake");
  expect(content).toContain("/novel-plan");
  expect(content).toContain("review");
  expect(content).toContain("repair");
  expect(content).toContain("3");
  expect(content).toContain("active branch");
  expect(content).not.toContain("novel_auto");
});
```

If deployment tests assert the full managed list or count, add `.opencode/commands/novel-auto.md` to expected assets.

- [ ] **Step 2: Run failing asset tests**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts tests/novel-production/deployment.test.ts
```

Expected: FAIL because command asset and deployment registration are missing.

- [ ] **Step 3: Create command asset**

Create `.opencode/commands/novel-auto.md` following existing command frontmatter patterns:

```markdown
---
description: Run the approved novel production plan through automatic drafting, review, repair, and export
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Run the active branch novel production workflow after the user has manually completed `/novel-intake` and `/novel-plan`.

Use the current active branch only. Do not create or switch branches.

Quality loop:
- Produce the next ready plot unit.
- Review every drafted unit.
- If review fails with repair instructions, repair the unit and re-review it.
- Use at most 3 repairs per plot unit by default.
- Never approve directly after produce or repair; approval requires a passing review.
- Export only after every plot unit is approved.

If a unit cannot pass review, lacks repair instructions, exceeds the repair limit, or is in an unsafe interrupted state, stop and report the blocker.
```

- [ ] **Step 4: Register deployment asset**

Add `.opencode/commands/novel-auto.md` to `managedAssetPaths` in `src/novel-production/deployment.ts` near other command assets.

Update deployment tests only where required by failing assertions.

- [ ] **Step 5: Run asset tests**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts tests/novel-production/deployment.test.ts
```

Expected: PASS.

## Task 7: Verification and Final Review

**Files:**
- All changed files

- [ ] **Step 1: Run targeted novel-auto tests**

Run:

```bash
npm test -- tests/novel-production/auto.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run related asset/deployment tests**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts tests/novel-production/deployment.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run LSP diagnostics if available**

Run diagnostics on changed TypeScript files:

- `src/novel-production/auto.ts`
- `tests/novel-production/auto.test.ts`
- `src/novel-production/deployment.ts`

Expected: no new diagnostics. If the language server is unavailable, record the tool error explicitly.

- [ ] **Step 6: Request final review**

Ask Oracle or the review-work workflow to review:

- spec: `docs/superpowers/specs/2026-05-18-novel-auto-design.md`
- plan: `docs/superpowers/plans/2026-05-18-novel-auto-implementation.md`
- implementation diff
- verification output

Expected: APPROVED or concrete issues fixed before final handoff.
