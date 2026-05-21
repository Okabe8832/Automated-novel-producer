# Novel Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement branch-scoped novel projects and fast active-branch draft reading through a direct `novel_read` plugin tool.

**Architecture:** Add a branch selector layer above the existing `.novel-production/` workspace. Each branch stores a complete `NovelProductionPaths`-compatible workspace under `.novel-production/branches/<branchId>/`, while `.novel-production/branches.json` and `.novel-production/active-branch.json` track available branches and the active HEAD-like pointer. The core business behavior must live in this project's TypeScript modules and be callable without OMO-specific command flow; OpenCode markdown commands and plugin tools are temporary/thin entrypoints over that core, not the business architecture.

**Tech Stack:** TypeScript, Node `fs/promises`, Vitest, OpenCode markdown commands, OpenCode plugin tool shape.

---

## File Structure

- Create `src/novel-production/branches.ts`
  - Owns branch ID validation, registry parsing/writing, active pointer parsing/writing, branch creation, branch switching, and branch workspace path resolution.
- Modify `src/novel-production/workspace.ts`
  - Add a helper to build `NovelProductionPaths` from an explicit workspace directory.
  - Keep `workspacePaths(root)` backward-compatible for the current root workspace.
  - Add branch root paths such as `.novel-production/branches.json`, `.novel-production/active-branch.json`, and `.novel-production/branches/` only if needed by `branches.ts`.
- Modify `src/novel-production/repository.ts`
  - Add a factory for creating a repository from precomputed `NovelProductionPaths`, so branch workspaces can reuse the existing repository behavior.
- Modify `src/novel-production/reader.ts`
  - Add active-branch reader support while preserving current exported API where possible.
- Modify `.opencode/plugins/novel-production.ts`
  - Add direct tools for `novel_read`, branch creation, and branch switching.
- Create `.opencode/commands/novel-branch.md`
  - Command asset for switching active branch.
- Create `.opencode/commands/novel-branch-create.md`
  - Command asset for explicit branch creation.
- Modify `.opencode/commands/novel-read.md`
  - Document active-branch behavior and direct `novel_read` fast path.
- Modify `src/novel-production/deployment.ts`
  - Add branch command assets to `managedAssetPaths`.
- Create `tests/novel-production/branches.test.ts`
  - Covers branch registry, active pointer, branch workspace paths, and branch-scoped repository behavior.
- Modify `tests/novel-production/reader.test.ts`
  - Covers active-branch read and no fallback across branches.
- Modify `tests/novel-production/plugin-helper.test.ts`
  - Covers `novel_read` direct tool.
- Modify `tests/novel-production/opencode-assets.test.ts`
  - Covers new command assets and updated `/novel-read` documentation.
- Modify `tests/novel-production/deployment.test.ts`
  - Update managed asset fixture/list expectations for new commands.

## Implementation Notes

- Do not implement real git branch or worktree switching.
- Do not make branch behavior depend on OMO-specific business flow. OMO/OpenCode is only an entrypoint layer around this project's TypeScript business logic.
- Treat OMO as a historical host shell, not a product dependency. New business logic should remain usable if OMO/OpenCode command assets are removed later.
- Core branch operations must be testable through TypeScript APIs without invoking slash commands or agents.
- Do not add cross-branch reads.
- `novel_read` must not accept a user-provided `branchId`; it always uses active branch.
- Keep branch IDs and unit IDs path-safe with `^[A-Za-z0-9_-]+$`.
- Avoid silently migrating existing root `.novel-production/` data. Migration is out of scope for this implementation unless explicitly added later.
- If a test needs seeded branch data, create branch workspaces directly through branch helpers and repository APIs.

## Direct Runtime Boundary

The implementation should expose project-owned APIs first:

```ts
createNovelBranch(root, branchId, options?)
switchNovelBranch(root, branchId)
getActiveNovelBranch(root)
createActiveBranchNovelProductionRepository(root)
readActiveBranchDraftPreview(root, unitId, options?)
```

OpenCode commands and plugin tools should call these APIs or describe them. They must not be the only way the business logic works.

---

### Task 1: Branch Registry and Active Pointer

**Files:**
- Create: `src/novel-production/branches.ts`
- Modify: `src/novel-production/workspace.ts`
- Test: `tests/novel-production/branches.test.ts`

- [ ] **Step 1: Write failing tests for branch registry and active pointer**

