import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createNovelBranch,
  getActiveNovelBranch,
  branchWorkspacePaths,
  activeBranchWorkspacePaths,
  switchNovelBranch,
} from "@/novel-production/branches";
import { createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";
import { initializeNovelProductionWorkspace, workspacePaths } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-branches-"));
  await mkdir(join(root, "prompt settings"), { recursive: true });
  await writeFile(join(root, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "默认写作 prompt", "utf8");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("novel branches", () => {
  test("creates a branch, registers it, and makes it active", async () => {
    await createNovelBranch(root, "branch02", { title: "小说 B" });

    const branchWorkspace = join(root, ".novel-production", "branches", "branch02");

    await expect(readFile(join(branchWorkspace, "requirements.json"), "utf8")).resolves.toContain(
      "schemaVersion",
    );
    await expect(readFile(join(root, ".novel-production", "branches.json"), "utf8")).resolves.toContain(
      '"branch02"',
    );
    await expect(getActiveNovelBranch(root)).resolves.toBe("branch02");
    await expect(readFile(join(branchWorkspace, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "utf8")).resolves.toBe(
      "默认写作 prompt",
    );
  });

  test("initializes a default prompt shell when creating a branch", async () => {
    await rm(join(root, "prompt settings"), { recursive: true, force: true });

    await createNovelBranch(root, "branch02");

    const branchPrompt = await readFile(
      join(root, ".novel-production", "branches", "branch02", "prompt settings", "novel_ai_language_prompt_v1_3.md"),
      "utf8",
    );

    expect(branchPrompt).toContain("novel-intake:start");
    expect(branchPrompt).toContain("novel-plan:start");
  });

  test("switches only to an existing branch", async () => {
    await createNovelBranch(root, "branch01");
    await createNovelBranch(root, "branch02");

    await switchNovelBranch(root, "branch01");

    await expect(getActiveNovelBranch(root)).resolves.toBe("branch01");
    await expect(switchNovelBranch(root, "missing")).rejects.toThrow(/unknown branch/i);
  });

  test("reports no active branch clearly", async () => {
    await initializeNovelProductionWorkspace(root);

    await expect(getActiveNovelBranch(root)).rejects.toThrow(/create or select a branch first/i);
  });

  test("reports stale active branch pointers clearly", async () => {
    await createNovelBranch(root, "branch01");
    await writeFile(
      join(root, ".novel-production", "active-branch.json"),
      JSON.stringify({ schemaVersion: 1, branchId: "missing", updatedAt: "2026-05-16T00:00:00.000Z" }),
    );

    await expect(getActiveNovelBranch(root)).rejects.toThrow(/unknown active branch.*missing.*branch01/i);
  });

  test.each(["../escape", "nested/unit", "nested\\unit", "", ".", "branch.1"])(
    "rejects unsafe branch id %s",
    async (branchId) => {
      await expect(createNovelBranch(root, branchId)).rejects.toThrow(/invalid/i);
    },
  );

  test("workspacePaths(root, '.') treats root as the workspace directory", async () => {
    const paths = workspacePaths(root, ".");

    expect(paths.workspace).toBe(root);
    expect(paths.requirements).toBe(join(root, "requirements.json"));
  });

  test("branch workspace paths live under the branch workspace root", async () => {
    const paths = branchWorkspacePaths(root, "branch02");

    expect(paths.workspace).toBe(join(root, ".novel-production", "branches", "branch02"));
    expect(paths.draftsDir).toBe(join(root, ".novel-production", "branches", "branch02", "drafts"));
  });

  test("active branch workspace paths resolve the active branch", async () => {
    await createNovelBranch(root, "branch01");

    const paths = await activeBranchWorkspacePaths(root);

    expect(paths.workspace).toBe(join(root, ".novel-production", "branches", "branch01"));
  });

  test("branch-scoped repositories isolate drafts from the root workspace", async () => {
    await initializeNovelProductionWorkspace(root);
    await writeFile(join(root, ".novel-production", "drafts", "ch03.md"), "root draft");
    await createNovelBranch(root, "branch02");

    const branchRepo = createNovelProductionRepositoryFromPaths(branchWorkspacePaths(root, "branch02"));

    await branchRepo.writeDraft("ch03", "branch draft");

    await expect(readFile(join(root, ".novel-production", "drafts", "ch03.md"), "utf8")).resolves.toBe(
      "root draft",
    );
    await expect(branchRepo.readDraft("ch03")).resolves.toBe("branch draft");
    await expect(readFile(join(root, ".novel-production", "branches", "branch02", "drafts", "ch03.md"), "utf8")).resolves.toBe(
      "branch draft",
    );
  });

  test("creating a branch does not migrate root drafts into the branch workspace", async () => {
    await initializeNovelProductionWorkspace(root);
    await writeFile(join(root, ".novel-production", "drafts", "ch03.md"), "root draft");

    await createNovelBranch(root, "branch02");

    await expect(readFile(join(root, ".novel-production", "drafts", "ch03.md"), "utf8")).resolves.toBe(
      "root draft",
    );
    await expect(
      readFile(join(root, ".novel-production", "branches", "branch02", "drafts", "ch03.md"), "utf8"),
    ).rejects.toThrow(/enoent/i);
  });

  test("normalizes a workspace path passed as root instead of nesting another workspace", async () => {
    await initializeNovelProductionWorkspace(root);

    await createNovelBranch(join(root, ".novel-production"), "branch02");

    await expect(readFile(join(root, ".novel-production", "branches.json"), "utf8")).resolves.toContain(
      '"branch02"',
    );
    await expect(
      readFile(join(root, ".novel-production", ".novel-production", "branches.json"), "utf8"),
    ).rejects.toThrow(/enoent/i);

    const paths = branchWorkspacePaths(join(root, ".novel-production"), "branch02");
    expect(paths.workspace).toBe(join(root, ".novel-production", "branches", "branch02"));
    await expect(getActiveNovelBranch(join(root, ".novel-production"))).resolves.toBe("branch02");
  });
});
