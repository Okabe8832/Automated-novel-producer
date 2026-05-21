import { resolve } from "node:path";

import {
  applyDeploymentPlan,
  buildDeploymentPlan,
  type AssetAction,
  type DefaultAgentPolicy,
  type DeploymentApplyResult,
  type DeploymentMode,
  type DeploymentPlan,
} from "../src/novel-production/deployment";

type CliOptions = {
  targetRoot: string;
  mode: DeploymentMode;
  force: boolean;
  defaultAgentPolicy: DefaultAgentPolicy;
};

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const plan = await buildDeploymentPlan({
      sourceRoot: process.cwd(),
      targetRoot: options.targetRoot,
      mode: options.mode,
      force: options.force,
      defaultAgentPolicy: options.defaultAgentPolicy,
    });

    assertPlanCanProceed(plan);

    const result = options.mode === "write" ? await applyDeploymentPlan(plan) : undefined;

    printDeploymentReport(plan, result);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): CliOptions {
  let targetRoot: string | undefined;
  let mode: DeploymentMode | undefined;
  let force = false;
  let defaultAgentPolicy: DefaultAgentPolicy = "set-if-missing";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--target") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("Missing value for --target");
      }

      targetRoot = value;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      mode = setMode(mode, "dry-run");
      continue;
    }

    if (arg === "--write") {
      mode = setMode(mode, "write");
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--set-default-agent") {
      defaultAgentPolicy = "set";
      continue;
    }

    if (arg === "--keep-default-agent") {
      defaultAgentPolicy = "keep";
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (targetRoot === undefined) {
    throw new Error("Missing required --target <targetRoot>");
  }

  return {
    targetRoot: resolve(targetRoot),
    mode: mode ?? "dry-run",
    force,
    defaultAgentPolicy,
  };
}

function setMode(currentMode: DeploymentMode | undefined, nextMode: DeploymentMode): DeploymentMode {
  if (currentMode !== undefined && currentMode !== nextMode) {
    throw new Error("Choose either --dry-run or --write, not both");
  }

  return nextMode;
}

function printDeploymentReport(plan: DeploymentPlan, result: DeploymentApplyResult | undefined): void {
  const counts = countAssetActions(plan.assets.map((asset) => asset.action));

  console.log("OpenCode Novel Production Deployment");
  console.log(`Target: ${plan.targetRoot}`);
  console.log(`Mode: ${plan.mode}`);
  console.log("Assets:");
  console.log(`  create: ${counts.create}`);
  console.log(`  update: ${counts.update}`);
  console.log(`  unchanged: ${counts.unchanged}`);
  console.log(`  conflict: ${counts.conflict}`);
  console.log(`Config: ${plan.config.action}`);
  console.log(`default_agent: ${plan.config.defaultAgent ?? "unchanged"}`);
  console.log(`Warnings: ${plan.warnings.length === 0 ? "none" : plan.warnings.join("; ")}`);

  if (result !== undefined) {
    console.log(`Written: ${result.writtenFiles.length}`);
    console.log(`Backups: ${result.backedUpFiles.length === 0 ? "none" : result.backedUpFiles.join(", ")}`);
    if (result.backupRoot !== undefined) {
      console.log(`Backup root: ${result.backupRoot}`);
    }
  } else {
    console.log("Backups: not applied in dry-run");
  }

  console.log(`Next steps: ${plan.mode === "dry-run" ? "rerun with --write to apply" : "review installed OpenCode assets"}`);
}

function assertPlanCanProceed(plan: DeploymentPlan): void {
  const conflicts: string[] = plan.assets
    .filter((asset) => asset.action === "conflict")
    .map((asset) => asset.relativePath);

  if (plan.config.action === "conflict") {
    conflicts.push("opencode.json");
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Deployment plan has conflicts: ${conflicts.join(", ")}. Review these target files before using --force; --force is only safe when overwriting them is intended.`,
    );
  }
}

function countAssetActions(actions: AssetAction[]): Record<AssetAction, number> {
  return actions.reduce<Record<AssetAction, number>>(
    (counts, action) => ({ ...counts, [action]: counts[action] + 1 }),
    { create: 0, update: 0, unchanged: 0, conflict: 0 },
  );
}

await main();
