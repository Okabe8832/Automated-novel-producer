# OpenCode Novel Production Line Design

## Go / No-Go

**Conclusion: Conditional Go.**

The project should pivot from a local web story workbench into an OpenCode-native novel production line. The goal is not to build a general material manager or conversational writing companion. The goal is to reliably produce Chinese novel text that follows the user's requirements through a repeatable pipeline: intake, planning, unit production, review, repair, and export.

The condition is OpenCode's extension boundary. OpenCode supports project-local agents, commands, and plugins, but plugins do not currently provide a documented first-class API for registering agents or slash commands directly. The MVP must therefore work through project-local `.opencode/agents`, `.opencode/commands`, `.opencode/plugins`, plus project-local production files. Later plugin packaging may synchronize those assets into a consuming project.

## Product Direction

Build a local single-user novel production line inside OpenCode. The production line converts a writing request into a structured production plan, produces novel prose in ordered units, checks each unit against requirements, repairs failures, and exports the final manuscript.

The product is workflow-first. Conversation is auxiliary and should only clarify missing high-impact inputs. The normal interaction surface is command-driven.

## Confirmed User Decisions

- Stop the local web frontend direction.
- First build an OpenCode built-in/custom agent workflow.
- Later package it for plugin-style reuse.
- Use command/workflow execution as the main experience; use conversation only as support.
- Save production state in project-local files.
- The product is a **novel production line**: its success criterion is smooth generation of novel text according to requirements.

## Core Production Principle

Everything in the system exists to protect output quality. Prototypes, element pools, materials, characters, scenes, timelines, reviews, and repair tasks are not standalone management features in the MVP. They are production supports used to make generated text more controllable, consistent, and repairable.

MVP implementation should prefer a smaller pipeline that produces reliable text over a large library-management system that does not improve generation.

## OpenCode Extension Shape

The MVP should use the documented OpenCode surfaces directly:

```text
.opencode/
  agents/
    novel-producer.md
    novel-planner.md
    novel-drafter.md
    novel-reviewer.md
    novel-repairer.md
    novel-continuity.md
    novel-exporter.md
  commands/
    novel-init.md
    novel-intake.md
    novel-plan.md
    novel-produce.md
    novel-review.md
    novel-repair.md
    novel-export.md
    novel-status.md
  plugins/
    novel-production.ts
```

- `novel-producer.md` defines the main orchestration agent and production rules.
- Subagents provide focused stage expertise while the main agent owns routing, state checks, and final decisions.
- Commands provide repeatable production stages.
- `novel-production.ts` is a helper plugin for supported tool/hook behavior only. It must not rely on undocumented agent-registration behavior.

## Recommended Architecture

Use a file-backed production workspace with four layers.

### 1. Production Workspace

Production state lives in `.novel-production/`.

```text
.novel-production/
  requirements.json
  production-controls.json
  story-bible.json
  prototypes.json
  element-pools.json
  plan.json
  plot-units.json
  materials/
    <material-id>.md
  material-decompositions/
    <material-id>.json
  drafts/
    <unit-id>.md
  reviews/
    <review-id>.json
  repair-tasks/
    <repair-id>.json
  generation-runs/
    <run-id>.json
  exports/
    manuscript.md
  reports/
    production-report.md
```

The workspace is human-readable, git-friendly, and safe for OpenCode agents to inspect. It replaces SQLite as the first-stage store.

### 2. Main-Sub Agent Production Crew

This project should borrow the OMO-style main-sub agent pattern conceptually: one main agent supervises a set of focused subagents. The main agent is the only role that decides stage transitions and writes the production status. Subagents produce scoped deliverables that the main agent validates before accepting.

This is an architecture pattern, not a dependency on private OMO APIs. Implementation must use documented OpenCode agent files, command files, plugin tools, or normal subagent invocation supported by the local runtime.

OMO-style category routing, fallback models, and parallel background work are useful references for later implementation, but the MVP spec only requires the role boundaries and routing contracts. Exact runtime delegation mechanics must be verified during implementation planning.

