import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { captureRequirements } from "@/novel-production/intake";
import { createNovelBranch, createActiveBranchNovelProductionRepository } from "@/novel-production/branches";
import { createProductionPlan } from "@/novel-production/planning";
import { buildPromptSnapshot, renderProductionPrompt } from "@/novel-production/prompt";
import { producePlotUnit } from "@/novel-production/generation";
import { createNovelProductionRepository } from "@/novel-production/repository";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
  await mkdir(join(root, "prompt settings"), { recursive: true });
  await writeFile(join(root, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "默认分支 prompt", "utf8");
  await initializeNovelProductionWorkspace(root);
  await createNovelProductionRepository(root).writePrompt("默认 workspace prompt");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seedRootPlan() {
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
    characters: [
      {
        id: "char-1",
        name: "林澄",
        role: "调查记者",
        appearance: "短发，灰色风衣，眼神疲惫",
        personality: "冷静，执着，敏锐",
        motivation: "查清废弃卫星信号的真相",
        arc: "从旁观者变成主动追索真相的人",
      },
    ],
    unitSummaries: ["收到信息", "追查来源"],
  });
  return repo;
}

async function seedBranchPlan() {
  await createNovelBranch(root, "branch02");
  const repo = await createActiveBranchNovelProductionRepository(root);
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
    const repo = await seedRootPlan();
    const units = await repo.loadPlotUnits();

    const snapshot = await buildPromptSnapshot(repo, units[0]!.id);
    const prompt = renderProductionPrompt(snapshot);

    expect(snapshot.requirements.mustInclude).toContain("废弃卫星");
    expect(snapshot.currentUnit.summary).toBe("收到信息");
    expect(prompt).toContain("请使用中文写作");
  });

  test("production prompt includes planned story-bible characters", async () => {
    const repo = await seedRootPlan();
    const units = await repo.loadPlotUnits();

    const snapshot = await buildPromptSnapshot(repo, units[0]!.id);
    const prompt = renderProductionPrompt(snapshot);

    expect(prompt).toContain("# 主要角色");
    expect(prompt).toContain("林澄");
    expect(prompt).toContain("调查记者");
    expect(prompt).toContain("短发，灰色风衣，眼神疲惫");
    expect(prompt).toContain("冷静，执着，敏锐");
    expect(prompt).toContain("查清废弃卫星信号的真相");
    expect(prompt).toContain("从旁观者变成主动追索真相的人");
  });

  test("prompt snapshot and rendered prompt include branch-local prompt text", async () => {
    const repo = await seedBranchPlan();
    await repo.writePrompt("branch02 专属语言规范");
    const units = await repo.loadPlotUnits();

    const snapshot = await buildPromptSnapshot(repo, units[0]!.id);
    const prompt = renderProductionPrompt(snapshot);

    expect(snapshot.branchPrompt).toContain("branch02 专属语言规范");
    expect(prompt).toContain("branch02 专属语言规范");
    expect(prompt.indexOf("branch02 专属语言规范")).toBeLessThan(prompt.indexOf("# 作品需求"));
  });

  test("produces one unit and records generation metadata", async () => {
    const repo = await seedRootPlan();
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

  test("sequential mode blocks later units while earlier units are unresolved", async () => {
    const repo = await seedRootPlan();
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits([
      { ...units[0]!, status: "drafted" },
      { ...units[1]!, status: "ready_to_produce" },
    ]);

    await expect(
      producePlotUnit(repo, units[1]!.id, {
        async generate() {
          return "不应该生成。";
        },
      }),
    ).rejects.toThrow(/previous unit/i);
  });

  test("failed generation records an error and keeps unit retryable", async () => {
    const repo = await seedRootPlan();
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

  test("failed repair generation returns the unit to ready to produce", async () => {
    const repo = await seedRootPlan();
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits([{ ...units[0]!, status: "repairing" }, ...units.slice(1)]);

    const result = await producePlotUnit(repo, units[0]!.id, {
      async generate() {
        throw new Error("repair model unavailable");
      },
    });

    expect(result.unit.status).toBe("ready_to_produce");
    expect(result.run.status).toBe("failed");
  });

  test("branch-scoped production flow uses the active branch workspace and does not fall back to root", async () => {
    const repo = await seedBranchPlan();
    const units = await repo.loadPlotUnits();
    const rootRepo = createNovelProductionRepository(root);

    expect(repo.paths.workspace).toContain(".novel-production/branches/branch02");
    expect(repo.paths.draftsDir).toContain(".novel-production/branches/branch02");

    const result = await producePlotUnit(repo, units[0]!.id, {
      async generate(prompt) {
        expect(prompt).toContain("默认分支 prompt");
        expect(prompt).toContain("收到信息");
        return "branch02 的第一条信息来自废弃卫星。";
      },
    });

    expect(result.unit.status).toBe("drafted");
    await expect(repo.readDraft(units[0]!.id)).resolves.toContain("branch02 的第一条信息");
    await expect(rootRepo.readDraft(units[0]!.id)).rejects.toThrow();
  });
});
