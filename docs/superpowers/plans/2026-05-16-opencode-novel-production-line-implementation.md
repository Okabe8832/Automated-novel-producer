# OpenCode Novel Production Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the local web story workbench into an OpenCode-native novel production line that captures requirements, plans a manuscript, produces Chinese prose units, reviews/repairs them, and exports approved text.

**Architecture:** Implement a file-backed production core in `src/novel-production`, project-local OpenCode agents/commands under `.opencode`, and a thin plugin helper. Keep the old Next.js/SQLite surface until the production core passes tests, then decommission it explicitly.

**Tech Stack:** TypeScript, Node `fs/promises`, Vitest, OpenCode markdown agents/commands, project-local OpenCode plugin TypeScript.

---

## Source Spec

- Primary spec: `docs/superpowers/specs/2026-05-16-opencode-novel-production-line-design.md`
- Superseded spec: `docs/superpowers/specs/2026-05-16-opencode-story-agent-plugin-design.md`

## Important Execution Rules

- Use TDD: write a failing test, verify it fails, implement, verify it passes.
- Do not call external AI in tests. Use fake generators/reviewers.
- Do not delete the old web app until the new file-backed production line passes its core tests.
- Do not rely on undocumented OpenCode plugin APIs. Agents and commands are markdown assets; plugin helper must stay optional.
- Do not commit unless the user explicitly asks for commits. The checkpoint steps below are verification checkpoints, not git commits.
- Keep generated novel prose Chinese by default.

## File Structure

Create:

```text
src/novel-production/
  schema.ts              # Types, validators, status transition helpers
  workspace.ts           # Directory layout, initialization, atomic JSON/Markdown file IO
  repository.ts          # High-level workspace repository operations
  intake.ts              # Requirements and controls intake helpers
  planning.ts            # Story bible, plan, and plot unit persistence helpers
  prompt.ts              # Prompt snapshot builder and prompt renderer
  generation.ts          # Unit production orchestration with injectable generator
  review.ts              # Review records and approval/rejection state changes
  repair.ts              # Repair task creation/application orchestration
  export.ts              # Manuscript export
  status.ts              # Production report/status summary

tests/novel-production/
  schema.test.ts
  workspace.test.ts
  intake-planning.test.ts
  prompt-generation.test.ts
  review-repair.test.ts
  export-status.test.ts
  opencode-assets.test.ts
  plugin-helper.test.ts

.opencode/
  agents/
    novel-producer.md
    novel-planner.md
    novel-drafter.md
    novel-reviewer.md
    novel-repairer.md
    novel-continuity.md
    novel-exporter.md
  commands/
    novel-init.md
    novel-intake.md
    novel-plan.md
    novel-produce.md
    novel-review.md
    novel-repair.md
    novel-export.md
    novel-status.md
  plugins/
    novel-production.ts
```

Modify later, after the production core passes:

```text
package.json
package-lock.json
tsconfig.json
```

Candidate removal after replacement:

```text
src/app/
src/components/
src/db/
src/features/
src/ai/
src/lib/env.ts
e2e/
playwright.config.ts
next.config.ts
next-env.d.ts
tests/actions/
tests/ai/
tests/db/
tests/domain/
tests/settings/
```

---

### Task 1: Schema and Status Contracts

**Files:**
- Create: `src/novel-production/schema.ts`
- Create: `tests/novel-production/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `tests/novel-production/schema.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  createDefaultProductionControls,
  createEmptyElementPools,
  createEmptyPrototypes,
  parseRequirements,
  parsePlotUnits,
  transitionPlotUnitStatus,
} from "@/novel-production/schema";

