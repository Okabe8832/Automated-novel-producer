import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import type { ToolContext } from "../../.opencode/node_modules/@opencode-ai/plugin/dist/tool";
import { afterEach, beforeEach } from "vitest";

import { activeBranchWorkspacePaths, createNovelBranch, getActiveNovelBranch } from "@/novel-production/branches";
import { createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";
import novelProductionPlugin from "../../.opencode/plugins/novel-production";

let root: string;
let previousCwd: string;

type JsonToolResult = { output: string };

function parseToolJson<T>(result: unknown): T {
  expect(result).toEqual(expect.objectContaining({ output: expect.any(String) }));
  return JSON.parse((result as JsonToolResult).output) as T;
}

function toolContext(): ToolContext {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "novel-producer",
    directory: root,
    worktree: root,
    abort: new AbortController().signal,
    metadata() {},
    ask() {
      throw new Error("ask is not supported in plugin tests");
    },
  };
}

beforeEach(async () => {
  previousCwd = process.cwd();
  root = await mkdtemp(join(tmpdir(), "novel-production-plugin-"));
  await initializeNovelProductionWorkspace(root);
  process.chdir(root);
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(root, { recursive: true, force: true });
});

describe("novel production plugin helper", () => {
  test("exports a supported helper plugin shape", async () => {
    const plugin = await novelProductionPlugin();

    expect(plugin).toHaveProperty("tool");
    expect(Object.keys(plugin.tool ?? {})).toContain("novel_production_status");
    expect(Object.keys(plugin.tool ?? {})).toContain("novel_read");
    expect(Object.keys(plugin.tool ?? {})).toContain("novel_branch_create");
    expect(Object.keys(plugin.tool ?? {})).toContain("novel_branch_switch");
  });


  test("all direct plugin tools provide OpenCode zod args schemas", async () => {
    const plugin = await novelProductionPlugin();

    for (const [toolName, definition] of Object.entries(plugin.tool)) {
      expect(definition.args, `${toolName} args`).toBeDefined();
      expect(typeof definition.args).toBe("object");
      for (const [argName, schema] of Object.entries(definition.args ?? {})) {
        expect(typeof (schema as { safeParse?: unknown }).safeParse, `${toolName}.${argName} safeParse`).toBe("function");
      }
    }
  });

  test("novel_read reads the active branch draft directly and returns preview metadata", async () => {
    await createNovelBranch(root, "branch02");

    const branchRepo = createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
    await branchRepo.writeDraft("ch03", "branch draft preview");

    const plugin = await novelProductionPlugin();
    const novelRead = plugin.tool.novel_read;

    expect(novelRead).toBeDefined();

    const result = parseToolJson<Record<string, unknown>>(await novelRead.execute({ unitId: "ch03", offset: 7, limit: 6 }, toolContext()));

    expect(result).toMatchObject({
      branchId: "branch02",
      unitId: "ch03",
      path: expect.stringContaining(".novel-production/branches/branch02/drafts/ch03.md"),
      offset: 7,
      limit: 6,
      text: "draft ",
    });
  });

  test("novel_read rejects a branchId override", async () => {
    const plugin = await novelProductionPlugin();

    await expect(
      plugin.tool.novel_read.execute({ unitId: "ch03", branchId: "branch99" }, toolContext()),
    ).rejects.toThrow(/branchId/i);
  });

  test("novel_read rejects a present root that is not a string", async () => {
    await createNovelBranch(root, "branch02");
    const branchRepo = createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
    await branchRepo.writeDraft("ch03", "branch draft preview");

    const plugin = await novelProductionPlugin();

    await expect(plugin.tool.novel_read.execute({ unitId: "ch03", root: 123 }, toolContext())).rejects.toThrow(/root/i);
  });

  test.each([
    ["offset", { offset: "7" }],
    ["limit", { limit: "6" }],
  ])("novel_read rejects a present %s that is not a number", async (_label, input) => {
    await createNovelBranch(root, "branch02");
    const branchRepo = createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
    await branchRepo.writeDraft("ch03", "branch draft preview");

    const plugin = await novelProductionPlugin();

    await expect(plugin.tool.novel_read.execute({ unitId: "ch03", ...input }, toolContext())).rejects.toThrow(/(offset|limit)/i);
  });

  test("novel_branch_create creates a branch, makes it active, and returns branchId", async () => {
    const plugin = await novelProductionPlugin();

    const result = parseToolJson<Record<string, unknown>>(await plugin.tool.novel_branch_create.execute({ branchId: "branch03", title: "新标题" }, toolContext()));

    expect(result).toEqual({ branchId: "branch03" });
    await expect(getActiveNovelBranch(root)).resolves.toBe("branch03");
    await expect(
      readFile(join(root, ".novel-production", "branches.json"), "utf8").then((content) => JSON.parse(content)),
    ).resolves.toMatchObject({
      branches: [{ id: "branch03", title: "新标题" }],
    });
  });

  test("novel_branch_create defaults root to process.cwd() when omitted", async () => {
    const plugin = await novelProductionPlugin();

    const result = parseToolJson<Record<string, unknown>>(await plugin.tool.novel_branch_create.execute({ branchId: "branch04" }, toolContext()));

    expect(result).toEqual({ branchId: "branch04" });
    await expect(getActiveNovelBranch(root)).resolves.toBe("branch04");
  });

  test("novel_branch_status returns the core branch status report and does not expose draft contents", async () => {
    await createNovelBranch(root, "branch11", { title: "小说 11" });
    const branchRepo = createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
    await branchRepo.writeDraft("ch11", "SECRET_DRAFT_BODY");

    const plugin = await novelProductionPlugin();

    expect(Object.keys(plugin.tool ?? {})).toContain("novel_branch_status");

    const result = parseToolJson<Record<string, unknown>>(await plugin.tool.novel_branch_status.execute({}, toolContext()));

    expect(result).toMatchObject({
      activeBranchId: "branch11",
      warnings: [],
      branches: [
        {
          branchId: "branch11",
          title: "小说 11",
          active: true,
          warnings: [],
          directories: expect.arrayContaining([
            expect.objectContaining({
              name: "drafts",
              fileCount: 1,
            }),
          ]),
          artifacts: expect.arrayContaining([
            expect.objectContaining({
              name: "exports/manuscript.md",
              exists: false,
            }),
          ]),
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("SECRET_DRAFT_BODY");
  });

  test("novel_branch_status rejects a present root that is not a string", async () => {
    const plugin = await novelProductionPlugin();

    await expect(plugin.tool.novel_branch_status.execute({ root: 123 }, toolContext())).rejects.toThrow(/root/i);
  });

  test.each([
    ["novel_branch_create", {}],
    ["novel_branch_switch", {}],
  ])("%s rejects a missing branchId", async (toolName, input) => {
    const plugin = await novelProductionPlugin();

    await expect(plugin.tool[toolName].execute(input, toolContext())).rejects.toThrow(/branchId/i);
  });

  test.each([
    ["novel_branch_create", { branchId: 123 }],
    ["novel_branch_switch", { branchId: 123 }],
  ])("%s rejects a non-string branchId", async (toolName, input) => {
    const plugin = await novelProductionPlugin();

    await expect(plugin.tool[toolName].execute(input, toolContext())).rejects.toThrow(/branchId/i);
  });

  test("novel_branch_create rejects a present title that is not a string", async () => {
    const plugin = await novelProductionPlugin();

    await expect(plugin.tool.novel_branch_create.execute({ branchId: "branch05", title: 123 }, toolContext())).rejects.toThrow(
      /title/i,
    );
  });

  test("novel_branch_create accepts a string title and omits it when not provided", async () => {
    const plugin = await novelProductionPlugin();

    expect(parseToolJson<Record<string, unknown>>(await plugin.tool.novel_branch_create.execute({ branchId: "branch06", title: "分支标题" }, toolContext()))).toEqual({
      branchId: "branch06",
    });
    expect(parseToolJson<Record<string, unknown>>(await plugin.tool.novel_branch_create.execute({ branchId: "branch07" }, toolContext()))).toEqual({
      branchId: "branch07",
    });
    await expect(readFile(join(root, ".novel-production", "branches.json"), "utf8")).resolves.toContain(
      '"branch06"',
    );
  });

  test("novel_branch_switch switches to an existing branch and returns branchId", async () => {
    await createNovelBranch(root, "branch08");
    await createNovelBranch(root, "branch09");

    const plugin = await novelProductionPlugin();

    const result = parseToolJson<Record<string, unknown>>(await plugin.tool.novel_branch_switch.execute({ branchId: "branch08" }, toolContext()));

    expect(result).toEqual({ branchId: "branch08" });
    await expect(getActiveNovelBranch(root)).resolves.toBe("branch08");
  });

  test("novel_branch_switch defaults root to process.cwd() when omitted", async () => {
    await createNovelBranch(root, "branch10");

    const plugin = await novelProductionPlugin();

    const result = parseToolJson<Record<string, unknown>>(await plugin.tool.novel_branch_switch.execute({ branchId: "branch10" }, toolContext()));

    expect(result).toEqual({ branchId: "branch10" });
    await expect(getActiveNovelBranch(root)).resolves.toBe("branch10");
  });

  test.each([
    ["novel_branch_create", { branchId: "branch11", root: 123 }],
    ["novel_branch_switch", { branchId: "branch12", root: 123 }],
  ])("%s rejects a present root that is not a string", async (toolName, input) => {
    const plugin = await novelProductionPlugin();

    await expect(plugin.tool[toolName].execute(input, toolContext())).rejects.toThrow(/root/i);
  });
});
