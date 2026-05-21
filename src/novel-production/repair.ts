import type { NovelProductionRepository } from "./repository";
import type { IsoTimestamp, PlotUnitRecord, RepairTaskRecord } from "./schema";
import { transitionPlotUnitStatus } from "./schema";
import { buildPromptSnapshot, renderProductionPrompt } from "./prompt";

export type NovelRepairGenerator = {
  repair(input: { draft: string; repairTask: RepairTaskRecord; prompt: string }): Promise<string>;
};

export async function repairPlotUnit(
  repository: NovelProductionRepository,
  repairTaskId: string,
  generator: NovelRepairGenerator,
  options: { now?: () => IsoTimestamp } = {},
): Promise<{ unit: PlotUnitRecord; repairTask: RepairTaskRecord }> {
  const now = options.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const repairTask = await repository.loadRepairTask(repairTaskId);
  if (repairTask.status !== "open" && repairTask.status !== "in_progress") {
    throw new Error(`Repair task ${repairTaskId} is not repairable`);
  }
  if (repairTask.targetType !== "plot_unit") {
    throw new Error(`Unsupported repair target: ${repairTask.targetType}`);
  }

  const units = await repository.loadPlotUnits();
  const unitIndex = units.findIndex((unit) => unit.id === repairTask.targetId);
  if (unitIndex === -1) {
    throw new Error(`Plot unit not found: ${repairTask.targetId}`);
  }
  const unit = units[unitIndex]!;
  if (unit.status !== "repair_requested" && unit.status !== "repairing") {
    throw new Error(`Plot unit ${unit.id} is not repairable`);
  }

  const repairingUnit =
    unit.status === "repair_requested" ? { ...unit, status: transitionPlotUnitStatus("repair_requested", "repairing"), updatedAt: startedAt } : unit;
  const inProgressTask = { ...repairTask, status: "in_progress" as const, updatedAt: startedAt };
  await repository.saveRepairTask(inProgressTask);
  await saveUnit(repository, units, unitIndex, repairingUnit);

  const draft = await repository.readDraft(unit.id);
  const snapshot = await buildPromptSnapshot(repository, unit.id, { repairTaskId });
  const prompt = renderProductionPrompt(snapshot);
  const repairedDraft = await generator.repair({ draft, repairTask: inProgressTask, prompt });
  await repository.writeDraft(unit.id, repairedDraft);

  const completedAt = now();
  const completedTask = { ...inProgressTask, status: "completed" as const, updatedAt: completedAt };
  const draftedUnit = {
    ...repairingUnit,
    status: transitionPlotUnitStatus("repairing", "drafted"),
    currentRepairTaskId: "",
    updatedAt: completedAt,
  };
  await repository.saveRepairTask(completedTask);
  await saveUnit(repository, await repository.loadPlotUnits(), unitIndex, draftedUnit);

  return { unit: draftedUnit, repairTask: completedTask };
}

async function saveUnit(
  repository: NovelProductionRepository,
  units: PlotUnitRecord[],
  unitIndex: number,
  updatedUnit: PlotUnitRecord,
): Promise<void> {
  await repository.savePlotUnits(units.map((unit, index) => (index === unitIndex ? updatedUnit : unit)));
}
