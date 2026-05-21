# Novel Autorun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/novel-autorun` as the top-level command for guiding intake, planning readiness, final production blueprint approval, and then the existing automatic produce/review/repair/export loop.

**Architecture:** Implement the user-facing workflow as a managed OpenCode command routed through `novel-producer`, then add a small testable autorun readiness/reporting module only for deterministic checks that should not live in prompt text. Reuse existing `intake.ts`, `planning.ts`, `auto.ts`, branch routing, and repository APIs; do not duplicate the downstream production state machine.

**Tech Stack:** TypeScript, Vitest, OpenCode command markdown assets, existing novel-production repository modules.

---

## File Structure

- Create `.opencode/commands/novel-autorun.md`: managed command asset for the total-director autorun mode.
- Modify `tests/novel-production/opencode-assets.test.ts`: include the new command in the common asset contract and assert autorun-specific behavior.
- Modify `src/novel-production/deployment.ts`: include the new command in managed deployment assets.
- Modify `tests/novel-production/deployment.test.ts`: include the new command in seeded assets and update expected asset counts.
- Create `src/novel-production/autorun.ts`: focused readiness/reporting helpers for active-branch readiness, intake readiness, planning readiness, blueprint construction, and phase blocker reporting.
- Create `tests/novel-production/autorun.test.ts`: deterministic unit tests for readiness checks, active-branch blockers, downstream blocker propagation, and blueprint/report output.
- Do not modify `src/novel-production/auto.ts` unless tests prove the existing downstream API cannot be composed.

## Task 1: Add Command Asset Contract Tests

**Files:**
- Modify: `tests/novel-production/opencode-assets.test.ts`
- Create later: `.opencode/commands/novel-autorun.md`

- [ ] **Step 1: Add `novel-autorun` to the command asset list**

In `tests/novel-production/opencode-assets.test.ts`, add the command name after `novel-auto`:

```ts
const commandFiles = [
  "novel-init",
  "novel-intake",
  "novel-plan",
  "novel-produce",
  "novel-review",
  "novel-repair",
  "novel-export",
  "novel-status",
  "novel-read",
  "novel-branch",
  "novel-branch-create",
  "novel-branch-status",
  "novel-auto",
  "novel-autorun",
  "novel-inquiry",
];
```

- [ ] **Step 2: Add autorun-specific asset test**

Add a test near the existing `novel-auto` test:

```ts
test("novel-autorun command documents total-director workflow and final gate", async () => {
  const content = await readFile(".opencode/commands/novel-autorun.md", "utf8");

  expect(content).toContain("autorun mode");
  expect(content).toContain("/novel-init");
  expect(content).toContain("/novel-intake");
  expect(content).toContain("/novel-plan");
  expect(content).toContain("/novel-auto");
  expect(content).toContain("production blueprint");
  expect(content).toContain("final confirmation");
  expect(content).toContain("active branch");
  expect(content).toContain("review");
  expect(content).toContain("repair");
  expect(content).toContain("export");
  expect(content).not.toContain("novel_autorun");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts
```

Expected: FAIL because `.opencode/commands/novel-autorun.md` does not exist yet.

## Task 2: Create `/novel-autorun` Command Asset

**Files:**
- Create: `.opencode/commands/novel-autorun.md`
- Test: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Create command markdown**

Create `.opencode/commands/novel-autorun.md`:

