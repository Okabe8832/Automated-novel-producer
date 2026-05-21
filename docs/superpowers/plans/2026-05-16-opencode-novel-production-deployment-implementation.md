# OpenCode Novel Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe installer/sync workflow that deploys the project-local OpenCode novel production assets into another OpenCode project.

**Architecture:** Keep OpenCode agents and commands as file assets under `.opencode`; do not rely on plugin runtime registration. Implement a testable deployment core in `src/novel-production/deployment.ts`, expose it through a small CLI script in `scripts/install-opencode-novel-production.ts`, and document the install workflow in the deployment checklist.

**Tech Stack:** TypeScript, Node `fs/promises`, Node `path`, `tsx`, Vitest, OpenCode markdown agents/commands/plugins.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-16-opencode-novel-production-deployment-design.md`
- Existing deployment checklist: `docs/opencode-deployment-checklist.md`
- Existing OpenCode assets: `.opencode/agents`, `.opencode/commands`, `.opencode/plugins/novel-production.ts`

## File Structure

- Create: `src/novel-production/deployment.ts`
  - Owns managed asset manifest, deployment options, deployment-plan creation, config merge, conflict detection, backup planning, and write execution.
- Create: `scripts/install-opencode-novel-production.ts`
  - Thin CLI wrapper around the deployment core. Parses flags, calls planner/executor, prints report, sets process exit code.
- Create: `tests/novel-production/deployment.test.ts`
  - Tests planner and writer against temporary source/target projects.
- Modify: `package.json`
  - Add `install:opencode-novel` script using `tsx`.
- Modify: `.opencode/agents/*.md`, `.opencode/commands/*.md`, `.opencode/plugins/novel-production.ts`
  - Add managed markers used for safe overwrite detection.
- Modify: `tests/novel-production/opencode-assets.test.ts`
  - Assert managed markers exist on deployable assets.
- Modify: `docs/opencode-deployment-checklist.md`
  - Document installer dry-run/write/force workflow.

## Task 1: Deployment Planner Core

**Files:**
- Create: `src/novel-production/deployment.ts`
- Create: `tests/novel-production/deployment.test.ts`

- [ ] **Step 1: Write failing tests for dry-run planning**

Create `tests/novel-production/deployment.test.ts` with a temp source project containing the expected `.opencode` files and a temp empty target project.

Required test:

```ts
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildDeploymentPlan } from "@/novel-production/deployment";

describe("OpenCode novel deployment planner", () => {
  let sourceRoot: string;
  let targetRoot: string;

  beforeEach(async () => {
    sourceRoot = await mkdtemp(join(tmpdir(), "novel-deploy-source-"));
    targetRoot = await mkdtemp(join(tmpdir(), "novel-deploy-target-"));
    await seedSourceAssets(sourceRoot);
  });

  afterEach(async () => {
    await rm(sourceRoot, { recursive: true, force: true });
    await rm(targetRoot, { recursive: true, force: true });
  });

  test("plans asset creation for a fresh target", async () => {
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(plan.assets.filter((asset) => asset.action === "create")).toHaveLength(16);
    expect(plan.assets.filter((asset) => asset.action === "conflict")).toHaveLength(0);
    expect(plan.config.action).toBe("create");
    expect(plan.config.defaultAgent).toBe("novel-producer");
  });
});
```

Add helper `seedSourceAssets()` in the test file. It should create all 16 managed source files with marker text.

- [ ] **Step 2: Run the failing test**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: FAIL because `@/novel-production/deployment` does not exist.

- [ ] **Step 3: Implement planner types and manifest**

Create `src/novel-production/deployment.ts` with:

```ts
export const managedByMarker = "managed-by: opencode-novel-production-line";

export const managedAssetPaths = [
  ".opencode/agents/novel-producer.md",
  ".opencode/agents/novel-planner.md",
  ".opencode/agents/novel-drafter.md",
  ".opencode/agents/novel-reviewer.md",
  ".opencode/agents/novel-repairer.md",
  ".opencode/agents/novel-continuity.md",
  ".opencode/agents/novel-exporter.md",
  ".opencode/commands/novel-init.md",
  ".opencode/commands/novel-intake.md",
  ".opencode/commands/novel-plan.md",
  ".opencode/commands/novel-produce.md",
  ".opencode/commands/novel-review.md",
  ".opencode/commands/novel-repair.md",
  ".opencode/commands/novel-export.md",
  ".opencode/commands/novel-status.md",
  ".opencode/plugins/novel-production.ts",
] as const;

export type DeploymentMode = "dry-run" | "write";
export type DefaultAgentPolicy = "set-if-missing" | "set" | "keep";
export type AssetAction = "create" | "update" | "unchanged" | "conflict";
export type ConfigAction = "create" | "merge" | "unchanged" | "conflict";

export type BuildDeploymentPlanOptions = {
  sourceRoot: string;
  targetRoot: string;
  mode?: DeploymentMode;
  force?: boolean;
  defaultAgentPolicy?: DefaultAgentPolicy;
};
```

Implement `buildDeploymentPlan(options)` so it validates the roots, reads each source asset, compares target content, and returns asset actions. For this task, implement enough config behavior to create `opencode.json` with `default_agent: "novel-producer"` when missing.

- [ ] **Step 4: Run planner test**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: PASS for the first planner test.

## Task 2: Config Merge and Conflict Rules

**Files:**
- Modify: `src/novel-production/deployment.ts`
- Modify: `tests/novel-production/deployment.test.ts`

- [ ] **Step 1: Write failing tests for config merge and conflicts**

Add tests:

```ts
test("preserves unrelated opencode config keys", async () => {
  await writeFile(join(targetRoot, "opencode.json"), JSON.stringify({ theme: "system" }, null, 2));

  const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

  expect(plan.config.action).toBe("merge");
  expect(plan.config.next).toMatchObject({ theme: "system", default_agent: "novel-producer" });
});

test("keeps an existing default agent unless explicitly requested", async () => {
  await writeFile(join(targetRoot, "opencode.json"), JSON.stringify({ default_agent: "build" }, null, 2));

  const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

  expect(plan.config.action).toBe("unchanged");
  expect(plan.config.defaultAgent).toBe("build");
  expect(plan.warnings).toContain("Target already has default_agent build; rerun with --set-default-agent to replace it.");
});

test("reports unmarked changed target files as conflicts", async () => {
  await mkdir(join(targetRoot, ".opencode/agents"), { recursive: true });
  await writeFile(join(targetRoot, ".opencode/agents/novel-producer.md"), "custom local content");

  const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

  expect(plan.assets.find((asset) => asset.relativePath.endsWith("novel-producer.md"))?.action).toBe("conflict");
});

test("fails before writing when a required source asset is missing", async () => {
  await rm(join(sourceRoot, ".opencode/commands/novel-status.md"));

  await expect(buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" })).rejects.toThrow(
    "Missing required source asset: .opencode/commands/novel-status.md",
  );
});

test("rejects source and target pointing to the same project", async () => {
  await expect(buildDeploymentPlan({ sourceRoot, targetRoot: sourceRoot, mode: "dry-run" })).rejects.toThrow(
    "Target project must be different from the source project",
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: FAIL until merge, warning, and conflict behavior are implemented.

- [ ] **Step 3: Implement config merge and conflict rules**

Update `buildDeploymentPlan()`:

- Parse existing `opencode.json` as JSON.
- Throw a clear error for invalid JSON.
- Preserve unrelated keys.
- If `defaultAgentPolicy` is `set`, set `default_agent` to `novel-producer`.
- If `defaultAgentPolicy` is `keep`, do not change `default_agent`.
- If `defaultAgentPolicy` is `set-if-missing`, set it only when missing.
- Mark changed target files without the managed marker as `conflict` unless `force` is true.
- Mark changed target files with the marker as `update`.
- Mark identical files as `unchanged`.
- Throw a clear error when a required source asset is missing.
- Throw a clear error when `sourceRoot` and `targetRoot` resolve to the same directory.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: PASS.

## Task 3: Write Execution with Backups

**Files:**
- Modify: `src/novel-production/deployment.ts`
- Modify: `tests/novel-production/deployment.test.ts`

- [ ] **Step 1: Write failing tests for write mode**

Add tests:

```ts
import { pathExists } from "@/novel-production/deployment";

test("writes planned assets and config", async () => {
  const result = await applyDeploymentPlan(
    await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" }),
  );

  expect(result.writtenFiles).toContain(".opencode/commands/novel-status.md");
  expect(await pathExists(join(targetRoot, ".opencode/plugins/novel-production.ts"))).toBe(true);
  expect(JSON.parse(await readFile(join(targetRoot, "opencode.json"), "utf8"))).toMatchObject({
    default_agent: "novel-producer",
  });
});

test("backs up managed files before overwriting", async () => {
  await mkdir(join(targetRoot, ".opencode/commands"), { recursive: true });
  await writeFile(
    join(targetRoot, ".opencode/commands/novel-status.md"),
    `<!-- ${managedByMarker} -->\nold content`,
  );

  const result = await applyDeploymentPlan(
    await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" }),
  );

  expect(result.backupRoot).toContain(".opencode/novel-production-backups");
  expect(result.backedUpFiles).toContain(".opencode/commands/novel-status.md");
});

test("is idempotent after a successful install", async () => {
  await applyDeploymentPlan(await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" }));

  const secondPlan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

  expect(secondPlan.assets.every((asset) => asset.action === "unchanged")).toBe(true);
  expect(secondPlan.assets.filter((asset) => asset.action === "conflict")).toHaveLength(0);
  expect(secondPlan.config.action).toBe("unchanged");
});
```

Make sure imports include `applyDeploymentPlan`, `managedByMarker`, and `pathExists`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: FAIL because write execution is missing.

- [ ] **Step 3: Implement write execution**

Add exports:

```ts
export async function applyDeploymentPlan(plan: DeploymentPlan): Promise<DeploymentApplyResult>;
export async function pathExists(path: string): Promise<boolean>;
```

`applyDeploymentPlan()` must:

- reject plans with conflicts;
- create target directories;
- copy source asset content for create/update actions;
- write backups for update actions before overwrite;
- write merged `opencode.json` for create/merge config actions;
- return `writtenFiles`, `backedUpFiles`, and optional `backupRoot`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: PASS.

## Task 4: CLI Wrapper and Package Script

**Files:**
- Create: `scripts/install-opencode-novel-production.ts`
- Modify: `package.json`
- Modify: `tests/novel-production/deployment.test.ts`

- [ ] **Step 1: Write failing CLI smoke test**

Add a test that invokes the CLI through `tsx` against a temp target. Use Node `spawn` from `node:child_process` and wrap it in a Promise. Do not add CLI test dependencies.

Test behavior:

- run `npx tsx scripts/install-opencode-novel-production.ts --target <targetRoot> --dry-run`;
- expect exit code `0`;
- expect stdout includes `OpenCode Novel Production Deployment`;
- expect stdout includes `Mode: dry-run`.

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: FAIL because the CLI script does not exist.

- [ ] **Step 3: Implement CLI script**

Create `scripts/install-opencode-novel-production.ts`:

- parse `--target`, `--dry-run`, `--write`, `--force`, `--set-default-agent`, `--keep-default-agent`;
- default to dry-run if neither `--dry-run` nor `--write` is provided;
- call `buildDeploymentPlan()`;
- print a concise deployment report;
- call `applyDeploymentPlan()` only in write mode;
- exit `1` with an error message on validation or conflict failures.

Use only Node built-ins. Do not add CLI dependencies.

- [ ] **Step 4: Add package script**

Modify `package.json`:

```json
"install:opencode-novel": "tsx scripts/install-opencode-novel-production.ts"
```

- [ ] **Step 5: Run CLI dry-run manually**

Run: `npm run install:opencode-novel -- --target /Users/schelling/Desktop/514项目 --dry-run`

Expected: FAIL with a clear message because source and target are the same project. Then use a temp target for successful manual verification.

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/novel-production/deployment.test.ts`

Expected: PASS.

## Task 5: Managed Markers on Assets

**Files:**
- Modify: `.opencode/agents/novel-producer.md`
- Modify: `.opencode/agents/novel-planner.md`
- Modify: `.opencode/agents/novel-drafter.md`
- Modify: `.opencode/agents/novel-reviewer.md`
- Modify: `.opencode/agents/novel-repairer.md`
- Modify: `.opencode/agents/novel-continuity.md`
- Modify: `.opencode/agents/novel-exporter.md`
- Modify: `.opencode/commands/novel-init.md`
- Modify: `.opencode/commands/novel-intake.md`
- Modify: `.opencode/commands/novel-plan.md`
- Modify: `.opencode/commands/novel-produce.md`
- Modify: `.opencode/commands/novel-review.md`
- Modify: `.opencode/commands/novel-repair.md`
- Modify: `.opencode/commands/novel-export.md`
- Modify: `.opencode/commands/novel-status.md`
- Modify: `.opencode/plugins/novel-production.ts`
- Modify: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing marker tests**

Update `tests/novel-production/opencode-assets.test.ts` to assert every managed agent and command markdown file includes:

```text
managed-by: opencode-novel-production-line
```

Also assert `.opencode/plugins/novel-production.ts` includes the same marker.

- [ ] **Step 2: Run marker test to verify failure**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: FAIL until markers are added.

- [ ] **Step 3: Add markers to assets**

For markdown files, add near the top:

```md
<!-- managed-by: opencode-novel-production-line -->
```

For `.opencode/plugins/novel-production.ts`, add near the top:

```ts
// managed-by: opencode-novel-production-line
```

Do not change agent behavior or command instructions in this task.

- [ ] **Step 4: Run marker tests**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: PASS.

## Task 6: Documentation and Final Verification

**Files:**
- Modify: `docs/opencode-deployment-checklist.md`
- Modify: `docs/local-runbook.md` if helpful
- Test: all relevant tests

- [ ] **Step 1: Update deployment checklist**

Add a section named `Install Into Another OpenCode Project` showing:

```bash
npm run install:opencode-novel -- --target /path/to/target-project --dry-run
npm run install:opencode-novel -- --target /path/to/target-project --write
npm run install:opencode-novel -- --target /path/to/target-project --write --force
```

Document:

- dry-run first;
- backups under `.opencode/novel-production-backups/`;
- default-agent behavior;
- OpenCode verification commands after install.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/novel-production/deployment.test.ts tests/novel-production/opencode-assets.test.ts tests/novel-production/opencode-deployment.test.ts`

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Manual installer smoke check**

Create a temporary target directory and run:

```bash
npm run install:opencode-novel -- --target <temp-target> --dry-run
npm run install:opencode-novel -- --target <temp-target> --write
```

Expected:

- dry-run reports creates without writing;
- write mode creates `.opencode/agents`, `.opencode/commands`, `.opencode/plugins`, and `opencode.json`;
- rerunning dry-run after write reports unchanged or no conflicts.

- [ ] **Step 6: Record remaining runtime limitation**

If real OpenCode TUI verification is not possible in this environment, leave the final handoff note explicit: automated installer tests pass, but real TUI command discovery still needs manual verification.
