import type { NovelRequirements, PlotUnitRecord, ProductionPlan, StoryBible } from "./schema";

export type ManagedPromptBlock = "novel-intake" | "novel-plan";

export function replaceManagedBlock(prompt: string, block: ManagedPromptBlock, content: string): string {
  const start = `<!-- ${block}:start -->`;
  const end = `<!-- ${block}:end -->`;
  const nextBlock = `${start}\n${content.trim()}\n${end}`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);

  if (pattern.test(prompt)) {
    return `${prompt.replace(pattern, nextBlock).trimEnd()}\n`;
  }

  return `${prompt.trimEnd()}\n\n${nextBlock}\n`;
}

export function renderRequirementsPromptBlock(requirements: NovelRequirements): string {
  return [
    "# 本分支需求摘要",
    `标题：${requirements.title}`,
    `原始需求：${requirements.originalBrief}`,
    `类型：${requirements.genre}`,
    `目标读者：${requirements.targetAudience}`,
    `风格：${requirements.style}`,
    `视角：${requirements.pointOfView}`,
    `目标字数：总计 ${requirements.lengthTarget.totalWords}，单元 ${requirements.lengthTarget.unitWords}`,
    `必须包含：${formatList(requirements.mustInclude)}`,
    `必须避免：${formatList(requirements.mustAvoid)}`,
    `参考说明：${formatList(requirements.referenceNotes)}`,
    `质量标准：${formatList(requirements.qualityBar)}`,
  ].join("\n");
}

export function renderPlanPromptBlock(storyBible: StoryBible, plan: ProductionPlan, units: PlotUnitRecord[]): string {
  const characters = storyBible.characters.length
    ? storyBible.characters
        .map((character) => `- ${character.name}：${character.role}；${character.personality}；${character.motivation}；${character.arc}`)
        .join("\n")
    : "无";
  const plotUnits = units
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((unit) => `- ${unit.orderIndex}. ${unit.title}：${unit.summary}`)
    .join("\n");

  return [
    "# 本分支规划摘要",
    `梗概：${plan.logline}`,
    `前提：${storyBible.premise}`,
    `世界：${storyBible.world}`,
    `结构：${plan.structure}`,
    `连续性规则：${formatList(storyBible.continuityRules)}`,
    "主要角色：",
    characters,
    "生产单元：",
    plotUnits || "无",
  ].join("\n");
}

function formatList(items: string[]): string {
  return items.length ? items.join("、") : "无";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
