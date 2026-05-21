import type { NovelProductionRepository } from "./repository";
import type { IsoTimestamp, NovelRequirements } from "./schema";
import { renderRequirementsPromptBlock, replaceManagedBlock } from "./prompt-settings";

export type RequirementsInput = {
  title: string;
  originalBrief: string;
  genre: string;
  targetAudience: string;
  style: string;
  pointOfView: string;
  totalWords: number;
  unitWords: number;
  mustInclude?: string[];
  mustAvoid?: string[];
  referenceNotes?: string[];
  qualityBar?: string[];
};

const defaultQualityBar = ["符合用户要求", "中文表达自然", "情节推进清晰", "人物行为前后一致"];

export async function captureRequirements(
  repository: NovelProductionRepository,
  input: RequirementsInput,
  now: () => IsoTimestamp = () => new Date().toISOString(),
): Promise<NovelRequirements> {
  const timestamp = now();
  const requirements: NovelRequirements = {
    schemaVersion: 1,
    id: "requirements-1",
    title: input.title,
    originalBrief: input.originalBrief,
    language: "zh-CN",
    genre: input.genre,
    targetAudience: input.targetAudience,
    style: input.style,
    pointOfView: input.pointOfView,
    lengthTarget: {
      totalWords: input.totalWords,
      unitWords: input.unitWords,
    },
    mustInclude: input.mustInclude ?? [],
    mustAvoid: input.mustAvoid ?? [],
    referenceNotes: input.referenceNotes ?? [],
    qualityBar: input.qualityBar ?? defaultQualityBar,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await repository.saveRequirements(requirements);
  const prompt = await repository.readPrompt();
  await repository.writePrompt(replaceManagedBlock(prompt, "novel-intake", renderRequirementsPromptBlock(requirements)));
  return requirements;
}
