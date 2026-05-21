import { join } from "node:path";

import { activeBranchWorkspacePaths, getActiveNovelBranch } from "./branches";
import { readTextFile, workspacePaths } from "./workspace";

const defaultPreviewLimit = 4000;

export type DraftPreview = {
  unitId: string;
  draftPath: string;
  offset: number;
  limit: number;
  text: string;
};

export type DraftPreviewOptions = {
  offset?: number;
  limit?: number;
};

export async function readDraftPreview(root: string, unitId: string, options: DraftPreviewOptions = {}): Promise<DraftPreview> {
  assertSafeUnitId(unitId);

  const offset = normalizeNonNegativeInteger(options.offset ?? 0, "offset");
  const limit = normalizePositiveInteger(options.limit ?? defaultPreviewLimit, "limit");
  const draftPath = join(workspacePaths(root).draftsDir, `${unitId}.md`);

  let content: string;

  try {
    content = await readTextFile(draftPath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      throw new Error(`Draft not found for ${unitId}: .novel-production/drafts/${unitId}.md`);
    }

    throw error;
  }

  return {
    unitId,
    draftPath,
    offset,
    limit,
    text: content.slice(offset, offset + limit),
  };
}

export async function readActiveBranchDraftPreview(root: string, unitId: string, options: DraftPreviewOptions = {}): Promise<DraftPreview & { branchId: string }> {
  assertSafeUnitId(unitId);

  const offset = normalizeNonNegativeInteger(options.offset ?? 0, "offset");
  const limit = normalizePositiveInteger(options.limit ?? defaultPreviewLimit, "limit");
  const branchId = await getActiveNovelBranch(root);
  const activeBranchPaths = await activeBranchWorkspacePaths(root);
  const draftPath = join(activeBranchPaths.draftsDir, `${unitId}.md`);

  let content: string;

  try {
    content = await readTextFile(draftPath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      throw new Error(`Draft not found for ${unitId} in active branch ${activeBranchPaths.workspace}: ${draftPath}`);
    }

    throw error;
  }

  return {
    unitId,
    branchId,
    draftPath,
    offset,
    limit,
    text: content.slice(offset, offset + limit),
  };
}

export function renderDraftPreviewMarkdown(preview: DraftPreview): string {
  return `${preview.text}\n`;
}

function assertSafeUnitId(unitId: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(unitId)) {
    throw new Error(`Invalid unit id: ${unitId}`);
  }
}

function normalizeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }

  return value;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function isNodeErrorWithCode(error: unknown, code: string): error is Error & { code: string } {
  return error instanceof Error && "code" in error && error.code === code;
}
