import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createNovelProductionRepository, createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";
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
    await expect(readFile(paths.storyBible, "utf8")).resolves.toContain("continuityRules");
    await expect(readFile(paths.plan, "utf8")).resolves.toContain("productionNotes");
    await expect(readFile(paths.plotUnits, "utf8")).resolves.toBe("[]\n");
    await expect(readFile(paths.prototypes, "utf8")).resolves.toBe("[]\n");
    await expect(readFile(paths.elementPools, "utf8")).resolves.toBe("[]\n");

    await expect(access(paths.materialsDir)).resolves.toBeUndefined();
    await expect(access(paths.materialDecompositionsDir)).resolves.toBeUndefined();
    await expect(access(paths.draftsDir)).resolves.toBeUndefined();
    await expect(access(paths.reviewsDir)).resolves.toBeUndefined();
    await expect(access(paths.repairTasksDir)).resolves.toBeUndefined();
    await expect(access(paths.generationRunsDir)).resolves.toBeUndefined();
    await expect(access(paths.exportsDir)).resolves.toBeUndefined();
    await expect(access(paths.reportsDir)).resolves.toBeUndefined();
    expect(paths.workspace).toBe(join(root, ".novel-production"));
    expect(paths.manuscript).toBe(join(paths.exportsDir, "manuscript.md"));
    expect(paths.productionReport).toBe(join(paths.reportsDir, "production-report.md"));
    expect(paths.promptSettingsDir).toBe(join(root, ".novel-production", "prompt settings"));
    expect(paths.promptFile).toBe(join(root, ".novel-production", "prompt settings", "novel_ai_language_prompt_v1_3.md"));
  });



  test("reinitializing preserves existing workspace files", async () => {
    await initializeNovelProductionWorkspace(root);
    const repo = createNovelProductionRepository(root);

    await repo.saveRequirements({
      schemaVersion: 1,
      id: "req-1",
      title: "保留的需求",
      originalBrief: "重新初始化不能覆盖",
      language: "zh-CN",
      genre: "科幻",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      lengthTarget: { totalWords: 80000, unitWords: 2000 },
      mustInclude: ["废弃卫星"],
      mustAvoid: [],
      referenceNotes: [],
      qualityBar: ["符合用户要求"],
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    });

    await initializeNovelProductionWorkspace(root);

    await expect(repo.loadRequirements()).resolves.toMatchObject({ title: "保留的需求" });
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

  test("repository round-trips text artifacts and rejects path traversal IDs", async () => {
    await initializeNovelProductionWorkspace(root);
    const repo = createNovelProductionRepository(root);

    await repo.writeDraft("unit-1", "第一章正文");
    await repo.writeManuscript("合稿正文");
    await repo.writeProductionReport("生产报告");

    await expect(repo.readDraft("unit-1")).resolves.toBe("第一章正文");
    await expect(repo.readManuscript()).resolves.toBe("合稿正文");
    await expect(repo.readProductionReport()).resolves.toBe("生产报告");
    expect(() => repo.readDraft("../escape")).toThrow(/invalid/i);
    expect(() => repo.readDraft("nested/unit")).toThrow(/invalid/i);
    expect(() => repo.readDraft("nested\\unit")).toThrow(/invalid/i);
    expect(() => repo.readDraft("")).toThrow(/invalid/i);
    expect(() => repo.readDraft(".")).toThrow(/invalid/i);
    expect(() => repo.readDraft("   ")).toThrow(/invalid/i);
    expect(() => repo.readDraft("unit.1")).toThrow(/invalid/i);
  });

  test("repository round-trips workspace prompt text", async () => {
    const repo = createNovelProductionRepositoryFromPaths(workspacePaths(root, "."));

    await repo.writePrompt("分支写作 prompt");

    await expect(repo.readPrompt()).resolves.toBe("分支写作 prompt");
    await expect(readFile(join(root, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "utf8")).resolves.toBe(
      "分支写作 prompt",
    );
  });
});
