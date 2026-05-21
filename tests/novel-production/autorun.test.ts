import { describe, expect, test } from "vitest";
import type { PlotUnitRecord, ProductionPlan, NovelRequirements, StoryBible } from "@/novel-production/schema";
import { buildAutorunBlueprint, createAutorunBlockedReport, evaluateAutorunReadiness } from "@/novel-production/autorun";

function makeRequirements(overrides: Partial<NovelRequirements> = {}): NovelRequirements {
  return {
    schemaVersion: 1,
    id: "requirements-1",
    title: "废弃卫星来信",
    originalBrief: "主角收到废弃卫星的信息。",
    language: "zh-CN",
    genre: "科幻悬疑",
    targetAudience: "成人读者",
    style: "冷峻",
    pointOfView: "第三人称",
    lengthTarget: {
      totalWords: 80000,
      unitWords: 2000,
    },
    mustInclude: ["废弃卫星"],
    mustAvoid: ["英文正文"],
    referenceNotes: [],
    qualityBar: ["符合用户要求"],
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

function makeStoryBible(overrides: Partial<StoryBible> = {}): StoryBible {
  return {
    schemaVersion: 1,
    premise: "深夜信息打破主角的平静生活。",
    world: "近未来城市。",
    themes: ["真相"],
    characters: [
      {
        id: "char-protagonist",
        name: "林砚",
        role: "主角",
        appearance: "长期熬夜的工程师。",
        personality: "谨慎、克制。",
        motivation: "查明来信来源。",
        arc: "从逃避到主动追查。",
      },
    ],
    scenes: [],
    timeline: [],
    continuityRules: ["已批准的内容不得被后续内容推翻。"],
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

function makePlan(overrides: Partial<ProductionPlan> = {}): ProductionPlan {
  return {
    schemaVersion: 1,
    logline: "主角追查废弃卫星来信。",
    structure: "sequential_units",
    acts: ["收到信息", "追查来源"],
    productionNotes: ["按 plot unit 顺序生产中文正文。"],
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

function makePlotUnit(overrides: Partial<PlotUnitRecord> = {}): PlotUnitRecord {
  return {
    id: "unit-1",
    orderIndex: 1,
    title: "第1单元",
    purpose: "建立异常信息的引子。",
    summary: "主角收到来自废弃卫星的信号。",
    targetWords: 2000,
    status: "ready_to_produce",
    prototypeIds: [],
    inheritedElementPoolIds: [],
    localElements: [],
    bindings: {
      characterIds: ["char-protagonist"],
      sceneIds: [],
      timeEntryIds: [],
    },
    constraints: [],
    draftPath: ".novel-production/drafts/unit-1.md",
    currentRepairTaskId: "",
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("autorun readiness", () => {
  test("blocks when active branch is missing", () => {
    expect(evaluateAutorunReadiness({})).toEqual({
      ready: false,
      phase: "branch",
      blocker: "No active branch is selected.",
      nextAction: "Run /novel-init or switch to an active branch before /novel-autorun.",
    });
  });

  test("blocks intake when core requirements are missing", () => {
    const result = evaluateAutorunReadiness({
      activeBranchId: "main",
      requirements: makeRequirements({ originalBrief: "", genre: "", style: "", lengthTarget: { totalWords: 0, unitWords: 0 } }),
    });

    expect(result).toEqual({
      ready: false,
      activeBranchId: "main",
      phase: "intake",
      blocker: "Intake is missing core requirements: originalBrief, genre, style, lengthTarget.totalWords, lengthTarget.unitWords",
      nextAction: "Run or continue /novel-intake with the missing core requirements.",
    });
  });

  test("blocks planning when story bible, plan, or plot units are missing", () => {
    expect(evaluateAutorunReadiness({ activeBranchId: "main", requirements: makeRequirements() })).toEqual({
      ready: false,
      activeBranchId: "main",
      phase: "planning",
      blocker: "Planning artifacts are missing: storyBible, plan, plotUnits",
      nextAction: "Run or continue /novel-plan before final autorun confirmation.",
    });
  });

  test("blocks planning when plot units lack production-ready structure", () => {
    const result = evaluateAutorunReadiness({
      activeBranchId: "main",
      requirements: makeRequirements(),
      storyBible: makeStoryBible({ premise: " ", world: " ", characters: [] }),
      plan: makePlan({ logline: " ", acts: [] }),
      plotUnits: [makePlotUnit({ purpose: " ", summary: " ", bindings: { characterIds: ["char-missing"], sceneIds: [], timeEntryIds: [] } })],
    });

    expect(result.ready).toBe(false);
    expect(result.phase).toBe("planning");
    expect(result.blocker).toContain("storyBible.premise");
    expect(result.blocker).toContain("storyBible.world");
    expect(result.blocker).toContain("storyBible.characters");
    expect(result.blocker).toContain("plan.logline");
    expect(result.blocker).toContain("plan.acts");
    expect(result.blocker).toContain("plotUnits[0].purpose");
    expect(result.blocker).toContain("plotUnits[0].summary");
    expect(result.blocker).toContain("plotUnits[0].bindings.characterIds:char-missing");
  });

  test("requires final confirmation after intake and planning are ready", () => {
    const result = evaluateAutorunReadiness({
      activeBranchId: "main",
      requirements: makeRequirements(),
      storyBible: makeStoryBible(),
      plan: makePlan(),
      plotUnits: [makePlotUnit()],
    });

    expect(result).toMatchObject({
      ready: false,
      activeBranchId: "main",
      phase: "final_confirmation",
      blocker: "Final production confirmation has not been granted.",
      nextAction: "Ask the user to approve the production blueprint before running /novel-auto.",
    });
    expect(result.blueprint).toContain("# Production Blueprint");
    expect(result.blueprint).toContain("## Intake");
    expect(result.blueprint).toContain("## Story Bible");
    expect(result.blueprint).toContain("## Major Characters");
    expect(result.blueprint).toContain("## Plot Nodes");
    expect(result.blueprint).toContain("## Production Policy");
  });

  test("is ready for auto loop after final confirmation", () => {
    const result = evaluateAutorunReadiness({
      activeBranchId: "main",
      requirements: makeRequirements(),
      storyBible: makeStoryBible(),
      plan: makePlan(),
      plotUnits: [makePlotUnit()],
      finalConfirmation: true,
    });

    expect(result).toMatchObject({
      ready: true,
      activeBranchId: "main",
      phase: "production",
      nextAction: "Run the existing /novel-auto production loop.",
    });
    expect(result.blueprint).toContain("# Production Blueprint");
  });

  test("surfaces downstream auto blockers without swallowing them", () => {
    expect(
      createAutorunBlockedReport({
        activeBranchId: "main",
        phase: "production",
        blocker: "unit-2 exceeded the repair limit",
        nextAction: "Resolve the /novel-auto blocker, then rerun /novel-autorun.",
      }),
    ).toEqual({
      ready: false,
      activeBranchId: "main",
      phase: "production",
      blocker: "unit-2 exceeded the repair limit",
      nextAction: "Resolve the /novel-auto blocker, then rerun /novel-autorun.",
    });
  });
});
