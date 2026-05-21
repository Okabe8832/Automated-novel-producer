import type { NovelProductionRepository } from "./repository";
import type { PlotUnitRecord } from "./schema";

export type ProductionStatusReport = {
  totalUnits: number;
  approvedCount: number;
  draftedCount: number;
  rejectedCount: number;
  repairRequestedCount: number;
  nextAction: string;
  blockers: string[];
  omoRuntime: OmoRuntimeStatus;
};

export type OmoRuntimeStatus = {
  available: boolean;
  message: string;
};

export type BuildProductionStatusOptions = {
  omoRuntimeAvailable?: boolean;
};

export async function buildProductionStatus(
  repository: NovelProductionRepository,
  options: BuildProductionStatusOptions = {},
): Promise<ProductionStatusReport> {
  const units = await repository.loadPlotUnits();
  const orderedUnits = [...units].sort((left, right) => left.orderIndex - right.orderIndex);
  const blockers = orderedUnits
    .filter((unit) => unit.status === "rejected" || unit.status === "repair_requested")
    .map((unit) => `${unit.id} is ${unit.status}`);

  return {
    totalUnits: orderedUnits.length,
    approvedCount: countStatus(orderedUnits, "approved"),
    draftedCount: countStatus(orderedUnits, "drafted"),
    rejectedCount: countStatus(orderedUnits, "rejected"),
    repairRequestedCount: countStatus(orderedUnits, "repair_requested"),
    nextAction: selectNextAction(orderedUnits),
    blockers,
    omoRuntime: buildOmoRuntimeStatus(options.omoRuntimeAvailable),
  };
}

export function renderProductionStatusMarkdown(report: ProductionStatusReport): string {
  return [
    "# Novel Production Status",
    `- Total units: ${report.totalUnits}`,
    `- Approved: ${report.approvedCount}`,
    `- Drafted: ${report.draftedCount}`,
    `- Rejected: ${report.rejectedCount}`,
    `- Repair requested: ${report.repairRequestedCount}`,
    `- Next action: ${report.nextAction}`,
    `- Blockers: ${report.blockers.length === 0 ? "None" : report.blockers.join("; ")}`,
    `- OMO runtime: ${report.omoRuntime.available ? "detected" : "not detected"}`,
    ...renderOmoRuntimeNotes(report.omoRuntime),
  ].join("\n");
}

export async function writeProductionStatusReport(repository: NovelProductionRepository): Promise<ProductionStatusReport> {
  const report = await buildProductionStatus(repository);
  await repository.writeProductionReport(`${renderProductionStatusMarkdown(report)}\n`);
  return report;
}

function countStatus(units: PlotUnitRecord[], status: PlotUnitRecord["status"]): number {
  return units.filter((unit) => unit.status === status).length;
}

function buildOmoRuntimeStatus(available = isOmoRuntimeDetected()): OmoRuntimeStatus {
  return {
    available,
    message: available
      ? "Automated commands and agent workflows are available."
      : "Novel production assets are available as files. Automated commands and agent workflows require OMO/OpenCode.",
  };
}

function isOmoRuntimeDetected(): boolean {
  return process.env.OPENCODE === "1" || process.env.OMO === "1" || process.env.OH_MY_OPENCODE === "1";
}

function renderOmoRuntimeNotes(runtime: OmoRuntimeStatus): string[] {
  if (runtime.available) {
    return [`- ${runtime.message}`];
  }

  return [
    `- ${runtime.message}`,
    "- Drafts: .novel-production/drafts/",
    "- Status: .novel-production/reports/production-report.md",
  ];
}

function selectNextAction(units: PlotUnitRecord[]): string {
  const blocked = units.find((unit) => unit.status === "repair_requested" || unit.status === "rejected");
  if (blocked) {
    return `Resolve blocker on ${blocked.id}`;
  }
  const reviewable = units.find((unit) => unit.status === "drafted");
  if (reviewable) {
    return `Review ${reviewable.id}`;
  }
  const ready = units.find((unit) => unit.status === "ready_to_produce");
  if (ready) {
    return `Produce ${ready.id}`;
  }
  const planned = units.find((unit) => unit.status === "planned");
  if (planned) {
    return `Prepare ${planned.id}`;
  }
  if (units.length > 0 && units.every((unit) => unit.status === "approved")) {
    return "Export manuscript";
  }
  return "Create or update production plan";
}
