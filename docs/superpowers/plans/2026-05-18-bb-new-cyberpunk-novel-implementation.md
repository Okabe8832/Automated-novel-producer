# BB New Cyberpunk Novel Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize the approved BB branch cyberpunk novel design into branch-local novel production metadata files.

**Architecture:** This is a metadata-only planning update for the active `BB` novel branch. It replaces placeholder branch-local JSON files with Chinese-first requirements, story bible, production plan, and 12 ordered plot units while leaving prose artifacts untouched.

**Tech Stack:** JSON metadata files under `.novel-production/branches/BB/`; validation with file reads and `novel_branch_status` where applicable.

---

## File Structure

- Modify: `.novel-production/branches/BB/requirements.json` — branch-local user requirements.
- Modify: `.novel-production/branches/BB/story-bible.json` — branch-local world, characters, themes, scenes, timeline, and continuity rules.
- Modify: `.novel-production/branches/BB/plan.json` — branch-local first-volume production plan.
- Modify: `.novel-production/branches/BB/plot-units.json` — branch-local ordered `ch01`–`ch12` plot units.
- Do not modify: root `.novel-production/requirements.json`, `.novel-production/story-bible.json`, `.novel-production/production-plan.json`, `.novel-production/plot-units.json`.
- Do not read or modify: draft prose, review prose, repair contents, generation run details, report bodies, manuscript exports.

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-18-bb-new-cyberpunk-novel-design.md`
- Active branch pointer: `.novel-production/active-branch.json`
- Branch registry: `.novel-production/branches.json`

## Task 1: Verify active branch and placeholders

**Files:**
- Read: `.novel-production/active-branch.json`
- Read: `.novel-production/branches.json`
- Read: `.novel-production/branches/BB/requirements.json`
- Read: `.novel-production/branches/BB/story-bible.json`
- Read: `.novel-production/branches/BB/plan.json`
- Read: `.novel-production/branches/BB/plot-units.json`

- [ ] **Step 1: Confirm active branch is BB**

Read `.novel-production/active-branch.json`.

Expected: JSON contains `"branchId": "BB"`.

- [ ] **Step 2: Confirm BB is registered**

Read `.novel-production/branches.json`.

Expected: `branches` contains an entry with `"id": "BB"`.

- [ ] **Step 3: Confirm branch files are placeholders**

Read the four branch-local JSON files listed above.

Expected: `requirements.json` has `id: requirements-placeholder`, `story-bible.json` has empty `premise`, `plan.json` has empty `logline`, and `plot-units.json` is `[]`.

## Task 2: Write branch-local requirements

**Files:**
- Modify: `.novel-production/branches/BB/requirements.json`

- [ ] **Step 1: Replace placeholder requirements JSON**

Write this content exactly, updating timestamps only if desired:

```json
{
  "schemaVersion": 1,
  "id": "requirements-BB-2026-05-18",
  "title": "未命名赛博朋克硬盘阴谋卷",
  "originalBrief": "程序员社畜罗伊生活在未来锡南共和国东部沿海的江州东城市群。这个高度老龄化、赛博化的寡头威权社会主义国家中，军事、工业、企业和城市治理已深度一体化。罗伊所在软件公司的一份机密硬盘丢失，董事会命令他找回；他因此卷入多方阴谋。",
  "language": "zh-CN",
  "genre": "科幻 / 冒险 / 赛博朋克",
  "targetAudience": "青年网文读者，节奏和悬念优先",
  "style": "冷峻硬核赛博朋克为主，快节奏商业冒险与反乌托邦社会氛围为辅助",
  "pointOfView": "第三人称限知为主，主要跟随罗伊；可穿插多视角群像；第一人称少见，仅用于特殊文本或片段",
  "lengthTarget": {
    "totalWords": 48000,
    "unitWords": 4000
  },
  "mustInclude": [
    "公司/董事会阴谋",
    "机密硬盘数据真相",
    "黑客潜入与网络战",
    "义体改造、脑机接口",
    "老龄化社会压迫感",
    "军工企业与城市治理一体化",
    "地下反抗组织",
    "企业安保/私兵追杀",
    "逃亡、公路/城市穿越冒险",
    "罗伊从社畜变成关键棋手的成长线"
  ],
  "mustAvoid": [
    "不要魔法/超能力",
    "不要后宫",
    "不要拯救世界过早展开",
    "不要现实国家映射太直白"
  ],
  "referenceNotes": [
    "第一卷按连载做法规划 12 章成一本。",
    "第一卷不推进完整故事线，只完成阶段性卷目标并保留后续悬念。",
    "采用硬核阴谋冒险卷方向：机密硬盘丢失、罗伊被迫追查、多方势力争夺数据、卷末揭示硬盘只是更大系统的一枚钥匙。"
  ],
  "qualityBar": [
    "中文正文。",
    "每章必须有明确悬念或推进。",
    "技术与制度压迫感要服务冒险线。",
    "赛博技术保持工程逻辑，不引入超自然解释。",
    "现实映射保持虚构化和间接化。"
  ],
  "createdAt": "2026-05-18T00:00:00.000Z",
  "updatedAt": "2026-05-18T00:00:00.000Z"
}
```

- [ ] **Step 2: Validate requirements JSON parses**

Use the Read tool on `.novel-production/branches/BB/requirements.json`.

Expected: file contains non-empty title, genre, targetAudience, style, pointOfView, mustInclude, and mustAvoid.

## Task 3: Write branch-local story bible

**Files:**
- Modify: `.novel-production/branches/BB/story-bible.json`

- [ ] **Step 1: Replace placeholder story bible JSON**

Write this content:

```json
{
  "schemaVersion": 1,
  "premise": "在未来锡南共和国东部沿海的江州东城市群，程序员社畜罗伊被董事会命令找回一块丢失的机密硬盘，却发现硬盘牵连公司、企业私兵、地下反抗组织和城市治理系统的多方阴谋。",
  "world": "锡南共和国位于锡洲东部，是高度老龄化、赛博化的寡头威权社会主义国家。江州东城市群由军事、工业、企业和城市治理体系深度一体化，沿海港区、军工园区、软件外包楼、义体诊所、退休等级社区和城市控制区共同构成冷峻的赛博朋克社会。",
  "themes": [
    "技术劳动者的工具化",
    "老龄化社会中的身体商品化",
    "企业治理与国家治理边界消失",
    "普通人被推入系统核心后的选择",
    "数据所有权与人的自由意志"
  ],
  "characters": [
    {
      "name": "罗伊",
      "role": "主角；软件公司程序员社畜；机密硬盘追查任务的执行者与替罪羊候选人",
      "arc": "从服从董事会命令的低位技术雇员，成长为能主动设局、理解多方势力逻辑的关键棋手。",
      "voice": "克制、疲惫、技术化思维强；在危机中逐渐变得果断。"
    },
    {
      "name": "董事会代表",
      "role": "公司权力接口；把硬盘丢失包装成内部追责和紧急任务的人",
      "arc": "前期作为罗伊的上级压力源，逐步暴露其并不掌握完整真相。",
      "voice": "官僚化、冷静、以风险和责任转移为核心。"
    },
    {
      "name": "企业安保队长",
      "role": "企业安保/私兵追杀线代表；负责监控、封锁和清除风险人员",
      "arc": "从执行命令的追兵变成揭示军工企业一体化暴力结构的窗口。",
      "voice": "短句、命令式、职业化。"
    },
    {
      "name": "地下反抗组织接触者",
      "role": "引导罗伊看到公司之外的城市真相；同样想得到硬盘",
      "arc": "从不可信的临时盟友，变成迫使罗伊独立判断的镜像人物。",
      "voice": "警惕、讽刺、熟悉城市暗面。"
    },
    {
      "name": "义体/脑机技术关键人物",
      "role": "连接硬盘数据、义体诊所和脑机接口债务系统的技术线人物",
      "arc": "揭示江州东老龄化社会如何通过技术延寿和债务绑定维持秩序。",
      "voice": "专业、冷淡，对人体和数据边界有异样熟悉。"
    }
  ],
  "scenes": [
    "江州东软件公司深夜办公层",
    "董事会远程会议室",
    "公司内网审计机房",
    "沿海工业港区",
    "城市群边缘义体诊所",
    "退休等级社区",
    "地下反抗组织临时据点",
    "城市控制区检查站",
    "军工企业数据中继节点"
  ],
  "timeline": [
    "第一卷开端：机密硬盘丢失，罗伊被董事会命令找回。",
    "第一卷前段：罗伊追踪公司内网日志，发现硬盘丢失不是普通盗窃。",
    "第一卷中段：企业安保、地下反抗组织和第三方技术势力同时介入。",
    "第一卷后段：罗伊被迫逃亡并穿越江州东工业港区、义体诊所和城市控制区。",
    "第一卷结尾：硬盘真相部分揭示，罗伊发现自己是访问更大系统的关键钥匙。"
  ],
  "continuityRules": [
    "不得引入魔法、超能力或超自然解释。",
    "不得发展后宫结构。",
    "第一卷不得过早升级为拯救世界叙事。",
    "现实国家映射必须保持虚构化和间接化。",
    "技术描写应保持工程逻辑：硬盘、脑机接口、义体、网络战和城市监控均应有可追踪机制。",
    "第三人称限知主要跟随罗伊；多视角插段必须服务阴谋推进；第一人称只用于日志、录音、系统片段等特殊文本。",
    "每章必须推进硬盘追查、罗伊处境变化或多方阴谋认知。"
  ],
  "createdAt": "2026-05-18T00:00:00.000Z",
  "updatedAt": "2026-05-18T00:00:00.000Z"
}
```

- [ ] **Step 2: Validate story bible JSON parses**

Use the Read tool on `.novel-production/branches/BB/story-bible.json`.

Expected: file contains non-empty premise, world, themes, characters, scenes, timeline, and continuityRules.

## Task 4: Write branch-local production plan

**Files:**
- Modify: `.novel-production/branches/BB/plan.json`

- [ ] **Step 1: Replace placeholder plan JSON**

Write this content:

```json
{
  "schemaVersion": 1,
  "logline": "在军工企业与城市治理一体化的江州东城市群，程序员罗伊被迫寻找一块丢失的机密硬盘，却在公司、私兵、地下反抗组织和未知技术势力的争夺中成为关键棋手。",
  "structure": "第一卷 12 章，硬核阴谋冒险卷。按顺序生产，每章约 4000 字。第一卷只完成罗伊从社畜到关键棋手的阶段性转变，不解决完整故事线。",
  "acts": [
    {
      "id": "act1",
      "chapters": ["ch01", "ch02", "ch03"],
      "function": "建立江州东赛博社会、罗伊的社畜处境、硬盘丢失事故和董事会压力。"
    },
    {
      "id": "act2",
      "chapters": ["ch04", "ch05", "ch06"],
      "function": "追查升级，企业安保介入，罗伊发现自己可能被当作替罪羊，并第一次接触地下反抗组织。"
    },
    {
      "id": "act3",
      "chapters": ["ch07", "ch08", "ch09"],
      "function": "展开老龄化赛博社会、义体和脑机接口债务系统，罗伊被迫逃亡并初步解密硬盘。"
    },
    {
      "id": "act4",
      "chapters": ["ch10", "ch11", "ch12"],
      "function": "多方势力同时逼近，罗伊主动设局反制追踪，卷末揭示硬盘只是更大系统的一枚钥匙。"
    }
  ],
  "productionNotes": [
    "一次只生产一个章节单元。",
    "默认不得跳过未批准或需修复章节。",
    "每章草稿完成后必须 review；未通过则进入 repair。",
    "第一卷不完整解决幕后阴谋，只形成阶段性转折和后续钩子。",
    "下一可生产单元为 ch01。",
    "不要继承根级旧项目规划。"
  ],
  "createdAt": "2026-05-18T00:00:00.000Z",
  "updatedAt": "2026-05-18T00:00:00.000Z"
}
```

- [ ] **Step 2: Validate plan JSON parses**

Use the Read tool on `.novel-production/branches/BB/plan.json`.

Expected: file contains logline, structure, four acts, and productionNotes.

## Task 5: Write branch-local plot units

**Files:**
- Modify: `.novel-production/branches/BB/plot-units.json`

- [ ] **Step 1: Replace empty plot units array**

Write an array with 12 objects, each using these fields: `id`, `order`, `title`, `status`, `targetWords`, `pov`, `purpose`, `beats`, `continuitySeeds`, `reviewCriteria`.

Use this exact chapter list:

1. `ch01` — `硬盘丢失的深夜`
2. `ch02` — `董事会的追责任务`
3. `ch03` — `不存在的内网日志`
4. `ch04` — `替罪羊协议`
5. `ch05` — `义体诊所的黑门`
6. `ch06` — `地下组织也想要它`
7. `ch07` — `退休等级社区`
8. `ch08` — `穿越工业港区`
9. `ch09` — `硬盘里的城市治理接口`
10. `ch10` — `三方围猎`
11. `ch11` — `罗伊的反追踪脚本`
12. `ch12` — `访问钥匙`

All units must have `"status": "planned"` and `"targetWords": 4000`.

- [ ] **Step 2: Include required content across plot units**

Ensure the 12 plot units collectively include:

- company/board conspiracy
- hard drive truth
- hacking/network war
- cybernetics/brain-computer interfaces
- aging society pressure
- military-industrial enterprise city-governance integration
- underground resistance
- corporate security/private soldiers
- fugitive/city-crossing adventure
- Roy growth arc

- [ ] **Step 3: Validate plot units JSON parses**

Use the Read tool on `.novel-production/branches/BB/plot-units.json`.

Expected: top-level value is an array with 12 objects; all IDs are `ch01` through `ch12`; all statuses are `planned`.

## Task 6: Final metadata validation

**Files:**
- Read: `.novel-production/branches/BB/requirements.json`
- Read: `.novel-production/branches/BB/story-bible.json`
- Read: `.novel-production/branches/BB/plan.json`
- Read: `.novel-production/branches/BB/plot-units.json`

- [ ] **Step 1: Check branch status**

Run direct plugin tool `novel_branch_status` with root `.novel-production/`.

Expected: registered branch `BB` exists and is active. If the tool reports no branches because of current nested workspace behavior, read `.novel-production/active-branch.json` and `.novel-production/branches.json` directly instead.

- [ ] **Step 2: Verify no old-project inherited fields**

Search/read the four branch-local metadata files for accidental inherited names such as `旧项目角色`, `旧项目角色`, `旧项目角色`, or `旧项目`.

Expected: no matches.

- [ ] **Step 3: Verify next action**

Confirm that `plot-units.json` starts with `ch01` planned and no unit is drafted, approved, rejected, or repair-requested.

Expected next action: `/novel-produce ch01`.

- [ ] **Step 4: Report result**

Report counts: total=12, approved=0, drafted=0, rejected=0, repairRequested=0, planned=12. State next eligible unit: `ch01`.
