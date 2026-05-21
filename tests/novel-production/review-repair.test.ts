import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { captureRequirements } from "@/novel-production/intake";
import { createProductionPlan } from "@/novel-production/planning";
import { producePlotUnit } from "@/novel-production/generation";
import { createNovelProductionRepository, type NovelProductionRepository } from "@/novel-production/repository";
import { repairPlotUnit } from "@/novel-production/repair";
import { reviewPlotUnit } from "@/novel-production/review";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
  await initializeNovelProductionWorkspace(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seedDraftedUnit(): Promise<{ repo: NovelProductionRepository; unitId: string }> {
  const repo = createNovelProductionRepository(root);
  const requirements = await captureRequirements(repo, {
    title: "废弃卫星来信",
    originalBrief: "主角收到废弃卫星的信息。",
    genre: "科幻悬疑",
    targetAudience: "成人读者",
    style: "冷峻",
    pointOfView: "第三人称",
    totalWords: 2000,
    unitWords: 2000,
    mustInclude: ["废弃卫星"],
    mustAvoid: ["英文正文"],
  });
  await createProductionPlan(repo, requirements, {
    logline: "主角追查废弃卫星来信。",
    premise: "深夜信息打破生活。",
    world: "近未来城市。",
    unitSummaries: ["收到信息"],
  });
  const [unit] = await repo.loadPlotUnits();
  await producePlotUnit(repo, unit!.id, {
    async generate() {
      return "主角在深夜收到了来自废弃卫星的信息。";
    },
  });
  return { repo, unitId: unit!.id };
}

async function seedRepairRequestedUnit(): Promise<{ repo: NovelProductionRepository; unitId: string; repairTaskId: string }> {
  const { repo, unitId } = await seedDraftedUnit();
  const result = await reviewPlotUnit(repo, unitId, {
    result: "fail",
    reviewMode: "manual",
    checklist: {
      matchesRequirements: false,
      matchesUnitPurpose: true,
      continuityOk: true,
      characterBehaviorOk: true,
      styleOk: false,
      chineseProseOk: true,
    },
    issues: ["没有体现废弃卫星"],
    decisionNotes: "需要补足核心意象",
    repair: {
      scope: "unit",
      intensity: "medium",
      instructions: "重写当前单元，突出废弃卫星的信息。",
    },
  });
  return { repo, unitId, repairTaskId: result.repairTask!.id };
}

describe("review and repair gates", () => {
  test("review pass approves a drafted unit", async () => {
    const { repo, unitId } = await seedDraftedUnit();
    const result = await reviewPlotUnit(repo, unitId, {
      result: "pass",
      reviewMode: "manual",
      checklist: {
        matchesRequirements: true,
        matchesUnitPurpose: true,
        continuityOk: true,
        characterBehaviorOk: true,
        styleOk: true,
        chineseProseOk: true,
      },
      issues: [],
      decisionNotes: "通过",
    });

    expect(result.unit.status).toBe("approved");
    expect(result.review.result).toBe("pass");
  });

  test("review pass promotes the next planned unit in sequential mode", async () => {
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
      mustAvoid: [],
    });
    await createProductionPlan(repo, requirements, {
      logline: "主角追查废弃卫星来信。",
      premise: "深夜信息打破生活。",
      world: "近未来城市。",
      unitSummaries: ["收到信息", "追查来源"],
    });
    const [firstUnit, secondUnit] = await repo.loadPlotUnits();
    await producePlotUnit(repo, firstUnit!.id, {
      async generate() {
        return "主角在深夜收到了来自废弃卫星的信息。";
      },
    });

    await reviewPlotUnit(repo, firstUnit!.id, {
      result: "pass",
      reviewMode: "manual",
      checklist: {
        matchesRequirements: true,
        matchesUnitPurpose: true,
        continuityOk: true,
        characterBehaviorOk: true,
        styleOk: true,
        chineseProseOk: true,
      },
      issues: [],
      decisionNotes: "通过",
    });

    await expect(repo.loadPlotUnits()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: secondUnit!.id, status: "ready_to_produce" })]),
    );
  });

  test("review fail creates a repair task and blocks progress", async () => {
    const { repo, unitId } = await seedDraftedUnit();
    const result = await reviewPlotUnit(repo, unitId, {
      result: "fail",
      reviewMode: "manual",
      checklist: {
        matchesRequirements: false,
        matchesUnitPurpose: true,
        continuityOk: true,
        characterBehaviorOk: true,
        styleOk: false,
        chineseProseOk: true,
      },
      issues: ["没有体现废弃卫星"],
      decisionNotes: "需要补足核心意象",
      repair: {
        scope: "unit",
        intensity: "medium",
        instructions: "重写当前单元，突出废弃卫星的信息。",
      },
    });

    expect(result.unit.status).toBe("repair_requested");
    expect(result.unit.currentRepairTaskId).toBe(result.repairTask?.id);
    expect(result.repairTask?.reason).toContain("没有体现废弃卫星");
  });

  test("review fail without repair leaves the unit rejected", async () => {
    const { repo, unitId } = await seedDraftedUnit();
    const result = await reviewPlotUnit(repo, unitId, {
      result: "fail",
      reviewMode: "manual",
      checklist: {
        matchesRequirements: false,
        matchesUnitPurpose: true,
        continuityOk: true,
        characterBehaviorOk: true,
        styleOk: true,
        chineseProseOk: true,
      },
      issues: ["偏离需求"],
      decisionNotes: "退回但暂不修复",
    });

    expect(result.unit.status).toBe("rejected");
    expect(result.repairTask).toBeUndefined();
  });

  test("review rejects non-reviewable statuses", async () => {
    const { repo, unitId } = await seedDraftedUnit();
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === unitId ? { ...unit, status: "approved" } : unit)));

    await expect(
      reviewPlotUnit(repo, unitId, {
        result: "pass",
        reviewMode: "manual",
        checklist: {
          matchesRequirements: true,
          matchesUnitPurpose: true,
          continuityOk: true,
          characterBehaviorOk: true,
          styleOk: true,
          chineseProseOk: true,
        },
        issues: [],
        decisionNotes: "重复审核",
      }),
    ).rejects.toThrow(/not reviewable/i);
  });

  test("repair records traceability and returns unit to drafted", async () => {
    const { repo, unitId, repairTaskId } = await seedRepairRequestedUnit();
    const result = await repairPlotUnit(repo, repairTaskId, {
      async repair() {
        return "主角重新读到废弃卫星的信息，意识到它来自十年前的自己。";
      },
    });

    expect(result.unit.status).toBe("drafted");
    expect(result.unit.currentRepairTaskId).toBe("");
    expect(result.repairTask.status).toBe("completed");
    await expect(repo.readDraft(unitId)).resolves.toContain("废弃卫星");
  });

  test("repair rejects completed tasks", async () => {
    const { repo, repairTaskId } = await seedRepairRequestedUnit();
    const task = await repo.loadRepairTask(repairTaskId);
    await repo.saveRepairTask({ ...task, status: "completed" });

    await expect(
      repairPlotUnit(repo, repairTaskId, {
        async repair() {
          return "不会执行";
        },
      }),
    ).rejects.toThrow(/not repairable/i);
  });
});
