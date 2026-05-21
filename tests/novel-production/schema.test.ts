import { describe, expect, test } from "vitest";
import {
  createDefaultProductionControls,
  createEmptyElementPools,
  createEmptyPrototypes,
  parseGenerationRun,
  parseRequirements,
  parsePlotUnits,
  transitionPlotUnitStatus,
} from "@/novel-production/schema";

describe("novel production schema", () => {
  test("parses a minimal Chinese novel requirement", () => {
    const requirements = parseRequirements({
      schemaVersion: 1,
      id: "req-1",
      title: "废弃卫星来信",
      originalBrief: "写一篇科幻悬疑小说",
      language: "zh-CN",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻、克制",
      pointOfView: "第三人称",
      lengthTarget: { totalWords: 80000, unitWords: 2000 },
      mustInclude: ["废弃卫星"],
      mustAvoid: ["英文正文"],
      referenceNotes: [],
      qualityBar: ["符合用户要求", "中文表达自然"],
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    });

    expect(requirements.language).toBe("zh-CN");
    expect(requirements.lengthTarget.unitWords).toBe(2000);
  });

  test("rejects invalid plot unit status", () => {
    expect(() => parsePlotUnits([{ ...createPlotUnit(), status: "done" }])).toThrow(/status/i);
  });

  test("rejects generation runs with invalid nested prompt snapshots", () => {
    expect(() =>
      parseGenerationRun({
        id: "run-1",
        plotUnitId: "unit-1",
        status: "succeeded",
        agent: "novel-drafter",
        model: "fake-generator",
        promptSnapshot: {
          requirements: { id: "req-1" },
          productionControls: createDefaultProductionControls(() => "2026-05-16T00:00:00.000Z"),
          storyBible: createStoryBible(),
          plan: createProductionPlan(),
          previousApprovedUnits: [],
          currentUnit: createPlotUnit(),
          prototypes: [],
          elementPools: [],
          repairTask: null,
          templateVersion: "novel-production-v1",
        },
        outputPath: ".novel-production/drafts/unit-1.md",
        errorMessage: "",
        createdAt: "2026-05-16T00:00:00.000Z",
        updatedAt: "2026-05-16T00:00:00.000Z",
      }),
    ).toThrow(/requirements/i);
  });

  test("allows valid sequential status transitions", () => {
    expect(transitionPlotUnitStatus("planned", "ready_to_produce")).toBe("ready_to_produce");
    expect(transitionPlotUnitStatus("ready_to_produce", "producing")).toBe("producing");
    expect(transitionPlotUnitStatus("producing", "drafted")).toBe("drafted");
  });

  test("rejects skipping review before approval", () => {
    expect(() => transitionPlotUnitStatus("drafted", "approved")).toThrow(/invalid/i);
  });

  test("creates default supporting collections", () => {
    expect(createDefaultProductionControls().generationMode).toBe("sequential");
    expect(createEmptyPrototypes()).toEqual([]);
    expect(createEmptyElementPools()).toEqual([]);
  });
});

function createPlotUnit() {
  return {
    id: "unit-1",
    orderIndex: 1,
    title: "第一单元",
    purpose: "建立悬疑钩子",
    summary: "主角收到废弃卫星的信息",
    targetWords: 2000,
    status: "planned",
    prototypeIds: [],
    inheritedElementPoolIds: [],
    localElements: [],
    bindings: { characterIds: [], sceneIds: [], timeEntryIds: [] },
    constraints: [],
    draftPath: ".novel-production/drafts/unit-1.md",
    currentRepairTaskId: "",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
  };
}

function createStoryBible() {
  return {
    schemaVersion: 1,
    premise: "主角追查废弃卫星来信背后的真相。",
    world: "近未来低轨通信网络衰败后的城市。",
    themes: [],
    characters: [],
    scenes: [],
    timeline: [],
    continuityRules: [],
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
  };
}

function createProductionPlan() {
  return {
    schemaVersion: 1,
    logline: "主角追查废弃卫星来信。",
    structure: "三幕式",
    acts: [],
    productionNotes: [],
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
  };
}
