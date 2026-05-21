import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

export const managedByMarker = "managed-by: opencode-novel-production-line";

export const managedAssetPaths = [
  ".opencode/agents/novel-producer.md",
  ".opencode/agents/novel-planner.md",
  ".opencode/agents/novel-drafter.md",
  ".opencode/agents/novel-reviewer.md",
  ".opencode/agents/novel-repairer.md",
  ".opencode/agents/novel-continuity.md",
  ".opencode/agents/novel-exporter.md",
  ".opencode/commands/novel-init.md",
  ".opencode/commands/novel-intake.md",
  ".opencode/commands/novel-plan.md",
  ".opencode/commands/novel-produce.md",
  ".opencode/commands/novel-review.md",
  ".opencode/commands/novel-repair.md",
  ".opencode/commands/novel-export.md",
  ".opencode/commands/novel-branch.md",
  ".opencode/commands/novel-branch-create.md",
  ".opencode/commands/novel-branch-status.md",
  ".opencode/commands/novel-auto.md",
  ".opencode/commands/novel-autorun.md",
  ".opencode/commands/novel-inquiry.md",
  ".opencode/commands/novel-status.md",
  ".opencode/commands/novel-read.md",
  ".opencode/plugins/novel-production.ts",
  ".opencode/package.json",
] as const;

export type DeploymentMode = "dry-run" | "write";
export type DefaultAgentPolicy = "set-if-missing" | "set" | "keep";
export type AssetAction = "create" | "update" | "unchanged" | "conflict";
export type ConfigAction = "create" | "merge" | "unchanged" | "conflict";

export type BuildDeploymentPlanOptions = {
  sourceRoot: string;
  targetRoot: string;
  mode?: DeploymentMode;
  force?: boolean;
  defaultAgentPolicy?: DefaultAgentPolicy;
};

export type DeploymentAssetPlan = {
  relativePath: (typeof managedAssetPaths)[number];
  sourcePath: string;
  targetPath: string;
  content: string;
  action: AssetAction;
};

export type DeploymentConfigPlan = {
  path: string;
  action: ConfigAction;
  defaultAgent: string | undefined;
  next: Record<string, unknown> & {
    default_agent?: string;
  };
};

export type DeploymentPlan = {
  mode: DeploymentMode;
  sourceRoot: string;
  targetRoot: string;
  assets: DeploymentAssetPlan[];
  config: DeploymentConfigPlan;
  warnings: string[];
};

export type DeploymentApplyResult = {
  writtenFiles: string[];
  backedUpFiles: string[];
  backupRoot?: string;
};

export async function buildDeploymentPlan(options: BuildDeploymentPlanOptions): Promise<DeploymentPlan> {
  const mode = options.mode ?? "dry-run";
  const sourceRoot = resolve(options.sourceRoot);
  const targetRoot = resolve(options.targetRoot);
  const warnings: string[] = [];

  if (sourceRoot === targetRoot) {
    throw new Error("Target project must be different from the source project");
  }

  await ensureDirectory(sourceRoot, "Source project root");
  await ensureDirectory(targetRoot, "Target project root");

  const assets = await Promise.all(
    managedAssetPaths.map(async (relativePath) => {
      const sourcePath = join(sourceRoot, relativePath);
      const targetPath = join(targetRoot, relativePath);
      const content = await readRequiredSourceAsset(sourcePath, relativePath);
      const targetContent = await readOptionalTextFile(targetPath);

      return {
        relativePath,
        sourcePath,
        targetPath,
        content,
        action: getAssetAction(content, targetContent, options.force === true),
      };
    }),
  );

  const configPath = join(targetRoot, "opencode.json");
  const config = await buildConfigPlan(configPath, options.defaultAgentPolicy ?? "set-if-missing", warnings);

  return {
    mode,
    sourceRoot,
    targetRoot,
    assets,
    config,
    warnings,
  };
}