```markdown
---
description: Run guided autorun mode from intake and planning through final manuscript export
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Start the active branch novel production autorun mode after `/novel-init`.

Workspace: `.novel-production/`.

Use the current active branch only. Do not create or switch branches unless the user explicitly asks.

Purpose: act as the total director for the finished novel, not just a shortcut for `/novel-auto`. Guide the project from requirements through production-ready planning, final production blueprint confirmation, automatic drafting, review, repair, re-review, approval, and export.

Autorun workflow:
- Confirm or create `/novel-intake` requirements.
- Ask only for missing core production requirements; keep confirmation loose and focused.
- Confirm or create `/novel-plan` outputs: story bible, production plan, plot units, major characters, and character bindings.
- Inspect existing planning for production readiness instead of accepting file presence alone.
- Present a concise production blueprint before prose generation.
- Require final confirmation before writing novel prose.
- After final confirmation, run the existing `/novel-auto` quality loop.
- Continue automatic drafting, review, repair, re-review, approval, and export until completed or blocked.

Production blueprint must summarize:
- intake: genre, length target, audience, tone, constraints, and special instructions
- story bible: premise, world, central conflict, themes, style, and continuity rules
- major characters: role, motivation, arc, and identifying traits
- plot nodes: each unit's narrative purpose, conflict movement, character movement, dependencies, and output role
- production policy: automatic drafting, review, repair limit, re-review requirement, and export behavior

Planning readiness requirements:
- non-placeholder story bible
- non-placeholder production plan
- at least one ordered plot unit
- each plot unit has a distinct narrative function
- major characters are instantiated in `story-bible.json.characters`
- plot units bind relevant known characters through `bindings.characterIds`
- no obvious contradiction between intake, story bible, and plot units

Stop and report a blocker instead of guessing when intake is missing critical information, planning is structurally weak, the user has not given final confirmation, branch state is ambiguous, or the downstream `/novel-auto` loop reports a blocker.

Route this command through `novel-producer` so intake, planning, drafting, review, repair, and export agents can participate. Do not rely on a direct `novel_autorun` plugin shortcut for this workflow.
```

- [ ] **Step 2: Run asset test**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts
```

Expected: PASS for the command asset tests.

## Task 3: Add Command to Deployment Assets

**Files:**
- Modify: `src/novel-production/deployment.ts`
- Modify: `tests/novel-production/deployment.test.ts`
- Test: `tests/novel-production/deployment.test.ts`

- [ ] **Step 1: Write failing deployment test updates**

In `tests/novel-production/deployment.test.ts`, add the new source asset after `.opencode/commands/novel-auto.md`:

```ts
const sourceAssetPaths = [
  // ...
  ".opencode/commands/novel-auto.md",
  ".opencode/commands/novel-autorun.md",
  ".opencode/commands/novel-inquiry.md",
  // ...
] as const;
```

Update the fresh target asset count from `23` to `24`:

```ts
expect(plan.assets.filter((asset) => asset.action === "create")).toHaveLength(24);
```

- [ ] **Step 2: Run deployment test to verify it fails**

Run:

```bash
npm test -- tests/novel-production/deployment.test.ts
```

Expected: FAIL because `managedAssetPaths` does not include `.opencode/commands/novel-autorun.md` yet.

- [ ] **Step 3: Add managed asset path**

In `src/novel-production/deployment.ts`, add the new command after `.opencode/commands/novel-auto.md`:

```ts
export const managedAssetPaths = [
  // ...
  ".opencode/commands/novel-auto.md",
  ".opencode/commands/novel-autorun.md",
  ".opencode/commands/novel-inquiry.md",
  // ...
] as const;
```

- [ ] **Step 4: Run deployment test**

Run:

```bash
npm test -- tests/novel-production/deployment.test.ts
```

Expected: PASS.

## Task 4: Add Autorun Readiness Module Tests

**Files:**
- Create: `tests/novel-production/autorun.test.ts`
- Create later: `src/novel-production/autorun.ts`

- [ ] **Step 1: Write tests for intake readiness**

Create `tests/novel-production/autorun.test.ts` with imports:

```ts
import { describe, expect, test } from "vitest";
import type { NovelRequirements, PlotUnitRecord, ProductionPlan, StoryBible } from "@/novel-production/schema";
import { buildAutorunBlueprint, createAutorunBlockedReport, evaluateAutorunReadiness } from "@/novel-production/autorun";
```

Add factory helpers in the test file for complete requirements, story bible, plan, and units. Keep them local to the test file.

Add test:

```ts
test("blocks when active branch is missing", () => {
  const result = evaluateAutorunReadiness({ activeBranchId: undefined });

  expect(result).toEqual({
    ready: false,
    phase: "branch",
    blocker: "No active branch is selected.",
    nextAction: "Run /novel-init or switch to an active branch before /novel-autorun.",
  });
});
```

Add test:

```ts
test("blocks intake when core requirements are missing", () => {
  const requirements = makeRequirements({ genre: "", originalBrief: "" });

  const result = evaluateAutorunReadiness({ activeBranchId: "main", requirements });

  expect(result).toEqual({
    ready: false,
    phase: "intake",
    blocker: "Intake is missing core requirements: originalBrief, genre",
    nextAction: "Run or continue /novel-intake with the missing core requirements.",
  });
});
```

- [ ] **Step 2: Write tests for missing planning**

Add test:

```ts
test("blocks planning when story bible, plan, or plot units are missing", () => {
  const result = evaluateAutorunReadiness({ activeBranchId: "main", requirements: makeRequirements() });

  expect(result).toMatchObject({
    ready: false,
    phase: "planning",
    blocker: "Planning artifacts are missing: storyBible, plan, plotUnits",
    nextAction: "Run or continue /novel-plan before final autorun confirmation.",
  });
});
```

- [ ] **Step 3: Write tests for weak planning**

Add test:

```ts
test("blocks planning when plot units lack production-ready structure", () => {
  const result = evaluateAutorunReadiness({
    activeBranchId: "main",
    requirements: makeRequirements(),
    storyBible: makeStoryBible({ characters: [] }),
    plan: makePlan(),
    plotUnits: [makePlotUnit({ purpose: "", summary: "" })],
  });

  expect(result.ready).toBe(false);
  expect(result.phase).toBe("planning");
  expect(result.blocker).toContain("storyBible.characters");
  expect(result.blocker).toContain("plotUnits[0].purpose");
  expect(result.blocker).toContain("plotUnits[0].summary");
});
```

- [ ] **Step 4: Write tests for final confirmation and blueprint**

Add tests:

```ts
test("requires final confirmation after intake and planning are ready", () => {
  const result = evaluateAutorunReadiness({
    activeBranchId: "main",
    requirements: makeRequirements(),
    storyBible: makeStoryBible(),
    plan: makePlan(),
    plotUnits: [makePlotUnit()],
  });

  expect(result).toMatchObject({
    ready: false,
    phase: "final_confirmation",
    blocker: "Final production confirmation has not been granted.",
  });
  expect(result.blueprint).toContain("# Production Blueprint");
});

