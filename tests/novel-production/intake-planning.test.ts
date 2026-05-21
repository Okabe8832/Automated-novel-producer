import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { captureRequirements } from "@/novel-production/intake";
import { replaceManagedBlock } from "@/novel-production/prompt-settings";
import { createNovelProductionRepository } from "@/novel-production/repository";
import { createNovelBranch, createActiveBranchNovelProductionRepository } from "@/novel-production/branches";
import { createProductionPlan } from "@/novel-production/planning";
import { initializeNovelProductionWorkspace } from "@/novel-production/workspace";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novel-production-"));
  await initializeNovelProductionWorkspace(root);
  await createNovelProductionRepository(root).writePrompt("默认 workspace prompt");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("intake and planning", () => {
  test("replaces managed prompt blocks without changing surrounding text", () => {
    const appended = replaceManagedBlock("base prompt", "novel-intake", "新需求摘要");

    expect(appended).toContain("base prompt");
    expect(appended).toContain("<!-- novel-intake:start -->");
    expect(appended).toContain("新需求摘要");
    expect(appended).toContain("<!-- novel-intake:end -->");

    const replaced = replaceManagedBlock(appended, "novel-intake", "更新后的需求摘要");

    expect(replaced).toContain("base prompt");
    expect(replaced).toContain("更新后的需求摘要");
    expect(replaced).not.toContain("新需求摘要");
  });

  test("captures requirements from a production brief", async () => {
    const repo = createNovelProductionRepository(root);

    const requirements = await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "写一部长篇科幻悬疑小说，主角收到废弃卫星的信息。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻、克制",
      pointOfView: "第三人称",
      totalWords: 80000,
      unitWords: 2000,
      mustInclude: ["废弃卫星"],
      mustAvoid: ["英文正文"],
    });

    expect(requirements.language).toBe("zh-CN");
    await expect(repo.loadRequirements()).resolves.toMatchObject({
      genre: "科幻悬疑",
      language: "zh-CN",
      qualityBar: expect.arrayContaining(["符合用户要求", "中文表达自然"]),
    });
  });

  test("captures requirements into the branch-local prompt clone", async () => {
    await mkdir(join(root, "prompt settings"), { recursive: true });
    await writeFile(join(root, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "默认 prompt", "utf8");
    await createNovelBranch(root, "branch02");
    const repo = await createActiveBranchNovelProductionRepository(root);

    await captureRequirements(repo, {
      title: "废弃卫星来信",
      originalBrief: "主角收到废弃卫星的信息。",
      genre: "科幻悬疑",
      targetAudience: "成人读者",
      style: "冷峻",
      pointOfView: "第三人称",
      totalWords: 6000,
      unitWords: 2000,
      mustInclude: ["废弃卫星"],
      mustAvoid: ["英文正文"],
    });

    await expect(repo.readPrompt()).resolves.toContain("<!-- novel-intake:start -->");
    await expect(repo.readPrompt()).resolves.toContain("废弃卫星来信");
    await expect(repo.readPrompt()).resolves.toContain("科幻悬疑");
    await expect(repo.readPrompt()).resolves.toContain("冷峻");
    await expect(repo.readPrompt()).resolves.toContain("第三人称");
    await expect(repo.readPrompt()).resolves.toContain("英文正文");
    await expect(readFile(join(root, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "utf8")).resolves.toBe(
      "默认 prompt",
    );
  });

  test("creates a sequential plan from requirements", async () => {
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

    const result = await createProductionPlan(repo, requirements, {
      logline: "主角追查废弃卫星来信背后的真相。",
      premise: "一条来自废弃卫星的深夜信息打破主角生活。",
      world: "近未来低轨通信网络衰败后的城市。",
      unitSummaries: ["收到信息", "追查来源", "发现真相"],
    });

    expect(result.units).toHaveLength(3);
    expect(result.units[0]?.status).toBe("ready_to_produce");
    expect(result.units[1]?.status).toBe("planned");
    expect(result.units[2]?.status).toBe("planned");
    expect(result.units[0]?.targetWords).toBe(2000);
  });

  test("writes planning summary into the branch-local prompt clone", async () => {
    await mkdir(join(root, "prompt settings"), { recursive: true });
    await writeFile(join(root, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "默认 prompt", "utf8");
    await createNovelBranch(root, "branch02");
    const repo = await createActiveBranchNovelProductionRepository(root);
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

    await createProductionPlan(repo, requirements, {
      logline: "主角追查废弃卫星来信背后的真相。",
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
      unitSummaries: ["收到信息", "追查来源"],
    });

    const branchPrompt = await repo.readPrompt();
    expect(branchPrompt).toContain("<!-- novel-plan:start -->");
    expect(branchPrompt).toContain("主角追查废弃卫星来信背后的真相。");
    expect(branchPrompt).toContain("一条异常信息打破生活。");
    expect(branchPrompt).toContain("近未来城市。");
    expect(branchPrompt).toContain("林砚");
    expect(branchPrompt).toContain("收到信息");
    await expect(readFile(join(root, "prompt settings", "novel_ai_language_prompt_v1_3.md"), "utf8")).resolves.toBe(
      "默认 prompt",
    );
  });

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
});
