# Novel Branch Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/novel-branch-status` as a low-agent-workload filesystem summary for all novel branches.

**Architecture:** Add a focused `branch-status.ts` core module that reads branch registry/active pointer data and counts direct regular files in known branch directories. Expose it through a direct `novel_branch_status` plugin tool and a thin OpenCode command asset; do not route core work through `novel-producer` or inspect file contents.

**Tech Stack:** TypeScript, Node `fs/promises`, Vitest, OpenCode markdown command assets, OpenCode plugin tools.

---

## File Structure

- Create `src/novel-production/branch-status.ts`
  - Owns read-only all-branch filesystem status report and markdown rendering.
  - Counts only direct regular files in known directories.
  - Checks key artifact existence.
  - Surfaces top-level and per-branch warnings.
- Modify `src/novel-production/branches.ts`
  - Add public read-only `listNovelBranches(root)` API if needed.
  - Keep branch mutation behavior unchanged.
- Modify `.opencode/plugins/novel-production.ts`
  - Add direct `novel_branch_status` tool.
- Create `.opencode/commands/novel-branch-status.md`
  - Command asset documenting low-agent-workload direct plugin behavior.
- Modify `src/novel-production/deployment.ts`
  - Add command asset to `managedAssetPaths`.
- Create `tests/novel-production/branch-status.test.ts`
  - Core status behavior and error/warning behavior.
- Modify `tests/novel-production/plugin-helper.test.ts`
  - Plugin contract tests for `novel_branch_status`.
- Modify `tests/novel-production/opencode-assets.test.ts`
  - Command asset content tests.
- Modify `tests/novel-production/deployment.test.ts`
  - Managed asset inclusion tests.

## Implementation Notes

- Do not recurse into subdirectories.
- Count only direct regular files. Ignore directories when counting files.
- Missing known directories count as `0` and are not fatal.
- Missing branch workspace creates a per-branch warning and zero counts/artifacts missing.
- Missing branch registry returns `{ warnings: [], branches: [] }` with no active branch.
- Missing active pointer is not fatal.
- Stale active pointer produces a top-level warning and marks no branch active.
- Malformed branch registry or active pointer JSON throws a clear error.
- Permission errors should surface; portable permission simulation can be best-effort/manual.
- Low agent workload is a hard requirement: direct plugin/core API only, no prose loading, no agent reasoning over branch contents.

---

### Task 1: Core Branch Status API

**Files:**
- Create: `src/novel-production/branch-status.ts`
- Modify: `src/novel-production/branches.ts`
- Test: `tests/novel-production/branch-status.test.ts`

- [ ] **Step 1: Write failing tests for all-branch status**

