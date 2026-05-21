#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const defaultRepoUrl = "https://github.com/Okabe8832/Automated-novel-producer-release.git";

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (options.targetRoot === undefined) {
    console.error("Missing target project path");
    printUsage();
    process.exitCode = 1;
    return;
  }

  const checkoutRoot = await mkdtemp(join(tmpdir(), "opencode-novel-installer-"));

  try {
    run("git", ["clone", "--depth", "1", options.repoUrl, checkoutRoot], process.cwd());
    run("npm", ["install"], checkoutRoot);
    run(
      "npm",
      [
        "run",
        "install:opencode-novel",
        "--",
        "--target",
        resolve(options.targetRoot),
        options.write ? "--write" : "--dry-run",
        ...options.forwardedFlags,
      ],
      checkoutRoot,
    );
  } finally {
    await rm(checkoutRoot, { recursive: true, force: true });
  }
}

function parseArgs(args) {
  let targetRoot;
  let write = false;
  let repoUrl = process.env.OPENCODE_NOVEL_REPO_URL ?? defaultRepoUrl;
  const forwardedFlags = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true, repoUrl, forwardedFlags, write };
    }

    if (arg === "--repo-url") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("Missing value for --repo-url");
      }
      repoUrl = value;
      index += 1;
      continue;
    }

    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--dry-run") {
      write = false;
      continue;
    }

    if (arg === "--force" || arg === "--set-default-agent" || arg === "--keep-default-agent") {
      forwardedFlags.push(arg);
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (targetRoot !== undefined) {
      throw new Error(`Unexpected extra target path: ${arg}`);
    }

    targetRoot = arg;
  }

  return { help: false, repoUrl, forwardedFlags, targetRoot, write };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function printUsage() {
  console.log(`Usage: node install.mjs <target-project> [options]

Installs the OpenCode novel production workflow into another project.

Options:
  --dry-run              Preview deployment without writing files (default)
  --write                Apply deployment after review
  --force                Overwrite conflicting managed assets
  --set-default-agent    Set target default_agent to novel-producer
  --keep-default-agent   Preserve target default_agent exactly
  --repo-url <url>       Override source repository URL
  -h, --help             Show this help
`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
