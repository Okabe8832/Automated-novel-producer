import { stat, readdir } from "node:fs/promises";
import { join } from "node:path";

import { branchWorkspacePaths, listNovelBranches } from "./branches";
import { parsePlotUnits, type PlotUnitStatus } from "./schema";
import { readJsonFile } from "./workspace";

const directoryNames = [
  "materials",
  "material-decompositions",
  "drafts",
  "reviews",
  "repair-tasks",
  "generation-runs",
  "exports",
  "reports",
] as const;

const artifactNames = [
  "requirements.json",
  "plan.json",
  "plot-units.json",
  "exports/manuscript.md",
  "reports/production-report.md",
] as const;

export type NovelBranchStatusReport = {
  activeBranchId?: string;
  warnings: string[];
  branches: NovelBranchStatusBranch[];
};

export type NovelBranchStatusBranch = {
  branchId: string;
  title?: string;
  active: boolean;
  workspace: string;
  warnings: string[];
  directories: NovelBranchDirectoryStatus[];
  artifacts: NovelBranchArtifactStatus[];
  plotUnits: NovelBranchPlotUnitStatus[];
  plotUnitsAvailable: boolean;
};

export type NovelBranchPlotUnitStatus = {
  label: string;
  status: PlotUnitStatus;
};

export type NovelBranchDirectoryStatus = {
  name: string;
  path: string;
  fileCount: number;
};

export type NovelBranchArtifactStatus = {
  name: string;
  path: string;
  exists: boolean;
};

type ActiveBranchPointer = {
  schemaVersion: 1;
  branchId: string;
  updatedAt: string;
};

export async function buildNovelBranchStatus(root: string): Promise<NovelBranchStatusReport> {
  const branchesFile = join(root, ".novel-production", "branches.json");
  try {
    await stat(branchesFile);
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        warnings: [],
        branches: [],
      };
    }

    throw error;
  }

  const branches = await listNovelBranches(root);

  const activeBranchId = await readActiveBranchId(root);
  const activeBranchIsKnown = activeBranchId !== undefined && branches.some((branch) => branch.id === activeBranchId);
  const branchStatuses = await Promise.all(branches.map((branch) => buildBranchStatus(root, branch, activeBranchId, activeBranchIsKnown)));

  const warnings: string[] = [];
  if (activeBranchId !== undefined && !branchStatuses.some((branch) => branch.branchId === activeBranchId)) {
    warnings.push(`Unknown active branch: ${activeBranchId}`);
  }

  return {
    ...(activeBranchId === undefined ? {} : { activeBranchId }),
    warnings,
    branches: branchStatuses,
  };
}

export function renderNovelBranchStatusMarkdown(report: NovelBranchStatusReport): string {
  const lines = ["# Novel Branch Status"];

  if (report.activeBranchId !== undefined) {
    lines.push(`- Active branch: ${report.activeBranchId}`);
  }

  for (const warning of report.warnings) {
    lines.push(`- Warning: ${warning}`);
  }

  if (report.branches.length > 0) {
    lines.push("## Branch Timeline");
    for (const branch of report.branches) {
      lines.push(renderBranchTimeline(branch));
    }
  }

  for (const branch of report.branches) {
    const title = branch.title === undefined ? "" : ` (${branch.title})`;
    lines.push(`- ${branch.branchId}${title}: ${branch.active ? "active" : "inactive"}`);
    lines.push(`  - Workspace: ${branch.workspace}`);
    for (const directory of branch.directories) {
      lines.push(`  - ${directory.name}: ${directory.fileCount} files`);
    }
    for (const artifact of branch.artifacts) {
      lines.push(`  - ${artifact.name}: ${artifact.exists ? "present" : "missing"}`);
    }
    for (const warning of branch.warnings) {
      lines.push(`  - Warning: ${warning}`);
    }
  }

  if (report.branches.length === 0) {
    lines.push("- Branches: none");
  }

  return `${lines.join("\n")}\n`;
}

function renderBranchTimeline(branch: NovelBranchStatusBranch): string {
  const branchLabel = `${branch.branchId}${branch.active ? "*" : ""}`;
  if (!branch.plotUnitsAvailable) {
    return `${branchLabel}: plot units unavailable`;
  }
  if (branch.plotUnits.length === 0) {
    return `${branchLabel}: no plot units`;
  }
  return `${branchLabel}: ${branch.plotUnits.map((unit) => `${unit.label}(${unit.status})`).join(" ── ")}`;
}

async function buildBranchStatus(
  root: string,
  branch: { id: string; title?: string },
  activeBranchId: string | undefined,
  activeBranchIsKnown: boolean,
): Promise<NovelBranchStatusBranch> {
  const paths = branchWorkspacePaths(root, branch.id);
  const workspaceExists = await pathIsDirectory(paths.workspace);
  const timeline = workspaceExists ? await loadPlotUnitTimeline(paths.plotUnits) : { available: true as const, units: [] };
  const warnings = workspaceExists ? [] : [`Missing branch workspace: ${paths.workspace}`];
  if (!timeline.available) {
    warnings.push(timeline.warning);
  }

  return {
    branchId: branch.id,
    ...(branch.title === undefined ? {} : { title: branch.title }),
    active: activeBranchIsKnown && activeBranchId === branch.id,
    workspace: paths.workspace,
    warnings,
    directories: await Promise.all(
      directoryNames.map(async (name) => {
        const path = join(paths.workspace, name);
        return {
          name,
          path,
          fileCount: workspaceExists ? await countDirectRegularFiles(path) : 0,
        };
      }),
    ),
    artifacts: await Promise.all(
      artifactNames.map(async (name) => {
        const path = join(paths.workspace, name);
        return {
          name,
          path,
          exists: workspaceExists ? await pathIsFile(path) : false,
        };
      }),
    ),
    plotUnits: timeline.available ? timeline.units : [],
    plotUnitsAvailable: timeline.available,
  };
}

async function loadPlotUnitTimeline(path: string): Promise<{ available: true; units: NovelBranchPlotUnitStatus[] } | { available: false; warning: string }> {
  try {
    const units = await readJsonFile(path, parsePlotUnits);
    return {
      available: true,
      units: [...units]
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((unit, index) => ({ label: `ch${String(index + 1).padStart(2, "0")}`, status: unit.status })),
    };
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError || error instanceof Error) {
      return { available: false, warning: `Plot units unavailable: ${error instanceof Error ? error.message : String(error)}` };
    }
    return { available: false, warning: `Plot units unavailable: ${String(error)}` };
  }
}

async function readActiveBranchId(root: string): Promise<string | undefined> {
  try {
    return (await readJsonFile(join(root, ".novel-production", "active-branch.json"), parseActiveBranchPointer)).branchId;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid active branch pointer: ${error.message}`);
    }
    throw error;
  }
}

function parseActiveBranchPointer(value: unknown): ActiveBranchPointer {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.branchId !== "string" || typeof value.updatedAt !== "string") {
    throw new Error("Invalid active branch pointer");
  }

  return {
    schemaVersion: 1,
    branchId: value.branchId,
    updatedAt: value.updatedAt,
  };
}

async function countDirectRegularFiles(path: string): Promise<number> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).length;
  } catch (error) {
    if (isMissingFileError(error)) {
      return 0;
    }
    throw error;
  }
}

async function pathIsDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function pathIsFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