test("is ready for auto loop after final confirmation", () => {
  const result = evaluateAutorunReadiness({
    activeBranchId: "main",
    requirements: makeRequirements(),
    storyBible: makeStoryBible(),
    plan: makePlan(),
    plotUnits: [makePlotUnit()],
    finalConfirmation: true,
  });

  expect(result).toMatchObject({
    ready: true,
    phase: "production",
    nextAction: "Run the existing /novel-auto production loop.",
  });
});
```

- [ ] **Step 5: Write tests for downstream blocker propagation**

Add test:

```ts
test("surfaces downstream auto blockers without swallowing them", () => {
  const result = createAutorunBlockedReport({
    activeBranchId: "main",
    phase: "production",
    blocker: "unit-2 exceeded the repair limit",
    nextAction: "Resolve the /novel-auto blocker, then rerun /novel-autorun.",
  });

  expect(result).toEqual({
    ready: false,
    activeBranchId: "main",
    phase: "production",
    blocker: "unit-2 exceeded the repair limit",
    nextAction: "Resolve the /novel-auto blocker, then rerun /novel-autorun.",
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run:

```bash
npm test -- tests/novel-production/autorun.test.ts
```

Expected: FAIL because `@/novel-production/autorun` does not exist yet.

## Task 5: Implement Autorun Readiness Module

**Files:**
- Create: `src/novel-production/autorun.ts`
- Test: `tests/novel-production/autorun.test.ts`

- [ ] **Step 1: Define public types**

Create `src/novel-production/autorun.ts`:

```ts
import type { NovelRequirements, PlotUnitRecord, ProductionPlan, StoryBible } from "./schema";

export type AutorunPhase = "branch" | "intake" | "planning" | "final_confirmation" | "production" | "review" | "repair" | "export";

export type AutorunReadinessInput = {
  activeBranchId?: string;
  requirements?: NovelRequirements;
  storyBible?: StoryBible;
  plan?: ProductionPlan;
  plotUnits?: PlotUnitRecord[];
  finalConfirmation?: boolean;
};

export type AutorunReadinessResult = {
  ready: boolean;
  activeBranchId?: string;
  phase: AutorunPhase;
  blocker?: string;
  nextAction: string;
  blueprint?: string;
};
```

- [ ] **Step 2: Implement readiness evaluation**

Implement:

```ts
export function evaluateAutorunReadiness(input: AutorunReadinessInput): AutorunReadinessResult {
  if (isBlank(input.activeBranchId ?? "")) {
    return {
      ready: false,
      phase: "branch",
      blocker: "No active branch is selected.",
      nextAction: "Run /novel-init or switch to an active branch before /novel-autorun.",
    };
  }

  if (input.requirements === undefined) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "intake",
      blocker: "Intake requirements are missing.",
      nextAction: "Run or continue /novel-intake with the missing core requirements.",
    };
  }

  const intakeIssues = getIntakeIssues(input.requirements);
  if (intakeIssues.length > 0) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "intake",
      blocker: `Intake is missing core requirements: ${intakeIssues.join(", ")}`,
      nextAction: "Run or continue /novel-intake with the missing core requirements.",
    };
  }

  const missingPlanning = getMissingPlanningArtifacts(input);
  if (missingPlanning.length > 0) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "planning",
      blocker: `Planning artifacts are missing: ${missingPlanning.join(", ")}`,
      nextAction: "Run or continue /novel-plan before final autorun confirmation.",
    };
  }

  const planningIssues = getPlanningIssues(input.storyBible, input.plan, input.plotUnits);
  if (planningIssues.length > 0) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "planning",
      blocker: `Planning is not production-ready: ${planningIssues.join(", ")}`,
      nextAction: "Revise /novel-plan outputs until the story bible and plot units are production-ready.",
    };
  }

  const blueprint = buildAutorunBlueprint({
    requirements: input.requirements,
    storyBible: input.storyBible,
    plan: input.plan,
    plotUnits: input.plotUnits,
  });

  if (input.finalConfirmation !== true) {
    return {
      ready: false,
      activeBranchId: input.activeBranchId,
      phase: "final_confirmation",
      blocker: "Final production confirmation has not been granted.",
      nextAction: "Ask the user to approve the production blueprint before running /novel-auto.",
      blueprint,
    };
  }

  return {
    ready: true,
    activeBranchId: input.activeBranchId,
    phase: "production",
    nextAction: "Run the existing /novel-auto production loop.",
    blueprint,
  };
}
```

- [ ] **Step 3: Implement helper checks**

Add private helpers:

```ts
function getIntakeIssues(requirements: NovelRequirements): string[] {
  const issues: string[] = [];
  if (isBlank(requirements.originalBrief)) issues.push("originalBrief");
  if (isBlank(requirements.genre)) issues.push("genre");
  if (isBlank(requirements.style)) issues.push("style");
  if (requirements.lengthTarget.totalWords <= 0) issues.push("lengthTarget.totalWords");
  if (requirements.lengthTarget.unitWords <= 0) issues.push("lengthTarget.unitWords");
  return issues;
}

function getMissingPlanningArtifacts(input: AutorunReadinessInput): string[] {
  const missing: string[] = [];
  if (input.storyBible === undefined) missing.push("storyBible");
  if (input.plan === undefined) missing.push("plan");
  if (input.plotUnits === undefined) missing.push("plotUnits");
  return missing;
}

function getPlanningIssues(
  storyBible: StoryBible | undefined,
  plan: ProductionPlan | undefined,
  plotUnits: PlotUnitRecord[] | undefined,
): string[] {
  if (storyBible === undefined || plan === undefined || plotUnits === undefined) return [];

  const issues: string[] = [];
  if (isBlank(storyBible.premise)) issues.push("storyBible.premise");
  if (isBlank(storyBible.world)) issues.push("storyBible.world");
  if (storyBible.characters.length === 0) issues.push("storyBible.characters");
  if (isBlank(plan.logline)) issues.push("plan.logline");
  if (plan.acts.length === 0) issues.push("plan.acts");
  if (plotUnits.length === 0) issues.push("plotUnits");

  const characterIds = new Set(storyBible.characters.map((character) => character.id));
  plotUnits.forEach((unit, index) => {
    if (isBlank(unit.purpose)) issues.push(`plotUnits[${index}].purpose`);
    if (isBlank(unit.summary)) issues.push(`plotUnits[${index}].summary`);
    for (const characterId of unit.bindings.characterIds) {
      if (!characterIds.has(characterId)) issues.push(`plotUnits[${index}].bindings.characterIds:${characterId}`);
    }
  });

  return issues;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}
```

- [ ] **Step 4: Implement downstream blocker report helper**

Add:

```ts
export function createAutorunBlockedReport(input: {
  activeBranchId?: string;
  phase: Exclude<AutorunPhase, "branch" | "intake" | "planning" | "final_confirmation">;
  blocker: string;
  nextAction: string;
}): AutorunReadinessResult {
  return {
    ready: false,
    ...(input.activeBranchId === undefined ? {} : { activeBranchId: input.activeBranchId }),
    phase: input.phase,
    blocker: input.blocker,
    nextAction: input.nextAction,
  };
}
```

- [ ] **Step 5: Implement blueprint builder**

Add:

```ts
export function buildAutorunBlueprint(input: {
  requirements: NovelRequirements;
  storyBible: StoryBible;
  plan: ProductionPlan;
  plotUnits: PlotUnitRecord[];
}): string {
  const characters = input.storyBible.characters
    .map((character) => `- ${character.name} (${character.role}): ${character.motivation}; arc: ${character.arc}`)
    .join("\n");
  const units = [...input.plotUnits]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((unit) => `- ${unit.orderIndex}. ${unit.title}: ${unit.purpose} (${unit.summary})`)
    .join("\n");

  return [
    "# Production Blueprint",
    "",
    "## Intake",
    `- Title: ${input.requirements.title}`,
    `- Genre: ${input.requirements.genre}`,
    `- Length: ${input.requirements.lengthTarget.totalWords} total words; ${input.requirements.lengthTarget.unitWords} words per unit`,
    `- Audience: ${input.requirements.targetAudience}`,
    `- Style: ${input.requirements.style}`,
    `- Must include: ${input.requirements.mustInclude.join(", ") || "None"}`,
    `- Must avoid: ${input.requirements.mustAvoid.join(", ") || "None"}`,
    "",
    "## Story Bible",
    `- Premise: ${input.storyBible.premise}`,
    `- World: ${input.storyBible.world}`,
    `- Continuity: ${input.storyBible.continuityRules.join("; ") || "None"}`,
    "",
    "## Major Characters",
    characters || "- None",
    "",
    "## Plot Nodes",
    units || "- None",
    "",
    "## Production Policy",
    "- Draft in plot-unit order.",
    "- Review every drafted unit.",
    "- Repair failed units with concrete instructions, then re-review.",
    "- Export only after every plot unit is approved.",
  ].join("\n");
}
```

- [ ] **Step 6: Run autorun tests**

Run:

```bash
npm test -- tests/novel-production/autorun.test.ts
```

Expected: PASS.

## Task 6: Validate Integration and Type Safety

**Files:**
- All files touched above

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts tests/novel-production/deployment.test.ts tests/novel-production/autorun.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run LSP diagnostics if available**

Run diagnostics on changed TypeScript files:

- `src/novel-production/autorun.ts`
- `src/novel-production/deployment.ts`
- `tests/novel-production/autorun.test.ts`
- `tests/novel-production/opencode-assets.test.ts`
- `tests/novel-production/deployment.test.ts`

Expected: no new diagnostics. If the language server is unavailable, record that explicitly in the final handoff.

## Task 7: Install Updated OpenCode Assets If Requested

**Files:**
- `.opencode/commands/novel-autorun.md`
- `src/novel-production/deployment.ts`

- [ ] **Step 1: Ask before installing globally**

Only install to `/Users/schelling/.config/opencode` if the user explicitly asks to update the global OpenCode assets.

- [ ] **Step 2: Run installer if approved**

Run:

```bash
npm run install:opencode-novel -- --target "/Users/schelling/.config/opencode" --write
```

Expected: output reports the new or updated command asset. Tell the user they may need to restart OpenCode for command discovery.

## Notes for Implementers

- Do not use `as any`, `@ts-ignore`, or `@ts-expect-error`.
- Do not add a direct plugin shortcut named `novel_autorun`.
- Do not start production before final confirmation.
- Keep `/novel-auto` as the authority for produce/review/repair/export behavior.
- If no git repository is present, skip commit steps and state that commits were unavailable because the directory is not a git repository.