Create `tests/novel-production/branch-status.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { buildNovelBranchStatus, renderNovelBranchStatusMarkdown } from "@/novel-production/branch-status";
import { branchWorkspacePaths, createNovelBranch, switchNovelBranch } from "@/novel-production/branches";
import { createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";
import { writeJsonFile } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-branch-status-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("novel branch status", () => {
  test("reports all branches, marks the active branch, and counts direct files", async () => {
    await createNovelBranch(root, "branch01", { title: "小说 A" });
    const branch01 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch01"));
    await branch01.writeDraft("ch01", "branch01 draft");

    await createNovelBranch(root, "branch02", { title: "小说 B" });
    const branch02Paths = branchWorkspacePaths(root, "branch02");
    const branch02 = createNovelProductionRepositoryFromPaths(branch02Paths);
    await branch02.writeDraft("ch01", "branch02 draft");
    await branch02.writeDraft("ch02", "branch02 draft 2");
    await writeFile(join(branch02Paths.draftsDir, "notes.tmp"), "tmp");
    await mkdir(join(branch02Paths.draftsDir, "nested"));
    await branch02.writeManuscript("branch02 manuscript");
    await switchNovelBranch(root, "branch02");

    const status = await buildNovelBranchStatus(root);

    expect(status.activeBranchId).toBe("branch02");
    expect(status.warnings).toEqual([]);
    expect(status.branches).toHaveLength(2);
    expect(status.branches[1]).toMatchObject({
      branchId: "branch02",
      title: "小说 B",
      active: true,
      warnings: [],
    });
    expect(directoryCount(status, "branch02", "drafts")).toBe(3);
    expect(artifactExists(status, "branch02", "exports/manuscript.md")).toBe(true);
  });

  test("missing branch registry returns an empty status", async () => {
    await expect(buildNovelBranchStatus(root)).resolves.toMatchObject({
      warnings: [],
      branches: [],
    });
  });

  test("missing active pointer does not fail", async () => {
    await createNovelBranch(root, "branch01");
    await rm(join(root, ".novel-production", "active-branch.json"));

    const status = await buildNovelBranchStatus(root);

    expect(status.activeBranchId).toBeUndefined();
    expect(status.branches[0]!.active).toBe(false);
  });

  test("stale active pointer reports a top-level warning", async () => {
    await createNovelBranch(root, "branch01");
    await writeJsonFile(join(root, ".novel-production", "active-branch.json"), {
      schemaVersion: 1,
      branchId: "missing",
      updatedAt: "2026-05-17T00:00:00.000Z",
    });

    const status = await buildNovelBranchStatus(root);

    expect(status.activeBranchId).toBe("missing");
    expect(status.warnings.join(" ")).toMatch(/unknown active branch.*missing/i);
    expect(status.branches[0]!.active).toBe(false);
  });

  test("missing branch workspace returns zero counts and a branch warning", async () => {
    await createNovelBranch(root, "branch01");
    await rm(branchWorkspacePaths(root, "branch01").workspace, { recursive: true, force: true });

    const status = await buildNovelBranchStatus(root);

    expect(status.branches[0]!.warnings.join(" ")).toMatch(/missing branch workspace/i);
    expect(status.branches[0]!.directories.every((directory) => directory.fileCount === 0)).toBe(true);
    expect(status.branches[0]!.artifacts.every((artifact) => artifact.exists === false)).toBe(true);
  });

  test("malformed branch registry throws a clear error", async () => {
    await mkdir(join(root, ".novel-production"), { recursive: true });
    await writeFile(join(root, ".novel-production", "branches.json"), "not json");

    await expect(buildNovelBranchStatus(root)).rejects.toThrow(/branch registry/i);
  });

  test("malformed active branch pointer throws a clear error", async () => {
    await createNovelBranch(root, "branch01");
    await writeFile(join(root, ".novel-production", "active-branch.json"), "not json");

    await expect(buildNovelBranchStatus(root)).rejects.toThrow(/active branch/i);
  });

  test("renders compact markdown without file contents", async () => {
    await createNovelBranch(root, "branch01", { title: "小说 A" });
    const status = await buildNovelBranchStatus(root);

    const markdown = renderNovelBranchStatusMarkdown(status);

    expect(markdown).toContain("# Novel Branch Status");
    expect(markdown).toContain("branch01");
    expect(markdown).toContain("active");
    expect(markdown).not.toContain("branch01 draft");
  });
});

function directoryCount(status: Awaited<ReturnType<typeof buildNovelBranchStatus>>, branchId: string, name: string): number {
  return status.branches.find((branch) => branch.branchId === branchId)!.directories.find((directory) => directory.name === name)!.fileCount;
}

function artifactExists(status: Awaited<ReturnType<typeof buildNovelBranchStatus>>, branchId: string, name: string): boolean {
  return status.branches.find((branch) => branch.branchId === branchId)!.artifacts.find((artifact) => artifact.name === name)!.exists;
}
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/branch-status.test.ts`

Expected: FAIL because `@/novel-production/branch-status` does not exist.

- [ ] **Step 3: Add read-only branch listing API**

In `src/novel-production/branches.ts`, export `NovelBranchRecord` and add:

