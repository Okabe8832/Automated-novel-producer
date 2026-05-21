import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const agentFiles = [
  "novel-producer",
  "novel-planner",
  "novel-drafter",
  "novel-reviewer",
  "novel-repairer",
  "novel-continuity",
  "novel-exporter",
];

const commandFiles = [
  "novel-init",
  "novel-intake",
  "novel-plan",
  "novel-produce",
  "novel-review",
  "novel-repair",
  "novel-export",
  "novel-status",
  "novel-read",
  "novel-branch",
  "novel-branch-create",
  "novel-branch-status",
  "novel-auto",
  "novel-autorun",
  "novel-inquiry",
];

const managedByMarker = "managed-by: opencode-novel-production-line";
const managedByHtmlComment = `<!-- ${managedByMarker} -->`;

function parseFrontmatter(content: string) {
  const lines = content.split("\n");
  expect(lines[0]).toBe("---");

  const closingIndex = lines.indexOf("---", 1);
  expect(closingIndex).toBeGreaterThan(0);

  return {
    frontmatter: lines.slice(1, closingIndex).join("\n"),
    lineAfterFrontmatter: lines[closingIndex + 1],
  };
}

describe("OpenCode novel production assets", () => {
  test.each(agentFiles)("agent %s exists with description", async (name) => {
    const content = await readFile(`.opencode/agents/${name}.md`, "utf8");
    const { frontmatter, lineAfterFrontmatter } = parseFrontmatter(content);

    expect(frontmatter).not.toContain(managedByMarker);
    expect(lineAfterFrontmatter).toBe(managedByHtmlComment);
    expect(frontmatter).toContain("description:");
    if (name === "novel-producer") {
      expect(frontmatter).toContain("mode:");
    }
    expect(content).toContain("novel production");
  });

  test.each(commandFiles)("command %s routes through novel-producer", async (name) => {
    const content = await readFile(`.opencode/commands/${name}.md`, "utf8");
    const { frontmatter, lineAfterFrontmatter } = parseFrontmatter(content);

    expect(frontmatter).not.toContain(managedByMarker);
    expect(lineAfterFrontmatter).toBe(managedByHtmlComment);
    expect(frontmatter).toContain("description:");
    expect(frontmatter).toContain("agent: novel-producer");
    expect(content).toContain("novel-producer");
    expect(content).toContain(".novel-production");
  });

  test("plugin includes managed marker", async () => {
    const content = await readFile(".opencode/plugins/novel-production.ts", "utf8");
    expect(content.split("\n")[0]).toBe(`// ${managedByMarker}`);
  });

  test("novel-read command documents active branch and plugin behavior", async () => {
    const content = await readFile(".opencode/commands/novel-read.md", "utf8");

    expect(content).toContain("active branch");
    expect(content).toContain("novel_read");
    expect(content).toContain("unitId");
    expect(content).toContain("--offset");
    expect(content).toContain("--limit");
    expect(content).toContain(".novel-production/branches/");
    expect(content).toContain("active-branch.json");
    expect(content).toContain("content.slice");
    expect(content).not.toContain("branchId");
    expect(content).not.toContain("Continue with");
  });

  test("novel-auto command documents quality loop and manual preconditions", async () => {
    const content = await readFile(".opencode/commands/novel-auto.md", "utf8");

    expect(content).toContain("manual");
    expect(content).toContain("/novel-intake");
    expect(content).toContain("/novel-plan");
    expect(content).toContain("review");
    expect(content).toContain("repair");
    expect(content).toContain("3");
    expect(content).toContain("active branch");
    expect(content).not.toContain("novel_auto");
  });

  test("novel-autorun command documents the automated production flow", async () => {
    const content = await readFile(".opencode/commands/novel-autorun.md", "utf8");

    expect(content).toContain("autorun mode");
    expect(content).toContain("/novel-init");
    expect(content).toContain("/novel-intake");
    expect(content).toContain("/novel-plan");
    expect(content).toContain("/novel-auto");
    expect(content).toContain("production blueprint");
    expect(content).toContain("final confirmation");
    expect(content).toContain("active branch");
    expect(content).toContain("review");
    expect(content).toContain("repair");
    expect(content).toContain("export");
    expect(content).not.toContain("novel_autorun");
  });

  test("novel-plan assets require major character instantiation", async () => {
    const command = await readFile(".opencode/commands/novel-plan.md", "utf8");
    const planner = await readFile(".opencode/agents/novel-planner.md", "utf8");

    for (const content of [command, planner]) {
      expect(content).toContain("major characters");
      expect(content).toContain("story-bible.json.characters");
      expect(content).toContain("characterIds");
      expect(content).toContain("Do not leave placeholder characters");
    }
  });

  test("branch commands document active branch behavior", async () => {
    const branchContent = await readFile(".opencode/commands/novel-branch.md", "utf8");
    const createContent = await readFile(".opencode/commands/novel-branch-create.md", "utf8");

    for (const content of [branchContent, createContent]) {
      expect(content).toContain("active branch");
      expect(content).toContain("branches.json");
      expect(content).toContain("active-branch.json");
      expect(content).toContain("branch workspace");
      expect(content).toContain("branches/");
    }
    expect(branchContent).toContain("novel_branch_switch");
    expect(createContent).toContain("novel_branch_create");
    expect(createContent).toContain("Set .novel-production/active-branch.json to the new branch.");
  });

  test("novel-branch-status command documents low-agent direct status behavior", async () => {
    const content = await readFile(".opencode/commands/novel-branch-status.md", "utf8");

    expect(content).toContain("novel_branch_status");
    expect(content).toContain("active branch");
    expect(content).toContain("file counts");
    expect(content).toContain("timeline");
    expect(content).toContain("plot-units.json");
    expect(content).toContain("direct plugin");
    expect(content).toContain("Do not read draft or review contents");
    expect(content).toContain("Do not ask novel-producer to reason");
  });

  test("novel-inquiry command documents no-op question-only behavior", async () => {
    const content = await readFile(".opencode/commands/novel-inquiry.md", "utf8");

    expect(content).toContain("question");
    expect(content).toContain("read-only");
    expect(content).toContain("Do not modify");
    expect(content).toContain(".novel-production");
    expect(content).toContain("Do not continue production");
    expect(content).toContain("Do not run /novel-auto");
  });
});
