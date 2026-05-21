import { createActiveBranchNovelProductionRepository, getActiveNovelBranch } from "./branches";
import { exportManuscript, type ExportResult } from "./export";
import { producePlotUnit } from "./generation";
import { repairPlotUnit } from "./repair";
import { reviewPlotUnit } from "./review";
import type { NovelProductionRepository } from "./repository";
import { transitionPlotUnitStatus, type IsoTimestamp, type PlotUnitRecord, type RepairTaskRecord, type ReviewRecord } from "./schema";

export type NovelAutoOptions = {
  maxRepairAttemptsPerUnit?: number;
  now?: () => IsoTimestamp;
};

export type NovelAutoReviewRequest = {
  unit: PlotUnitRecord;
  draft: string;
  repairAttempt: number;
};

export type NovelAutoRepairRequest = {
  draft: string;
  repairTask: RepairTaskRecord;
  prompt: string;
};

export type NovelAutoReviewDecision = {
  result: "pass" | "fail";
  checklist: ReviewRecord["checklist"];
  issues: string[];
  decisionNotes: string;
  repair?: {
    scope: RepairTaskRecord["scope"];
    intensity: RepairTaskRecord["intensity"];
    instructions: string;
  };
};

export type NovelAutoAgents = {
  generate(prompt: string): Promise<string>;
  review(input: NovelAutoReviewRequest): Promise<NovelAutoReviewDecision>;
  repair(input: NovelAutoRepairRequest): Promise<string>;
};

export type NovelAutoRunReport = {
  status: "completed" | "blocked";
  activeBranchId?: string;
  processedUnitIds: string[];
  approvedUnitIds: string[];
  repairedUnitIds: string[];
  blockedUnitId?: string;
  blocker?: string;
  repairAttemptsByUnitId: Record<string, number>;
  exportResult?: ExportResult;
};

const defaultMaxRepairAttemptsPerUnit = 3;
const placeholderTimestamp = "1970-01-01T00:00:00.000Z";

export async function runActiveBranchNovelAuto(
  root: string,
  agents: NovelAutoAgents,
  options: NovelAutoOptions = {},
): Promise<NovelAutoRunReport> {
  const activeBranch = await loadActiveBranchId(root);
  if (!activeBranch.ok) {
    return createBlockedReport(`Active branch unavailable: ${activeBranch.blocker}`);
  }
  const repository = await createActiveBranchNovelProductionRepository(root);
  return runNovelAuto(repository, agents, options, activeBranch.value);
}

