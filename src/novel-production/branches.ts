import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import {
  copyPromptSettingsIntoWorkspace,
  initializeNovelProductionWorkspace,
  readJsonFile,
  workspacePaths,
  writeJsonFile,
  type NovelProductionPaths,
} from "./workspace";
import { createNovelProductionRepositoryFromPaths, type NovelProductionRepository } from "./repository";

const safeBranchIdPattern = /^[A-Za-z0-9_-]+$/;

type BranchRegistry = {
  schemaVersion: 1;
  branches: NovelBranchRecord[];
};

export type NovelBranchRecord = {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

type ActiveBranchPointer = {
  schemaVersion: 1;
  branchId: string;
  updatedAt: string;
};

export type CreateNovelBranchOptions = {
  title?: string;
  now?: () => Date;
};

export async function createNovelBranch(root: string, branchId: string, options: CreateNovelBranchOptions = {}): Promise<void> {
  assertSafeBranchId(branchId);

  const paths = branchRootPaths(root);
  const registry = await readBranchRegistry(paths);

  if (registry.branches.some((branch) => branch.id === branchId)) {
    throw new Error(`Branch already exists: ${branchId}`);
  }

  const now = options.now ?? (() => new Date());
  const timestamp = now().toISOString();
  const projectRoot = projectRootFromMaybeWorkspace(root);
  const branchRoot = branchWorkspacePaths(root, branchId).workspace;

  await initializeNovelProductionWorkspace(projectRoot);
  await mkdir(branchRoot, { recursive: true });
  await initializeNovelProductionWorkspace(branchRoot, ".");
  await copyPromptSettingsIntoWorkspace(projectRoot, branchRoot);

  registry.branches.push({
    id: branchId,
    title: options.title,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await writeJsonFile(paths.branchesFile, registry);
  await writeJsonFile(paths.activeBranchFile, {
    schemaVersion: 1,
    branchId,
    updatedAt: timestamp,
  });
}

export async function listNovelBranches(root: string): Promise<NovelBranchRecord[]> {
  return (await readBranchRegistry(branchRootPaths(root))).branches;
}

export async function switchNovelBranch(root: string, branchId: string): Promise<void> {
  assertSafeBranchId(branchId);

  const paths = branchRootPaths(root);
  const registry = await readBranchRegistry(paths);

  if (!registry.branches.some((branch) => branch.id === branchId)) {
    throw new Error(`Unknown branch: ${branchId}`);
  }

  await writeJsonFile(paths.activeBranchFile, {
    schemaVersion: 1,
    branchId,
    updatedAt: new Date().toISOString(),
  });
}

export async function getActiveNovelBranch(root: string): Promise<string> {
  const paths = branchRootPaths(root);

  let activeBranch: ActiveBranchPointer;

  try {
    activeBranch = await readJsonFile(paths.activeBranchFile, parseActiveBranch);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error("Create or select a branch first.");
    }

    throw error;
  }

  const registry = await readBranchRegistry(paths);

  if (!registry.branches.some((branch) => branch.id === activeBranch.branchId)) {
    const knownBranchIds = registry.branches.map((branch) => branch.id);
    throw new Error(`Unknown active branch: ${activeBranch.branchId}. Known branches: ${knownBranchIds.join(", ") || "none"}`);
  }

  return activeBranch.branchId;
}

export function branchWorkspacePaths(root: string, branchId: string): NovelProductionPaths {
  assertSafeBranchId(branchId);

  return workspacePaths(projectRootFromMaybeWorkspace(root), join(".novel-production", "branches", branchId));
}

export async function activeBranchWorkspacePaths(root: string): Promise<NovelProductionPaths> {
  return branchWorkspacePaths(root, await getActiveNovelBranch(root));
}

export async function createActiveBranchNovelProductionRepository(root: string): Promise<NovelProductionRepository> {
  return createNovelProductionRepositoryFromPaths(await activeBranchWorkspacePaths(root));
}

function branchRootPaths(root: string) {
  const projectRoot = projectRootFromMaybeWorkspace(root);
  const workspace = join(projectRoot, ".novel-production");

  return {
    ...workspacePaths(projectRoot),
    branchesDir: join(workspace, "branches"),
    branchesFile: join(workspace, "branches.json"),
    activeBranchFile: join(workspace, "active-branch.json"),
  };
}

function projectRootFromMaybeWorkspace(root: string): string {
  if (basename(root) === ".novel-production") {
    return dirname(root);
  }

  return root;
}

async function readBranchRegistry(paths: ReturnType<typeof branchRootPaths>): Promise<BranchRegistry> {
  try {
    return await readJsonFile(paths.branchesFile, parseBranchRegistry);
  } catch (error) {
    if (isMissingFileError(error)) {
      return { schemaVersion: 1, branches: [] };
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid branch registry: ${error.message}`);
    }

    throw error;
  }
}

function parseBranchRegistry(value: unknown): BranchRegistry {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid branch registry");
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== 1 || !Array.isArray(record.branches)) {
    throw new Error("Invalid branch registry");
  }

  return {
    schemaVersion: 1,
    branches: record.branches.map(parseBranchRecord),
  };
}

function parseBranchRecord(value: unknown): NovelBranchRecord {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid branch record");
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || typeof record.createdAt !== "string" || typeof record.updatedAt !== "string") {
    throw new Error("Invalid branch record");
  }

  assertSafeBranchId(record.id);

  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseActiveBranch(value: unknown): ActiveBranchPointer {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid active branch");
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== 1 || typeof record.branchId !== "string" || typeof record.updatedAt !== "string") {
    throw new Error("Invalid active branch");
  }

  assertSafeBranchId(record.branchId);

  return {
    schemaVersion: 1,
    branchId: record.branchId,
    updatedAt: record.updatedAt,
  };
}

function assertSafeBranchId(branchId: string): void {
  if (!safeBranchIdPattern.test(branchId)) {
    throw new Error(`Invalid branch id: ${branchId}`);
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
