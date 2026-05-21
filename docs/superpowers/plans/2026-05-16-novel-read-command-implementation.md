# Novel Read Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/novel-read <unitId> [--offset N] [--limit N]` so users can preview draft markdown from `.novel-production/drafts/` in paged CLI output.

**Architecture:** Implement a small pure reader module that resolves safe unit IDs, slices draft text by character offset/limit, and renders a continuation hint when truncated. Add an OpenCode command asset routed through `novel-producer`, include it in deployment assets, and cover both reader behavior and asset presence with Vitest.

**Tech Stack:** TypeScript, Node fs/path APIs, OpenCode command markdown assets, Vitest.

---

### Task 1: Reader Module

**Files:**
- Create: `src/novel-production/reader.ts`
- Test: `tests/novel-production/reader.test.ts`

- [ ] **Step 1: Write failing tests**

Test behaviors:
- Reads `.novel-production/drafts/ch03.md` by unit id.
- Returns first page with `nextOffset` when content exceeds limit.
- Returns end marker when page reaches the end.
- Rejects unsafe unit ids such as `../escape`, `nested/unit`, empty string, or `unit.1`.
- Reports a helpful missing-draft error.

- [ ] **Step 2: Run red test**

Run: `npm test -- tests/novel-production/reader.test.ts`
Expected: fail because `@/novel-production/reader` does not exist.

- [ ] **Step 3: Implement minimal reader**

Create:

```ts
export type DraftPreview = {
  unitId: string;
  draftPath: string;
  offset: number;
  limit: number;
  totalCharacters: number;
  text: string;
  nextOffset: number | null;
};

export async function readDraftPreview(root: string, unitId: string, options?: { offset?: number; limit?: number }): Promise<DraftPreview>;

export function renderDraftPreviewMarkdown(preview: DraftPreview): string;
```

- [ ] **Step 4: Run green test**

Run: `npm test -- tests/novel-production/reader.test.ts`
Expected: pass.

### Task 2: OpenCode Command Asset

**Files:**
- Create: `.opencode/commands/novel-read.md`
- Modify: `src/novel-production/deployment.ts`
- Modify: `tests/novel-production/opencode-assets.test.ts`

- [ ] **Step 1: Write failing asset test**

Add `novel-read` to the command asset list. Assert command content mentions `unitId`, `--offset`, `--limit`, `.novel-production/drafts/`, and continuation hint behavior.

- [ ] **Step 2: Run red asset test**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`
Expected: fail because `.opencode/commands/novel-read.md` does not exist or deployment assets omit it.

- [ ] **Step 3: Add command asset and deployment path**

Command frontmatter:

```md
---
description: Preview a drafted novel unit in paged CLI output.
agent: novel-producer
---
<!-- managed-by: opencode-novel-production-line -->
```

Required behavior:
- Parse `<unitId>` and optional `--offset N`, `--limit N`.
- Read `.novel-production/drafts/<unitId>.md`.
- Default `limit` to 4000 characters and `offset` to 0.
- Print continuation command when truncated.
- Do not modify production state.

- [ ] **Step 4: Run green asset test**

Run: `npm test -- tests/novel-production/opencode-assets.test.ts`
Expected: pass.

### Task 3: Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- tests/novel-production/reader.test.ts tests/novel-production/opencode-assets.test.ts`
Expected: pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: pass.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: pass.

- [ ] **Step 4: Run LSP diagnostics if available**

Run diagnostics on `src/novel-production/reader.ts`, `src/novel-production/deployment.ts`, and touched tests. If TypeScript LSP is unavailable, report that and rely on `npm run typecheck`.
