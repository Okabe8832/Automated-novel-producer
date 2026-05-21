import type { NovelProductionRepository } from "./repository";
import type {
  IsoTimestamp,
  NovelRequirements,
  PlotUnitRecord,
  ProductionPlan,
  StoryBible,
  StoryBibleCharacter,
} from "./schema";
import { renderPlanPromptBlock, replaceManagedBlock } from "./prompt-settings";

export type ProductionPlanInput = {
  logline: string;
  premise: string;
  world: string;
  characters?: StoryBibleCharacter[];
  structure?: string;
  unitSummaries: string[];
  unitCharacterIds?: string[][];
};

export async function createProductionPlan(
  repository: NovelProductionRepository,
  requirements: NovelRequirements,
  input: ProductionPlanInput,
  now: () => IsoTimestamp = () => new Date().toISOString(),
): Promise<{ storyBible: StoryBible; plan: ProductionPlan; units: PlotUnitRecord[] }> {
  const timestamp = now();
  const storyBible: StoryBible = {
    schemaVersion: 1,
    premise: input.premise,
    world: input.world,
    themes: [],
    characters: [...(input.characters ?? [])],
    scenes: [],
    timeline: [],
    continuityRules: ["已通过审核的单元不得被后续生成内容推翻。"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const plannedCharacterIds = new Set(storyBible.characters.map((character) => character.id));
  const plan: ProductionPlan = {
    schemaVersion: 1,
    logline: input.logline,
    structure: input.structure ?? "sequential_units",
    acts: input.unitSummaries,
    productionNotes: ["按 plot unit 顺序生产中文正文。"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const units = input.unitSummaries.map((summary, index): PlotUnitRecord => {
    const characterIds = [...(input.unitCharacterIds?.[index] ?? [])];
    for (const characterId of characterIds) {
      if (!plannedCharacterIds.has(characterId)) {
        throw new Error(`Unknown character id in plot unit binding: ${characterId}`);
      }
    }
    const id = `unit-${index + 1}`;
    return {
      id,
      orderIndex: index + 1,
      title: `第${index + 1}单元`,
      purpose: summary,
      summary,
      targetWords: requirements.lengthTarget.unitWords,
      status: index === 0 ? "ready_to_produce" : "planned",
      prototypeIds: [],
      inheritedElementPoolIds: [],
      localElements: [],
      bindings: {
        characterIds,
        sceneIds: [],
        timeEntryIds: [],
      },
      constraints: [...requirements.mustInclude, ...requirements.mustAvoid.map((item) => `避免：${item}`)],
      draftPath: `.novel-production/drafts/${id}.md`,
      currentRepairTaskId: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  await repository.saveStoryBible(storyBible);
  await repository.savePlan(plan);
  await repository.savePlotUnits(units);
  const prompt = await repository.readPrompt();
  await repository.writePrompt(replaceManagedBlock(prompt, "novel-plan", renderPlanPromptBlock(storyBible, plan, units)));

  return { storyBible, plan, units };
}