#### Main Agent: `novel-producer`

`novel-producer` owns production policy and orchestration:

- Keep all generated prose in Chinese unless the requirement explicitly says otherwise.
- Preserve the user's stated requirements over creative invention.
- Generate in ordered units, not as one uncontrolled whole manuscript.
- Do not proceed to the next unit when the current unit is unreviewed or rejected, unless the command explicitly allows selected-unit production.
- Record why every repair exists.
- Treat approved units as locked context by default.
- Route planning, drafting, reviewing, repairing, continuity checking, and exporting to the right subagent.
- Verify subagent output before mutating production state.

#### Subagents

- `novel-planner`: turns requirements into `story-bible.json`, `plan.json`, `plot-units.json`, and optional supporting prototypes/element pools.
- `novel-drafter`: writes Chinese prose for one production unit from the prompt snapshot.
- `novel-reviewer`: evaluates a draft against requirements, unit purpose, continuity, style, and Chinese prose quality.
- `novel-repairer`: applies repair tasks with explicit scope and intensity.
- `novel-continuity`: checks approved prior units, story bible, character behavior, timeline, and unresolved contradictions.
- `novel-exporter`: assembles approved units and writes production reports.

Subagents must not silently edit unrelated production files. Each subagent returns a narrow result for the main agent to accept, reject, or route into repair.

### 3. Production Commands

Commands map to production stages:

- `/novel-init`: create the production workspace.
- `/novel-intake`: capture or update the user's writing requirements.
- `/novel-plan`: convert requirements into a story bible and production plan.
- `/novel-produce`: generate one target production unit.
- `/novel-review`: evaluate one generated unit against requirements and quality gates.
- `/novel-repair`: repair a failed or rejected unit using a repair task.
- `/novel-export`: assemble approved units into a manuscript.
- `/novel-status`: report pipeline progress, blockers, rejected units, and next action.

### 4. Plugin Helper

The plugin helper may expose validated operations such as workspace summary, JSON validation, atomic state writes, and production report generation. The workflow must still be understandable from files and commands even if the helper is temporarily unavailable.

## MVP Trim

### MVP Must Have

- Project-local `.novel-production/` workspace.
- One main OpenCode agent: `novel-producer`.
- Focused subagents for planning, drafting, review, repair, continuity, and export.
- Command files for init, intake, planning, unit production, review, repair, export, and status.
- Requirements intake saved as structured data.
- Production plan generated from requirements.
- Story bible with global setting, characters, scenes, timeline, and continuity rules.
- Ordered plot units with target purpose, constraints, target word count, and status.
- Sequential production by default: produce current unit, review it, then continue.
- Prompt snapshot and generation metadata for every production run.
- Review records with pass/fail decision and issue list.
- Repair tasks with target, scope, intensity, reason, and instructions.
- Export of approved units into a single manuscript Markdown file.
- Tests for workspace initialization, state validation, status transitions, prompt snapshots, review/repair state, and export ordering.

### MVP Optional

- Text material ingestion from local Markdown/TXT files.
- Material decomposition into requirements, prototypes, or element pools.
- Prototype/preset import and export.
- Agent-assisted auto-review checklist.
- Additional specialist subagents beyond the core production crew.
- Local plugin helper for workspace validation.
- Migration from current SQLite demo data.

### Later

- Large reusable preset library.
- Multi-novel project registry.
- Branching plot graphs.
- Emotion, rhythm, and tension curves.
- Automatic reviewer agent with configurable standards.
- Revision impact analysis across downstream units.
- Full distributable plugin package with asset synchronization.

### Not Implemented

- Web UI.
- Next.js runtime.
- Browser e2e flow.
- Account system.
- Multi-user collaboration.
- Cloud deployment.
- Separate API settings UI.
- SQLite as the primary store.
- A complex material-library product unrelated to text production.

