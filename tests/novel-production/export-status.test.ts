import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { exportManuscript } from "@/novel-production/export";
import { createNovelBranch, createActiveBranchNovelProductionRepository } from "@/novel-production/branches";
import { createNovelProductionRepository } from "@/novel-production/repository";
import { type NovelProductionRepository } from "@/novel-production/repository";
import type { PlotUnitRecord } from "@/novel-production/schema";
import { buildProductionStatus, renderProductionStatusMarkdown, writeProductionStatusReport } from "@/novel-production/status";
import { initializeNovelProductionWorkspace, workspacePaths } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
  await initializeNovelProductionWorkspace(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seedUnitsWithDrafts(
  units: Array<{ id: string; orderIndex: number; status: PlotUnitRecord["status"]; draft: string }>,
): Promise<NovelProductionRepository> {
  const repo = createNovelProductionRepository(root);
  await repo.savePlotUnits(
    units.map((unit) => ({
      id: unit.id,
      orderIndex: unit.orderIndex,
      title: unit.id,
      purpose: unit.id,
      summary: unit.id,
      targetWords: 2000,
      status: unit.status,
      prototypeIds: [],
      inheritedElementPoolIds: [],
      localElements: [],
      bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
      constraints: [],
      draftPath: `.novel-production/drafts/${unit.id}.md`,
      currentRepairTaskId: "",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    })),
  );
  for (const unit of units) {
    if (unit.draft) {
      await repo.writeDraft(unit.id, unit.draft);
    }
  }
  return repo;
}

async function seedBranchUnitsWithDrafts(
  units: Array<{ id: string; orderIndex: number; status: PlotUnitRecord["status"]; draft: string }>,
): Promise<NovelProductionRepository> {
  await createNovelBranch(root, "branch02");
  const repo = await createActiveBranchNovelProductionRepository(root);
  await repo.savePlotUnits(
    units.map((unit) => ({
      id: unit.id,
      orderIndex: unit.orderIndex,
      title: unit.id,
      purpose: unit.id,
      summary: unit.id,
      targetWords: 2000,
      status: unit.status,
      prototypeIds: [],
      inheritedElementPoolIds: [],
      localElements: [],
      bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
      constraints: [],
      draftPath: `.novel-production/drafts/${unit.id}.md`,
      currentRepairTaskId: "",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    })),
  );
  for (const unit of units) {
    if (unit.draft) {
      await repo.writeDraft(unit.id, unit.draft);
    }
  }
  return repo;
}

describe("export and status reporting", () => {
  test("exports approved drafts in order and skips unapproved units", async () => {
    const repo = await seedUnitsWithDrafts([
      { id: "unit-3", orderIndex: 3, status: "approved", draft: "第三段。" },
      { id: "unit-2", orderIndex: 2, status: "drafted", draft: "第二段未审。" },
      { id: "unit-1", orderIndex: 1, status: "approved", draft: "第一段。" },
    ]);

    const result = await exportManuscript(repo);

    expect(result.manuscriptPath).toBe(repo.paths.manuscript);
    expect(result.includedUnitIds).toEqual(["unit-1", "unit-3"]);
    expect(result.skippedUnitIds).toEqual(["unit-2"]);
    await expect(repo.readManuscript()).resolves.toContain("第一段。\n\n第三段。");
    await expect(repo.readProductionReport()).resolves.toContain("Skipped units: unit-2");
  });

  test("throws without writing when no approved units exist", async () => {
    const repo = await seedUnitsWithDrafts([{ id: "unit-1", orderIndex: 1, status: "drafted", draft: "未审正文。" }]);

    await expect(exportManuscript(repo)).rejects.toThrow(/no approved units/i);
    await expect(repo.readManuscript()).rejects.toThrow();
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

  test("writes a markdown status report", async () => {
    const repo = await seedUnitsWithDrafts([{ id: "unit-1", orderIndex: 1, status: "approved", draft: "第一段。" }]);

    const report = await writeProductionStatusReport(repo);
    const markdown = renderProductionStatusMarkdown(report);

    expect(markdown).toContain("Approved: 1");
    await expect(repo.readProductionReport()).resolves.toContain("Export manuscript");
  });

  test("renders a non-blocking warning when OMO runtime is unavailable", async () => {
    const repo = await seedUnitsWithDrafts([{ id: "unit-1", orderIndex: 1, status: "approved", draft: "第一段。" }]);

    const report = await buildProductionStatus(repo, { omoRuntimeAvailable: false });
    const markdown = renderProductionStatusMarkdown(report);

    expect(report.omoRuntime.available).toBe(false);
    expect(markdown).toContain("OMO runtime: not detected");
    expect(markdown).toContain("Novel production assets are available as files");
    expect(markdown).toContain("Automated commands and agent workflows require OMO/OpenCode");
    expect(markdown).toContain("Drafts: .novel-production/drafts/");
  });

  test("branch-scoped status and export use the active branch workspace and do not fall back to root", async () => {
    const repo = await seedBranchUnitsWithDrafts([{ id: "unit-1", orderIndex: 1, status: "approved", draft: "branch02 正文。" }]);
    const rootRepo = createNovelProductionRepository(root);

    expect(repo.paths.manuscript).toContain(".novel-production/branches/branch02/exports/manuscript.md");

    const result = await exportManuscript(repo);
    const report = await buildProductionStatus(repo);

    expect(result.manuscriptPath).toContain(".novel-production/branches/branch02/exports/manuscript.md");
    expect(report.approvedCount).toBe(1);
    expect(report.nextAction).toContain("Export manuscript");
    await expect(repo.readManuscript()).resolves.toContain("branch02 正文。");
    await expect(rootRepo.readManuscript()).rejects.toThrow();
    await expect(rootRepo.readProductionReport()).rejects.toThrow();
  });
});
