# Plan Character Instantiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/novel-plan` instantiate all structurally important characters in `story-bible.json` and bind them to relevant plot units.

**Architecture:** Reuse the existing `StoryBibleCharacter` schema instead of adding new fields. Extend `createProductionPlan()` input so planning can receive fully defined major characters and per-unit character bindings, then validate that every binding references a defined character. Update command and planner instructions so the agent must design major roles during planning rather than leaving vague placeholders.

**Tech Stack:** TypeScript, Vitest, OpenCode markdown command/agent assets.

---

### Task 1: Planning Contract Tests

**Files:**
- Modify: `tests/novel-production/intake-planning.test.ts`
- Modify later: `src/novel-production/planning.ts`

- [ ] **Step 1: Write a failing test that saves major characters into the story bible**

Add this test inside `describe("intake and planning", () => { ... })`:

```ts
  test("instantiates structurally important characters during planning", async () => {
    const repo = createNovelProductionRepository(root);
    const requirements = await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "主角收到废弃卫星的信息，并遭到企业安保追捕。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      totalWords: 6000,
      unitWords: 2000,
      mustInclude: ["废弃卫星"],
      mustAvoid: [],
    });

    const result = await createProductionPlan(repo, requirements, {
      logline: "主角追查废弃卫星来信背后的真相。",
      premise: "一条来自废弃卫星的深夜信息打破主角生活。",
      world: "近未来低轨通信网络衰败后的城市。",
      characters: [
        {
          id: "char-protagonist",
          name: "林砚",
          role: "主角；收到废弃卫星来信的工程师",
          appearance: "长期熬夜的瘦高青年，常穿旧工程外套。",
          personality: "谨慎、压抑、对异常信号有近乎偏执的好奇。",
          motivation: "查明废弃卫星为何知道自己的隐私。",
          arc: "从逃避风险的工程师变成主动追查真相的人。",
        },
        {
          id: "char-security-chief",
          name: "周岚",
          role: "关键阻碍者；企业安保负责人",
          appearance: "短发、黑色制服、义眼会记录环境数据。",
          personality: "冷静、控制欲强、习惯用流程压迫他人。",
          motivation: "追回卫星信号暴露的企业机密。",
          arc: "从执行命令的追捕者变成发现自己也被系统利用的人。",
        },
      ],
      unitSummaries: ["收到信息", "遭到追捕", "发现真相"],
      unitCharacterIds: [
        ["char-protagonist"],
        ["char-protagonist", "char-security-chief"],
        ["char-protagonist", "char-security-chief"],
      ],
    });

    expect(result.storyBible.characters).toHaveLength(2);
    expect(result.storyBible.characters[0]).toMatchObject({ id: "char-protagonist", name: "林砚" });
    expect(result.units[0]?.bindings.characterIds).toEqual(["char-protagonist"]);
    expect(result.units[1]?.bindings.characterIds).toEqual(["char-protagonist", "char-security-chief"]);
    await expect(repo.loadStoryBible()).resolves.toMatchObject({
      characters: expect.arrayContaining([expect.objectContaining({ id: "char-security-chief", name: "周岚" })]),
    });
  });
```

- [ ] **Step 2: Run the test and verify it fails for the expected reason**

Run:

```bash
npm test -- tests/novel-production/intake-planning.test.ts -t "instantiates structurally important characters"
```

Expected: FAIL because `ProductionPlanInput` does not accept `characters` / `unitCharacterIds`, or because current implementation ignores them.

- [ ] **Step 3: Write a failing test that rejects unknown character bindings**

Add this test in the same describe block:

```ts
  test("rejects plot unit character bindings that do not reference planned characters", async () => {
    const repo = createNovelProductionRepository(root);
    const requirements = await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "主角收到废弃卫星的信息。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      totalWords: 6000,
      unitWords: 2000,
      mustInclude: ["废弃卫星"],
      mustAvoid: [],
    });

    await expect(
      createProductionPlan(repo, requirements, {
        logline: "主角追查废弃卫星来信。",
        premise: "一条异常信息打破生活。",
        world: "近未来城市。",
        characters: [
          {
            id: "char-protagonist",
            name: "林砚",
            role: "主角",
            appearance: "瘦高青年。",
            personality: "谨慎。",
            motivation: "查明真相。",
            arc: "从逃避到追查。",
          },
        ],
        unitSummaries: ["收到信息"],
        unitCharacterIds: [["char-missing"]],
      }),
    ).rejects.toThrow(/unknown character id/i);
  });
```

- [ ] **Step 4: Run the rejection test and verify it fails for the expected reason**

Run:

```bash
npm test -- tests/novel-production/intake-planning.test.ts -t "rejects plot unit character bindings"
```

Expected: FAIL because current implementation does not validate character binding references.

### Task 2: Planning Implementation

**Files:**
- Modify: `src/novel-production/planning.ts`
- Test: `tests/novel-production/intake-planning.test.ts`

- [ ] **Step 1: Extend the planning input type**

Update imports and `ProductionPlanInput`:

```ts
import type {
  IsoTimestamp,
  NovelRequirements,
  PlotUnitRecord,
  ProductionPlan,
  StoryBible,
  StoryBibleCharacter,
} from "./schema";

export type ProductionPlanInput = {
  logline: string;
  premise: string;
  world: string;
  structure?: string;
  characters?: StoryBibleCharacter[];
  unitSummaries: string[];
  unitCharacterIds?: string[][];
};
```

- [ ] **Step 2: Use planned characters in the story bible**

In `createProductionPlan()`, set:

