---
name: opencode-project-kickoff-orchestration
description: Use when starting a complex software project in OpenCode that needs go-no-go evaluation, MVP trimming, shared contract freezing, and safe parallel execution across multiple conversations.
---

# OpenCode Project Kickoff Orchestration

## Overview

这个 skill 用于把“复杂项目从设计阶段推进到可开工阶段”。

核心原则：

1. 一个总控对话负责范围、契约、集成。
2. 只把高影响问题推给负责人，低影响问题自己收敛。
3. 先冻结 MVP 和共享契约，再并行拆分。
4. 按工作包拆分，不按纯技术层机械拆分。

## When to Use

适用于：

1. 项目已经有多轮概念设计，需要判断“现在能不能开始”。
2. 项目复杂，准备开启多个 OpenCode 新对话并行推进。
3. 需要避免多个对话互相踩范围、踩文件、踩契约。
4. 负责人希望只回答重要问题，不想被低价值提问打断。
5. 需要把“规划 / 契约 / 对话拆分 / 汇总验收”组织成标准流程。

不适用于：

1. 单文件小改动。
2. 单会话就能完成的简单任务。
3. 不需要并行拆分、不需要契约冻结的短任务。

## Core Pattern

### 1. 先做开工判断

先输出：

1. 上一轮审查结果。
2. 当前是否具备开工条件。
3. `Go / Conditional Go / No-Go` 结论。
4. 当前最小可启动范围。

没有这一步，不要急着拆工作包。

### 2. 只问高影响问题

只有满足下列任一条件的问题，才值得推给负责人：

1. 会改变第一阶段范围。
2. 会改变架构主方向。
3. 会改变工作流边界。
4. 会改变共享契约。
5. 会改变交付形态。
6. 会改变自动化与人工分工边界。

其余问题默认自己收敛。

### 3. 先做 MVP 裁剪

必须把内容分成四类：

1. MVP 必做
2. MVP 可选
3. 后续版本
4. 暂不实现

如果这一层不清晰，就不要并行拆对话。

### 4. 冻结共享契约

并行前先产出 `Shared Contract Freeze V1`，至少冻结：

1. 核心对象最小字段集。
2. 关键状态枚举。
3. 第一阶段数据库边界。
4. API 风格与命名。
5. Context Package 顶层结构。
6. `prompt_snapshot` 保存结构。
7. 高影响事件推送格式。

任何子对话不得静默修改这些内容。

### 5. 冻结文件归属

并行前先产出 `File Ownership Map V1`。每个工作包都必须知道：

1. 自己主导哪些文件。
2. 哪些文件只能读不能抢写。
3. 哪些共享文件需要总控协调接入。

## Recommended Conversation Structure

### 总控对话职责

总控对话负责：

1. 审查上一轮设计。
2. 输出开工判断。
3. 提问关键问题。
4. 产出 MVP 裁剪表。
5. 产出共享契约冻结。
6. 产出文件归属表。
7. 产出各工作包启动 prompt。
8. 接收各工作包回传。
9. 处理契约冲突。
10. 决定下一批工作包何时启动。

### 子对话职责

每个子对话只负责一个工作包：

1. 只处理自己的边界。
2. 不重定义全局架构。
3. 不扩张第一阶段范围。
4. 发现共享契约问题时输出 `CONTRACT CHANGE REQUEST`。
5. 按统一格式回传。

## Work Package Splitting Rule

优先按“可独立推进的工作包”拆，而不是按纯技术层机械拆。

推荐拆法：

1. `A：工程骨架与运行底座`
2. `B：核心领域模型与主工作流后端`
3. `C：上下文系统与 Prompt 系统`
4. `D：最小 Web 工作台`
5. `E：连续性控制与修理影响分析`

推荐启动顺序：

1. 先启动 A。
2. 再启动 B 和 C。
3. B 稳定后启动 D。
4. B/C 稳定后启动 E。

## Shared Master Text Template

每个子对话都应先读取同一份共享主文本。共享主文本至少说明：

1. 项目定位。
2. 第一阶段冻结目标。
3. 第一阶段不要提前做重的内容。
4. 当前已冻结的核心决策。
5. 当前共享契约边界。
6. 当前工作包职责。
7. 回传格式要求。

## CONTRACT CHANGE REQUEST

如果子对话认为必须修改共享契约，必须输出：

```text
CONTRACT CHANGE REQUEST
1. Current contract
2. Proposed change
3. Reason
4. Affected work packages
5. Blocking or non-blocking
6. Suggested migration path
```

没有 CCR，就默认不能改共享契约。

## Standard Return Format

每个子对话统一回传：

```text
【工作包名称】
1. 已完成内容
2. 涉及文件
3. 新增/变更 API
4. 新增/变更数据结构
5. 新增/变更异步任务
6. 测试/验证方式
7. Blockers
8. CONTRACT CHANGE REQUEST（如无则写无）
9. 建议下一步
```

## High-Impact Question Gate

默认只向负责人推送这类问题：

1. 范围是否扩大或缩小。
2. 架构主方案如何选。
3. 自动化边界如何定。
4. 修理传播是否需要负责人确认。
5. 交付形态是后端优先还是前后端同时推进。
6. 是否允许更改共享契约。
7. 是否开始下一批工作包。

不要向负责人推送：

1. 低影响命名问题。
2. 轻微字段排序问题。
3. 小的 UI 文案问题。
4. 能通过现有原则自行收敛的问题。

## Common Mistakes

1. 还没做 MVP 裁剪就开多个对话。
2. 没冻结契约就让多个对话同时设计核心对象。
3. 工作包拆得太技术化，导致所有人都要改同一批文件。
4. 子对话静默修改共享结构。
5. 把不重要的问题不断推给负责人。
6. 把总控对话变成纯转发器，而不是裁决者。

## Ready-to-Start Checklist

- [ ] 已有明确的 `Go / Conditional Go / No-Go` 结论。
- [ ] 已有 MVP 裁剪表。
- [ ] 已有 `Shared Contract Freeze V1`。
- [ ] 已有 `File Ownership Map V1`。
- [ ] 已有首批工作包列表。
- [ ] 已有每个工作包的启动 prompt。
- [ ] 已定义统一回传格式。
- [ ] 已定义哪些问题才需要负责人选择。
