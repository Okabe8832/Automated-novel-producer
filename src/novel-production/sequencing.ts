import type { PlotUnitRecord, ProductionControls } from "./schema";

export function assertCanProduceUnit(
  units: PlotUnitRecord[],
  targetUnit: PlotUnitRecord,
  controls: ProductionControls,
): void {
  if (controls.generationMode !== "sequential" || controls.allowProduceUnreviewedNextUnit || targetUnit.status === "repairing") {
    return;
  }

  const previousUnapprovedUnit = units
    .filter((unit) => unit.orderIndex < targetUnit.orderIndex)
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .find((unit) => unit.status !== "approved");

  if (previousUnapprovedUnit) {
    throw new Error(`Cannot produce ${targetUnit.id}: previous unit ${previousUnapprovedUnit.id} is ${previousUnapprovedUnit.status}`);
  }
}

export function promoteNextPlannedUnit(
  units: PlotUnitRecord[],
  approvedUnit: PlotUnitRecord,
  controls: ProductionControls,
  updatedAt: string,
): PlotUnitRecord[] {
  if (controls.generationMode !== "sequential") {
    return units;
  }

  const hasReadyUnit = units.some((unit) => unit.status === "ready_to_produce" || unit.status === "producing" || unit.status === "drafted" || unit.status === "reviewing" || unit.status === "repair_requested" || unit.status === "repairing" || unit.status === "rejected");
  if (hasReadyUnit) {
    return units;
  }

  const nextPlannedUnit = [...units]
    .filter((unit) => unit.orderIndex > approvedUnit.orderIndex && unit.status === "planned")
    .sort((left, right) => left.orderIndex - right.orderIndex)[0];

  if (!nextPlannedUnit) {
    return units;
  }

  return units.map((unit) => (unit.id === nextPlannedUnit.id ? { ...unit, status: "ready_to_produce", updatedAt } : unit));
}
