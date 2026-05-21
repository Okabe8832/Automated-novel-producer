import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { activeBranchWorkspacePaths, createNovelBranch } from "@/novel-production/branches";
import { createNovelProductionRepositoryFromPaths } from "@/novel-production/repository";
import { readActiveBranchDraftPreview, readDraftPreview, renderDraftPreviewMarkdown } from "@/novel-production/reader";
import { createNovelProductionRepository } from "@/novel-production/repository";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-reader-"));
  await initializeNovelProductionWorkspace(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("draft reader", () => {
  test("reads only the requested draft slice", async () => {
    const repo = createNovelProductionRepository(root);
    await repo.writeDraft("ch03", "# ch03\n\n一二三四五六七八九十");

    const preview = await readDraftPreview(root, "ch03", { offset: 0, limit: 8 });
    const markdown = renderDraftPreviewMarkdown(preview);

    expect(preview).toMatchObject({
      unitId: "ch03",
      draftPath: expect.stringContaining(".novel-production/drafts/ch03.md"),
      offset: 0,
      limit: 8,
      text: "# ch03\n\n",
    });
    expect(markdown).toBe("# ch03\n\n\n");
  });

  test("prints the final requested slice without markers", async () => {
    const repo = createNovelProductionRepository(root);
    await repo.writeDraft("ch03", "正文内容");

    const preview = await readDraftPreview(root, "ch03", { offset: 0, limit: 100 });
    const markdown = renderDraftPreviewMarkdown(preview);

    expect(preview.text).toBe("正文内容");
    expect(markdown).toBe("正文内容\n");
  });

  test("reads only the active branch draft preview", async () => {
    const repo = createNovelProductionRepository(root);
    await repo.writeDraft("ch03", "root draft");
    await createNovelBranch(root, "branch02");

    const branchRepo = createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
    await branchRepo.writeDraft("ch03", "branch draft preview");

    const preview = await readActiveBranchDraftPreview(root, "ch03", { offset: 7, limit: 6 });

    expect(preview).toMatchObject({
      unitId: "ch03",
      branchId: "branch02",
      draftPath: expect.stringContaining(".novel-production/branches/branch02/drafts/ch03.md"),
      offset: 7,
      limit: 6,
      text: "draft ",
    });
  });

  test("does not fall back to the root draft when the active branch draft is missing", async () => {
    const repo = createNovelProductionRepository(root);
    await repo.writeDraft("ch03", "root draft");
    await createNovelBranch(root, "branch02");

    await expect(readActiveBranchDraftPreview(root, "ch03")).rejects.toThrow(
      /draft not found.*branch02.*\.novel-production\/branches\/branch02\/drafts\/ch03\.md/i,
    );
  });

  test.each(["../escape", "nested/unit", "nested\\unit", "", ".", "unit.1"])("rejects unsafe unit id %s", async (unitId) => {
    await expect(readDraftPreview(root, unitId)).rejects.toThrow(/invalid/i);
  });

  test("reports missing draft path", async () => {
    await expect(readDraftPreview(root, "ch99")).rejects.toThrow(/draft not found.*ch99/i);
  });
});