export async function runNovelAuto(
  repository: NovelProductionRepository,
  agents: NovelAutoAgents,
  options: NovelAutoOptions = {},
  activeBranchId?: string,
): Promise<NovelAutoRunReport> {
  const maxRepairAttemptsPerUnit = resolveMaxRepairAttempts(options.maxRepairAttemptsPerUnit);
  const baseReport = createBaseReport(activeBranchId);
  const preconditions = await validatePreconditions(repository);
  if (!preconditions.ok) {
    return createBlockedReport(preconditions.blocker, { activeBranchId });
  }

  const now = options.now;
  const processedUnitIds = new Set<string>();
  const approvedUnitIds = new Set<string>();
  const repairedUnitIds = new Set<string>();
  const repairAttemptsByUnitId: Record<string, number> = {};

  while (true) {
    const units = sortUnits(await repository.loadPlotUnits());
    const unapproved = units.filter((unit) => unit.status !== "approved");
    if (unapproved.length === 0) {
      const exportResult = await exportManuscript(repository);
      if (exportResult.skippedUnitIds.length > 0) {
        return createBlockedReport(`Export skipped unapproved units: ${exportResult.skippedUnitIds.join(", ")}`, {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          exportResult,
        });
      }
      return {
        ...baseReport,
        status: "completed",
        processedUnitIds: [...processedUnitIds],
        approvedUnitIds: units.map((unit) => unit.id),
        repairedUnitIds: [...repairedUnitIds],
        repairAttemptsByUnitId,
        exportResult,
      };
    }

    const producingUnit = units.find((candidate) => candidate.status === "producing");
    if (producingUnit !== undefined) {
      return createBlockedReport("Persisted producing unit cannot be safely resumed", {
        ...baseReport,
        processedUnitIds: [...processedUnitIds],
        approvedUnitIds: [...approvedUnitIds],
        repairedUnitIds: [...repairedUnitIds],
        repairAttemptsByUnitId,
        blockedUnitId: producingUnit.id,
      });
    }

    const rejectedUnit = units.find((candidate) => candidate.status === "rejected");
    if (rejectedUnit !== undefined && rejectedUnit.currentRepairTaskId === "") {
      return createBlockedReport("Rejected unit has no resolvable repair task", {
        ...baseReport,
        processedUnitIds: [...processedUnitIds],
        approvedUnitIds: [...approvedUnitIds],
        repairedUnitIds: [...repairedUnitIds],
        repairAttemptsByUnitId,
        blockedUnitId: rejectedUnit.id,
      });
    }

    const unit = units.find((candidate) => candidate.status === "repair_requested" || candidate.status === "repairing" || (candidate.status === "rejected" && candidate.currentRepairTaskId !== "")) ?? units.find((candidate) => candidate.status === "drafted" || candidate.status === "reviewing" || candidate.status === "ready_to_produce");
    if (unit === undefined) {
      return createBlockedReport(`No actionable plot unit is available with max repair attempts set to ${maxRepairAttemptsPerUnit}`, {
        ...baseReport,
        processedUnitIds: [...processedUnitIds],
        approvedUnitIds: [...approvedUnitIds],
        repairedUnitIds: [...repairedUnitIds],
        repairAttemptsByUnitId,
      });
    }

    if (unit.status === "ready_to_produce") {
      const result = await producePlotUnit(repository, unit.id, { generate: agents.generate }, { now });
      if (result.run.status === "failed" || result.unit.status === "ready_to_produce") {
        return createBlockedReport(`Production failed: ${result.run.errorMessage}`, {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          blockedUnitId: unit.id,
        });
      }
      processedUnitIds.add(unit.id);
      continue;
    }

    if (unit.status === "repair_requested" || unit.status === "repairing" || unit.status === "rejected") {
      const repairTaskId = unit.currentRepairTaskId;
      if (repairTaskId === "") {
        return createBlockedReport("Repair requested unit has no current repair task", {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          blockedUnitId: unit.id,
        });
      }
      const currentAttempts = repairAttemptsByUnitId[unit.id] ?? 0;
      if (currentAttempts >= maxRepairAttemptsPerUnit) {
        return createBlockedReport(`Unit ${unit.id} exceeded max repair attempts`, {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          blockedUnitId: unit.id,
        });
      }
      let repairTask: RepairTaskRecord;
      try {
        repairTask = await repository.loadRepairTask(repairTaskId);
      } catch (error) {
        return createBlockedReport(`Repair task ${repairTaskId} cannot be loaded: ${errorMessage(error)}`, {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          blockedUnitId: unit.id,
        });
      }
      if (repairTask.status !== "open" && repairTask.status !== "in_progress") {
        return createBlockedReport(`Repair task ${repairTaskId} is not repairable`, {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          blockedUnitId: unit.id,
        });
      }
      if (repairTask.targetType !== "plot_unit" || repairTask.targetId !== unit.id) {
        return createBlockedReport(`Repair task ${repairTaskId} does not target unit ${unit.id}`, {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          blockedUnitId: unit.id,
        });
      }
      if (unit.status === "rejected") {
        await savePlotUnit(repository, unit.id, {
          ...unit,
          status: transitionPlotUnitStatus("rejected", "repair_requested"),
          updatedAt: now?.() ?? new Date().toISOString(),
        });
      }
      try {
        await repairPlotUnit(repository, repairTaskId, { repair: agents.repair }, { now });
      } catch (error) {
        return createBlockedReport(`Repair failed: ${errorMessage(error)}`, {
          ...baseReport,
          processedUnitIds: [...processedUnitIds],
          approvedUnitIds: [...approvedUnitIds],
          repairedUnitIds: [...repairedUnitIds],
          repairAttemptsByUnitId,
          blockedUnitId: unit.id,
        });
      }
      repairAttemptsByUnitId[unit.id] = currentAttempts + 1;
      repairedUnitIds.add(unit.id);
      processedUnitIds.add(unit.id);
      continue;
    }

    const draft = await repository.readDraft(unit.id);
    const decision = await agents.review({ unit, draft, repairAttempt: repairAttemptsByUnitId[unit.id] ?? 0 });
    const result = await reviewPlotUnit(
      repository,
      unit.id,
      {
        result: decision.result,
        reviewMode: "agent_assisted",
        checklist: decision.checklist,
        issues: decision.issues,
        decisionNotes: decision.decisionNotes,
        repair: decision.repair,
      },
      { now },
    );
    processedUnitIds.add(unit.id);
    if (result.unit.status === "approved") {
      approvedUnitIds.add(unit.id);
      continue;
    }
    if (result.unit.status === "rejected" && result.repairTask === undefined) {
      return createBlockedReport("Review failed without repair instructions", {
        ...baseReport,
        processedUnitIds: [...processedUnitIds],
        approvedUnitIds: [...approvedUnitIds],
        repairedUnitIds: [...repairedUnitIds],
        repairAttemptsByUnitId,
        blockedUnitId: unit.id,
      });
    }
  }
}