Add `tests/novel-production/branches.test.ts` with tests like:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createNovelBranch,
  getActiveNovelBranch,
  listNovelBranches,
  switchNovelBranch,
} from "@/novel-production/branches";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-branch-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("novel branches", () => {
  test("creates a branch, registers it, and makes it active", async () => {
    await createNovelBranch(root, "branch02", { title: "小说 B" });

    await expect(listNovelBranches(root)).resolves.toMatchObject([
      { id: "branch02", title: "小说 B" },
    ]);
    await expect(getActiveNovelBranch(root)).resolves.toBe("branch02");
  });

  test("switches only to an existing branch", async () => {
    await createNovelBranch(root, "branch01");
    await createNovelBranch(root, "branch02");

    await switchNovelBranch(root, "branch01");

    await expect(getActiveNovelBranch(root)).resolves.toBe("branch01");
    await expect(switchNovelBranch(root, "missing")).rejects.toThrow(/unknown branch/i);
  });

  test("reports no active branch clearly", async () => {
    await expect(getActiveNovelBranch(root)).rejects.toThrow(/create or select a branch/i);
  });

  test("reports stale active branch pointers clearly", async () => {
    await createNovelBranch(root, "branch01");
    await switchNovelBranch(root, "branch01");
    await writeFile(join(root, ".novel-production", "active-branch.json"), JSON.stringify({ schemaVersion: 1, branchId: "missing", updatedAt: "2026-05-16T00:00:00.000Z" }));

    await expect(getActiveNovelBranch(root)).rejects.toThrow(/unknown active branch.*missing.*branch01/i);
  });

  test.each(["../escape", "nested/unit", "nested\\unit", "", ".", "branch.1"])(
    "rejects unsafe branch id %s",
    async (branchId) => {
      await expect(createNovelBranch(root, branchId)).rejects.toThrow(/invalid/i);
    },
  );
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/branches.test.ts`

Expected: FAIL because `@/novel-production/branches` does not exist.

- [ ] **Step 3: Implement minimal branch registry module**

Create `src/novel-production/branches.ts` with registry and active-pointer APIs only. Do not import repository helpers in this task:

```ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { initializeNovelProductionWorkspace, readJsonFile, writeJsonFile } from "./workspace";

const schemaVersion = 1;
const safeIdPattern = /^[A-Za-z0-9_-]+$/;

export type NovelBranchRecord = {
  schemaVersion?: never;
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export type NovelBranchRegistry = {
  schemaVersion: 1;
  branches: NovelBranchRecord[];
};

export type ActiveNovelBranch = {
  schemaVersion: 1;
  branchId: string;
  updatedAt: string;
};

export type CreateNovelBranchOptions = {
  title?: string;
  now?: () => Date;
};

export function novelBranchRootPaths(root: string) {
  const workspace = join(root, ".novel-production");
  return {
    workspace,
    branchesFile: join(workspace, "branches.json"),
    activeBranchFile: join(workspace, "active-branch.json"),
    branchesDir: join(workspace, "branches"),
  };
}

export function assertSafeBranchId(branchId: string): void {
  if (!safeIdPattern.test(branchId)) {
    throw new Error(`Invalid branch id: ${branchId}`);
  }
}

export async function listNovelBranches(root: string): Promise<NovelBranchRecord[]> {
  return (await readBranchRegistry(root)).branches;
}

export async function getActiveNovelBranch(root: string): Promise<string> {
  return (await resolveActiveNovelBranch(root)).id;
}

export async function resolveActiveNovelBranch(root: string): Promise<NovelBranchRecord> {
  const paths = novelBranchRootPaths(root);
  let active: ActiveNovelBranch;
  try {
    active = await readJsonFile(paths.activeBranchFile, parseActiveBranch);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      throw new Error("No active branch. Create or select a branch first.");
    }
    throw error;
  }
  assertSafeBranchId(active.branchId);
  const registry = await readBranchRegistry(root);
  const branch = registry.branches.find((candidate) => candidate.id === active.branchId);
  if (branch === undefined) {
    const known = registry.branches.map((candidate) => candidate.id).join(", ") || "none";
    throw new Error(`Unknown active branch: ${active.branchId}. Known branches: ${known}`);
  }
  return branch;
}

export async function createNovelBranch(
  root: string,
  branchId: string,
  options: CreateNovelBranchOptions = {},
): Promise<void> {
  assertSafeBranchId(branchId);
  const paths = novelBranchRootPaths(root);
  await mkdir(paths.branchesDir, { recursive: true });

  const registry = await readBranchRegistry(root);
  if (registry.branches.some((branch) => branch.id === branchId)) {
    throw new Error(`Branch already exists: ${branchId}`);
  }

  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  const nextRegistry: NovelBranchRegistry = {
    schemaVersion,
    branches: [
      ...registry.branches,
      {
        id: branchId,
        ...(options.title === undefined ? {} : { title: options.title }),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };

  await initializeNovelProductionWorkspace(join(paths.branchesDir, branchId), { workspaceName: "." });
  await writeJsonFile(paths.branchesFile, nextRegistry);
  await writeJsonFile(paths.activeBranchFile, { schemaVersion, branchId, updatedAt: timestamp });
}

export async function switchNovelBranch(root: string, branchId: string, now: () => Date = () => new Date()): Promise<void> {
  assertSafeBranchId(branchId);
  const registry = await readBranchRegistry(root);
  if (!registry.branches.some((branch) => branch.id === branchId)) {
    throw new Error(`Unknown branch: ${branchId}`);
  }
  await writeJsonFile(novelBranchRootPaths(root).activeBranchFile, {
    schemaVersion,
    branchId,
    updatedAt: now().toISOString(),
  });
}

async function readBranchRegistry(root: string): Promise<NovelBranchRegistry> {
  try {
    return await readJsonFile(novelBranchRootPaths(root).branchesFile, parseBranchRegistry);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return { schemaVersion, branches: [] };
    }
    throw error;
  }
}

function parseBranchRegistry(value: unknown): NovelBranchRegistry {
  if (!isRecord(value) || value.schemaVersion !== schemaVersion || !Array.isArray(value.branches)) {
    throw new Error("Invalid branch registry");
  }
  return {
    schemaVersion,
    branches: value.branches.map(parseBranchRecord),
  };
}

function parseBranchRecord(value: unknown): NovelBranchRecord {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Invalid branch record");
  }
  assertSafeBranchId(value.id);
  return {
    id: value.id,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

function parseActiveBranch(value: unknown): ActiveNovelBranch {
  if (!isRecord(value) || value.schemaVersion !== schemaVersion || typeof value.branchId !== "string") {
    throw new Error("Invalid active branch pointer");
  }
  return {
    schemaVersion,
    branchId: value.branchId,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeErrorWithCode(error: unknown, code: string): error is Error & { code: string } {
  return error instanceof Error && "code" in error && error.code === code;
}
```

Modify `initializeNovelProductionWorkspace` signature in `workspace.ts` to support an explicit workspace directory name:

```ts
export type InitializeNovelProductionWorkspaceOptions = {
  workspaceName?: string;
};

export function workspacePaths(root: string, workspaceName = ".novel-production"): NovelProductionPaths {
  const workspace = workspaceName === "." ? root : join(root, workspaceName);

  const exportsDir = join(workspace, "exports");
  const reportsDir = join(workspace, "reports");

  return {
    root,
    workspace,
    requirements: join(workspace, "requirements.json"),
    productionControls: join(workspace, "production-controls.json"),
    storyBible: join(workspace, "story-bible.json"),
    prototypes: join(workspace, "prototypes.json"),
    elementPools: join(workspace, "element-pools.json"),
    plan: join(workspace, "plan.json"),
    plotUnits: join(workspace, "plot-units.json"),
    materialsDir: join(workspace, "materials"),
    materialDecompositionsDir: join(workspace, "material-decompositions"),
    draftsDir: join(workspace, "drafts"),
    reviewsDir: join(workspace, "reviews"),
    repairTasksDir: join(workspace, "repair-tasks"),
    generationRunsDir: join(workspace, "generation-runs"),
    exportsDir,
    reportsDir,
    manuscript: join(exportsDir, "manuscript.md"),
    productionReport: join(reportsDir, "production-report.md"),
  };
}

export async function initializeNovelProductionWorkspace(
  root: string,
  options: InitializeNovelProductionWorkspaceOptions = {},
): Promise<void> {
  const paths = workspacePaths(root, options.workspaceName);
  // keep the existing mkdir and writeJsonFileIfAbsent calls unchanged
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/branches.test.ts tests/novel-production/workspace.test.ts`

Expected: PASS.

---

### Task 2: Branch Workspace Paths and Repository Factory

**Files:**
- Modify: `src/novel-production/branches.ts`
- Modify: `src/novel-production/repository.ts`
- Test: `tests/novel-production/branches.test.ts`

- [ ] **Step 1: Write failing tests for branch-scoped repository data**

Append to `tests/novel-production/branches.test.ts`:

```ts
import { createNovelProductionRepository, createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";
import { activeBranchWorkspacePaths, branchWorkspacePaths } from "@/novel-production/branches";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

test("branch workspace paths isolate drafts by branch", async () => {
  await createNovelBranch(root, "branch01");
  const branch01 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch01"));
  await branch01.writeDraft("ch03", "branch01 text");

  await createNovelBranch(root, "branch02");
  const branch02 = createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
  await branch02.writeDraft("ch03", "branch02 text");

  await expect(branch01.readDraft("ch03")).resolves.toBe("branch01 text");
  await expect(branch02.readDraft("ch03")).resolves.toBe("branch02 text");
});

test("creating a branch does not migrate root workspace drafts", async () => {
  await initializeNovelProductionWorkspace(root);
  const rootRepo = createNovelProductionRepository(root);
  await rootRepo.writeDraft("ch03", "root text");

  await createNovelBranch(root, "branch01");
  const branchRepo = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch01"));

  await expect(rootRepo.readDraft("ch03")).resolves.toBe("root text");
  await expect(branchRepo.readDraft("ch03")).rejects.toThrow();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/branches.test.ts`

Expected: FAIL because `branchWorkspacePaths`, `activeBranchWorkspacePaths`, or repository factory does not exist. If only the no-migration test fails, that is still valid RED for this task.

- [ ] **Step 3: Implement branch workspace path helpers**

If Task 1 did not already add them, add these helpers to `branches.ts`:

```ts
import { workspacePaths, type NovelProductionPaths } from "./workspace";

export function branchWorkspacePaths(root: string, branchId: string): NovelProductionPaths {
  assertSafeBranchId(branchId);
  return workspacePaths(join(novelBranchRootPaths(root).branchesDir, branchId), ".");
}

export async function activeBranchWorkspacePaths(root: string): Promise<NovelProductionPaths> {
  return branchWorkspacePaths(root, await getActiveNovelBranch(root));
}
```

- [ ] **Step 4: Add repository factory from paths**

In `repository.ts`, refactor only enough to avoid duplicating method definitions. The complete return body should be the existing repository object moved into `createNovelProductionRepositoryFromPaths`:

```ts
export function createNovelProductionRepository(root: string): NovelProductionRepository {
  return createNovelProductionRepositoryFromPaths(workspacePaths(root));
}

export function createNovelProductionRepositoryFromPaths(paths: NovelProductionPaths): NovelProductionRepository {
  return {
    paths,
    loadRequirements: () => readJsonFile(paths.requirements, parseRequirements),
    saveRequirements: (value) => writeJsonFile(paths.requirements, value),
    loadProductionControls: () => readJsonFile(paths.productionControls, parseProductionControls),
    saveProductionControls: (value) => writeJsonFile(paths.productionControls, value),
    loadStoryBible: () => readJsonFile(paths.storyBible, parseStoryBible),
    saveStoryBible: (value) => writeJsonFile(paths.storyBible, value),
    loadPrototypes: () => readJsonFile(paths.prototypes, parsePrototypes),
    savePrototypes: (value) => writeJsonFile(paths.prototypes, value),
    loadElementPools: () => readJsonFile(paths.elementPools, parseElementPools),
    saveElementPools: (value) => writeJsonFile(paths.elementPools, value),
    loadPlan: () => readJsonFile(paths.plan, parseProductionPlan),
    savePlan: (value) => writeJsonFile(paths.plan, value),
    loadPlotUnits: () => readJsonFile(paths.plotUnits, parsePlotUnits),
    savePlotUnits: (value) => writeJsonFile(paths.plotUnits, value),
    readDraft: (unitId) => readTextFile(idPath(paths.draftsDir, unitId, ".md")),
    writeDraft: (unitId, text) => writeTextFile(idPath(paths.draftsDir, unitId, ".md"), text),
    loadReview: (reviewId) => readJsonFile(idPath(paths.reviewsDir, reviewId, ".json"), parseReviewRecord),
    saveReview: (value) => writeJsonFile(idPath(paths.reviewsDir, value.id, ".json"), value),
    loadRepairTask: (repairId) => readJsonFile(idPath(paths.repairTasksDir, repairId, ".json"), parseRepairTask),
    saveRepairTask: (value) => writeJsonFile(idPath(paths.repairTasksDir, value.id, ".json"), value),
    loadGenerationRun: (runId) => readJsonFile(idPath(paths.generationRunsDir, runId, ".json"), parseGenerationRun),
    saveGenerationRun: (value) => writeJsonFile(idPath(paths.generationRunsDir, value.id, ".json"), value),
    readManuscript: () => readTextFile(paths.manuscript),
    writeManuscript: (text) => writeTextFile(paths.manuscript, text),
    readProductionReport: () => readTextFile(paths.productionReport),
    writeProductionReport: (text) => writeTextFile(paths.productionReport, text),
  };
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/branches.test.ts tests/novel-production/workspace.test.ts`

Expected: PASS.

---

### Task 3: Active-Branch Reader

**Files:**
- Modify: `src/novel-production/reader.ts`
- Test: `tests/novel-production/reader.test.ts`

- [ ] **Step 1: Write failing tests for active-branch read**

Add to `tests/novel-production/reader.test.ts`:

```ts
import { createNovelBranch, branchWorkspacePaths, switchNovelBranch } from "@/novel-production/branches";
import { createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";
import { readActiveBranchDraftPreview } from "@/novel-production/reader";

test("reads draft from the active branch only", async () => {
  await createNovelBranch(root, "branch01");
  const branch01 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch01"));
  await branch01.writeDraft("ch03", "branch01 text");

  await createNovelBranch(root, "branch02");
  const branch02 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch02"));
  await branch02.writeDraft("ch03", "branch02 text");

  await switchNovelBranch(root, "branch02");

  await expect(readActiveBranchDraftPreview(root, "ch03", { limit: 7 })).resolves.toMatchObject({
    branchId: "branch02",
    unitId: "ch03",
    text: "branch0",
  });
});

test("missing active-branch draft does not fall back to another branch", async () => {
  await createNovelBranch(root, "branch01");
  const branch01 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch01"));
  await branch01.writeDraft("ch03", "branch01 text");

  await createNovelBranch(root, "branch02");
  await switchNovelBranch(root, "branch02");

  await expect(readActiveBranchDraftPreview(root, "ch03")).rejects.toThrow(/branch02.*ch03/i);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/reader.test.ts`

Expected: FAIL because `readActiveBranchDraftPreview` does not exist.

- [ ] **Step 3: Implement active-branch reader**

In `reader.ts`, add:

```ts
import { activeBranchWorkspacePaths, getActiveNovelBranch } from "./branches";

export type ActiveBranchDraftPreview = DraftPreview & {
  branchId: string;
};

export async function readActiveBranchDraftPreview(
  root: string,
  unitId: string,
  options: DraftPreviewOptions = {},
): Promise<ActiveBranchDraftPreview> {
  const branchId = await getActiveNovelBranch(root);
  const paths = await activeBranchWorkspacePaths(root);
  const preview = await readDraftPreviewFromDraftsDir(paths.draftsDir, unitId, options, `.novel-production/branches/${branchId}/drafts/${unitId}.md`);
  return { ...preview, branchId };
}
```

Refactor current `readDraftPreview` internally to use a shared helper:

```ts
async function readDraftPreviewFromDraftsDir(
  draftsDir: string,
  unitId: string,
  options: DraftPreviewOptions,
  displayPath: string,
): Promise<DraftPreview> {
  assertSafeUnitId(unitId);
  const offset = normalizeNonNegativeInteger(options.offset ?? 0, "offset");
  const limit = normalizePositiveInteger(options.limit ?? defaultPreviewLimit, "limit");
  const draftPath = join(draftsDir, `${unitId}.md`);

  let content: string;
  try {
    content = await readTextFile(draftPath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      throw new Error(`Draft not found for ${unitId}: ${displayPath}`);
    }
    throw error;
  }

  return {
    unitId,
    draftPath,
    offset,
    limit,
    text: content.slice(offset, offset + limit),
  };
}
```

Make missing draft errors use `displayPath`.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/reader.test.ts tests/novel-production/branches.test.ts`

Expected: PASS.

---

### Task 4: Direct Plugin `novel_read` Tool

**Files:**
- Modify: `.opencode/plugins/novel-production.ts`
- Test: `tests/novel-production/plugin-helper.test.ts`

- [ ] **Step 1: Write failing plugin tests**

Extend `tests/novel-production/plugin-helper.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createNovelBranch, branchWorkspacePaths, switchNovelBranch } from "@/novel-production/branches";
import { createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-plugin-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("novel_read reads the active branch draft directly", async () => {
  await createNovelBranch(root, "branch01");
  const branch01 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch01"));
  await branch01.writeDraft("ch03", "branch01 text");

  await createNovelBranch(root, "branch02");
  const branch02 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch02"));
  await branch02.writeDraft("ch03", "branch02 text");
  await switchNovelBranch(root, "branch02");

  const plugin = await novelProductionPlugin({} as never);
  const output = await plugin.tool.novel_read.execute({ root, unitId: "ch03", offset: 0, limit: 7 });

  expect(output).toMatchObject({
    branchId: "branch02",
    unitId: "ch03",
    path: expect.stringContaining(".novel-production/branches/branch02/drafts/ch03.md"),
    offset: 0,
    limit: 7,
    text: "branch0",
  });
});

test("novel_read rejects branch override input", async () => {
  const plugin = await novelProductionPlugin({} as never);
  await expect(plugin.tool.novel_read.execute({ root, branchId: "branch01", unitId: "ch03" })).rejects.toThrow(/branchId/i);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts`

Expected: FAIL because `novel_read` does not exist.

- [ ] **Step 3: Implement plugin tool**

Modify `.opencode/plugins/novel-production.ts`:

```ts
import { readActiveBranchDraftPreview } from "../../src/novel-production/reader";

// keep existing types

novel_read: {
  description: "Read a draft from the active novel branch without invoking novel-producer.",
  async execute(input) {
    if ("branchId" in input) {
      throw new Error("novel_read does not accept branchId; switch active branch first");
    }
    if (typeof input.unitId !== "string") {
      throw new Error("novel_read requires unitId");
    }
    const preview = await readActiveBranchDraftPreview(
      typeof input.root === "string" ? input.root : process.cwd(),
      input.unitId,
      {
        offset: typeof input.offset === "number" ? input.offset : undefined,
        limit: typeof input.limit === "number" ? input.limit : undefined,
      },
    );
    return {
      branchId: preview.branchId,
      unitId: preview.unitId,
      path: preview.draftPath,
      offset: preview.offset,
      limit: preview.limit,
      text: preview.text,
    };
  },
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts tests/novel-production/reader.test.ts tests/novel-production/branches.test.ts`

Expected: PASS.

---

### Task 5: Active-Branch Business API Coverage for Production Flow

**Files:**
- Modify: `src/novel-production/branches.ts`
- Test: `tests/novel-production/branches.test.ts`
- Test: `tests/novel-production/prompt-generation.test.ts`
- Test: `tests/novel-production/export-status.test.ts`

- [ ] **Step 1: Write failing tests for active-branch repository use in core production modules**

Add helper usage in production-flow tests rather than command assets. The purpose is to prove intake/plan/produce/review/export/status can operate on a branch-scoped repository without OMO/OpenCode commands.

In `tests/novel-production/prompt-generation.test.ts`, add a branch-scoped production test:

```ts
import { createNovelBranch, createActiveBranchNovelProductionRepository } from "@/novel-production/branches";

test("intake planning and production operate on the active branch repository", async () => {
  await createNovelBranch(root, "branch02", { title: "小说 B" });
  const repo = await createActiveBranchNovelProductionRepository(root);

  const requirements = await captureRequirements(repo, {
    title: "分支小说",
    originalBrief: "只写入 branch02。",
    genre: "科幻",
    targetAudience: "成人读者",
    style: "冷峻",
    pointOfView: "第三人称",
    totalWords: 4000,
    unitWords: 2000,
  });

  await createProductionPlan(repo, requirements, {
    logline: "分支项目 logline",
    premise: "分支项目 premise",
    world: "分支世界。",
    unitSummaries: ["分支第一章"],
  });

  const units = await repo.loadPlotUnits();
  await producePlotUnit(repo, units[0]!.id, {
    async generate() {
      return "branch02 generated text";
    },
  });

  await expect(repo.readDraft(units[0]!.id)).resolves.toBe("branch02 generated text");
});
```

In `tests/novel-production/export-status.test.ts`, add a branch-scoped status/export test:

```ts
import { createNovelBranch, createActiveBranchNovelProductionRepository } from "@/novel-production/branches";

test("status and export use the active branch repository", async () => {
  await createNovelBranch(root, "branch02");
  const repo = await createActiveBranchNovelProductionRepository(root);
  await repo.savePlotUnits([
    {
      id: "ch01",
      orderIndex: 1,
      title: "ch01",
      purpose: "ch01",
      summary: "ch01",
      targetWords: 2000,
      status: "approved",
      prototypeIds: [],
      inheritedElementPoolIds: [],
      localElements: [],
      bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
      constraints: [],
      draftPath: ".novel-production/branches/branch02/drafts/ch01.md",
      currentRepairTaskId: "",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
  ]);
  await repo.writeDraft("ch01", "branch02 approved text");

  const status = await buildProductionStatus(repo);
  const exported = await exportManuscript(repo);

  expect(status.approvedCount).toBe(1);
  expect(exported.manuscriptPath).toContain(".novel-production/branches/branch02/exports/manuscript.md");
  await expect(repo.readManuscript()).resolves.toContain("branch02 approved text");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/prompt-generation.test.ts tests/novel-production/export-status.test.ts`

Expected: FAIL because `createActiveBranchNovelProductionRepository` does not exist until branch core is implemented.

- [ ] **Step 3: Ensure core API supports active-branch repository**

Implement this API now in `src/novel-production/branches.ts`. Add the required imports:

```ts
import { createNovelProductionRepositoryFromPaths, type NovelProductionRepository } from "./repository";
```

Then add:

```ts
export async function createActiveBranchNovelProductionRepository(root: string): Promise<NovelProductionRepository> {
  return createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
}
```

If it is missing, add it to `src/novel-production/branches.ts`. Do not modify `captureRequirements`, `createProductionPlan`, `producePlotUnit`, `buildProductionStatus`, or `exportManuscript` unless tests prove they cannot work with a `NovelProductionRepository` created from branch paths.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/branches.test.ts tests/novel-production/prompt-generation.test.ts tests/novel-production/export-status.test.ts`

Expected: PASS.

---

### Task 6: Direct Plugin Branch Tools

**Files:**
- Modify: `.opencode/plugins/novel-production.ts`
- Test: `tests/novel-production/plugin-helper.test.ts`

- [ ] **Step 1: Write failing plugin tests for branch create/switch direct tools**

Extend `tests/novel-production/plugin-helper.test.ts`:

```ts
test("plugin exposes direct branch create and switch tools", async () => {
  const plugin = await novelProductionPlugin({} as never);

  await plugin.tool.novel_branch_create.execute({ root, branchId: "branch01", title: "小说 A" });
  await plugin.tool.novel_branch_create.execute({ root, branchId: "branch02", title: "小说 B" });
  const switchResult = await plugin.tool.novel_branch_switch.execute({ root, branchId: "branch01" });

  expect(switchResult).toMatchObject({ branchId: "branch01" });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts`

Expected: FAIL because `novel_branch_create` and `novel_branch_switch` do not exist.

- [ ] **Step 3: Implement direct branch tools**

In `.opencode/plugins/novel-production.ts`, import and expose the TypeScript core APIs:

```ts
import { createNovelBranch, switchNovelBranch } from "../../src/novel-production/branches";
```

Add tools:

```ts
novel_branch_create: {
  description: "Create a novel branch and make it active.",
  async execute(input) {
    if (typeof input.branchId !== "string") {
      throw new Error("novel_branch_create requires branchId");
    }
    await createNovelBranch(typeof input.root === "string" ? input.root : process.cwd(), input.branchId, {
      title: typeof input.title === "string" ? input.title : undefined,
    });
    return { branchId: input.branchId };
  },
},
novel_branch_switch: {
  description: "Switch the active novel branch.",
  async execute(input) {
    if (typeof input.branchId !== "string") {
      throw new Error("novel_branch_switch requires branchId");
    }
    await switchNovelBranch(typeof input.root === "string" ? input.root : process.cwd(), input.branchId);
    return { branchId: input.branchId };
  },
},
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts tests/novel-production/branches.test.ts`

Expected: PASS.

---

### Task 7: Branch Command Assets and Read Documentation

**Files:**
- Create: `.opencode/commands/novel-branch.md`
- Create: `.opencode/commands/novel-branch-create.md`
- Modify: `.opencode/commands/novel-read.md`
- Modify: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing asset tests**

Modify `commandFiles` in `tests/novel-production/opencode-assets.test.ts` to include:

```ts
"novel-branch",
"novel-branch-create",
```

Add tests:

```ts
test("branch commands document active branch behavior", async () => {
  const branch = await readFile(".opencode/commands/novel-branch.md", "utf8");
  const create = await readFile(".opencode/commands/novel-branch-create.md", "utf8");

  expect(branch).toContain("active branch");
  expect(branch).toContain("novel_branch_switch");
  expect(branch).toContain("branches.json");
  expect(branch).toContain("active-branch.json");
  expect(create).toContain("novel_branch_create");
  expect(create).toContain("branch workspace");
  expect(create).toContain("branches/<branchId>");
});

test("novel-read command documents active-branch direct plugin read", async () => {
  const content = await readFile(".opencode/commands/novel-read.md", "utf8");

  expect(content).toContain("active branch");
  expect(content).toContain("novel_read");
  expect(content).toContain("content.slice");
  expect(content).not.toContain("branchId");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: FAIL because branch command files do not exist and read docs are not active-branch aware.

- [ ] **Step 3: Add branch command assets**

Create `.opencode/commands/novel-branch.md`:

```md
---
description: Switch the active novel branch.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Switch the active branch by calling the direct `novel_branch_switch` plugin tool, which calls this project's TypeScript branch API. `agent: novel-producer` is only the OpenCode host entrypoint and must not contain the business implementation.

Workspace: `.novel-production/`.

Arguments:
- `branchId`: required branch id, for example `branch02`.

Required behavior:
- Validate that `branchId` is safe.
- Switch only to an existing branch recorded in `.novel-production/branches.json`.
- Write `.novel-production/active-branch.json` with the selected branch.
- Do not create missing branches; tell the user to use `/novel-branch-create <branchId>`.
- Do not read or modify another branch's production files.
```

Create `.opencode/commands/novel-branch-create.md`:

```md
---
description: Create a novel branch and make it active.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Create a new branch workspace by calling the direct `novel_branch_create` plugin tool, which calls this project's TypeScript branch API. `agent: novel-producer` is only the OpenCode host entrypoint and must not contain the business implementation.

Workspace: `.novel-production/`.

Arguments:
- `branchId`: required branch id, for example `branch02`.
- `title`: optional branch title.

Required behavior:
- Validate that `branchId` is safe.
- Refuse to overwrite an existing branch.
- Create `.novel-production/branches/<branchId>/` with starter novel-production files and directories.
- Register the branch in `.novel-production/branches.json`.
- Set `.novel-production/active-branch.json` to the new branch.
- Do not migrate existing root workspace files automatically.
```

Update `.opencode/commands/novel-read.md` to mention active branch and `novel_read` direct tool:

```md
Required behavior:
- Use the direct `novel_read` plugin tool when available.
- Resolve the current active branch from `.novel-production/active-branch.json`.
- Read only `.novel-production/branches/<activeBranch>/drafts/<unitId>.md`.
- Print `content.slice(--offset, --offset + --limit)`.
- Do not accept branch override input.
- Do not modify drafts, reviews, runs, plans, reports, branch registry, or production state.
- If the draft file is missing, report the active branch and missing path.
- Reject unsafe unit ids instead of guessing paths.
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: PASS.

---

### Task 8: Deployment Asset List

**Files:**
- Modify: `src/novel-production/deployment.ts`
- Modify: `tests/novel-production/deployment.test.ts`
- Test: `tests/novel-production/deployment.test.ts`

- [ ] **Step 1: Write failing deployment expectations**

Update `tests/novel-production/deployment.test.ts` source asset fixture/list to include:

```ts
".opencode/commands/novel-branch.md",
".opencode/commands/novel-branch-create.md",
```

Update fresh install created asset count by `+2`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: FAIL because `managedAssetPaths` does not include new command assets.

- [ ] **Step 3: Add managed assets**

In `src/novel-production/deployment.ts`, add the new commands near other command assets:

```ts
".opencode/commands/novel-branch.md",
".opencode/commands/novel-branch-create.md",
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/deployment.test.ts tests/novel-production/opencode-assets.test.ts`

Expected: PASS.

---

### Task 9: Final Verification

**Files:**
- No code edits unless verification finds issues caused by this work.

- [ ] **Step 1: Run targeted branch feature tests**

Run:

```bash
npm test -- tests/novel-production/branches.test.ts tests/novel-production/reader.test.ts tests/novel-production/plugin-helper.test.ts tests/novel-production/opencode-assets.test.ts tests/novel-production/deployment.test.ts tests/novel-production/prompt-generation.test.ts tests/novel-production/export-status.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 4: Run LSP diagnostics if available**

Run diagnostics on changed TypeScript files:

- `src/novel-production/branches.ts`
- `src/novel-production/workspace.ts`
- `src/novel-production/repository.ts`
- `src/novel-production/reader.ts`
- `.opencode/plugins/novel-production.ts`
- changed tests

Expected: clean diagnostics. If `typescript-language-server` is still missing, record that LSP diagnostics could not run and rely on `npm run typecheck`.

- [ ] **Step 5: Manual smoke check via direct tool import**

Run a short Node/tsx script or test equivalent that:

1. Creates branch01 and branch02.
2. Writes `ch03.md` in both branches.
3. Switches active branch to branch02.
4. Calls plugin `novel_read`.
5. Confirms branch02 text is returned.

Expected: branch02 text only.