```ts
export type NovelBranchRecord = BranchRecord;

export async function listNovelBranches(root: string): Promise<NovelBranchRecord[]> {
  return (await readBranchRegistry(branchRootPaths(root))).branches;
}
```

Also update `readBranchRegistry` so malformed JSON is wrapped with branch-registry context instead of leaking a raw `SyntaxError`:

```ts
async function readBranchRegistry(paths: ReturnType<typeof branchRootPaths>): Promise<BranchRegistry> {
  try {
    return await readJsonFile(paths.branchesFile, parseBranchRegistry);
  } catch (error) {
    if (isMissingFileError(error)) {
      return { schemaVersion: 1, branches: [] };
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid branch registry: ${error.message}`);
    }
    throw error;
  }
}
```

If TypeScript rejects aliasing a non-exported type, rename internal `BranchRecord` to exported `NovelBranchRecord` and update references.

- [ ] **Step 4: Implement branch-status module**

Create `src/novel-production/branch-status.ts`:

```ts
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { branchWorkspacePaths, listNovelBranches } from "./branches";
import { readJsonFile } from "./workspace";

const directoryNames = [
  "materials",
  "material-decompositions",
  "drafts",
  "reviews",
  "repair-tasks",
  "generation-runs",
  "exports",
  "reports",
] as const;

const artifactPaths = [
  ["requirements.json", "requirements.json"],
  ["plan.json", "plan.json"],
  ["plot-units.json", "plot-units.json"],
  ["exports/manuscript.md", "exports/manuscript.md"],
  ["reports/production-report.md", "reports/production-report.md"],
] as const;

export type NovelBranchStatusReport = {
  activeBranchId?: string;
  warnings: string[];
  branches: NovelBranchStatusBranch[];
};

export type NovelBranchStatusBranch = {
  branchId: string;
  title?: string;
  active: boolean;
  workspace: string;
  warnings: string[];
  directories: NovelBranchDirectoryStatus[];
  artifacts: NovelBranchArtifactStatus[];
};

export type NovelBranchDirectoryStatus = {
  name: string;
  path: string;
  fileCount: number;
};

export type NovelBranchArtifactStatus = {
  name: string;
  path: string;
  exists: boolean;
};

type ActiveBranchPointer = {
  schemaVersion: 1;
  branchId: string;
  updatedAt: string;
};

export async function buildNovelBranchStatus(root: string): Promise<NovelBranchStatusReport> {
  const branches = await listNovelBranches(root);
  const activeBranchId = await readActiveBranchId(root);
  const warnings: string[] = [];

  if (activeBranchId !== undefined && !branches.some((branch) => branch.id === activeBranchId)) {
    warnings.push(`Unknown active branch: ${activeBranchId}`);
  }

  return {
    ...(activeBranchId === undefined ? {} : { activeBranchId }),
    warnings,
    branches: await Promise.all(
      branches.map(async (branch) => buildBranchStatus(root, branch, activeBranchId, warnings.length === 0)),
    ),
  };
}

