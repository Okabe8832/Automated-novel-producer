import { constants } from "node:fs";
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createDefaultProductionControls, createEmptyElementPools, createEmptyPrototypes } from "./schema";

export type NovelProductionPaths = {
  root: string;
  workspace: string;
  requirements: string;
  productionControls: string;
  storyBible: string;
  prototypes: string;
  elementPools: string;
  plan: string;
  plotUnits: string;
  materialsDir: string;
  materialDecompositionsDir: string;
  draftsDir: string;
  reviewsDir: string;
  repairTasksDir: string;
  generationRunsDir: string;
  exportsDir: string;
  reportsDir: string;
  promptSettingsDir: string;
  promptFile: string;
  manuscript: string;
  productionReport: string;
};

const placeholderTimestamp = "1970-01-01T00:00:00.000Z";

export function workspacePaths(root: string, workspaceDir = ".novel-production"): NovelProductionPaths {
  const workspace = workspaceDir === "." ? root : join(root, workspaceDir);
  const exportsDir = join(workspace, "exports");
  const reportsDir = join(workspace, "reports");
  const promptSettingsDir = join(workspace, "prompt settings");

  return {
    root,
    workspace,
    requirements: join(workspace, "requirements.json"),
    productionControls: join(workspace, "production-controls.json"),
    storyBible: join(workspace, "story-bible.json"),
    prototypes: join(workspace, "prototypes.json"),
    elementPools: join(workspace, "element-pools.json"),
    plan: join(workspace, "plan.json"),
    plotUnits: join(workspace, "plot-units.json"),
    materialsDir: join(workspace, "materials"),
    materialDecompositionsDir: join(workspace, "material-decompositions"),
    draftsDir: join(workspace, "drafts"),
    reviewsDir: join(workspace, "reviews"),
    repairTasksDir: join(workspace, "repair-tasks"),
    generationRunsDir: join(workspace, "generation-runs"),
    exportsDir,
    reportsDir,
    promptSettingsDir,
    promptFile: join(promptSettingsDir, "novel_ai_language_prompt_v1_3.md"),
    manuscript: join(exportsDir, "manuscript.md"),
    productionReport: join(reportsDir, "production-report.md"),
  };
}

export async function initializeNovelProductionWorkspace(root: string, workspaceDir = ".novel-production"): Promise<void> {
  const paths = workspacePaths(root, workspaceDir);
  const rootPromptSettingsDir = join(root, "prompt settings");
  const rootPromptFile = join(rootPromptSettingsDir, "novel_ai_language_prompt_v1_3.md");
  await Promise.all([
    mkdir(paths.workspace, { recursive: true }),
    mkdir(paths.promptSettingsDir, { recursive: true }),
    mkdir(rootPromptSettingsDir, { recursive: true }),
    mkdir(paths.materialsDir, { recursive: true }),
    mkdir(paths.materialDecompositionsDir, { recursive: true }),
    mkdir(paths.draftsDir, { recursive: true }),
    mkdir(paths.reviewsDir, { recursive: true }),
    mkdir(paths.repairTasksDir, { recursive: true }),
    mkdir(paths.generationRunsDir, { recursive: true }),
    mkdir(paths.exportsDir, { recursive: true }),
    mkdir(paths.reportsDir, { recursive: true }),
  ]);

  await Promise.all([
    writeJsonFileIfAbsent(paths.requirements, createPlaceholderRequirements()),
    writeJsonFileIfAbsent(paths.productionControls, createDefaultProductionControls(() => placeholderTimestamp)),
    writeJsonFileIfAbsent(paths.storyBible, createPlaceholderStoryBible()),
    writeJsonFileIfAbsent(paths.prototypes, createEmptyPrototypes()),
    writeJsonFileIfAbsent(paths.elementPools, createEmptyElementPools()),
    writeJsonFileIfAbsent(paths.plan, createPlaceholderPlan()),
    writeJsonFileIfAbsent(paths.plotUnits, []),
    writeTextFileIfAbsent(paths.promptFile, createPlaceholderPromptSettings()),
    writeTextFileIfAbsent(rootPromptFile, createPlaceholderPromptSettings()),
  ]);
}

export async function copyPromptSettingsIntoWorkspace(projectRoot: string, destinationWorkspace: string): Promise<void> {
  try {
    await cp(join(projectRoot, "prompt settings"), join(destinationWorkspace, "prompt settings"), {
      recursive: true,
      force: true,
      errorOnExist: false,
    });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error("Missing prompt settings directory at project root: prompt settings");
    }
    throw error;
  }
}

export async function readJsonFile<T>(path: string, parse: (value: unknown) => T): Promise<T> {
  const content = await readTextFile(path);
  return parse(JSON.parse(content));
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeTextFile(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await writeFile(tempPath, value, "utf8");
  try {
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function writeJsonFileIfAbsent(path: string, value: unknown): Promise<void> {
  if (await fileExists(path)) {
    return;
  }
  await writeJsonFile(path, value);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function createPlaceholderRequirements() {
  return {
    schemaVersion: 1,
    id: "requirements-placeholder",
    title: "",
    originalBrief: "",
    language: "zh-CN",
    genre: "",
    targetAudience: "",
    style: "",
    pointOfView: "",
    lengthTarget: { totalWords: 0, unitWords: 0 },
    mustInclude: [],
    mustAvoid: [],
    referenceNotes: [],
    qualityBar: [],
    createdAt: placeholderTimestamp,
    updatedAt: placeholderTimestamp,
  };
}

function createPlaceholderStoryBible() {
  return {
    schemaVersion: 1,
    premise: "",
    world: "",
    themes: [],
    characters: [],
    scenes: [],
    timeline: [],
    continuityRules: [],
    createdAt: placeholderTimestamp,
    updatedAt: placeholderTimestamp,
  };
}

function createPlaceholderPlan() {
  return {
    schemaVersion: 1,
    logline: "",
    structure: "",
    acts: [],
    productionNotes: [],
    createdAt: placeholderTimestamp,
    updatedAt: placeholderTimestamp,
  };
}

function createPlaceholderPromptSettings() {
  return [
    "# 默认写作 Prompt",
    "",
    "<!-- novel-intake:start -->",
    "<!-- novel-intake:end -->",
    "",
    "<!-- novel-plan:start -->",
    "<!-- novel-plan:end -->",
    "",
  ].join("\n");
}

async function writeTextFileIfAbsent(path: string, value: string): Promise<void> {
  if (await fileExists(path)) {
    return;
  }
  await writeTextFile(path, value);
}
