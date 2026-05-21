# Branch Prompt Shell Design

## Goal

Each novel production branch must own an editable copy of the default writing prompt shell. The root-level `prompt settings/` directory remains the default template. Branch creation clones that directory into the branch workspace, intake and planning update only the branch-local clone, and drafting reads the active branch prompt when building the writing prompt.

## Current State

- Branch workspaces live under `.novel-production/branches/<branchId>/`.
- `createNovelBranch()` initializes branch-local JSON state and activates the new branch.
- `captureRequirements()` saves intake data to `requirements.json`.
- `createProductionPlan()` saves `story-bible.json`, `plan.json`, and `plot-units.json`.
- `buildPromptSnapshot()` and `renderProductionPrompt()` assemble drafting prompts from structured JSON state.
- `prompt settings/novel_ai_language_prompt_v1_3.md` exists at the project root but is not used by the production pipeline.

## Chosen Approach

Preserve the folder name exactly. Creating branch `branch02` clones:

```text
prompt settings/
```

into:

```text
.novel-production/branches/branch02/prompt settings/
```

The primary prompt file is initially:

```text
prompt settings/novel_ai_language_prompt_v1_3.md
```

This keeps the user's template structure intact and leaves room for future prompt-support files in the same directory.

## Data Model And Paths

Extend `NovelProductionPaths` with branch/workspace-relative prompt paths:

- `promptSettingsDir`: `<workspace>/prompt settings`
- `promptFile`: `<workspace>/prompt settings/novel_ai_language_prompt_v1_3.md`

Extend `NovelProductionRepository` with text helpers:

- `readPrompt(): Promise<string>`
- `writePrompt(text: string): Promise<void>`

These helpers operate on whatever workspace paths the repository was created with, so root repositories read root prompt files and branch repositories read branch-local prompt clones.

## Branch Creation

After `initializeNovelProductionWorkspace(branchRoot, ".")`, `createNovelBranch()` copies the project root `prompt settings/` directory into `branchRoot/prompt settings/`.

If the root prompt shell is missing, branch creation fails with a clear error. The prompt shell is part of the branch contract, so silently creating a prompt-less branch would lead to confusing drafting behavior later.

Existing branch isolation remains unchanged: root drafts and branch drafts are still separate, and branch creation still does not migrate root drafts.

## Intake Prompt Update

After `captureRequirements()` saves `requirements.json`, it updates only the repository prompt file. The update should replace a managed block rather than rewriting the whole prompt:

```text
<!-- novel-intake:start -->
...generated intake summary...
<!-- novel-intake:end -->
```

The generated intake summary should include title, original brief, genre, target audience, style, point of view, length target, must-include items, must-avoid items, reference notes, and quality bar.

If the managed block is absent, append it to the end of the prompt file.

## Planning Prompt Update

After `createProductionPlan()` saves story bible, plan, and plot units, it updates a separate managed block in the same branch prompt file:

```text
<!-- novel-plan:start -->
...generated planning summary...
<!-- novel-plan:end -->
```

The generated planning summary should include logline, premise, world, structure, major characters, continuity rules, and ordered plot units.

If the managed block is absent, append it to the end of the prompt file.

## Drafting Prompt Use

`buildPromptSnapshot()` should include the current repository prompt text in the snapshot, for example as `branchPrompt: string`.

`renderProductionPrompt()` should place the branch prompt before the existing structured sections. The final order is:

1. Branch-local prompt shell text.
2. Structured requirements.
3. Story bible and characters.
4. Production plan.
5. Previous approved units.
6. Current unit details.
7. Optional repair task.

Generation run metadata should store the prompt text in the prompt snapshot so each draft remains auditable against the exact branch prompt used at production time.

## Command And Agent Instructions

Update the managed command files so agents follow the new contract:

- `novel-intake`: update active branch prompt clone after capturing requirements.
- `novel-plan`: update active branch prompt clone after planning.
- `novel-produce`: use active branch prompt clone when building the prompt snapshot.

Each command should explicitly say not to modify the root `prompt settings/` template during branch-specific work.

## Tests

Add or update tests for:

- Branch creation copies `prompt settings/` into the branch workspace.
- Branch creation fails clearly if the root prompt shell is missing.
- Intake updates only the branch-local prompt managed intake block.
- Planning updates only the branch-local prompt managed plan block.
- Production prompt includes branch-local prompt content.
- Separate branches can diverge in prompt content without affecting each other.

## Non-Goals

- Do not migrate existing drafts into new branches.
- Do not edit the root prompt template during intake, planning, production, or repair.
- Do not introduce multiple prompt template selection yet.
- Do not add fallback prompt behavior for missing branch prompts beyond clear errors.
