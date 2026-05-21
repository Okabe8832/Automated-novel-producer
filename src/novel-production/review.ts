import type { NovelProductionRepository } from "./repository";
import type { IsoTimestamp, PlotUnitRecord, RepairTaskRecord, ReviewMode, ReviewRecord, ReviewResult } from "./schema";
import { transitionPlotUnitStatus } from "./schema";
import { promoteNextPlannedUnit } from "./sequencing";

export type ReviewInput = {
  result: ReviewResult;
  reviewMode: ReviewMode;
  checklist: ReviewRecord["checklist"];
  issues: string[];
  decisionNotes: string;
  repair?: {
    scope: RepairTaskRecord["scope"];
    intensity: RepairTaskRecord["intensity"];
    instructions: string;
  };
};

export async function reviewPlotUnit(
  repository: NovelProductionRepository,
  plotUnitId: string,
  input: ReviewInput,
  options: { now?: () => IsoTimestamp; id?: () => string } = {},
): Promise<{ unit: PlotUnitRecord; review: ReviewRecord; repairTask?: RepairTaskRecord }> {
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.id ?? (() => `review-${Date.now()}`);
  const createdAt = now();
  const units = await repository.loadPlotUnits();
  const unitIndex = units.findIndex((unit) => unit.id === plotUnitId);
  if (unitIndex === -1) {
    throw new Error(`Plot unit not found: ${plotUnitId}`);
  }
  const unit = units[unitIndex]!;
  if (unit.status !== "drafted" && unit.status !== "reviewing") {
    throw new Error(`Plot unit ${plotUnitId} is not reviewable`);
  }

  const review: ReviewRecord = {
    id: createId(),
    plotUnitId,
    result: input.result,
    reviewMode: input.reviewMode,
    checklist: input.checklist,
    issues: input.issues,
    decisionNotes: input.decisionNotes,
    createdAt,
  };
  await repository.saveReview(review);

  if (input.result === "pass") {
    const reviewingUnit = unit.status === "drafted" ? updateUnit(unit, transitionPlotUnitStatus("drafted", "reviewing"), createdAt) : unit;
    const approvedUnit = updateUnit(reviewingUnit, transitionPlotUnitStatus("reviewing", "approved"), createdAt);
    const controls = await repository.loadProductionControls();
    const updatedUnits = units.map((currentUnit, index) => (index === unitIndex ? approvedUnit : currentUnit));
    await repository.savePlotUnits(promoteNextPlannedUnit(updatedUnits, approvedUnit, controls, createdAt));
    return { unit: approvedUnit, review };
  }

  const rejectedUnit = unit.status === "drafted" ? updateUnit(unit, transitionPlotUnitStatus("drafted", "rejected"), createdAt) : updateUnit(unit, transitionPlotUnitStatus("reviewing", "rejected"), createdAt);
  if (!input.repair) {
    await saveUnit(repository, units, unitIndex, rejectedUnit);
    return { unit: rejectedUnit, review };
  }

  const repairTask: RepairTaskRecord = {
    id: `repair-${review.id}`,
    targetType: "plot_unit",
    targetId: plotUnitId,
    createdFromReviewId: review.id,
    reason: input.issues.join("；") || input.decisionNotes,
    scope: input.repair.scope,
    intensity: input.repair.intensity,
    instructions: input.repair.instructions,
    status: "open",
    createdAt,
    updatedAt: createdAt,
  };
  const repairRequestedUnit = updateUnit(
    { ...rejectedUnit, currentRepairTaskId: repairTask.id },
    transitionPlotUnitStatus("rejected", "repair_requested"),
    createdAt,
  );

  await repository.saveRepairTask(repairTask);
  await saveUnit(repository, units, unitIndex, repairRequestedUnit);
  return { unit: repairRequestedUnit, review, repairTask };
}

function updateUnit(unit: PlotUnitRecord, status: PlotUnitRecord["status"], updatedAt: IsoTimestamp): PlotUnitRecord {
  return { ...unit, status, updatedAt };
}

async function saveUnit(
  repository: NovelProductionRepository,
  units: PlotUnitRecord[],
  unitIndex: number,
  updatedUnit: PlotUnitRecord,
): Promise<void> {
  await repository.savePlotUnits(units.map((unit, index) => (index === unitIndex ? updatedUnit : unit)));
}
