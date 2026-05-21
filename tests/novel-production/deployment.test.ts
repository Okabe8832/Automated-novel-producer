import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { applyDeploymentPlan, buildDeploymentPlan, managedByMarker, pathExists } from "@/novel-production/deployment";

const sourceAssetPaths = [
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

const managedMarker = managedByMarker;

describe("OpenCode novel deployment planner", () => {
  let sourceRoot: string;
  let targetRoot: string;

  beforeEach(async () => {
    sourceRoot = await mkdtemp(join(tmpdir(), "novel-deploy-source-"));
    targetRoot = await mkdtemp(join(tmpdir(), "novel-deploy-target-"));
    await seedSourceAssets(sourceRoot);
  });

  afterEach(async () => {
    await rm(sourceRoot, { recursive: true, force: true });
    await rm(targetRoot, { recursive: true, force: true });
  });

  test("plans asset creation for a fresh target", async () => {
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(plan.assets.filter((asset) => asset.action === "create")).toHaveLength(24);
    expect(plan.assets.filter((asset) => asset.action === "conflict")).toHaveLength(0);
    expect(plan.config.action).toBe("create");
    expect(plan.config.defaultAgent).toBe("novel-producer");
  });

  test("does not create target directories while planning write mode", async () => {
    await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" });

    await expect(access(join(targetRoot, ".opencode"))).rejects.toThrow();
    await expect(access(join(targetRoot, "opencode.json"))).rejects.toThrow();
  });

  test("rejects a dry-run plan without writing files", async () => {
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    await expect(applyDeploymentPlan(plan)).rejects.toThrow("Cannot apply a dry-run deployment plan");

    await expect(pathExists(join(targetRoot, ".opencode/plugins/novel-production.ts"))).resolves.toBe(false);
    await expect(pathExists(join(targetRoot, "opencode.json"))).resolves.toBe(false);
  });

  test("rejects a conflicting asset before writing new files", async () => {
    await writeTargetAsset(".opencode/agents/novel-producer.md", "custom local content");
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" });

    await expect(applyDeploymentPlan(plan)).rejects.toThrow(
      "Cannot apply deployment plan with conflicting asset: .opencode/agents/novel-producer.md",
    );

    await expect(pathExists(join(targetRoot, ".opencode/plugins/novel-production.ts"))).resolves.toBe(false);
    await expect(pathExists(join(targetRoot, "opencode.json"))).resolves.toBe(false);
  });

  test("pathExists returns false for a missing path", async () => {
    await expect(pathExists(join(targetRoot, ".opencode/missing.md"))).resolves.toBe(false);
  });

  test("writes planned assets and config", async () => {
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" });

    const result = await applyDeploymentPlan(plan);

    await expect(pathExists(join(targetRoot, ".opencode/plugins/novel-production.ts"))).resolves.toBe(true);
    await expect(readFile(join(targetRoot, ".opencode/plugins/novel-production.ts"), "utf8")).resolves.toBe(
      await readSourceAsset(".opencode/plugins/novel-production.ts"),
    );
    await expect(readFile(join(targetRoot, "opencode.json"), "utf8")).resolves.toContain(
      '"default_agent": "novel-producer"',
    );
    expect(result.writtenFiles).toContain(".opencode/plugins/novel-production.ts");
    expect(result.writtenFiles).toContain(".opencode/package.json");
    expect(result.writtenFiles).toContain("opencode.json");
    expect(result.backedUpFiles).toEqual([]);
    expect(result.backupRoot).toBeUndefined();
  });

  test("backs up managed files before overwriting", async () => {
    const relativePath = ".opencode/commands/novel-status.md";
    const oldContent = `<!-- ${managedByMarker} -->\nold content`;
    await writeTargetAsset(relativePath, oldContent);
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" });

    const result = await applyDeploymentPlan(plan);

    expect(result.backedUpFiles).toEqual([relativePath]);
    expect(result.backupRoot).toBeDefined();
    expect(result.writtenFiles).toContain(relativePath);
    const backupRoot = result.backupRoot;
    expect(backupRoot).toBeDefined();
    await expect(readFile(join(targetRoot, backupRoot ?? "", relativePath), "utf8")).resolves.toBe(oldContent);
    await expect(readFile(join(targetRoot, relativePath), "utf8")).resolves.toBe(await readSourceAsset(relativePath));
  });

  test("backs up existing opencode config before merge writes", async () => {
    const oldConfig = `${JSON.stringify({ theme: "system" }, null, 2)}\n`;
    await writeFile(join(targetRoot, "opencode.json"), oldConfig);
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" });

    const result = await applyDeploymentPlan(plan);

    expect(result.backedUpFiles).toEqual(["opencode.json"]);
    expect(result.backupRoot).toBeDefined();
    expect(result.writtenFiles).toContain("opencode.json");
    const backupRoot = result.backupRoot;
    expect(backupRoot).toBeDefined();
    await expect(readFile(join(targetRoot, backupRoot ?? "", "opencode.json"), "utf8")).resolves.toBe(oldConfig);
    await expect(readFile(join(targetRoot, "opencode.json"), "utf8")).resolves.toContain(
      '"default_agent": "novel-producer"',
    );
  });

  test("rejects a config conflict before writing files", async () => {
    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" });
    const conflictPlan = {
      ...plan,
      config: {
        ...plan.config,
        action: "conflict" as const,
      },
    };

    await expect(applyDeploymentPlan(conflictPlan)).rejects.toThrow(
      "Cannot apply deployment plan with conflicting opencode.json",
    );

    await expect(pathExists(join(targetRoot, ".opencode/plugins/novel-production.ts"))).resolves.toBe(false);
    await expect(pathExists(join(targetRoot, "opencode.json"))).resolves.toBe(false);
  });

  test("is idempotent after a successful install", async () => {
    const writePlan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "write" });
    await applyDeploymentPlan(writePlan);

    const secondPlan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(secondPlan.assets.every((asset) => asset.action === "unchanged")).toBe(true);
    expect(secondPlan.assets.filter((asset) => asset.action === "conflict")).toHaveLength(0);
    expect(secondPlan.config.action).toBe("unchanged");
  });

  test("plans unchanged managed assets", async () => {
    await writeTargetAsset(".opencode/agents/novel-producer.md", await readSourceAsset(".opencode/agents/novel-producer.md"));

    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(actionFor(plan, ".opencode/agents/novel-producer.md")).toBe("unchanged");
  });

  test("plans updates for changed managed target assets", async () => {
    await writeTargetAsset(".opencode/agents/novel-producer.md", `${managedMarker}\nold content\n`);

    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(actionFor(plan, ".opencode/agents/novel-producer.md")).toBe("update");
  });

  test("plans conflicts for changed unmarked target assets", async () => {
    await writeTargetAsset(".opencode/agents/novel-producer.md", "custom content\n");

    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(actionFor(plan, ".opencode/agents/novel-producer.md")).toBe("conflict");
  });

  test("plans forced updates for changed unmarked target assets", async () => {
    await writeTargetAsset(".opencode/agents/novel-producer.md", "custom content\n");

    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run", force: true });

    expect(actionFor(plan, ".opencode/agents/novel-producer.md")).toBe("update");
  });

  test("preserves unrelated opencode config keys", async () => {
    await writeFile(join(targetRoot, "opencode.json"), JSON.stringify({ theme: "system" }, null, 2));

    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(plan.config.action).toBe("merge");
    expect(plan.config.next).toMatchObject({ theme: "system", default_agent: "novel-producer" });
  });

  test("keeps an existing default agent unless explicitly requested", async () => {
    await writeFile(join(targetRoot, "opencode.json"), JSON.stringify({ default_agent: "build" }, null, 2));

    const defaultPlan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });
    const setPlan = await buildDeploymentPlan({
      sourceRoot,
      targetRoot,
      mode: "dry-run",
      defaultAgentPolicy: "set",
    });

    expect(defaultPlan.config.action).toBe("unchanged");
    expect(defaultPlan.config.defaultAgent).toBe("build");
    expect(defaultPlan.warnings).toContain(
      "Target already has default_agent build; rerun with --set-default-agent to replace it.",
    );
    expect(setPlan.config.action).toBe("merge");
    expect(setPlan.config.defaultAgent).toBe("novel-producer");
  });

  test("keeps target default agent when keep policy is requested", async () => {
    await writeFile(
      join(targetRoot, "opencode.json"),
      JSON.stringify({ default_agent: "build", theme: "system" }, null, 2),
    );

    const plan = await buildDeploymentPlan({
      sourceRoot,
      targetRoot,
      mode: "dry-run",
      defaultAgentPolicy: "keep",
    });

    expect(plan.config.action).toBe("unchanged");
    expect(plan.config.defaultAgent).toBe("build");
    expect(plan.config.next).toMatchObject({ default_agent: "build", theme: "system" });
    expect(plan.warnings).toHaveLength(0);
  });

  test("does not report a default agent for keep policy when none exists", async () => {
    await writeFile(join(targetRoot, "opencode.json"), JSON.stringify({ theme: "system" }, null, 2));

    const plan = await buildDeploymentPlan({
      sourceRoot,
      targetRoot,
      mode: "dry-run",
      defaultAgentPolicy: "keep",
    });

    expect(plan.config.action).toBe("unchanged");
    expect(plan.config.defaultAgent).toBeUndefined();
    expect(plan.config.next).toMatchObject({ theme: "system" });
    expect(plan.config.next.default_agent).toBeUndefined();
  });

  test("reports unmarked changed target files as conflicts", async () => {
    await writeTargetAsset(".opencode/agents/novel-producer.md", "custom local content");

    const plan = await buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" });

    expect(actionFor(plan, ".opencode/agents/novel-producer.md")).toBe("conflict");
  });

  test("fails before writing when a required source asset is missing", async () => {
    await rm(join(sourceRoot, ".opencode/commands/novel-status.md"));

    await expect(buildDeploymentPlan({ sourceRoot, targetRoot, mode: "dry-run" })).rejects.toThrow(
      "Missing required source asset: .opencode/commands/novel-status.md",
    );
  });

  test("rejects source and target pointing to the same project", async () => {
    await expect(buildDeploymentPlan({ sourceRoot, targetRoot: sourceRoot, mode: "dry-run" })).rejects.toThrow(
      "Target project must be different from the source project",
    );
  });

  test("CLI reports a dry-run deployment plan", async () => {
    const result = await runInstallerCli(["--target", targetRoot, "--dry-run"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("OpenCode Novel Production Deployment");
    expect(result.stdout).toContain("Mode: dry-run");
  });

  test("CLI exits with a clear error when dry-run finds conflicts", async () => {
    await writeTargetAsset(".opencode/agents/novel-producer.md", "custom local content");

    const result = await runInstallerCli(["--target", targetRoot, "--dry-run"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error: Deployment plan has conflicts");
    expect(result.stderr).toContain(".opencode/agents/novel-producer.md");
  });

  async function readSourceAsset(relativePath: (typeof sourceAssetPaths)[number]): Promise<string> {
    return readFile(join(sourceRoot, relativePath), "utf8");
  }

  async function writeTargetAsset(relativePath: (typeof sourceAssetPaths)[number], content: string): Promise<void> {
    const absolutePath = join(targetRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
});

function actionFor(
  plan: Awaited<ReturnType<typeof buildDeploymentPlan>>,
  relativePath: (typeof sourceAssetPaths)[number],
): string | undefined {
  return plan.assets.find((asset) => asset.relativePath === relativePath)?.action;
}

async function runInstallerCli(args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const tsxCliPath = join(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  await stat(tsxCliPath);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCliPath, "scripts/install-opencode-novel-production.ts", ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function seedSourceAssets(sourceRoot: string): Promise<void> {
  await Promise.all(
    sourceAssetPaths.map(async (relativePath) => {
      const absolutePath = join(sourceRoot, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, `${managedMarker}\n${relativePath}\n`);
    }),
  );
}
