import type { NovelProductionRepository } from "./repository";

export type ExportResult = {
  manuscriptPath: string;
  includedUnitIds: string[];
  skippedUnitIds: string[];
};

export async function exportManuscript(repository: NovelProductionRepository): Promise<ExportResult> {
  const units = await repository.loadPlotUnits();
  const orderedUnits = [...units].sort((left, right) => left.orderIndex - right.orderIndex);
  const approvedUnits = orderedUnits.filter((unit) => unit.status === "approved");
  if (approvedUnits.length === 0) {
    throw new Error("No approved units to export");
  }

  const approvedDrafts = await Promise.all(approvedUnits.map(async (unit) => repository.readDraft(unit.id)));
  const manuscript = `${approvedDrafts.join("\n\n")}\n`;
  await repository.writeManuscript(manuscript);

  const includedUnitIds = approvedUnits.map((unit) => unit.id);
  const skippedUnitIds = orderedUnits.filter((unit) => unit.status !== "approved").map((unit) => unit.id);
  await repository.writeProductionReport(
    [
      "# Production Export Report",
      `Included units: ${includedUnitIds.join(", ") || "none"}`,
      `Skipped units: ${skippedUnitIds.join(", ") || "none"}`,
      "",
    ].join("\n"),
  );

  return {
    manuscriptPath: repository.paths.manuscript,
    includedUnitIds,
    skippedUnitIds,
  };
}
