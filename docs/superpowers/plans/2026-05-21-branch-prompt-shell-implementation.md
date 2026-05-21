# Branch Prompt Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add branch-local prompt shell cloning, intake/plan prompt updates, and drafting-time use of the active branch prompt.

**Architecture:** Keep prompt shell files inside each workspace using the existing repository/path abstraction. Branch creation clones the root `prompt settings/` directory into the new branch workspace. Intake and planning replace managed blocks in the branch prompt file, and prompt rendering prepends the branch prompt text to the existing structured production prompt.

**Tech Stack:** TypeScript, Node.js `fs/promises`, Vitest, existing `src/novel-production/*` modules.

---

## File Structure

- Modify `src/novel-production/workspace.ts` to add prompt paths and copy helpers.
- Modify `src/novel-production/repository.ts` to expose `readPrompt()` and `writePrompt()`.
- Modify `src/novel-production/branches.ts` to clone root `prompt settings/` during branch creation.
- Create `src/novel-production/prompt-settings.ts` for managed block replacement and summary rendering.
- Modify `src/novel-production/intake.ts` to update the prompt intake block after saving requirements.
- Modify `src/novel-production/planning.ts` to update the prompt plan block after saving planning state.
- Modify `src/novel-production/prompt.ts` to include prompt text in snapshots and prepend it during render.
- Modify `src/novel-production/schema.ts` so generation run prompt snapshots accept/store the prompt text.
- Modify `.opencode/commands/novel-intake.md`, `.opencode/commands/novel-plan.md`, and `.opencode/commands/novel-produce.md` to document the new behavior.
- Add tests to `tests/novel-production/branches.test.ts`, `tests/novel-production/intake-planning.test.ts`, and `tests/novel-production/prompt-generation.test.ts`.

---

### Task 1: Prompt Paths And Repository Helpers

**Files:**
- Modify: `src/novel-production/workspace.ts`
- Modify: `src/novel-production/repository.ts`
- Test: `tests/novel-production/workspace.test.ts`

- [ ] **Step 1: Write failing path/repository tests**

Add assertions that `workspacePaths(root)` exposes:

```ts
expect(paths.promptSettingsDir).toBe(join(root, ".novel-production", "prompt settings"));
expect(paths.promptFile).toBe(join(root, ".novel-production", "prompt settings", "novel_ai_language_prompt_v1_3.md"));
```

Add a repository test that writes and reads prompt text through `createNovelProductionRepositoryFromPaths(workspacePaths(root, "."))`.

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/novel-production/workspace.test.ts`

Expected: FAIL because prompt paths and repository prompt helpers do not exist.

- [ ] **Step 3: Add paths and repository helpers**

In `NovelProductionPaths`, add:

```ts
promptSettingsDir: string;
promptFile: string;
```

In `workspacePaths()`, set:

```ts
promptSettingsDir: join(workspace, "prompt settings"),
promptFile: join(workspace, "prompt settings", "novel_ai_language_prompt_v1_3.md"),
```

In `NovelProductionRepository`, add:

```ts
readPrompt(): Promise<string>;
writePrompt(text: string): Promise<void>;
```

Implement using `readTextFile(paths.promptFile)` and `writeTextFile(paths.promptFile, text)`.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/novel-production/workspace.test.ts`

Expected: PASS.

---

### Task 2: Branch Prompt Shell Cloning

**Files:**
- Modify: `src/novel-production/workspace.ts`
- Modify: `src/novel-production/branches.ts`
- Test: `tests/novel-production/branches.test.ts`

- [ ] **Step 1: Write failing branch cloning tests**

Add tests that create root `prompt settings/novel_ai_language_prompt_v1_3.md`, create a branch, and assert the branch copy exists with the same content.

Add a second test that calls `createNovelBranch()` without a root `prompt settings/` directory and expects a clear error containing `prompt settings`.

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/novel-production/branches.test.ts`

Expected: FAIL because branch creation does not copy prompt settings or validate the root prompt shell.

- [ ] **Step 3: Add copy helper**

In `workspace.ts`, export a helper:

```ts
export async function copyPromptSettingsIntoWorkspace(projectRoot: string, destinationWorkspace: string): Promise<void> {
  const sourceDir = join(projectRoot, "prompt settings");
  const destinationDir = join(destinationWorkspace, "prompt settings");
  await cp(sourceDir, destinationDir, { recursive: true, force: false, errorOnExist: false });
}
```

Use `node:fs/promises` `cp`. If `cp` throws `ENOENT`, rethrow `new Error("Missing prompt settings directory at project root: prompt settings")`.

- [ ] **Step 4: Call helper during branch creation**

In `createNovelBranch()`, after branch workspace initialization, call:

```ts
await copyPromptSettingsIntoWorkspace(projectRoot, branchRoot);
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/novel-production/branches.test.ts`

Expected: PASS.

---

### Task 3: Managed Prompt Blocks

**Files:**
- Create: `src/novel-production/prompt-settings.ts`
- Test: `tests/novel-production/intake-planning.test.ts`

- [ ] **Step 1: Write failing tests for managed block replacement**

Add tests that call exported helpers directly or through intake/planning once Tasks 4-5 are ready. At minimum, cover:

```ts
expect(replaceManagedBlock("base", "novel-intake", "content")).toContain("<!-- novel-intake:start -->");
expect(replaceManagedBlock(existingBlock, "novel-intake", "new content")).not.toContain("old content");
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement prompt-settings helpers**

