import { join } from "node:path";

import {
  parseElementPools,
  parseGenerationRun,
  parsePlotUnits,
  parseProductionControls,
  parseProductionPlan,
  parsePrototypes,
  parseRepairTask,
  parseRequirements,
  parseReviewRecord,
  parseStoryBible,
  type ElementPoolRecord,
  type GenerationRunRecord,
  type NovelRequirements,
  type PlotUnitRecord,
  type ProductionControls,
  type ProductionPlan,
  type PrototypeRecord,
  type RepairTaskRecord,
  type ReviewRecord,
  type StoryBible,
} from "./schema";
import { readJsonFile, readTextFile, workspacePaths, writeJsonFile, writeTextFile, type NovelProductionPaths } from "./workspace";

export type NovelProductionRepository = {
  paths: NovelProductionPaths;
  loadRequirements(): Promise<NovelRequirements>;
  saveRequirements(value: NovelRequirements): Promise<void>;
  loadProductionControls(): Promise<ProductionControls>;
  saveProductionControls(value: ProductionControls): Promise<void>;
  loadStoryBible(): Promise<StoryBible>;
  saveStoryBible(value: StoryBible): Promise<void>;
  loadPrototypes(): Promise<PrototypeRecord[]>;
  savePrototypes(value: PrototypeRecord[]): Promise<void>;
  loadElementPools(): Promise<ElementPoolRecord[]>;
  saveElementPools(value: ElementPoolRecord[]): Promise<void>;
  loadPlan(): Promise<ProductionPlan>;
  savePlan(value: ProductionPlan): Promise<void>;
  loadPlotUnits(): Promise<PlotUnitRecord[]>;
  savePlotUnits(value: PlotUnitRecord[]): Promise<void>;
  readDraft(unitId: string): Promise<string>;
  writeDraft(unitId: string, text: string): Promise<void>;
  loadReview(reviewId: string): Promise<ReviewRecord>;
  saveReview(value: ReviewRecord): Promise<void>;
  loadRepairTask(repairId: string): Promise<RepairTaskRecord>;
  saveRepairTask(value: RepairTaskRecord): Promise<void>;
  loadGenerationRun(runId: string): Promise<GenerationRunRecord>;
  saveGenerationRun(value: GenerationRunRecord): Promise<void>;
  readPrompt(): Promise<string>;
  writePrompt(text: string): Promise<void>;
  readManuscript(): Promise<string>;
  writeManuscript(text: string): Promise<void>;
  readProductionReport(): Promise<string>;
  writeProductionReport(text: string): Promise<void>;
};

export function createNovelProductionRepository(root: string): NovelProductionRepository {
  return createNovelProductionRepositoryFromPaths(workspacePaths(root));
}

export function createNovelProductionRepositoryFromPaths(paths: NovelProductionPaths): NovelProductionRepository {
  return {
    paths,
    loadRequirements: () => readJsonFile(paths.requirements, parseRequirements),
    saveRequirements: (value) => writeJsonFile(paths.requirements, value),
    loadProductionControls: () => readJsonFile(paths.productionControls, parseProductionControls),
    saveProductionControls: (value) => writeJsonFile(paths.productionControls, value),
    loadStoryBible: () => readJsonFile(paths.storyBible, parseStoryBible),
    saveStoryBible: (value) => writeJsonFile(paths.storyBible, value),
    loadPrototypes: () => readJsonFile(paths.prototypes, parsePrototypes),
    savePrototypes: (value) => writeJsonFile(paths.prototypes, value),
    loadElementPools: () => readJsonFile(paths.elementPools, parseElementPools),
    saveElementPools: (value) => writeJsonFile(paths.elementPools, value),
    loadPlan: () => readJsonFile(paths.plan, parseProductionPlan),
    savePlan: (value) => writeJsonFile(paths.plan, value),
    loadPlotUnits: () => readJsonFile(paths.plotUnits, parsePlotUnits),
    savePlotUnits: (value) => writeJsonFile(paths.plotUnits, value),
    readDraft: (unitId) => readTextFile(idPath(paths.draftsDir, unitId, ".md")),
    writeDraft: (unitId, text) => writeTextFile(idPath(paths.draftsDir, unitId, ".md"), text),
    loadReview: (reviewId) => readJsonFile(idPath(paths.reviewsDir, reviewId, ".json"), parseReviewRecord),
    saveReview: (value) => writeJsonFile(idPath(paths.reviewsDir, value.id, ".json"), value),
    loadRepairTask: (repairId) => readJsonFile(idPath(paths.repairTasksDir, repairId, ".json"), parseRepairTask),
    saveRepairTask: (value) => writeJsonFile(idPath(paths.repairTasksDir, value.id, ".json"), value),
    loadGenerationRun: (runId) => readJsonFile(idPath(paths.generationRunsDir, runId, ".json"), parseGenerationRun),
    saveGenerationRun: (value) => writeJsonFile(idPath(paths.generationRunsDir, value.id, ".json"), value),
    readPrompt: () => readTextFile(paths.promptFile),
    writePrompt: (text) => writeTextFile(paths.promptFile, text),
    readManuscript: () => readTextFile(paths.manuscript),
    writeManuscript: (text) => writeTextFile(paths.manuscript, text),
    readProductionReport: () => readTextFile(paths.productionReport),
    writeProductionReport: (text) => writeTextFile(paths.productionReport, text),
  };
}

function idPath(directory: string, id: string, extension: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid repository id: ${id}`);
  }
  return join(directory, `${id}${extension}`);
}