export function renderNovelBranchStatusMarkdown(report: NovelBranchStatusReport): string {
  const lines = ["# Novel Branch Status"];
  if (report.activeBranchId !== undefined) {
    lines.push(`- Active branch: ${report.activeBranchId}`);
  }
  for (const warning of report.warnings) {
    lines.push(`- Warning: ${warning}`);
  }
  if (report.branches.length === 0) {
    lines.push("- Branches: none");
    return `${lines.join("\n")}\n`;
  }
  for (const branch of report.branches) {
    const marker = branch.active ? "active" : "inactive";
    const title = branch.title === undefined ? "" : ` (${branch.title})`;
    const counts = branch.directories.map((directory) => `${directory.name}=${directory.fileCount}`).join(", ");
    const artifacts = branch.artifacts.map((artifact) => `${artifact.name}=${artifact.exists ? "yes" : "no"}`).join(", ");
    lines.push(`- ${branch.branchId}${title}: ${marker}; ${counts}; artifacts: ${artifacts}`);
    for (const warning of branch.warnings) {
      lines.push(`  - Warning: ${warning}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function buildBranchStatus(
  root: string,
  branch: { id: string; title?: string },
  activeBranchId: string | undefined,
  activePointerValid: boolean,
): Promise<NovelBranchStatusBranch> {
  const paths = branchWorkspacePaths(root, branch.id);
  const workspaceExists = await pathIsDirectory(paths.workspace);
  const warnings = workspaceExists ? [] : [`Missing branch workspace: ${paths.workspace}`];

  return {
    branchId: branch.id,
    ...(branch.title === undefined ? {} : { title: branch.title }),
    active: activePointerValid && activeBranchId === branch.id,
    workspace: paths.workspace,
    warnings,
    directories: await Promise.all(
      directoryNames.map(async (name) => {
        const path = join(paths.workspace, name);
        return { name, path, fileCount: workspaceExists ? await countDirectRegularFiles(path) : 0 };
      }),
    ),
    artifacts: await Promise.all(
      artifactPaths.map(async ([name, relativePath]) => {
        const path = join(paths.workspace, relativePath);
        return { name, path, exists: workspaceExists ? await pathIsFile(path) : false };
      }),
    ),
  };
}

async function readActiveBranchId(root: string): Promise<string | undefined> {
  try {
    return (await readJsonFile(join(root, ".novel-production", "active-branch.json"), parseActiveBranch)).branchId;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid active branch pointer: ${error.message}`);
    }
    throw error;
  }
}

function parseActiveBranch(value: unknown): ActiveBranchPointer {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.branchId !== "string" || typeof value.updatedAt !== "string") {
    throw new Error("Invalid active branch pointer");
  }
  return { schemaVersion: 1, branchId: value.branchId, updatedAt: value.updatedAt };
}

async function countDirectRegularFiles(path: string): Promise<number> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).length;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return 0;
    }
    throw error;
  }
}

async function pathIsDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

async function pathIsFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeErrorWithCode(error: unknown, code: string): error is Error & { code: string } {
  return error instanceof Error && "code" in error && error.code === code;
}
```

Adjust implementation if tests reveal exact type/path issues, but keep behavior unchanged.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/branch-status.test.ts tests/novel-production/branches.test.ts`

Expected: PASS.

---

### Task 2: Direct Plugin Tool

**Files:**
- Modify: `.opencode/plugins/novel-production.ts`
- Test: `tests/novel-production/plugin-helper.test.ts`

- [ ] **Step 1: Write failing plugin tests**

Extend `tests/novel-production/plugin-helper.test.ts`:

```ts
import { buildNovelBranchStatus } from "@/novel-production/branch-status";

// inside describe

test("novel_branch_status returns all branch file summaries", async () => {
  const plugin = await novelProductionPlugin();
  await plugin.tool.novel_branch_create.execute({ branchId: "branch12", title: "状态分支" });
  const repo = createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
  await repo.writeDraft("ch01", "SECRET_DRAFT_BODY");

  const result = await plugin.tool.novel_branch_status.execute({});

  expect(result).toMatchObject({
    activeBranchId: "branch12",
    branches: [
      {
        branchId: "branch12",
        title: "状态分支",
        active: true,
      },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("SECRET_DRAFT_BODY");
});

test("novel_branch_status rejects a present root that is not a string", async () => {
  const plugin = await novelProductionPlugin();

  await expect(plugin.tool.novel_branch_status.execute({ root: 123 })).rejects.toThrow(/root/i);
});
```

