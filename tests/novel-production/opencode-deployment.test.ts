import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("OpenCode deployment contract", () => {
  test("project config opens with the novel producer as the default agent", async () => {
    const config = JSON.parse(await readFile("opencode.json", "utf8")) as Record<string, unknown>;

    expect(config.default_agent).toBe("novel-producer");
  });

  test("deployment checklist explains how OpenCode discovers and runs the production line", async () => {
    const checklist = await readFile("docs/opencode-deployment-checklist.md", "utf8");

    expect(checklist).toContain("open this project root in OpenCode");
    expect(checklist).toContain("/novel-init");
    expect(checklist).toContain("/novel-produce");
    expect(checklist).toContain("/novel-export");
    expect(checklist).toContain("plugin helper does not register agents or commands");
    expect(checklist).toContain("npm run install:opencode-novel -- --target /path/to/target-project --dry-run");
    expect(checklist).toContain("npm run install:opencode-novel -- --target /path/to/target-project --write");
    expect(checklist).toContain("npm run install:opencode-novel -- --target /path/to/target-project --write --force");
    expect(checklist).toContain(".opencode/novel-production-backups/");
    expect(checklist).toContain("--set-default-agent");
    expect(checklist).toContain("--keep-default-agent");
  });
});
