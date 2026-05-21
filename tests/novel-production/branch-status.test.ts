import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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


  test("renders Branch Timeline with active marker and sorted unit statuses while preserving details", async () => {
    await createNovelBranch(root, "branch01");
    const branch01 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch01"));
    await branch01.savePlotUnits([
      {
        id: "unit-b",
        orderIndex: 2,
        title: "第二单元",
        purpose: "第二",
        summary: "第二",
        targetWords: 1000,
        status: "approved",
        prototypeIds: [],
        inheritedElementPoolIds: [],
        localElements: [],
        bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
        constraints: [],
        draftPath: ".novel-production/drafts/unit-b.md",
        currentRepairTaskId: "",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
      },
      {
        id: "unit-a",
        orderIndex: 1,
        title: "第一单元",
        purpose: "第一",
        summary: "第一",
        targetWords: 1000,
        status: "drafted",
        prototypeIds: [],
        inheritedElementPoolIds: [],
        localElements: [],
        bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
        constraints: [],
        draftPath: ".novel-production/drafts/unit-a.md",
        currentRepairTaskId: "",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
      },
    ]);

    await createNovelBranch(root, "branch02");
    const branch02 = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch02"));
    await branch02.savePlotUnits([
      {
        id: "unit-c",
        orderIndex: 1,
        title: "第一单元",
        purpose: "第一",
        summary: "第一",
        targetWords: 1000,
        status: "ready_to_produce",
        prototypeIds: [],
        inheritedElementPoolIds: [],
        localElements: [],
        bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
        constraints: [],
        draftPath: ".novel-production/drafts/unit-c.md",
        currentRepairTaskId: "",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
      },
    ]);

    const markdown = renderNovelBranchStatusMarkdown(await buildNovelBranchStatus(root));

    expect(markdown).toContain("## Branch Timeline");
    expect(markdown).toContain("branch01: ch01(drafted) ── ch02(approved)");
    expect(markdown).toContain("branch02*: ch01(ready_to_produce)");
    expect(markdown).toContain("  - drafts:");
    expect(markdown).toContain("  - requirements.json:");
  });


  test("renders no plot units when branch workspace is missing", async () => {
    await createNovelBranch(root, "branch01");
    await rm(branchWorkspacePaths(root, "branch01").workspace, { recursive: true, force: true });

    const markdown = renderNovelBranchStatusMarkdown(await buildNovelBranchStatus(root));

    expect(markdown).toContain("branch01*: no plot units");
    expect(markdown).toMatch(/Warning: Missing branch workspace/);
  });

  test("renders plot units unavailable when plot-units metadata is missing", async () => {
    await createNovelBranch(root, "branch01");
    await rm(branchWorkspacePaths(root, "branch01").plotUnits, { force: true });

    const markdown = renderNovelBranchStatusMarkdown(await buildNovelBranchStatus(root));

    expect(markdown).toContain("branch01*: plot units unavailable");
    expect(markdown).toMatch(/Warning: Plot units unavailable/);
  });

  test("renders plot units unavailable when plot-units metadata is malformed", async () => {
    await createNovelBranch(root, "branch01");
    await writeFile(branchWorkspacePaths(root, "branch01").plotUnits, "not json");

    const markdown = renderNovelBranchStatusMarkdown(await buildNovelBranchStatus(root));

    expect(markdown).toContain("branch01*: plot units unavailable");
    expect(markdown).toMatch(/Warning: Plot units unavailable/);
  });

  test("renders plot units unavailable when plot-units metadata is unreadable", async () => {
    await createNovelBranch(root, "branch01");
    await chmod(branchWorkspacePaths(root, "branch01").plotUnits, 0o000);

    const markdown = renderNovelBranchStatusMarkdown(await buildNovelBranchStatus(root));

    expect(markdown).toContain("branch01*: plot units unavailable");
    expect(markdown).toMatch(/Warning: Plot units unavailable/);
  });

  test("renders metadata-only status without reading content files", async () => {
    await createNovelBranch(root, "branch01");
    const branchPaths = branchWorkspacePaths(root, "branch01");
    const branch = createNovelProductionRepositoryFromPaths(branchPaths);
    await branch.savePlotUnits([
      {
        id: "unit-a",
        orderIndex: 1,
        title: "第一单元",
        purpose: "第一",
        summary: "第一",
        targetWords: 1000,
        status: "drafted",
        prototypeIds: [],
        inheritedElementPoolIds: [],
        localElements: [],
        bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
        constraints: [],
        draftPath: ".novel-production/drafts/unit-a.md",
        currentRepairTaskId: "",
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
      },
    ]);
    const contentFiles = [
      join(branchPaths.draftsDir, "unit-a.md"),
      join(branchPaths.reviewsDir, "review-a.json"),
      join(branchPaths.repairTasksDir, "repair-a.json"),
      join(branchPaths.generationRunsDir, "run-a.json"),
      branchPaths.manuscript,
      branchPaths.productionReport,
    ];
    await branch.writeDraft("unit-a", "SECRET_BRANCH_STATUS_CONTENT");
    await writeFile(join(branchPaths.reviewsDir, "review-a.json"), "SECRET_BRANCH_STATUS_CONTENT");
    await writeFile(join(branchPaths.repairTasksDir, "repair-a.json"), "SECRET_BRANCH_STATUS_CONTENT");
    await writeFile(join(branchPaths.generationRunsDir, "run-a.json"), "SECRET_BRANCH_STATUS_CONTENT");
    await branch.writeManuscript("SECRET_BRANCH_STATUS_CONTENT");
    await branch.writeProductionReport("SECRET_BRANCH_STATUS_CONTENT");
    await Promise.all(contentFiles.map((path) => chmod(path, 0o000)));

    const markdown = renderNovelBranchStatusMarkdown(await buildNovelBranchStatus(root));

    expect(markdown).toContain("branch01*: ch01(drafted)");
    expect(markdown).not.toContain("SECRET_BRANCH_STATUS_CONTENT");
  });

  test("missing branch registry returns an empty status", async () => {
    await expect(buildNovelBranchStatus(root)).resolves.toMatchObject({
      warnings: [],
      branches: [],
    });
  });

  test("missing branch registry ignores an existing active pointer", async () => {
    await mkdir(join(root, ".novel-production"), { recursive: true });
    await writeFile(
      join(root, ".novel-production", "active-branch.json"),
      JSON.stringify({ schemaVersion: 1, branchId: "branch01", updatedAt: "2026-05-17T00:00:00.000Z" }),
    );

    const status = await buildNovelBranchStatus(root);

    expect(status).toEqual({
      warnings: [],
      branches: [],
    });
  });

  test("existing but empty branch registry reports a warning if an active pointer exists", async () => {
    await mkdir(join(root, ".novel-production"), { recursive: true });
    await writeFile(
      join(root, ".novel-production", "branches.json"),
      JSON.stringify({ schemaVersion: 1, branches: [] }),
    );
    await writeFile(
      join(root, ".novel-production", "active-branch.json"),
      JSON.stringify({ schemaVersion: 1, branchId: "branch01", updatedAt: "2026-05-17T00:00:00.000Z" }),
    );

    const status = await buildNovelBranchStatus(root);

    expect(status.activeBranchId).toBe("branch01");
    expect(status.warnings.join(" ")).toMatch(/unknown active branch.*branch01/i);
    expect(status.branches).toEqual([]);
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

  test("active branch stays active when its workspace is missing", async () => {
    await createNovelBranch(root, "branch01");
    await rm(branchWorkspacePaths(root, "branch01").workspace, { recursive: true, force: true });

    const status = await buildNovelBranchStatus(root);

    expect(status.activeBranchId).toBe("branch01");
    expect(status.branches[0]!.active).toBe(true);
  });

  test("artifact existence requires a regular file", async () => {
    await createNovelBranch(root, "branch01");
    const branchPaths = branchWorkspacePaths(root, "branch01");
    await rm(join(branchPaths.workspace, "exports", "manuscript.md"), { force: true });
    await mkdir(join(branchPaths.workspace, "exports", "manuscript.md"), { recursive: true });

    const status = await buildNovelBranchStatus(root);

    expect(artifactExists(status, "branch01", "exports/manuscript.md")).toBe(false);
  });

  test("workspace path that is a file is treated as missing and non-directory", async () => {
    await createNovelBranch(root, "branch01");
    const branchPaths = branchWorkspacePaths(root, "branch01");
    await rm(branchPaths.workspace, { recursive: true, force: true });
    await writeFile(branchPaths.workspace, "not a directory");

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
