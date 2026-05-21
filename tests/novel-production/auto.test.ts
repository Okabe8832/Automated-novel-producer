import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { runActiveBranchNovelAuto, runNovelAuto, type NovelAutoAgents } from "@/novel-production/auto";
import { createActiveBranchNovelProductionRepository, createNovelBranch } from "@/novel-production/branches";
import { captureRequirements } from "@/novel-production/intake";
import { createProductionPlan } from "@/novel-production/planning";
import { createNovelProductionRepository, type NovelProductionRepository } from "@/novel-production/repository";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

let root: string;
let repo: NovelProductionRepository;

const passingChecklist = {
  matchesRequirements: true,
  matchesUnitPurpose: true,
  continuityOk: true,
  characterBehaviorOk: true,
  styleOk: true,
  chineseProseOk: true,
};

const failingChecklist = {
  matchesRequirements: false,
  matchesUnitPurpose: true,
  continuityOk: true,
  characterBehaviorOk: true,
  styleOk: false,
  chineseProseOk: true,
};

const agents: NovelAutoAgents = {
  async generate() {
    return "自动生成的正文。";
  },
  async review() {
    return {
      result: "pass",
      checklist: passingChecklist,
      issues: [],
      decisionNotes: "通过",
    };
  },
  async repair() {
    return "修复后的正文。";
  },
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
  await initializeNovelProductionWorkspace(root);
  repo = createNovelProductionRepository(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seedPlan(targetRepo: NovelProductionRepository, unitSummaries = ["收到信息"]): Promise<void> {
  const requirements = await captureRequirements(targetRepo, {
    title: "废弃卫星来信",
    originalBrief: "主角收到废弃卫星的信息。",
    genre: "科幻悬疑",
    targetAudience: "成人读者",
    style: "冷峻",
    pointOfView: "第三人称",
    totalWords: unitSummaries.length * 2000,
    unitWords: 2000,
    mustInclude: ["废弃卫星"],
    mustAvoid: ["英文正文"],
  });
  await createProductionPlan(targetRepo, requirements, {
    logline: "主角追查废弃卫星来信。",
    premise: "深夜信息打破生活。",
    world: "近未来城市。",
    unitSummaries,
  });
}

describe("novel auto orchestration", () => {
  test("rejects non-positive repair attempt limit", async () => {
    await expect(runNovelAuto(repo, agents, { maxRepairAttemptsPerUnit: 0 })).rejects.toThrow(/positive integer/i);
  });

  test("rejects non-integer repair attempt limit", async () => {
    await expect(runNovelAuto(repo, agents, { maxRepairAttemptsPerUnit: 1.5 })).rejects.toThrow(/positive integer/i);
  });

  test("rejects infinite repair attempt limit", async () => {
    await expect(runNovelAuto(repo, agents, { maxRepairAttemptsPerUnit: Number.POSITIVE_INFINITY })).rejects.toThrow(/positive integer/i);
  });


  test("produces reviews approves and exports all units", async () => {
    await seedPlan(repo, ["收到信息", "追查来源"]);

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("completed");
    expect(report.processedUnitIds).toEqual(["unit-1", "unit-2"]);
    expect(report.approvedUnitIds).toEqual(["unit-1", "unit-2"]);
    expect(report.exportResult?.skippedUnitIds).toEqual([]);
    await expect(repo.readManuscript()).resolves.toBe("自动生成的正文。\n\n自动生成的正文。\n");
  });


  test("repairs and re-reviews a failed unit before approval", async () => {
    await seedPlan(repo);
    let reviewCalls = 0;

    const repairAgents: NovelAutoAgents = {
      async generate() {
        return "初稿。";
      },
      async review() {
        reviewCalls += 1;
        if (reviewCalls === 1) {
          return {
            result: "fail",
            checklist: failingChecklist,
            issues: ["质量不足"],
            decisionNotes: "需要增强",
            repair: { scope: "unit", intensity: "medium", instructions: "增强冲突和细节。" },
          };
        }
        return { result: "pass", checklist: passingChecklist, issues: [], decisionNotes: "通过" };
      },
      async repair() {
        return "修复后的正文。";
      },
    };

    const report = await runNovelAuto(repo, repairAgents);

    expect(report.status).toBe("completed");
    expect(report.repairedUnitIds).toEqual(["unit-1"]);
    expect(report.repairAttemptsByUnitId).toEqual({ "unit-1": 1 });
    await expect(repo.readManuscript()).resolves.toBe("修复后的正文。\n");
  });

  test("blocks when review fails without repair instructions", async () => {
    await seedPlan(repo);
    let repairCalls = 0;

    const noRepairAgents: NovelAutoAgents = {
      async generate() {
        return "初稿。";
      },
      async review() {
        return {
          result: "fail",
          checklist: failingChecklist,
          issues: ["质量不足"],
          decisionNotes: "需要人工处理",
        };
      },
      async repair() {
        repairCalls += 1;
        return "不会执行。";
      },
    };

    const report = await runNovelAuto(repo, noRepairAgents);

    expect(report.status).toBe("blocked");
    expect(report.blockedUnitId).toBe("unit-1");
    expect(report.blocker).toMatch(/repair instructions/i);
    expect(repairCalls).toBe(0);
    await expect(repo.readManuscript()).rejects.toThrow();
  });

  test("blocks after three repair attempts by default", async () => {
    await seedPlan(repo);
    let reviewCalls = 0;
    let repairCalls = 0;

    const failingAgents: NovelAutoAgents = {
      async generate() {
        return "初稿。";
      },
      async review() {
        reviewCalls += 1;
        return {
          result: "fail",
          checklist: failingChecklist,
          issues: ["质量不足"],
          decisionNotes: "仍需增强",
          repair: { scope: "unit", intensity: "medium", instructions: "继续增强。" },
        };
      },
      async repair() {
        repairCalls += 1;
        return `第${repairCalls}次修复。`;
      },
    };

    const report = await runNovelAuto(repo, failingAgents);

    expect(report.status).toBe("blocked");
    expect(report.repairAttemptsByUnitId).toEqual({ "unit-1": 3 });
    expect(repairCalls).toBe(3);
    expect(reviewCalls).toBe(4);
    expect(report.blocker).toMatch(/max repair attempts/i);
  });


  test("resumes by reviewing an existing drafted unit without regenerating", async () => {
    await seedPlan(repo);
    await repo.writeDraft("unit-1", "已有草稿。");
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "drafted" } : unit)));
    let generateCalls = 0;

    const report = await runNovelAuto(repo, {
      ...agents,
      async generate() {
        generateCalls += 1;
        return "不应生成。";
      },
    });

    expect(report.status).toBe("completed");
    expect(generateCalls).toBe(0);
    await expect(repo.readManuscript()).resolves.toBe("已有草稿。\n");
  });

  test("repairs an existing repair request before later ready units", async () => {
    await seedPlan(repo, ["收到信息", "追查来源"]);
    await repo.writeDraft("unit-1", "初稿。");
    const failed = await repo.loadPlotUnits();
    await repo.savePlotUnits(failed.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "drafted" } : { ...unit, status: "ready_to_produce" })));
    const reviewResult = await import("@/novel-production/review").then(({ reviewPlotUnit }) =>
      reviewPlotUnit(repo, "unit-1", {
        result: "fail",
        reviewMode: "manual",
        checklist: failingChecklist,
        issues: ["质量不足"],
        decisionNotes: "需要修复",
        repair: { scope: "unit", intensity: "medium", instructions: "先修复第一单元。" },
      }),
    );
    const callOrder: string[] = [];

    const report = await runNovelAuto(repo, {
      async generate() {
        callOrder.push("generate");
        return "第二单元正文。";
      },
      async review() {
        callOrder.push("review");
        return { result: "pass", checklist: passingChecklist, issues: [], decisionNotes: "通过" };
      },
      async repair() {
        callOrder.push("repair");
        return "第一单元修复正文。";
      },
    });

    expect(reviewResult.unit.status).toBe("repair_requested");
    expect(report.status).toBe("completed");
    expect(callOrder[0]).toBe("repair");
  });

  test("resumes an existing repairing unit with an in-progress task", async () => {
    await seedPlan(repo);
    await repo.writeDraft("unit-1", "初稿。");
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "drafted" } : unit)));
    const { reviewPlotUnit } = await import("@/novel-production/review");
    const reviewed = await reviewPlotUnit(repo, "unit-1", {
      result: "fail",
      reviewMode: "manual",
      checklist: failingChecklist,
      issues: ["质量不足"],
      decisionNotes: "需要修复",
      repair: { scope: "unit", intensity: "medium", instructions: "修复。" },
    });
    const task = await repo.loadRepairTask(reviewed.repairTask!.id);
    await repo.saveRepairTask({ ...task, status: "in_progress" });
    const repairRequested = await repo.loadPlotUnits();
    await repo.savePlotUnits(repairRequested.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "repairing" } : unit)));

    const report = await runNovelAuto(repo, {
      ...agents,
      async repair() {
        return "修复中的正文完成。";
      },
    });

    expect(report.status).toBe("completed");
    expect(report.repairedUnitIds).toEqual(["unit-1"]);
  });

  test("blocks rejected units without a resolvable repair task", async () => {
    await seedPlan(repo);
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "rejected" } : unit)));

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blockedUnitId).toBe("unit-1");
    expect(report.blocker).toMatch(/rejected/i);
  });

  test("blocks persisted producing units", async () => {
    await seedPlan(repo);
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "producing" } : unit)));

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blockedUnitId).toBe("unit-1");
    expect(report.blocker).toMatch(/producing/i);
  });

  test("blocks planned-only remaining units without an actionable unit", async () => {
    await seedPlan(repo);
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => ({ ...unit, status: "planned" })));

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blocker).toMatch(/actionable|planned/i);
  });


  test("passes the current repair attempt count into re-review", async () => {
    await seedPlan(repo);
    const attempts: number[] = [];

    const report = await runNovelAuto(repo, {
      async generate() {
        return "初稿。";
      },
      async review(input) {
        attempts.push(input.repairAttempt);
        if (input.repairAttempt === 0) {
          return {
            result: "fail",
            checklist: failingChecklist,
            issues: ["质量不足"],
            decisionNotes: "需要修复",
            repair: { scope: "unit", intensity: "medium", instructions: "修复。" },
          };
        }
        return { result: "pass", checklist: passingChecklist, issues: [], decisionNotes: "通过" };
      },
      async repair() {
        return "修复后的正文。";
      },
    });

    expect(report.status).toBe("completed");
    expect(attempts).toEqual([0, 1]);
  });

  test("does not mask invalid active branch state as unavailable", async () => {
    await writeFile(repo.paths.workspace + "/active-branch.json", "not-json");

    await expect(runActiveBranchNovelAuto(root, agents)).rejects.toThrow(/json/i);
  });


  test("resumes a rejected unit with a resolvable repair task", async () => {
    await seedPlan(repo);
    await repo.writeDraft("unit-1", "初稿。");
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "drafted" } : unit)));
    const { reviewPlotUnit } = await import("@/novel-production/review");
    const reviewed = await reviewPlotUnit(repo, "unit-1", {
      result: "fail",
      reviewMode: "manual",
      checklist: failingChecklist,
      issues: ["质量不足"],
      decisionNotes: "需要修复",
      repair: { scope: "unit", intensity: "medium", instructions: "修复。" },
    });
    const repairRequested = await repo.loadPlotUnits();
    await repo.savePlotUnits(repairRequested.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "rejected", currentRepairTaskId: reviewed.repairTask!.id } : unit)));

    const report = await runNovelAuto(repo, {
      ...agents,
      async repair() {
        return "修复后的正文。";
      },
    });

    expect(report.status).toBe("completed");
    expect(report.repairedUnitIds).toEqual(["unit-1"]);
  });

  test("returns a blocked report when repair generation fails", async () => {
    await seedPlan(repo);
    await repo.writeDraft("unit-1", "初稿。");
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "drafted" } : unit)));
    const { reviewPlotUnit } = await import("@/novel-production/review");
    await reviewPlotUnit(repo, "unit-1", {
      result: "fail",
      reviewMode: "manual",
      checklist: failingChecklist,
      issues: ["质量不足"],
      decisionNotes: "需要修复",
      repair: { scope: "unit", intensity: "medium", instructions: "修复。" },
    });

    const report = await runNovelAuto(repo, {
      ...agents,
      async repair() {
        throw new Error("repair model failed");
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.blockedUnitId).toBe("unit-1");
    expect(report.blocker).toMatch(/repair failed.*repair model failed/i);
  });

  test("blocks repair units whose current task is not repairable", async () => {
    await seedPlan(repo);
    await repo.writeDraft("unit-1", "初稿。");
    const units = await repo.loadPlotUnits();
    await repo.savePlotUnits(units.map((unit) => (unit.id === "unit-1" ? { ...unit, status: "drafted" } : unit)));
    const { reviewPlotUnit } = await import("@/novel-production/review");
    const reviewed = await reviewPlotUnit(repo, "unit-1", {
      result: "fail",
      reviewMode: "manual",
      checklist: failingChecklist,
      issues: ["质量不足"],
      decisionNotes: "需要修复",
      repair: { scope: "unit", intensity: "medium", instructions: "修复。" },
    });
    await repo.saveRepairTask({ ...reviewed.repairTask!, status: "completed" });

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blockedUnitId).toBe("unit-1");
    expect(report.blocker).toMatch(/repair task/i);
  });

  test("blocks when requirements are missing", async () => {
    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blocker).toMatch(/requirements/i);
  });

  test("blocks when production controls are missing", async () => {
    await repo.saveRequirements({
      schemaVersion: 1,
      id: "requirements-1",
      title: "废弃卫星来信",
      originalBrief: "主角收到废弃卫星的信息。",
      language: "zh-CN",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      lengthTarget: { totalWords: 2000, unitWords: 2000 },
      mustInclude: [],
      mustAvoid: [],
      referenceNotes: [],
      qualityBar: [],
      createdAt: "2026-05-18T00:00:00.000Z",
      updatedAt: "2026-05-18T00:00:00.000Z",
    });
    await rm(repo.paths.productionControls, { force: true });

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blocker).toMatch(/production controls/i);
  });

  test("blocks when story bible is missing", async () => {
    await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "主角收到废弃卫星的信息。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      totalWords: 2000,
      unitWords: 2000,
    });

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blocker).toMatch(/story bible/i);
  });

  test("blocks when production plan is missing", async () => {
    await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "主角收到废弃卫星的信息。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      totalWords: 2000,
      unitWords: 2000,
    });
    await repo.saveStoryBible({
      schemaVersion: 1,
      premise: "深夜信息打破生活。",
      world: "近未来城市。",
      themes: [],
      characters: [],
      scenes: [],
      timeline: [],
      continuityRules: [],
      createdAt: "2026-05-18T00:00:00.000Z",
      updatedAt: "2026-05-18T00:00:00.000Z",
    });

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blocker).toMatch(/production plan/i);
  });

  test("blocks when plot units are empty", async () => {
    await seedPlan(repo);
    await repo.savePlotUnits([]);

    const report = await runNovelAuto(repo, agents);

    expect(report.status).toBe("blocked");
    expect(report.blocker).toMatch(/plot units/i);
  });

  test("blocks active-branch auto when no active branch exists", async () => {
    const report = await runActiveBranchNovelAuto(root, agents);

    expect(report.status).toBe("blocked");
    expect(report.blocker).toMatch(/active branch/i);
  });

  test("uses only the current active branch repository", async () => {
    await createNovelBranch(root, "branch01");
    await createNovelBranch(root, "branch02");
    const activeRepo = await createActiveBranchNovelProductionRepository(root);
    await seedPlan(activeRepo);

    const report = await runActiveBranchNovelAuto(root, agents);

    expect(report.exportResult?.manuscriptPath).toContain(".novel-production/branches/branch02/exports/manuscript.md");
    await expect(repo.readManuscript()).rejects.toThrow();
  });
});
