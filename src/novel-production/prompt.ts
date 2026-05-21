import type { NovelProductionRepository } from "./repository";
import type {
  ElementPoolRecord,
  NovelRequirements,
  PlotUnitRecord,
  ProductionControls,
  ProductionPlan,
  PrototypeRecord,
  RepairTaskRecord,
  StoryBible,
} from "./schema";

export type PromptSnapshot = {
  requirements: NovelRequirements;
  productionControls: ProductionControls;
  storyBible: StoryBible;
  plan: ProductionPlan;
  previousApprovedUnits: Array<{ unit: PlotUnitRecord; draft: string }>;
  currentUnit: PlotUnitRecord;
  prototypes: PrototypeRecord[];
  elementPools: ElementPoolRecord[];
  repairTask: RepairTaskRecord | null;
  branchPrompt: string;
  templateVersion: "novel-production-v1";
};

export async function buildPromptSnapshot(
  repository: NovelProductionRepository,
  plotUnitId: string,
  options: { repairTaskId?: string } = {},
): Promise<PromptSnapshot> {
  const [requirements, productionControls, storyBible, plan, units, prototypes, elementPools, branchPrompt] = await Promise.all([
    repository.loadRequirements(),
    repository.loadProductionControls(),
    repository.loadStoryBible(),
    repository.loadPlan(),
    repository.loadPlotUnits(),
    repository.loadPrototypes(),
    repository.loadElementPools(),
    repository.readPrompt(),
  ]);
  const currentUnit = units.find((unit) => unit.id === plotUnitId);
  if (!currentUnit) {
    throw new Error(`Plot unit not found: ${plotUnitId}`);
  }
  const previousApprovedUnits = await loadPreviousApprovedUnits(repository, units, currentUnit);
  const repairTask = options.repairTaskId ? await repository.loadRepairTask(options.repairTaskId) : null;

  return {
    requirements,
    productionControls,
    storyBible,
    plan,
    previousApprovedUnits,
    currentUnit,
    prototypes,
    elementPools,
    repairTask,
    branchPrompt,
    templateVersion: "novel-production-v1",
  };
}

export function renderProductionPrompt(snapshot: PromptSnapshot): string {
  const previousDrafts = snapshot.previousApprovedUnits
    .map(({ unit, draft }) => `## 已审核单元 ${unit.id}: ${unit.title}\n${draft}`)
    .join("\n\n");
  const characterSection = snapshot.storyBible.characters?.length
    ? `# 主要角色\n${snapshot.storyBible.characters
        .map(
          (character) =>
            `- 姓名：${character.name}\n  角色：${character.role}\n  外观：${character.appearance}\n  性格：${character.personality}\n  动机：${character.motivation}\n  弧线：${character.arc}`,
        )
        .join("\n\n")}`
    : "";
  const repairSection = snapshot.repairTask
    ? `\n\n# 修复任务\n强度：${snapshot.repairTask.intensity}\n说明：${snapshot.repairTask.instructions}`
    : "";

  return [
    snapshot.branchPrompt.trim(),
    "请使用中文写作，除非用户明确要求，否则不要输出英文正文。",
    `# 作品需求\n标题：${snapshot.requirements.title}\n类型：${snapshot.requirements.genre}\n读者：${snapshot.requirements.targetAudience}\n风格：${snapshot.requirements.style}\n视角：${snapshot.requirements.pointOfView}`,
    `必须包含：${snapshot.requirements.mustInclude.join("、") || "无"}`,
    `必须避免：${snapshot.requirements.mustAvoid.join("、") || "无"}`,
    `# 故事圣经\n前提：${snapshot.storyBible.premise}\n世界：${snapshot.storyBible.world}\n连续性规则：${snapshot.storyBible.continuityRules.join("；") || "无"}`,
    characterSection,
    `# 生产计划\n梗概：${snapshot.plan.logline}\n结构：${snapshot.plan.structure}`,
    previousDrafts ? `# 前文已审核内容\n${previousDrafts}` : "# 前文已审核内容\n无",
    `# 当前生产单元\nID：${snapshot.currentUnit.id}\n标题：${snapshot.currentUnit.title}\n目的：${snapshot.currentUnit.purpose}\n摘要：${snapshot.currentUnit.summary}\n目标字数：${snapshot.currentUnit.targetWords}\n绑定：${JSON.stringify(snapshot.currentUnit.bindings)}\n约束：${snapshot.currentUnit.constraints.join("；") || "无"}`,
    repairSection,
  ].join("\n\n");
}

async function loadPreviousApprovedUnits(
  repository: NovelProductionRepository,
  units: PlotUnitRecord[],
  currentUnit: PlotUnitRecord,
): Promise<Array<{ unit: PlotUnitRecord; draft: string }>> {
  const controls = await repository.loadProductionControls();
  const previousUnits = units
    .filter((unit) => unit.orderIndex < currentUnit.orderIndex && unit.status === "approved")
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .slice(-controls.maxPreviousApprovedUnitsInPrompt);

  return Promise.all(previousUnits.map(async (unit) => ({ unit, draft: await repository.readDraft(unit.id) })));
}
