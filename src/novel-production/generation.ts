import type { NovelProductionRepository } from "./repository";
import type { GenerationRunRecord, IsoTimestamp, PlotUnitRecord } from "./schema";
import { transitionPlotUnitStatus } from "./schema";
import { buildPromptSnapshot, renderProductionPrompt } from "./prompt";
import { assertCanProduceUnit } from "./sequencing";

export type NovelTextGenerator = {
  generate(prompt: string): Promise<string>;
};

export async function producePlotUnit(
  repository: NovelProductionRepository,
  plotUnitId: string,
  generator: NovelTextGenerator,
  options: { now?: () => IsoTimestamp; id?: () => string; repairTaskId?: string } = {},
): Promise<{ unit: PlotUnitRecord; run: GenerationRunRecord }> {
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.id ?? (() => `run-${Date.now()}`);
  const startedAt = now();
  const units = await repository.loadPlotUnits();
  const unitIndex = units.findIndex((unit) => unit.id === plotUnitId);
  if (unitIndex === -1) {
    throw new Error(`Plot unit not found: ${plotUnitId}`);
  }
  const unit = units[unitIndex]!;
  if (unit.status !== "ready_to_produce" && unit.status !== "repairing") {
    throw new Error(`Plot unit ${plotUnitId} is not ready to produce`);
  }
  const controls = await repository.loadProductionControls();
  assertCanProduceUnit(units, unit, controls);

  const producingUnit = { ...unit, status: "producing" as const, updatedAt: startedAt };
  await saveUnit(repository, units, unitIndex, producingUnit);

  const snapshot = await buildPromptSnapshot(repository, plotUnitId, { repairTaskId: options.repairTaskId });
  const prompt = renderProductionPrompt(snapshot);
  const runId = createId();

  try {
    const draft = await generator.generate(prompt);
    await repository.writeDraft(plotUnitId, draft);
    const completedAt = now();
    const draftedUnit = { ...producingUnit, status: transitionPlotUnitStatus("producing", "drafted"), updatedAt: completedAt };
    const run: GenerationRunRecord = {
      id: runId,
      plotUnitId,
      status: "succeeded",
      agent: "novel-drafter",
      model: "injected-generator",
      promptSnapshot: snapshot,
      outputPath: draftedUnit.draftPath,
      errorMessage: "",
      createdAt: startedAt,
      updatedAt: completedAt,
    };

    await repository.saveGenerationRun(run);
    await saveUnit(repository, await repository.loadPlotUnits(), unitIndex, draftedUnit);
    return { unit: draftedUnit, run };
  } catch (error) {
    const failedAt = now();
    const retryableUnit = { ...producingUnit, status: transitionPlotUnitStatus("producing", "ready_to_produce"), updatedAt: failedAt };
    const run: GenerationRunRecord = {
      id: runId,
      plotUnitId,
      status: "failed",
      agent: "novel-drafter",
      model: "injected-generator",
      promptSnapshot: snapshot,
      outputPath: producingUnit.draftPath,
      errorMessage: error instanceof Error ? error.message : String(error),
      createdAt: startedAt,
      updatedAt: failedAt,
    };

    await repository.saveGenerationRun(run);
    await saveUnit(repository, await repository.loadPlotUnits(), unitIndex, retryableUnit);
    return { unit: retryableUnit, run };
  }
}

async function saveUnit(
  repository: NovelProductionRepository,
  units: PlotUnitRecord[],
  unitIndex: number,
  updatedUnit: PlotUnitRecord,
): Promise<void> {
  const nextUnits = units.map((unit, index) => (index === unitIndex ? updatedUnit : unit));
  await repository.savePlotUnits(nextUnits);
}
