import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("GitHub bootstrap installer", () => {
  test("Node installer prints one-command usage", async () => {
    const result = await runNodeInstaller(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: node install.mjs <target-project>");
    expect(result.stdout).toContain("--write");
    expect(result.stdout).toContain("--set-default-agent");
  });

  test("Node installer requires a target project", async () => {
    const result = await runNodeInstaller([]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing target project path");
  });

  test("Shell installer delegates to the raw Node installer", async () => {
    const script = await readFile(join(process.cwd(), "install.sh"), "utf8");

    expect(script).toContain("Automated-novel-producer-release/main/install.mjs");
    expect(script).toContain("node");
  });
});

async function runNodeInstaller(args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["install.mjs", ...args], {
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