describe("novel production schema", () => {
  test("parses a minimal Chinese novel requirement", () => {
    const requirements = parseRequirements({
      schemaVersion: 1,
      id: "req-1",
      title: "废弃卫星来信",
      originalBrief: "写一篇科幻悬疑小说",
      language: "zh-CN",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻、克制",
      pointOfView: "第三人称",
      lengthTarget: { totalWords: 80000, unitWords: 2000 },
      mustInclude: ["废弃卫星"],
      mustAvoid: ["英文正文"],
      referenceNotes: [],
      qualityBar: ["符合用户要求", "中文表达自然"],
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    });

    expect(requirements.language).toBe("zh-CN");
    expect(requirements.lengthTarget.unitWords).toBe(2000);
  });

  test("rejects invalid plot unit status", () => {
    expect(() => parsePlotUnits([{ id: "unit-1", status: "done" }])).toThrow(/status/i);
  });

  test("allows valid sequential status transitions", () => {
    expect(transitionPlotUnitStatus("planned", "ready_to_produce")).toBe("ready_to_produce");
    expect(transitionPlotUnitStatus("ready_to_produce", "producing")).toBe("producing");
    expect(transitionPlotUnitStatus("producing", "drafted")).toBe("drafted");
  });

  test("rejects skipping review before approval", () => {
    expect(() => transitionPlotUnitStatus("drafted", "approved")).toThrow(/invalid/i);
  });

  test("creates default supporting collections", () => {
    expect(createDefaultProductionControls().generationMode).toBe("sequential");
    expect(createEmptyPrototypes()).toEqual([]);
    expect(createEmptyElementPools()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/schema.test.ts`

Expected: FAIL because `@/novel-production/schema` does not exist.

- [ ] **Step 3: Implement schema contracts**

Create `src/novel-production/schema.ts` with exported types and runtime validators. Implement manual validators; do not add a validation dependency.

Required exports:

```ts
export type IsoTimestamp = string;

export type GenerationMode = "sequential" | "selected_units";
export type ReviewMode = "manual" | "agent_assisted" | "both";
export type ApprovedUnitPolicy = "locked" | "repair_with_confirmation";
export type RepairIntensity = "light" | "medium" | "strong";

export type PlotUnitStatus =
  | "planned"
  | "ready_to_produce"
  | "producing"
  | "drafted"
  | "reviewing"
  | "approved"
  | "rejected"
  | "repair_requested"
  | "repairing";

export type GenerationRunStatus = "pending" | "running" | "succeeded" | "failed";
export type ReviewResult = "pass" | "fail";
export type RepairTaskStatus = "open" | "in_progress" | "completed" | "cancelled";
```

Implement interfaces matching the spec:

- `NovelRequirements`
- `ProductionControls`
- `StoryBible`
- `PrototypeRecord`
- `ElementPoolRecord`
- `ProductionPlan`
- `PlotUnitRecord`
- `ReviewRecord`
- `RepairTaskRecord`
- `GenerationRunRecord`

Implement validators and helpers:

```ts
export function parseRequirements(value: unknown): NovelRequirements;
export function parseProductionControls(value: unknown): ProductionControls;
export function parseStoryBible(value: unknown): StoryBible;
export function parsePrototypes(value: unknown): PrototypeRecord[];
export function parseElementPools(value: unknown): ElementPoolRecord[];
export function parseProductionPlan(value: unknown): ProductionPlan;
export function parsePlotUnits(value: unknown): PlotUnitRecord[];
export function parseReviewRecord(value: unknown): ReviewRecord;
export function parseRepairTask(value: unknown): RepairTaskRecord;
export function parseGenerationRun(value: unknown): GenerationRunRecord;

export function createDefaultProductionControls(now?: () => IsoTimestamp): ProductionControls;
export function createEmptyPrototypes(): PrototypeRecord[];
export function createEmptyElementPools(): ElementPoolRecord[];
export function transitionPlotUnitStatus(current: PlotUnitStatus, next: PlotUnitStatus): PlotUnitStatus;
```

Transition map:

```ts
const allowedTransitions: Record<PlotUnitStatus, PlotUnitStatus[]> = {
  planned: ["ready_to_produce"],
  ready_to_produce: ["producing"],
  producing: ["drafted", "ready_to_produce"],
  drafted: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: [],
  rejected: ["repair_requested"],
  repair_requested: ["repairing"],
  repairing: ["drafted"],
};
```

- [ ] **Step 4: Run schema tests and verify pass**

Run: `npm test -- tests/novel-production/schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `npx tsc --noEmit --pretty false`

Expected: exit 0 or only pre-existing unrelated errors. Do not commit unless the user explicitly requests it.

---

### Task 2: Workspace and File Repository

**Files:**
- Create: `src/novel-production/workspace.ts`
- Create: `src/novel-production/repository.ts`
- Create: `tests/novel-production/workspace.test.ts`

- [ ] **Step 1: Write failing workspace tests**

Create `tests/novel-production/workspace.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createNovelProductionRepository } from "@/novel-production/repository";
import { initializeNovelProductionWorkspace, workspacePaths } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("novel production workspace", () => {
  test("initializes all required files and directories", async () => {
    await initializeNovelProductionWorkspace(root);
    const paths = workspacePaths(root);

    await expect(readFile(paths.requirements, "utf8")).resolves.toContain("schemaVersion");
    await expect(readFile(paths.productionControls, "utf8")).resolves.toContain("generationMode");
    await expect(readFile(paths.plotUnits, "utf8")).resolves.toBe("[]\n");
  });

  test("repository round-trips requirements", async () => {
    await initializeNovelProductionWorkspace(root);
    const repo = createNovelProductionRepository(root);

    await repo.saveRequirements({
      schemaVersion: 1,
      id: "req-1",
      title: "废弃卫星来信",
      originalBrief: "写一篇科幻悬疑小说",
      language: "zh-CN",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      lengthTarget: { totalWords: 80000, unitWords: 2000 },
      mustInclude: [],
      mustAvoid: [],
      referenceNotes: [],
      qualityBar: ["符合用户要求"],
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    });

    await expect(repo.loadRequirements()).resolves.toMatchObject({ title: "废弃卫星来信" });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/workspace.test.ts`

Expected: FAIL because workspace/repository modules do not exist.

- [ ] **Step 3: Implement workspace IO**

Create `src/novel-production/workspace.ts` with:

```ts
export type NovelProductionPaths = {
  root: string;
  workspace: string;
  requirements: string;
  productionControls: string;
  storyBible: string;
  prototypes: string;
  elementPools: string;
  plan: string;
  plotUnits: string;
  materialsDir: string;
  materialDecompositionsDir: string;
  draftsDir: string;
  reviewsDir: string;
  repairTasksDir: string;
  generationRunsDir: string;
  exportsDir: string;
  reportsDir: string;
  manuscript: string;
  productionReport: string;
};

export function workspacePaths(root: string): NovelProductionPaths;
export async function initializeNovelProductionWorkspace(root: string): Promise<void>;
export async function readJsonFile<T>(path: string, parse: (value: unknown) => T): Promise<T>;
export async function writeJsonFile(path: string, value: unknown): Promise<void>;
export async function writeTextFile(path: string, value: string): Promise<void>;
export async function readTextFile(path: string): Promise<string>;
```

Use `fs/promises.mkdir`, `readFile`, `writeFile`, `rename`. Atomic write pattern: write to `${path}.tmp-${process.pid}-${Date.now()}` then rename.

- [ ] **Step 4: Implement repository**

Create `src/novel-production/repository.ts` with `createNovelProductionRepository(root: string)` returning methods:

```ts
loadRequirements(); saveRequirements(value);
loadProductionControls(); saveProductionControls(value);
loadStoryBible(); saveStoryBible(value);
loadPrototypes(); savePrototypes(value);
loadElementPools(); saveElementPools(value);
loadPlan(); savePlan(value);
loadPlotUnits(); savePlotUnits(value);
readDraft(unitId: string); writeDraft(unitId: string, text: string);
loadReview(reviewId: string); saveReview(value);
loadRepairTask(repairId: string); saveRepairTask(value);
loadGenerationRun(runId: string); saveGenerationRun(value);
writeManuscript(text: string); readManuscript();
writeProductionReport(text: string); readProductionReport();
```

- [ ] **Step 5: Run workspace tests and verify pass**

Run: `npm test -- tests/novel-production/workspace.test.ts`

Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `npm test -- tests/novel-production/schema.test.ts tests/novel-production/workspace.test.ts`

Expected: PASS.

---

### Task 3: Intake and Planning Core

**Files:**
- Create: `src/novel-production/intake.ts`
- Create: `src/novel-production/planning.ts`
- Create: `tests/novel-production/intake-planning.test.ts`

- [ ] **Step 1: Write failing intake/planning tests**

Create `tests/novel-production/intake-planning.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { captureRequirements } from "@/novel-production/intake";
import { createNovelProductionRepository } from "@/novel-production/repository";
import { createProductionPlan } from "@/novel-production/planning";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
  await initializeNovelProductionWorkspace(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("intake and planning", () => {
  test("captures requirements from a production brief", async () => {
    const repo = createNovelProductionRepository(root);

    const requirements = await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "写一部长篇科幻悬疑小说，主角收到废弃卫星的信息。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻、克制",
      pointOfView: "第三人称",
      totalWords: 80000,
      unitWords: 2000,
      mustInclude: ["废弃卫星"],
      mustAvoid: ["英文正文"],
    });

    expect(requirements.language).toBe("zh-CN");
    await expect(repo.loadRequirements()).resolves.toMatchObject({ genre: "科幻悬疑" });
  });

  test("creates a sequential plan from requirements", async () => {
    const repo = createNovelProductionRepository(root);
    const requirements = await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "主角收到废弃卫星的信息。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      totalWords: 6000,
      unitWords: 2000,
      mustInclude: ["废弃卫星"],
      mustAvoid: [],
    });

    const result = await createProductionPlan(repo, requirements, {
      logline: "主角追查废弃卫星来信背后的真相。",
      premise: "一条来自废弃卫星的深夜信息打破主角生活。",
      world: "近未来低轨通信网络衰败后的城市。",
      unitSummaries: ["收到信息", "追查来源", "发现真相"],
    });

    expect(result.units).toHaveLength(3);
    expect(result.units[0]?.status).toBe("ready_to_produce");
    expect(result.units[0]?.targetWords).toBe(2000);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: FAIL because intake/planning modules do not exist.

- [ ] **Step 3: Implement intake**

`src/novel-production/intake.ts` exports:

```ts
export type RequirementsInput = {
  title: string;
  originalBrief: string;
  genre: string;
  targetAudience: string;
  style: string;
  pointOfView: string;
  totalWords: number;
  unitWords: number;
  mustInclude?: string[];
  mustAvoid?: string[];
  referenceNotes?: string[];
  qualityBar?: string[];
};

export async function captureRequirements(
  repository: NovelProductionRepository,
  input: RequirementsInput,
  now?: () => string,
): Promise<NovelRequirements>;
```

Default `language` to `zh-CN`; default `qualityBar` to the spec values.

- [ ] **Step 4: Implement planning**

`src/novel-production/planning.ts` exports:

```ts
export type ProductionPlanInput = {
  logline: string;
  premise: string;
  world: string;
  structure?: string;
  unitSummaries: string[];
};

export async function createProductionPlan(
  repository: NovelProductionRepository,
  requirements: NovelRequirements,
  input: ProductionPlanInput,
  now?: () => string,
): Promise<{ storyBible: StoryBible; plan: ProductionPlan; units: PlotUnitRecord[] }>;
```

Generate unit IDs deterministically enough for tests, for example `unit-1`, `unit-2`. First planned units should be saved as `ready_to_produce` for the first unit and `planned` for later units unless the implementation chooses all `ready_to_produce`; tests should reflect the chosen sequential policy. Prefer first unit ready, later units planned.

- [ ] **Step 5: Run tests and verify pass**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: PASS.

---

### Task 4: Prompt Snapshots and Unit Generation

**Files:**
- Create: `src/novel-production/prompt.ts`
- Create: `src/novel-production/generation.ts`
- Create: `tests/novel-production/prompt-generation.test.ts`

- [ ] **Step 1: Write failing prompt/generation tests**

Create `tests/novel-production/prompt-generation.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { captureRequirements } from "@/novel-production/intake";
import { createProductionPlan } from "@/novel-production/planning";
import { buildPromptSnapshot, renderProductionPrompt } from "@/novel-production/prompt";
import { producePlotUnit } from "@/novel-production/generation";
import { createNovelProductionRepository } from "@/novel-production/repository";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
  await initializeNovelProductionWorkspace(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seedPlan() {
  const repo = createNovelProductionRepository(root);
  const requirements = await captureRequirements(repo, {
    title: "废弃卫星来信",
    originalBrief: "主角收到废弃卫星的信息。",
    genre: "科幻悬疑",
    targetAudience: "成人读者",
    style: "冷峻",
    pointOfView: "第三人称",
    totalWords: 4000,
    unitWords: 2000,
    mustInclude: ["废弃卫星"],
    mustAvoid: ["英文正文"],
  });
  await createProductionPlan(repo, requirements, {
    logline: "主角追查废弃卫星来信。",
    premise: "深夜信息打破生活。",
    world: "近未来城市。",
    unitSummaries: ["收到信息", "追查来源"],
  });
  return repo;
}

describe("prompt snapshots and generation", () => {
  test("prompt snapshot includes requirements, bible, plan, and current unit", async () => {
    const repo = await seedPlan();
    const units = await repo.loadPlotUnits();

    const snapshot = await buildPromptSnapshot(repo, units[0]!.id);
    const prompt = renderProductionPrompt(snapshot);

    expect(snapshot.requirements.mustInclude).toContain("废弃卫星");
    expect(snapshot.currentUnit.summary).toBe("收到信息");
    expect(prompt).toContain("请使用中文写作");
  });

  test("produces one unit and records generation metadata", async () => {
    const repo = await seedPlan();
    const units = await repo.loadPlotUnits();

    const result = await producePlotUnit(repo, units[0]!.id, {
      async generate(prompt) {
        expect(prompt).toContain("收到信息");
        return "主角在深夜收到了来自废弃卫星的第一条信息。";
      },
    });

    expect(result.unit.status).toBe("drafted");
    await expect(repo.readDraft(units[0]!.id)).resolves.toContain("废弃卫星");
    const run = await repo.loadGenerationRun(result.run.id);
    expect(run.status).toBe("succeeded");
  });

  test("failed generation records an error and keeps unit retryable", async () => {
    const repo = await seedPlan();
    const units = await repo.loadPlotUnits();

    const result = await producePlotUnit(repo, units[0]!.id, {
      async generate() {
        throw new Error("model unavailable");
      },
    });

    expect(result.unit.status).toBe("ready_to_produce");
    expect(result.run.status).toBe("failed");
    expect(result.run.errorMessage).toContain("model unavailable");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/prompt-generation.test.ts`

Expected: FAIL because prompt/generation modules do not exist.

- [ ] **Step 3: Implement prompt snapshot builder**

Create `src/novel-production/prompt.ts`:

```ts
export type PromptSnapshot = {
  requirements: NovelRequirements;
  productionControls: ProductionControls;
  storyBible: StoryBible;
  plan: ProductionPlan;
  previousApprovedUnits: Array<{ unit: PlotUnitRecord; draft: string }>;
  currentUnit: PlotUnitRecord;
  prototypes: PrototypeRecord[];
  elementPools: ElementPoolRecord[];
  repairTask: RepairTaskRecord | null;
  templateVersion: "novel-production-v1";
};

export async function buildPromptSnapshot(
  repository: NovelProductionRepository,
  plotUnitId: string,
  options?: { repairTaskId?: string },
): Promise<PromptSnapshot>;

export function renderProductionPrompt(snapshot: PromptSnapshot): string;
```

Prompt must include: Chinese-only instruction, requirements, style, forbidden content, previous approved draft excerpts, current unit purpose, target words, bindings, constraints, and repair task when present.

- [ ] **Step 4: Implement generation orchestration**

Create `src/novel-production/generation.ts`:

```ts
export type NovelTextGenerator = {
  generate(prompt: string): Promise<string>;
};

export async function producePlotUnit(
  repository: NovelProductionRepository,
  plotUnitId: string,
  generator: NovelTextGenerator,
  options?: { now?: () => string; id?: () => string; repairTaskId?: string },
): Promise<{ unit: PlotUnitRecord; run: GenerationRunRecord }>;
```

Rules:

- Only `ready_to_produce` or `repairing` units can produce.
- Move unit to `producing` before calling generator.
- On success: write draft, save succeeded run, move to `drafted`.
- On failure: save failed run, move back to `ready_to_produce`, preserve existing draft.

- [ ] **Step 5: Run tests and verify pass**

Run: `npm test -- tests/novel-production/prompt-generation.test.ts`

Expected: PASS.

---

### Task 5: Review and Repair Gates

**Files:**
- Create: `src/novel-production/review.ts`
- Create: `src/novel-production/repair.ts`
- Create: `tests/novel-production/review-repair.test.ts`

- [ ] **Step 1: Write failing review/repair tests**

Create `tests/novel-production/review-repair.test.ts` with helpers similar to Task 4 seeding. Required tests:

```ts
test("review pass approves a drafted unit", async () => {
  const { repo, unitId } = await seedDraftedUnit();
  const result = await reviewPlotUnit(repo, unitId, {
    result: "pass",
    reviewMode: "manual",
    checklist: {
      matchesRequirements: true,
      matchesUnitPurpose: true,
      continuityOk: true,
      characterBehaviorOk: true,
      styleOk: true,
      chineseProseOk: true,
    },
    issues: [],
    decisionNotes: "通过",
  });

  expect(result.unit.status).toBe("approved");
  expect(result.review.result).toBe("pass");
});

test("review fail creates a repair task and blocks progress", async () => {
  const { repo, unitId } = await seedDraftedUnit();
  const result = await reviewPlotUnit(repo, unitId, {
    result: "fail",
    reviewMode: "manual",
    checklist: {
      matchesRequirements: false,
      matchesUnitPurpose: true,
      continuityOk: true,
      characterBehaviorOk: true,
      styleOk: false,
      chineseProseOk: true,
    },
    issues: ["没有体现废弃卫星"],
    decisionNotes: "需要补足核心意象",
    repair: {
      scope: "unit",
      intensity: "medium",
      instructions: "重写当前单元，突出废弃卫星的信息。",
    },
  });

  expect(result.unit.status).toBe("repair_requested");
  expect(result.repairTask?.reason).toContain("没有体现废弃卫星");
});

test("repair records traceability and returns unit to drafted", async () => {
  const { repo, unitId, repairTaskId } = await seedRepairRequestedUnit();
  const result = await repairPlotUnit(repo, repairTaskId, {
    async repair() {
      return "主角重新读到废弃卫星的信息，意识到它来自十年前的自己。";
    },
  });

  expect(result.unit.status).toBe("drafted");
  expect(result.repairTask.status).toBe("completed");
  await expect(repo.readDraft(unitId)).resolves.toContain("废弃卫星");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/review-repair.test.ts`

Expected: FAIL because review/repair modules do not exist.

- [ ] **Step 3: Implement review gate**

Create `src/novel-production/review.ts`:

```ts
export type ReviewInput = {
  result: ReviewResult;
  reviewMode: ReviewMode;
  checklist: ReviewRecord["checklist"];
  issues: string[];
  decisionNotes: string;
  repair?: {
    scope: RepairTaskRecord["scope"];
    intensity: RepairTaskRecord["intensity"];
    instructions: string;
  };
};

export async function reviewPlotUnit(
  repository: NovelProductionRepository,
  plotUnitId: string,
  input: ReviewInput,
  options?: { now?: () => string; id?: () => string },
): Promise<{ unit: PlotUnitRecord; review: ReviewRecord; repairTask?: RepairTaskRecord }>;
```

Rules:

- Only `drafted` or `reviewing` units are reviewable.
- Pass moves to `approved`.
- Fail moves through `rejected` into `repair_requested` when repair input is present.
- Fail without repair input records review and leaves unit `rejected`.

- [ ] **Step 4: Implement repair station**

Create `src/novel-production/repair.ts`:

```ts
export type NovelRepairGenerator = {
  repair(input: { draft: string; repairTask: RepairTaskRecord; prompt: string }): Promise<string>;
};

export async function repairPlotUnit(
  repository: NovelProductionRepository,
  repairTaskId: string,
  generator: NovelRepairGenerator,
  options?: { now?: () => string },
): Promise<{ unit: PlotUnitRecord; repairTask: RepairTaskRecord }>;
```

Rules:

- Repair task must be `open` or `in_progress`.
- Target must be `plot_unit` for MVP.
- Move unit to `repairing`, write repaired draft, mark task `completed`, move unit to `drafted`.

- [ ] **Step 5: Run tests and verify pass**

Run: `npm test -- tests/novel-production/review-repair.test.ts`

Expected: PASS.

---

### Task 6: Export and Status Reporting

**Files:**
- Create: `src/novel-production/export.ts`
- Create: `src/novel-production/status.ts`
- Create: `tests/novel-production/export-status.test.ts`

- [ ] **Step 1: Write failing export/status tests**

Create `tests/novel-production/export-status.test.ts` with tests:

```ts
test("exports approved drafts in order and skips unapproved units", async () => {
  const repo = await seedUnitsWithDrafts([
    { id: "unit-1", orderIndex: 1, status: "approved", draft: "第一段。" },
    { id: "unit-2", orderIndex: 2, status: "drafted", draft: "第二段未审。" },
    { id: "unit-3", orderIndex: 3, status: "approved", draft: "第三段。" },
  ]);

  const result = await exportManuscript(repo);

  expect(result.includedUnitIds).toEqual(["unit-1", "unit-3"]);
  expect(result.skippedUnitIds).toEqual(["unit-2"]);
  await expect(repo.readManuscript()).resolves.toContain("第一段。\n\n第三段。");
});

test("status report names next action", async () => {
  const repo = await seedUnitsWithDrafts([
    { id: "unit-1", orderIndex: 1, status: "approved", draft: "第一段。" },
    { id: "unit-2", orderIndex: 2, status: "ready_to_produce", draft: "" },
  ]);

  const report = await buildProductionStatus(repo);

  expect(report.nextAction).toContain("unit-2");
  expect(report.approvedCount).toBe(1);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/export-status.test.ts`

Expected: FAIL because export/status modules do not exist.

- [ ] **Step 3: Implement export**

Create `src/novel-production/export.ts`:

```ts
export type ExportResult = {
  manuscriptPath: string;
  includedUnitIds: string[];
  skippedUnitIds: string[];
};

export async function exportManuscript(repository: NovelProductionRepository): Promise<ExportResult>;
```

Rules:

- Sort by `orderIndex`.
- Include only `approved` units.
- If none approved, throw `No approved units to export` and do not write manuscript.
- Separate units with blank lines.

- [ ] **Step 4: Implement status**

Create `src/novel-production/status.ts`:

```ts
export type ProductionStatusReport = {
  totalUnits: number;
  approvedCount: number;
  draftedCount: number;
  rejectedCount: number;
  repairRequestedCount: number;
  nextAction: string;
  blockers: string[];
};

export async function buildProductionStatus(repository: NovelProductionRepository): Promise<ProductionStatusReport>;
export function renderProductionStatusMarkdown(report: ProductionStatusReport): string;
export async function writeProductionStatusReport(repository: NovelProductionRepository): Promise<ProductionStatusReport>;
```

- [ ] **Step 5: Run tests and verify pass**

Run: `npm test -- tests/novel-production/export-status.test.ts`

Expected: PASS.

---

### Task 7: OpenCode Agents and Commands

**Files:**
- Create: `.opencode/agents/novel-producer.md`
- Create: `.opencode/agents/novel-planner.md`
- Create: `.opencode/agents/novel-drafter.md`
- Create: `.opencode/agents/novel-reviewer.md`
- Create: `.opencode/agents/novel-repairer.md`
- Create: `.opencode/agents/novel-continuity.md`
- Create: `.opencode/agents/novel-exporter.md`
- Create: `.opencode/commands/novel-init.md`
- Create: `.opencode/commands/novel-intake.md`
- Create: `.opencode/commands/novel-plan.md`
- Create: `.opencode/commands/novel-produce.md`
- Create: `.opencode/commands/novel-review.md`
- Create: `.opencode/commands/novel-repair.md`
- Create: `.opencode/commands/novel-export.md`
- Create: `.opencode/commands/novel-status.md`
- Create: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing OpenCode asset tests**

Create `tests/novel-production/opencode-assets.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const agentFiles = [
  "novel-producer",
  "novel-planner",
  "novel-drafter",
  "novel-reviewer",
  "novel-repairer",
  "novel-continuity",
  "novel-exporter",
];

const commandFiles = [
  "novel-init",
  "novel-intake",
  "novel-plan",
  "novel-produce",
  "novel-review",
  "novel-repair",
  "novel-export",
  "novel-status",
];

describe("OpenCode novel production assets", () => {
  test.each(agentFiles)("agent %s exists with description", async (name) => {
    const content = await readFile(`.opencode/agents/${name}.md`, "utf8");
    expect(content).toContain("description:");
    expect(content).toContain("novel production");
  });

  test.each(commandFiles)("command %s routes through novel-producer", async (name) => {
    const content = await readFile(`.opencode/commands/${name}.md`, "utf8");
    expect(content).toContain("novel-producer");
    expect(content).toContain(".novel-production");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: FAIL because `.opencode` assets do not exist.

- [ ] **Step 3: Create main agent prompt**

Create `.opencode/agents/novel-producer.md`:

```md
---
description: Main orchestrator for the OpenCode novel production line.
mode: primary
---

# Novel Producer

You are the main orchestrator for a command-driven novel production line.

Your goal is to produce Chinese novel text according to the user's requirements through intake, planning, unit production, review, repair, and export.

Hard rules:
- Preserve the user's requirements over creative invention.
- Produce prose in Chinese unless explicitly instructed otherwise.
- Work in ordered production units, not uncontrolled whole-manuscript generation.
- Do not advance past rejected or repair-requested units.
- Treat approved units as locked unless the user explicitly authorizes a strong repair.
- Route planning, drafting, review, repair, continuity, and export to the matching specialist role.
- Verify specialist output before mutating `.novel-production` state.
- Record prompt snapshots, reviews, repairs, and generation runs.

Default workspace: `.novel-production/`.
```

- [ ] **Step 4: Create specialist agent prompts**

Each specialist file uses frontmatter `description:` and a short role contract. Required content:

- `novel-planner.md`: creates `story-bible.json`, `plan.json`, `plot-units.json`.
- `novel-drafter.md`: writes Chinese prose for one unit from prompt snapshot.
- `novel-reviewer.md`: checks requirements, unit purpose, continuity, character behavior, style, Chinese prose.
- `novel-repairer.md`: applies repair task scope/intensity.
- `novel-continuity.md`: checks contradictions across approved units/story bible/timeline.
- `novel-exporter.md`: assembles approved units and production report.

- [ ] **Step 5: Create command prompts**

Each command file must route through `novel-producer`, name the workspace, and state the expected output.

Example `.opencode/commands/novel-produce.md`:

```md
---
description: Produce one novel unit through the novel-producer main agent.
agent: novel-producer
---

Use `novel-producer` to produce the next eligible unit or the unit specified by the user.

Workspace: `.novel-production/`.

Required behavior:
- Validate requirements, story bible, plan, and plot units.
- Use sequential mode by default.
- Build a prompt snapshot.
- Route drafting to `novel-drafter` and continuity checks to `novel-continuity` when needed.
- Write the draft, generation run, and updated unit state.
- Report blockers instead of guessing.
```

- [ ] **Step 6: Run asset tests and verify pass**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: PASS.

---

### Task 8: Plugin Helper

**Files:**
- Create: `.opencode/plugins/novel-production.ts`
- Create: `tests/novel-production/plugin-helper.test.ts`

- [ ] **Step 1: Write failing plugin helper tests**

Create `tests/novel-production/plugin-helper.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import novelProductionPlugin from "../../.opencode/plugins/novel-production";

describe("novel production plugin helper", () => {
  test("exports a supported helper plugin shape", async () => {
    const plugin = await novelProductionPlugin({} as never);

    expect(plugin).toHaveProperty("tool");
    expect(Object.keys(plugin.tool ?? {})).toContain("novel_production_status");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts`

Expected: FAIL because plugin file does not exist.

- [ ] **Step 3: Implement minimal optional plugin helper**

Create `.opencode/plugins/novel-production.ts` without importing undocumented plugin types. Use a structural default export:

```ts
type ToolHandler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

type PluginShape = {
  tool: Record<
    string,
    {
      description: string;
      args?: Record<string, unknown>;
      execute: ToolHandler;
    }
  >;
};

export default async function novelProductionPlugin(): Promise<PluginShape> {
  return {
    tool: {
      novel_production_status: {
        description: "Read the local novel production workspace status summary.",
        async execute(input) {
          return {
            workspace: typeof input.root === "string" ? input.root : ".novel-production",
            note: "Use /novel-status for the full command-driven report.",
          };
        },
      },
    },
  };
}
```

This helper is intentionally thin. Full OpenCode runtime compatibility should be verified during manual QA; tests only prove the project-local helper is importable and structurally stable.

- [ ] **Step 4: Run helper tests and typecheck**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit --pretty false`

Expected: PASS.

---

### Task 9: Production Line Integration Verification

**Files:**
- Modify only if needed: `src/novel-production/*`
- Tests: `tests/novel-production/*.test.ts`

- [ ] **Step 1: Run all novel production tests**

Run: `npm test -- tests/novel-production`

Expected: all `tests/novel-production` tests pass.

- [ ] **Step 2: Run full typecheck**

Run: `npx tsc --noEmit --pretty false`

Expected: PASS.

- [ ] **Step 3: Run full test suite before decommissioning**

Run: `npm test`

Expected: PASS or clearly identify old web/SQLite tests that are intentionally targeted for removal in Task 10.

- [ ] **Step 4: Manual smoke workflow through library functions**

Run a short `tsx` script or one-off command that initializes a temp workspace, captures requirements, plans, produces with fake generator, reviews pass, exports, and prints the manuscript path.

Expected: script exits 0 and exported manuscript contains Chinese draft text.

---

### Task 10: Decommission Web/SQLite Runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Delete: old web/runtime files listed below if no longer needed

**Important:** Start this task only after Task 9 passes. If time is short, leave this as a separate implementation batch rather than mixing it with core production work.

- [ ] **Step 1: Write decommission target list**

Before deleting files, list the exact files that will be removed and confirm no new production modules import them.

Candidate delete list:

```text
src/app/
src/components/
src/db/
src/features/
src/ai/
src/lib/env.ts
e2e/
playwright.config.ts
next.config.ts
next-env.d.ts
scripts/seed-demo.ts
tests/actions/
tests/ai/
tests/db/
tests/domain/
tests/env.test.ts
tests/settings/
```

- [ ] **Step 2: Update package scripts and dependencies**

Update `package.json`:

```json
{
  "name": "opencode-novel-production-line",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit --pretty false"
  },
  "devDependencies": {
    "@types/node": "^22.15.17",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.3"
  }
}
```

Remove Next.js, React, Playwright, SQLite, and ESLint dependencies only after old files/tests are removed.

- [ ] **Step 3: Update TypeScript config**

Remove Next.js plugin and JSX-specific settings if no TSX remains. Keep strict TypeScript and path alias.

Expected `tsconfig.json` shape:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Refresh lockfile**

Run: `npm install`

Expected: `package-lock.json` updates to match the new dependency set.

- [ ] **Step 5: Run final verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

---

### Task 11: Documentation and Handoff

**Files:**
- Create or modify: `docs/local-runbook.md`
- Modify: `docs/superpowers/specs/2026-05-16-opencode-novel-production-line-design.md` only if implementation discovers spec drift

- [ ] **Step 1: Update runbook**

Replace web-app instructions with OpenCode production line usage:

```md
# Novel Production Line Runbook

1. Run tests: `npm test`.
2. Typecheck: `npm run typecheck`.
3. In OpenCode, start with `/novel-init`.
4. Capture requirements with `/novel-intake`.
5. Build plan with `/novel-plan`.
6. Produce a unit with `/novel-produce`.
7. Review with `/novel-review`.
8. Repair rejected output with `/novel-repair`.
9. Export approved text with `/novel-export`.
10. Inspect progress with `/novel-status`.
```

- [ ] **Step 2: Run final full verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Report completion evidence**

Report:

- test command and pass count;
- typecheck result;
- files created/removed;
- any intentionally deferred plugin-package work.

Do not claim completion without fresh verification output.