Create:

```ts
export type ManagedPromptBlock = "novel-intake" | "novel-plan";

export function replaceManagedBlock(prompt: string, block: ManagedPromptBlock, content: string): string {
  const start = `<!-- ${block}:start -->`;
  const end = `<!-- ${block}:end -->`;
  const nextBlock = `${start}\n${content.trim()}\n${end}`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (pattern.test(prompt)) {
    return `${prompt.replace(pattern, nextBlock).trimEnd()}\n`;
  }
  return `${prompt.trimEnd()}\n\n${nextBlock}\n`;
}
```

Also add `renderRequirementsPromptBlock(requirements)` and `renderPlanPromptBlock(storyBible, plan, units)`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: PASS for helper-level tests.

---

### Task 4: Intake Updates Branch Prompt Clone

**Files:**
- Modify: `src/novel-production/intake.ts`
- Test: `tests/novel-production/intake-planning.test.ts`

- [ ] **Step 1: Write failing intake integration test**

Set up a branch with a branch prompt file, call `captureRequirements(branchRepo, input)`, then assert branch prompt contains `<!-- novel-intake:start -->`, title, genre, style, point of view, must-include, and must-avoid values.

Assert the root `prompt settings/novel_ai_language_prompt_v1_3.md` remains unchanged.

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: FAIL because intake does not update prompt text.

- [ ] **Step 3: Update intake**

After `repository.saveRequirements(requirements)`, read the prompt, replace the `novel-intake` block with `renderRequirementsPromptBlock(requirements)`, and write it back.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: PASS.

---

### Task 5: Planning Updates Branch Prompt Clone

**Files:**
- Modify: `src/novel-production/planning.ts`
- Test: `tests/novel-production/intake-planning.test.ts`

- [ ] **Step 1: Write failing planning integration test**

After branch setup and `createProductionPlan()`, assert branch prompt contains `<!-- novel-plan:start -->`, logline, premise, world, major character names, and ordered unit summaries.

Assert the root prompt template remains unchanged.

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: FAIL because planning does not update prompt text.

- [ ] **Step 3: Update planning**

After saving story bible, plan, and units, read the prompt, replace the `novel-plan` block with `renderPlanPromptBlock(storyBible, plan, units)`, and write it back.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/novel-production/intake-planning.test.ts`

Expected: PASS.

---

### Task 6: Drafting Uses Branch Prompt

**Files:**
- Modify: `src/novel-production/prompt.ts`
- Modify: `src/novel-production/schema.ts`
- Test: `tests/novel-production/prompt-generation.test.ts`

- [ ] **Step 1: Write failing prompt generation tests**

Add a test that writes unique text into a branch prompt, builds a prompt snapshot, renders the prompt, and expects both `snapshot.branchPrompt` and rendered prompt to contain that unique text.

Add a production test that verifies the generator receives the branch prompt text.

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/novel-production/prompt-generation.test.ts`

Expected: FAIL because snapshots do not include branch prompt text.

- [ ] **Step 3: Extend prompt snapshot**

In `PromptSnapshot`, add:

```ts
branchPrompt: string;
```

In `buildPromptSnapshot()`, load `repository.readPrompt()` and return it.

In `renderProductionPrompt()`, prepend `snapshot.branchPrompt.trim()` before the existing structured prompt sections.

In `schema.ts`, update `GenerationRunRecord.promptSnapshot` parsing to allow and require `branchPrompt`.

- [ ] **Step 4: Run prompt tests**

Run: `npm test -- tests/novel-production/prompt-generation.test.ts`

Expected: PASS.

---

### Task 7: Command Contracts

**Files:**
- Modify: `.opencode/commands/novel-intake.md`
- Modify: `.opencode/commands/novel-plan.md`
- Modify: `.opencode/commands/novel-produce.md`
- Test: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing asset assertions if needed**

If asset tests check command text, add assertions that command files mention branch-local prompt clones and not modifying root `prompt settings`.

- [ ] **Step 2: Update command files**

Add concise requirements:

- `novel-intake`: update active branch `prompt settings` clone after requirements are saved.
- `novel-plan`: update active branch `prompt settings` clone after plan artifacts are saved.
- `novel-produce`: include active branch `prompt settings` clone in the prompt snapshot.
- All three: do not modify root `prompt settings` during branch-scoped work.

- [ ] **Step 3: Run asset tests**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`

Expected: PASS.

---

### Task 8: Full Verification

**Files:**
- All modified files from Tasks 1-7.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
npm test -- tests/novel-production/branches.test.ts tests/novel-production/intake-planning.test.ts tests/novel-production/prompt-generation.test.ts tests/novel-production/workspace.test.ts tests/novel-production/opencode-assets.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Manual QA through a temp workspace**

Use a temporary project root with `prompt settings/novel_ai_language_prompt_v1_3.md`, create two branches, update one branch through intake/plan, and confirm the two branch prompt files diverge while the root prompt remains unchanged.

Expected: branch-local prompt isolation is visible on disk.