```ts
  const characters = input.characters ?? [];
```

Then use:

```ts
    characters,
```

instead of `characters: []`.

- [ ] **Step 3: Validate per-unit character bindings**

Add a small helper near the bottom of `planning.ts`:

```ts
function getUnitCharacterIds(input: ProductionPlanInput, index: number, characterIds: Set<string>): string[] {
  const unitCharacterIds = input.unitCharacterIds?.[index] ?? [];

  for (const characterId of unitCharacterIds) {
    if (!characterIds.has(characterId)) {
      throw new Error(`Unknown character id in plot unit binding: ${characterId}`);
    }
  }

  return unitCharacterIds;
}
```

Before mapping units:

```ts
  const characterIds = new Set(characters.map((character) => character.id));
```

Inside `bindings`, change:

```ts
        characterIds: getUnitCharacterIds(input, index, characterIds),
```

- [ ] **Step 4: Run targeted planning tests**

Run:

```bash
npm test -- tests/novel-production/intake-planning.test.ts
```

Expected: PASS.

### Task 3: Prompt Character Visibility

**Files:**
- Modify: `tests/novel-production/prompt-generation.test.ts`
- Modify: `src/novel-production/prompt.ts`

- [ ] **Step 1: Write a failing prompt rendering test for story-bible characters**

In `tests/novel-production/prompt-generation.test.ts`, update or add a test that creates a plan with `characters` and `unitCharacterIds`, then asserts `renderProductionPrompt(snapshot)` includes the character name, role, motivation, and arc.

Example assertion block:

```ts
    expect(prompt).toContain("# 主要角色");
    expect(prompt).toContain("林砚");
    expect(prompt).toContain("主角");
    expect(prompt).toContain("查明真相");
    expect(prompt).toContain("从逃避到追查");
```

- [ ] **Step 2: Run the prompt test and verify it fails for missing rendered character section**

Run:

```bash
npm test -- tests/novel-production/prompt-generation.test.ts -t "prompt snapshot"
```

Expected: FAIL because the rendered prompt does not include a dedicated major-character section.

- [ ] **Step 3: Render story bible characters in prompts**

In `src/novel-production/prompt.ts`, update `renderProductionPrompt()` so the returned text includes a character section after the story bible/world section:

```ts
const characterLines = snapshot.storyBible.characters.map((character) =>
  `- ${character.name}（${character.role}）：外貌：${character.appearance}；性格：${character.personality}；动机：${character.motivation}；弧线：${character.arc}`,
);
```

Include:

```ts
`# 主要角色\n${characterLines.length === 0 ? "无" : characterLines.join("\n")}`,
```

Do not change prompt behavior beyond making planned characters visible to drafting.

- [ ] **Step 4: Run prompt tests**

Run:

```bash
npm test -- tests/novel-production/prompt-generation.test.ts
```

Expected: PASS.

### Task 4: Command and Planner Instructions

**Files:**
- Modify: `.opencode/agents/novel-planner.md`
- Modify: `.opencode/commands/novel-plan.md`
- Modify: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing asset tests for character-instantiation instructions**

In `tests/novel-production/opencode-assets.test.ts`, add a test:

```ts
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
```

- [ ] **Step 2: Run the asset test and verify it fails**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts -t "major character instantiation"
```

Expected: FAIL because command/agent docs do not contain these requirements yet.

- [ ] **Step 3: Update `/novel-plan` command instructions**

In `.opencode/commands/novel-plan.md`, add required behavior bullets:

```md
- Identify all structurally important major characters before finalizing the plan.
- Write those major characters to `story-bible.json.characters` with stable ids, names, roles, appearances, personalities, motivations, and arcs.
- Bind relevant plot units to those characters through `bindings.characterIds`.
- Do not leave placeholder characters such as "某反派", "某盟友", or unnamed mystery roles when the story framework depends on them.
```

- [ ] **Step 4: Update `novel-planner` agent instructions**

In `.opencode/agents/novel-planner.md`, add responsibilities:

```md
- Instantiate all structurally important major characters during planning: protagonist, opponent, key allies, key blockers, organization representatives, and holders or embodiments of crucial technology, information, or secrets.
- Save each major character in `story-bible.json.characters` with id, name, role, appearance, personality, motivation, and arc.
- Bind every plot unit that depends on a major character through `bindings.characterIds`.
- Do not leave placeholder characters; if a real name is unavailable, create a stable Chinese name or codename.
- Ask the smallest necessary clarification before planning if the core cast cannot be determined from requirements.
```

- [ ] **Step 5: Run asset tests**

Run:

```bash
npm test -- tests/novel-production/opencode-assets.test.ts
```

Expected: PASS.

### Task 5: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run related tests**

Run:

```bash
npm test -- tests/novel-production/intake-planning.test.ts tests/novel-production/prompt-generation.test.ts tests/novel-production/opencode-assets.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run LSP diagnostics if available**

Run diagnostics on:

```text
src/novel-production/planning.ts
src/novel-production/prompt.ts
tests/novel-production/intake-planning.test.ts
tests/novel-production/prompt-generation.test.ts
tests/novel-production/opencode-assets.test.ts
```

Expected: No diagnostics. If `typescript-language-server` is missing, report that diagnostics could not run and rely on `npm run typecheck`.

- [ ] **Step 5: Report deployment note**

If command/agent assets changed, tell the user they need to reinstall assets and restart OpenCode for global runtime use:

```bash
npm run install:opencode-novel -- --target "/Users/schelling/.config/opencode" --write
```