function resolveMaxRepairAttempts(value: number | undefined): number {
  if (value === undefined) {
    return defaultMaxRepairAttemptsPerUnit;
  }
  if (!Number.isInteger(value) || value < 1 || !Number.isFinite(value)) {
    throw new Error("maxRepairAttemptsPerUnit must be a positive integer");
  }
  return value;
}

async function validatePreconditions(repository: NovelProductionRepository): Promise<{ ok: true } | { ok: false; blocker: string }> {
  const requirements = await loadRequired(() => repository.loadRequirements(), "Missing requirements from /novel-intake");
  if (!requirements.ok || requirements.value.id === "requirements-placeholder" || requirements.value.originalBrief === "") {
    return { ok: false, blocker: requirements.ok ? "Missing requirements from /novel-intake" : requirements.blocker };
  }

  const controls = await loadRequired(() => repository.loadProductionControls(), "Missing production controls");
  if (!controls.ok) {
    return { ok: false, blocker: controls.blocker };
  }

  const storyBible = await loadRequired(() => repository.loadStoryBible(), "Missing story bible from /novel-plan");
  if (!storyBible.ok || storyBible.value.createdAt === placeholderTimestamp || storyBible.value.premise === "") {
    return { ok: false, blocker: storyBible.ok ? "Missing story bible from /novel-plan" : storyBible.blocker };
  }

  const plan = await loadRequired(() => repository.loadPlan(), "Missing production plan from /novel-plan");
  if (!plan.ok || plan.value.createdAt === placeholderTimestamp || plan.value.acts.length === 0) {
    return { ok: false, blocker: plan.ok ? "Missing production plan from /novel-plan" : plan.blocker };
  }

  const units = await loadRequired(() => repository.loadPlotUnits(), "Missing plot units from /novel-plan");
  if (!units.ok || units.value.length === 0) {
    return { ok: false, blocker: units.ok ? "Missing plot units from /novel-plan" : units.blocker };
  }

  return { ok: true };
}

async function loadRequired<T>(load: () => Promise<T>, blocker: string): Promise<{ ok: true; value: T } | { ok: false; blocker: string }> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ok: false, blocker };
    }
    throw error;
  }
}

async function savePlotUnit(repository: NovelProductionRepository, unitId: string, updatedUnit: PlotUnitRecord): Promise<void> {
  const units = await repository.loadPlotUnits();
  await repository.savePlotUnits(units.map((unit) => (unit.id === unitId ? updatedUnit : unit)));
}

function sortUnits(units: PlotUnitRecord[]): PlotUnitRecord[] {
  return [...units].sort((left, right) => left.orderIndex - right.orderIndex);
}

function createBaseReport(activeBranchId?: string): NovelAutoRunReport {
  return {
    status: "blocked",
    ...(activeBranchId === undefined ? {} : { activeBranchId }),
    processedUnitIds: [],
    approvedUnitIds: [],
    repairedUnitIds: [],
    repairAttemptsByUnitId: {},
  };
}

function createBlockedReport(
  blocker: string,
  partial: Partial<NovelAutoRunReport> = {},
): NovelAutoRunReport {
  return {
    status: "blocked",
    processedUnitIds: partial.processedUnitIds ?? [],
    approvedUnitIds: partial.approvedUnitIds ?? [],
    repairedUnitIds: partial.repairedUnitIds ?? [],
    repairAttemptsByUnitId: partial.repairAttemptsByUnitId ?? {},
    ...(partial.activeBranchId === undefined ? {} : { activeBranchId: partial.activeBranchId }),
    ...(partial.blockedUnitId === undefined ? {} : { blockedUnitId: partial.blockedUnitId }),
    ...(partial.exportResult === undefined ? {} : { exportResult: partial.exportResult }),
    blocker,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadActiveBranchId(root: string): Promise<{ ok: true; value: string } | { ok: false; blocker: string }> {
  try {
    return { ok: true, value: await getActiveNovelBranch(root) };
  } catch (error) {
    if (isMissingFileError(error) || (error instanceof Error && /create or select a branch first|unknown active branch/i.test(error.message))) {
      return { ok: false, blocker: error instanceof Error ? error.message : String(error) };
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