## Production Data Contract V1

### `requirements.json`

The production order from the user.

```json
{
  "schemaVersion": 1,
  "id": "requirements-id",
  "title": "小说标题或临时项目名",
  "originalBrief": "用户原始要求",
  "language": "zh-CN",
  "genre": "类型",
  "targetAudience": "目标读者",
  "style": "文风要求",
  "pointOfView": "视角要求",
  "lengthTarget": {
    "totalWords": 80000,
    "unitWords": 2000
  },
  "mustInclude": [],
  "mustAvoid": [],
  "referenceNotes": [],
  "qualityBar": [
    "符合用户要求",
    "中文表达自然",
    "人物行为连续",
    "剧情推进明确"
  ],
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

### `production-controls.json`

How the pipeline should behave.

```json
{
  "schemaVersion": 1,
  "generationMode": "sequential",
  "reviewMode": "manual",
  "approvedUnitPolicy": "locked",
  "defaultRepairIntensity": "medium",
  "allowProduceUnreviewedNextUnit": false,
  "maxPreviousApprovedUnitsInPrompt": 3,
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

Allowed values:

- `generationMode`: `sequential | selected_units`
- `reviewMode`: `manual | agent_assisted | both`
- `approvedUnitPolicy`: `locked | repair_with_confirmation`
- `defaultRepairIntensity`: `light | medium | strong`

### `story-bible.json`

The stable global context used by all production units.

```json
{
  "schemaVersion": 1,
  "premise": "故事前提",
  "world": "世界观",
  "themes": [],
  "characters": [
    {
      "id": "character-id",
      "name": "人物名",
      "role": "主角",
      "appearance": "外貌",
      "personality": "性格",
      "motivation": "动机",
      "arc": "人物弧光"
    }
  ],
  "scenes": [
    {
      "id": "scene-id",
      "name": "场景名",
      "description": "场景说明"
    }
  ],
  "timeline": [
    {
      "id": "time-entry-id",
      "label": "时间标签",
      "description": "时间说明"
    }
  ],
  "continuityRules": [],
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

### `prototypes.json`

Reusable production recipes. These are supporting structures, not the main product.

```json
[
  {
    "id": "prototype-id",
    "type": "plot_unit",
    "name": "背叛节点",
    "description": "可复用的剧情节点原型",
    "defaultElements": [],
    "defaultConstraints": [],
    "promptNotes": [],
    "source": "manual",
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

Allowed `type`: `genre | plot_unit | character | scene | style | custom`.
Allowed `source`: `manual | imported_text | generated`.

### `element-pools.json`

Grouped production ingredients. Pools can be inherited by units or used during planning.

```json
[
  {
    "id": "pool-id",
    "kind": "global",
    "name": "全局创意库",
    "elements": [
      {
        "id": "element-id",
        "category": "world",
        "name": "废弃卫星",
        "description": "深夜向主角发送异常信息"
      }
    ],
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

Allowed `kind`: `genre | plot | character | scene | time | global | unit_local | custom`.

### `plan.json`

The production plan generated from requirements.

```json
{
  "schemaVersion": 1,
  "logline": "一句话故事",
  "structure": "三幕式或其他结构说明",
  "acts": [],
  "productionNotes": [],
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

### `plot-units.json`

The ordered manufacturing units of the manuscript.

```json
[
  {
    "id": "unit-id",
    "orderIndex": 1,
    "title": "生产单元标题",
    "purpose": "这个单元要完成的叙事功能",
    "summary": "情节摘要",
    "targetWords": 2000,
    "status": "ready_to_produce",
    "prototypeIds": [],
    "inheritedElementPoolIds": [],
    "localElements": [],
    "bindings": {
      "characterIds": [],
      "sceneIds": [],
      "timeEntryIds": []
    },
    "constraints": [],
    "draftPath": "drafts/unit-id.md",
    "currentRepairTaskId": "",
    "createdAt": "2026-05-16T00:00:00.000Z",
    "updatedAt": "2026-05-16T00:00:00.000Z"
  }
]
```

Unit status values:

```text
planned -> ready_to_produce -> producing -> drafted -> reviewing -> approved
drafted -> rejected -> repair_requested -> repairing -> drafted
reviewing -> rejected -> repair_requested -> repairing -> drafted
producing -> ready_to_produce
```

The last transition is for generation failure. Failure details belong in `generation-runs/<run-id>.json`.

### `reviews/<review-id>.json`

```json
{
  "id": "review-id",
  "plotUnitId": "unit-id",
  "result": "pass",
  "reviewMode": "manual",
  "checklist": {
    "matchesRequirements": true,
    "matchesUnitPurpose": true,
    "continuityOk": true,
    "characterBehaviorOk": true,
    "styleOk": true,
    "chineseProseOk": true
  },
  "issues": [],
  "decisionNotes": "",
  "createdAt": "2026-05-16T00:00:00.000Z"
}
```

Allowed `result`: `pass | fail`.

### `repair-tasks/<repair-id>.json`

```json
{
  "id": "repair-id",
  "targetType": "plot_unit",
  "targetId": "unit-id",
  "createdFromReviewId": "review-id",
  "reason": "不符合要求的原因",
  "scope": "unit",
  "intensity": "medium",
  "instructions": "具体修复要求",
  "status": "open",
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

Allowed `targetType`: `plot_unit | draft | character | scene | timeline | requirements | story_bible | global_elements`.
Allowed `scope`: `local_text | unit | forward_units | global_plan`.
Allowed `intensity`: `light | medium | strong`.
Allowed `status`: `open | in_progress | completed | cancelled`.

### `generation-runs/<run-id>.json`

```json
{
  "id": "run-id",
  "plotUnitId": "unit-id",
  "status": "succeeded",
  "agent": "novel-producer",
  "model": "opencode-session-model",
  "promptSnapshot": {
    "requirements": {},
    "productionControls": {},
    "storyBible": {},
    "plan": {},
    "previousApprovedUnits": [],
    "currentUnit": {},
    "prototypes": [],
    "elementPools": [],
    "repairTask": null,
    "templateVersion": "novel-production-v1"
  },
  "outputPath": "drafts/unit-id.md",
  "errorMessage": "",
  "createdAt": "2026-05-16T00:00:00.000Z",
  "updatedAt": "2026-05-16T00:00:00.000Z"
}
```

Allowed `status`: `pending | running | succeeded | failed`.

## Production Flows

### Flow 1: Intake

`/novel-intake` captures the production order. If the user's request is vague, the agent asks only high-impact questions: genre, target reader, style, length, required content, forbidden content, and whether reference materials should be used.

Output: `requirements.json` and initial `production-controls.json`.

### Flow 2: Planning

`/novel-plan` turns requirements into a production plan.

Main-sub route: `novel-producer` validates intake completeness, then asks `novel-planner` to draft the story bible, plan, and units. `novel-producer` accepts the plan only after checking that units can be generated sequentially and each unit has a clear production purpose.

Output:

- `story-bible.json`
- `plan.json`
- `plot-units.json`
- optional `prototypes.json` and `element-pools.json`

Planning must produce enough units for ordered text generation. It should not overbuild a reusable material library unless that directly improves the current manuscript.

### Flow 3: Unit Production

`/novel-produce` generates one production unit by default.

Main-sub route: `novel-producer` builds the prompt snapshot and asks `novel-continuity` for current constraints when prior approved units exist. It then asks `novel-drafter` to write the unit. `novel-producer` writes state only after the draft and metadata are complete.

The prompt snapshot includes:

- original requirements;
- production controls;
- story bible;
- current plan;
- previous approved units;
- current unit purpose and constraints;
- relevant prototypes and element pools;
- active repair task when repairing.

On success, write `drafts/<unit-id>.md`, write a generation run, and move the unit to `drafted` or `reviewing` depending on review mode.

On failure, write a failed generation run, preserve previous draft content, and return the unit to `ready_to_produce`.

### Flow 4: Review Gate

`/novel-review` evaluates one unit against the requirements and the unit's purpose.

Main-sub route: `novel-producer` asks `novel-reviewer` for a structured review. When continuity risks are present, it also asks `novel-continuity` for a focused contradiction check. The main agent records the final review decision.

Pass:

- write a review record;
- mark the unit `approved`;
- allow the next sequential unit to be produced.

Fail:

- write a review record with concrete issues;
- mark the unit `rejected`;
- create or request a repair task before further production.

### Flow 5: Repair Station

`/novel-repair` applies a repair task.

Main-sub route: `novel-producer` validates the repair task, asks `novel-repairer` to revise the target, and may ask `novel-continuity` to verify the repair when scope is `forward_units` or `global_plan`.

Repair must state:

- target;
- reason;
- scope;
- intensity;
- instructions.

Light repair changes local wording or continuity. Medium repair may rewrite the current unit. Strong repair may update forward units or plan-level context, but approved prior units remain locked unless the user explicitly allows touching them.

After repair, the unit returns to `drafted` or `reviewing` and must pass review before the next unit proceeds.

### Flow 6: Export

`/novel-export` reads approved units in `orderIndex` order and writes `exports/manuscript.md`. It should also write or update `reports/production-report.md` with skipped units, rejected units, active repair tasks, and next recommended actions.

Main-sub route: `novel-producer` asks `novel-exporter` to assemble the manuscript and report, then verifies that only approved units were included.

## Main-Sub Agent Routing Rules

- Commands enter through `novel-producer` by default.
- `novel-producer` may ask one or more subagents for focused outputs.
- Subagents do not own global state transitions.
- Subagents must return structured results with assumptions, files affected, and any blockers.
- If a subagent finds a missing requirement, it reports the gap to `novel-producer`; the main agent decides whether to ask the user.
- If subagents disagree, `novel-producer` records the conflict in `reports/production-report.md` or routes the unit to repair.
- No subagent may unlock approved units unless the user explicitly authorizes a strong repair affecting locked content.

## Business Constraints

- The production line should optimize for final prose quality, not feature breadth.
- No next sequential unit should be produced while the current unit is rejected or repair-requested.
- Approved units are locked by default.
- Repairs must be traceable.
- Requirements outrank prototypes and agent creativity.
- Every generated unit must have a prompt snapshot.
- Every failed unit must remain retryable.
- Reference text ingestion must never silently copy source text into output; it extracts requirements, patterns, or reusable notes.
- The system should generate by plot unit, scene, or chapter segment, not by uncontrolled whole-manuscript generation.

## Error Handling

- Missing `.novel-production/`: ask the user to run `/novel-init` or initialize if enough input is present.
- Missing requirements: block planning and ask for the smallest missing high-impact input.
- Invalid JSON: stop before writing new state, report the broken file, and preserve existing contents.
- Duplicate `orderIndex`: reject the write unless the command explicitly requested insertion and renumbering.
- Missing bindings: report the missing IDs and block production for affected units.
- Generation failure: record a failed generation run, preserve any existing draft, and keep the unit retryable.
- Review failure: create a review record and route into repair, not deletion.
- Export with no approved units: do not write a manuscript; report why.

Writes should be atomic where practical: write to a temporary file, then rename into place.

## Testing Strategy

Use TDD for the rewrite. Tests should prove the production line works without external AI calls.

Required tests:

- Workspace initialization creates the expected `.novel-production/` directories and files.
- Intake writes valid requirements and production controls.
- Planning writes a story bible and ordered plot units.
- Main agent routing maps each command to the correct production subagent contract.
- Status transitions reject invalid moves.
- Sequential production blocks the next unit until the current unit is approved.
- Prompt snapshots include requirements, bible, prior approved units, current unit, and repair task when present.
- Fake generation writes draft Markdown and generation run metadata.
- Failed generation records an error and leaves the unit retryable.
- Review pass approves a unit.
- Review fail creates or requires a repair task.
- Repair preserves traceability and returns the unit to a reviewable state.
- Export concatenates only approved drafts in order.
- Command templates point at `novel-producer` and do not duplicate stale business rules.

Browser e2e tests should be removed or replaced with command/workflow smoke tests after the web runtime is decommissioned.

## Migration and Decommissioning

The existing Next.js/SQLite workbench is now reference material, not the target runtime.

Reusable ideas:

- Domain status rules.
- Prompt snapshot structure.
- AI generation audit concept.
- Plot node binding concept.
- Existing tests that express business behavior.

Likely removed or replaced:

- `src/app/*` pages.
- React components.
- Next.js server actions.
- Playwright browser tests.
- SQLite repositories as primary store.
- API settings page and stored API keys.

Implementation should remove or archive the web surface only after the file-backed production line passes its core tests.

## File Ownership Map V1

### Agent and Command Surface

- `.opencode/agents/novel-producer.md`
- `.opencode/agents/novel-planner.md`
- `.opencode/agents/novel-drafter.md`
- `.opencode/agents/novel-reviewer.md`
- `.opencode/agents/novel-repairer.md`
- `.opencode/agents/novel-continuity.md`
- `.opencode/agents/novel-exporter.md`
- `.opencode/commands/novel-init.md`
- `.opencode/commands/novel-intake.md`
- `.opencode/commands/novel-plan.md`
- `.opencode/commands/novel-produce.md`
- `.opencode/commands/novel-review.md`
- `.opencode/commands/novel-repair.md`
- `.opencode/commands/novel-export.md`
- `.opencode/commands/novel-status.md`

### Plugin Helper Surface

- `.opencode/plugins/novel-production.ts`
- Any plugin-specific package/config files needed by OpenCode.

### Production Core Library

Suggested files:

- `src/novel-production/schema.ts`
- `src/novel-production/workspace.ts`
- `src/novel-production/repository.ts`
- `src/novel-production/intake.ts`
- `src/novel-production/planning.ts`
- `src/novel-production/prompt.ts`
- `src/novel-production/generation.ts`
- `src/novel-production/review.ts`
- `src/novel-production/repair.ts`
- `src/novel-production/export.ts`
- `src/novel-production/status.ts`

### Tests

- `tests/novel-production/*.test.ts`
- Existing domain tests that remain applicable after porting.

### Deprecated Web Surface

Candidate removal or archival:

- `src/app/*`
- `src/components/*`
- `e2e/*`
- `playwright.config.ts`
- Next.js and React dependencies in `package.json`

## Implementation Phases

### Phase 1: Built-In Novel Production Line

Create the project-local OpenCode agent, commands, `.novel-production/` schema, and file-backed production tests. The user should be able to run a novel from requirements to exported manuscript inside this project without publishing a plugin.

### Phase 2: Local Plugin Helper

Add `.opencode/plugins/novel-production.ts` for supported helper tools such as validation and status reporting. Keep the core pipeline understandable from files and commands.

### Phase 3: Reusable Plugin Package

Package the agent, commands, and helper plugin for reuse. Because official plugin APIs do not directly register agents or commands, packaging should install or synchronize markdown assets into the consumer project's `.opencode` directory.

## Acceptance Criteria

- No browser or local web server is required.
- A fresh project can initialize the production workspace.
- User requirements can be captured and turned into a production plan.
- Main-sub agent routing is represented in `.opencode/agents` and command prompts.
- The pipeline can produce at least one Chinese novel unit from requirements.
- Review can approve or reject the unit with traceable reasons.
- Repair can revise rejected output and return it to review.
- Export assembles approved units into a manuscript Markdown file.
- Tests pass without external AI calls.
- The design stays compatible with OpenCode's documented agent, command, and plugin surfaces.