Remove unused imports if the exact file already has equivalent helpers.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts`

Expected: FAIL because `novel_branch_status` does not exist.

- [ ] **Step 3: Implement plugin tool**

In `.opencode/plugins/novel-production.ts`, import:

```ts
import { buildNovelBranchStatus } from "../../src/novel-production/branch-status";
```

Add tool next to other branch tools:

```ts
novel_branch_status: {
  description: "Summarize file counts and key artifacts for all novel branches.",
  async execute(input) {
    if ("root" in input && typeof input.root !== "string") {
      throw new Error("root must be a string");
    }
    const root = typeof input.root === "string" ? input.root : process.cwd();
    return buildNovelBranchStatus(root);
  },
},
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/plugin-helper.test.ts tests/novel-production/branch-status.test.ts`

Expected: PASS.

---

### Task 3: Command Asset and Documentation

**Files:**
- Create: `.opencode/commands/novel-branch-status.md`
- Modify: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing asset tests**

Modify `commandFiles` in `tests/novel-production/opencode-assets.test.ts` to include:

```ts
"novel-branch-status",
```

Add test:

```ts
test("novel-branch-status command documents low-agent direct status behavior", async () => {
  const content = await readFile(".opencode/commands/novel-branch-status.md", "utf8");

  expect(content).toContain("novel_branch_status");
  expect(content).toContain("active branch");
  expect(content).toContain("file counts");
  expect(content).toContain("direct plugin");
  expect(content).toContain("Do not read draft or review contents");
  expect(content).toContain("Do not ask novel-producer to reason");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: FAIL because command file does not exist.

- [ ] **Step 3: Create command asset**

Create `.opencode/commands/novel-branch-status.md`:

```md
---
description: Show simple file status for all novel branches.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->

Use the direct `novel_branch_status` plugin tool to show simple file counts and key artifact existence for every registered active branch workspace. `agent: novel-producer` is only the OpenCode host entrypoint; business logic is implemented in direct plugin and core TypeScript APIs.

Workspace: `.novel-production/`.

Required behavior:
- Use the direct plugin tool `novel_branch_status`.
- Show all registered branches and mark the active branch.
- Print file counts for known branch directories.
- Print whether key artifacts such as `requirements.json`, `plot-units.json`, `exports/manuscript.md`, and `reports/production-report.md` exist.
- Do not read draft or review contents.
- Do not ask novel-producer to reason over branch files.
- Do not modify branch registry, active pointer, drafts, reviews, reports, or production state.
```

If the asset test requires `.novel-production` and `novel-producer`, keep those strings present.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: PASS.

---

### Task 4: Deployment Asset List

**Files:**
- Modify: `src/novel-production/deployment.ts`
- Modify: `tests/novel-production/deployment.test.ts`

- [ ] **Step 1: Write failing deployment expectations**

In `tests/novel-production/deployment.test.ts`, add to `sourceAssetPaths`:

```ts
".opencode/commands/novel-branch-status.md",
```

Update fresh target create count from `19` to `20`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: FAIL because `managedAssetPaths` does not include the new command.

- [ ] **Step 3: Add managed asset**

In `src/novel-production/deployment.ts`, add near other branch commands:

```ts
".opencode/commands/novel-branch-status.md",
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/novel-production/deployment.test.ts tests/novel-production/opencode-assets.test.ts`

Expected: PASS.

---

### Task 5: Final Verification

**Files:**
- No code edits unless verification finds issues caused by this work.

- [ ] **Step 1: Run targeted branch-status tests**

Run:

```bash
npm test -- tests/novel-production/branch-status.test.ts tests/novel-production/plugin-helper.test.ts tests/novel-production/opencode-assets.test.ts tests/novel-production/deployment.test.ts tests/novel-production/branches.test.ts
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

- `src/novel-production/branch-status.ts`
- `src/novel-production/branches.ts`
- `.opencode/plugins/novel-production.ts`
- changed tests

Expected: clean diagnostics. If `typescript-language-server` is still missing, record that LSP diagnostics could not run and rely on `npm run typecheck`.

- [ ] **Step 5: Manual direct tool smoke check**

Run a short Node/tsx script or equivalent test that:

1. Creates `branch01` and `branch02`.
2. Writes files in `branch02/drafts/` and `branch02/exports/`.
3. Calls plugin `novel_branch_status`.
4. Confirms both branches are listed, `branch02` is active, and output does not contain draft contents.

Expected: structured branch status only, no prose content.