export async function applyDeploymentPlan(plan: DeploymentPlan): Promise<DeploymentApplyResult> {
  if (plan.mode !== "write") {
    throw new Error("Cannot apply a dry-run deployment plan");
  }

  const conflictingAsset = plan.assets.find((asset) => asset.action === "conflict");
  if (conflictingAsset !== undefined) {
    throw new Error(`Cannot apply deployment plan with conflicting asset: ${conflictingAsset.relativePath}`);
  }

  if (plan.config.action === "conflict") {
    throw new Error("Cannot apply deployment plan with conflicting opencode.json");
  }

  const writtenFiles: string[] = [];
  const backedUpFiles: string[] = [];
  let backupRoot: string | undefined;

  for (const asset of plan.assets) {
    if (asset.action === "unchanged") {
      continue;
    }

    if (asset.action === "update") {
      backupRoot ??= join(".opencode", "novel-production-backups", createBackupTimestamp());
      await writeBackup(plan.targetRoot, backupRoot, asset.relativePath, asset.targetPath);
      backedUpFiles.push(asset.relativePath);
    }

    await mkdir(dirname(asset.targetPath), { recursive: true });
    await writeFile(asset.targetPath, asset.content);
    writtenFiles.push(asset.relativePath);
  }

  if (plan.config.action === "create" || plan.config.action === "merge") {
    if (plan.config.action === "merge") {
      backupRoot ??= join(".opencode", "novel-production-backups", createBackupTimestamp());
      await writeBackup(plan.targetRoot, backupRoot, "opencode.json", plan.config.path);
      backedUpFiles.push("opencode.json");
    }

    await mkdir(dirname(plan.config.path), { recursive: true });
    await writeFileAtomically(plan.config.path, `${JSON.stringify(plan.config.next, null, 2)}\n`);
    writtenFiles.push(relative(plan.targetRoot, plan.config.path));
  }

  return {
    writtenFiles,
    backedUpFiles,
    ...(backupRoot === undefined ? {} : { backupRoot }),
  };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function createBackupTimestamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

async function writeBackup(
  targetRoot: string,
  backupRoot: string,
  relativePath: string,
  sourcePath: string,
): Promise<void> {
  const backupPath = join(targetRoot, backupRoot, relativePath);
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFile(backupPath, await readFile(sourcePath, "utf8"));
}

async function writeFileAtomically(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, content);
  await rename(temporaryPath, path);
}

async function readRequiredSourceAsset(
  sourcePath: string,
  relativePath: (typeof managedAssetPaths)[number],
): Promise<string> {
  try {
    return await readFile(sourcePath, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      throw new Error(`Missing required source asset: ${relativePath}`);
    }

    throw error;
  }
}

async function buildConfigPlan(
  configPath: string,
  defaultAgentPolicy: DefaultAgentPolicy,
  warnings: string[],
): Promise<DeploymentConfigPlan> {
  const existingContent = await readOptionalTextFile(configPath);

  if (existingContent === undefined) {
    return {
      path: configPath,
      action: "create",
      defaultAgent: "novel-producer",
      next: {
        default_agent: "novel-producer",
      },
    };
  }

  const existingConfig = parseOpencodeConfig(existingContent, configPath);
  const currentDefaultAgent = getStringValue(existingConfig, "default_agent");

  if (defaultAgentPolicy === "set") {
    const next = { ...existingConfig, default_agent: "novel-producer" };

    return {
      path: configPath,
      action: currentDefaultAgent === "novel-producer" ? "unchanged" : "merge",
      defaultAgent: "novel-producer",
      next,
    };
  }

  if (defaultAgentPolicy === "keep") {
    return {
      path: configPath,
      action: "unchanged",
      defaultAgent: currentDefaultAgent,
      next: existingConfig,
    };
  }

  if (currentDefaultAgent !== undefined) {
    if (currentDefaultAgent !== "novel-producer") {
      warnings.push(
        `Target already has default_agent ${currentDefaultAgent}; rerun with --set-default-agent to replace it.`,
      );
    }

    return {
      path: configPath,
      action: "unchanged",
      defaultAgent: currentDefaultAgent,
      next: existingConfig,
    };
  }

  const next = { ...existingConfig, default_agent: "novel-producer" };

  return {
    path: configPath,
    action: "merge",
    defaultAgent: "novel-producer",
    next,
  };
}

function parseOpencodeConfig(content: string, configPath: string): Record<string, unknown> {
  try {
    const parsedConfig: unknown = JSON.parse(content);

    if (isRecord(parsedConfig)) {
      return parsedConfig;
    }

    throw new Error(`Invalid opencode.json: expected an object at ${configPath}`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid opencode.json: ${error.message}`);
    }

    throw error;
  }
}

function getStringValue(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function ensureDirectory(path: string, label: string): Promise<void> {
  const pathStats = await stat(path);
  if (!pathStats.isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}`);
  }
}

async function readOptionalTextFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    throw error;
  }
}

function isNodeErrorWithCode(error: unknown, code: string): error is Error & { code: string } {
  return error instanceof Error && "code" in error && error.code === code;
}

function getAssetAction(sourceContent: string, targetContent: string | undefined, force: boolean): AssetAction {
  if (targetContent === undefined) {
    return "create";
  }

  if (targetContent === sourceContent) {
    return "unchanged";
  }

  if (force || targetContent.includes(managedByMarker)) {
    return "update";
  }

  return "conflict";
}
